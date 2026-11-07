import { blessingRarities } from '../../domain/ascent/blessings';
import { fateGauge, fateGaugeCount, type FateGauge } from '../../domain/ascent/fateGauge';
import type { Rarity } from '../../domain/ascent/rarity';
import type { HabitId } from '../../domain/habit/Habit';
import { Week } from '../../domain/week/Week';
import type { PreferenceDependencies } from './checkInHint';
import type { UseCaseDependencies } from './UseCaseDependencies';

/** Le scellement de la jauge (`GaugeSeal`) du jour, dans le stockage clé-valeur (#93, P29). */
export const GAUGE_SEAL_KEY = 'ascent.gaugeSeal';

export type FateGaugeDependencies = UseCaseDependencies & PreferenceDependencies;

/**
 * Une habitude attendue hier, par son nom, pour le détail de la jauge (#41) seulement. Les noms
 * restent sur l'appareil : ils n'entrent jamais dans l'ascension ni dans son journal.
 */
export interface FateGaugeHabitLine {
  readonly name: string;
  readonly done: boolean;
  /** Attendue à la clôture, mais plus dans le Rappel d'hier (« attendue à la clôture »). */
  readonly atClosingOnly: boolean;
}

/** La jauge du jour, d'après hier : `done` habitudes faites sur `expected` attendues. */
export interface FateGaugeReading {
  readonly gauge: FateGauge;
  /** Les raretés des bénédictions de départ, une par habitude faite hier (3 au plus). */
  readonly blessings: readonly Rarity[];
  readonly done: number;
  readonly expected: number;
  /** Les habitudes attendues hier, dans l'ordre de création, faites ou non (#41). */
  readonly habits: readonly FateGaugeHabitLine[];
  /**
   * Les habitudes cochées « fait » hier, attendues ou non : celles qui tiennent leur Serment (#237).
   * Des identifiants, jamais des noms ; figées avec le reste au Scellement de la jauge.
   */
  readonly doneYesterday: readonly HabitId[];
  /** Figée au lancement de la 1re ascension du jour. */
  readonly sealed: boolean;
  /** Les habitudes n'ont pas pu être lues : la jauge est Neutre, sans effet (P28). */
  readonly unreadable: boolean;
}

/** La jauge d'une lecture en échec : Neutre, sans effet ; l'ascension se lance toujours (P28). */
export const UNREADABLE_GAUGE: FateGaugeReading = {
  gauge: 0,
  blessings: [],
  done: 0,
  expected: 0,
  habits: [],
  doneYesterday: [],
  sealed: false,
  unreadable: true,
};

/**
 * Le scellement : la lecture, sans `sealed`. `habits` et `unreadable` sont facultatifs : un
 * scellement d'avant #41 se relit sans noms, comme une lecture réussie ; `doneYesterday` aussi : un
 * scellement d'avant #237 n'attise rien.
 */
interface Seal
  extends
    Omit<FateGaugeReading, 'sealed' | 'habits' | 'unreadable' | 'doneYesterday'>,
    Partial<Pick<FateGaugeReading, 'habits' | 'unreadable' | 'doneYesterday'>> {
  readonly day: string;
}

async function readSeal({ keyValueStore }: PreferenceDependencies): Promise<Seal | null> {
  try {
    return JSON.parse((await keyValueStore.get(GAUGE_SEAL_KEY)) ?? 'null') as Seal | null;
  } catch {
    return null;
  }
}

/**
 * Cas d'usage : la jauge du jour (P22 à P25). Scellée aujourd'hui, elle ne change plus ; sinon elle
 * se calcule sur hier tel qu'à la clôture (`fateGaugeCount`, #41) : suivis du lundi de la semaine
 * d'hier jusqu'à hier, les jours d'avant hier sans leurs corrections, réglages de la clôture d'hier.
 * Un scellement d'un autre jour est ignoré. Une lecture en échec donne une jauge Neutre, marquée
 * `unreadable` : l'ascension se lance toujours (P28).
 */
export async function getFateGauge(dependencies: FateGaugeDependencies): Promise<FateGaugeReading> {
  const { clock, unitOfWork } = dependencies;
  const today = clock.today();
  const seal = await readSeal(dependencies);
  if (seal?.day === today.toIsoString()) {
    const { day: _day, habits = [], unreadable = false, doneYesterday = [], ...reading } = seal;
    return { ...reading, habits, doneYesterday, unreadable, sealed: true };
  }
  try {
    return await unitOfWork.run(async ({ habits, checkIns, settingsChanges }) => {
      const yesterday = today.plusDays(-1);
      const count = fateGaugeCount(
        yesterday,
        await habits.listAll(),
        await checkIns.listBetween(Week.containing(yesterday).start, yesterday),
        await settingsChanges.listAll(),
      );
      const done = count.habits.filter((each) => each.done);
      return {
        gauge: fateGauge(count.done, count.expected),
        blessings: blessingRarities(
          done.map(({ habit, difficulty }) => ({
            name: habit.name.value,
            createdOn: habit.createdOn,
            difficulty,
          })),
        ),
        done: count.done,
        expected: count.expected,
        habits: count.habits.map(({ habit, done: isDone, atClosingOnly }) => ({
          name: habit.name.value,
          done: isDone,
          atClosingOnly,
        })),
        doneYesterday: count.doneYesterday,
        sealed: false,
        unreadable: false,
      };
    });
  } catch {
    return UNREADABLE_GAUGE;
  }
}

/**
 * Cas d'usage : scelle la jauge pour aujourd'hui, au lancement de la 1re ascension du jour. Le
 * scellement garde toute la lecture : les noms d'hier, sur l'appareil seulement, et `unreadable`. Une
 * jauge lancée en lecture en échec reste donc Neutre et le dit toute la journée, même si les
 * habitudes se relisent ensuite : c'est la jauge avec laquelle l'ascension a été lancée.
 */
export async function sealFateGauge(
  dependencies: FateGaugeDependencies,
  reading: FateGaugeReading,
): Promise<void> {
  if (reading.sealed) return;
  const { sealed: _sealed, ...rest } = reading;
  const seal: Seal = { day: dependencies.clock.today().toIsoString(), ...rest };
  await dependencies.keyValueStore.set(GAUGE_SEAL_KEY, JSON.stringify(seal));
}
