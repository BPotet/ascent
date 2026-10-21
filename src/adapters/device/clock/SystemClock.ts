import type { WatchedClock } from '../../../application/ports/Clock';
import { Day } from '../../../domain/day/Day';

/**
 * Visibilité de l'application à l'écran. Sur le téléphone, le dev mobile la branche sur `AppState`
 * de React Native (visible = `active`).
 */
export interface AppVisibility {
  isVisible(): boolean;
  /** Appelle `listener` à chaque passage au premier plan (`true`) ou en arrière-plan (`false`). */
  onChange(listener: (visible: boolean) => void): () => void;
}

/** Une application toujours visible, à défaut de mieux. */
export const alwaysVisible: AppVisibility = {
  isVisible: () => true,
  onChange: () => () => undefined,
};

/** Relecture de l'heure quand l'application est visible, pour voir un changement de fuseau. */
export const RECHECK_INTERVAL_MS = 30_000;

/** Une minuterie ne dort jamais plus d'une heure : elle relit l'heure à chaque réveil. */
export const MAX_TIMER_DELAY_MS = 60 * 60 * 1000;

/**
 * Le prochain minuit heure locale après `instant`. Calculé sur le calendrier local, jamais en
 * ajoutant 24 heures : le jour du passage à l'heure d'hiver dure 25 heures, celui de l'heure d'été 23.
 */
export function nextLocalMidnight(instant: Date): Date {
  return new Date(instant.getFullYear(), instant.getMonth(), instant.getDate() + 1);
}

/**
 * Horloge du téléphone : aujourd'hui est la date locale au moment de l'appel.
 * Elle prévient quand aujourd'hui change : à minuit heure locale, au retour au premier plan, et
 * par une relecture toutes les 30 s quand l'application est visible (changement de fuseau, horloge
 * modifiée). Jamais quand le jour n'a pas changé.
 */
export class SystemClock implements WatchedClock {
  constructor(
    private readonly now: () => Date = () => new Date(),
    private readonly visibility: AppVisibility = alwaysVisible,
  ) {}

  today(): Day {
    return Day.fromLocalDate(this.now());
  }

  onTodayChange(listener: (today: Day) => void): () => void {
    let known = this.today();
    let midnightTimer: ReturnType<typeof setTimeout> | undefined;
    let recheckTimer: ReturnType<typeof setInterval> | undefined;

    const check = () => {
      const today = this.today();
      if (!today.equals(known)) {
        known = today;
        listener(today);
      }
    };
    const waitForMidnight = () => {
      const now = this.now();
      const delay = Math.min(nextLocalMidnight(now).getTime() - now.getTime(), MAX_TIMER_DELAY_MS);
      midnightTimer = setTimeout(() => {
        check();
        waitForMidnight();
      }, delay);
    };
    const stopRechecking = () => {
      clearInterval(recheckTimer);
      recheckTimer = undefined;
    };
    const startRechecking = () => {
      stopRechecking();
      recheckTimer = setInterval(check, RECHECK_INTERVAL_MS);
    };

    waitForMidnight();
    if (this.visibility.isVisible()) {
      startRechecking();
    }
    const stopWatchingVisibility = this.visibility.onChange((visible) => {
      if (visible) {
        check();
        startRechecking();
      } else {
        stopRechecking();
      }
    });

    return () => {
      clearTimeout(midnightTimer);
      stopRechecking();
      stopWatchingVisibility();
    };
  }
}
