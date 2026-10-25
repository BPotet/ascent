import { useCallback, useEffect, useReducer } from 'react';
import { AccessibilityInfo } from 'react-native';

import type { BattleSession, BattleSnapshot } from '../../../application/useCases/BattleSession';
import type { BattleEvent, BlowOutcome } from '../../../domain/battle/BattleEvent';
import type { HeroPose } from '../battle/sceneTypes';
import {
  announcement,
  damageFloat,
  feedbackText,
  type DamageFloat,
  type FeedbackText,
} from '../format/battleText';

/** L'état d'affichage de l'écran du combat d'essai, tiré des événements de combat. */
export interface TrialBattleDisplay {
  readonly snapshot: BattleSnapshot | null;
  /** Les derniers mots du combat (« Parfait », « Frappe parfaite », « Cassure »). */
  readonly feedback: { readonly texts: readonly FeedbackText[]; readonly key: number } | null;
  /** Le dernier chiffre qui s'envole (« −4 », « +3 »). */
  readonly float: { readonly float: DamageFloat; readonly key: number } | null;
  readonly heroPose: HeroPose;
  readonly flash: { readonly kind: 'light' | 'red'; readonly key: number } | null;
  readonly shakeKey: number;
  /** L'instant de la dernière parade parfaite, pour les traînées de la scène. */
  readonly streaksAt: number | null;
}

export const INITIAL_DISPLAY: TrialBattleDisplay = {
  snapshot: null,
  feedback: null,
  float: null,
  heroPose: 'idle',
  flash: null,
  shakeKey: 0,
  streaksAt: null,
};

const POSE_OF_OUTCOME: Readonly<Record<BlowOutcome, HeroPose>> = {
  perfectParry: 'counter',
  parry: 'lean',
  dodge: 'dodge',
  perilousParry: 'hit',
  suffered: 'hit',
};

/** La pose du héros après un événement, ou `null` s'il ne la change pas. */
function poseAfter(event: BattleEvent, pose: HeroPose): HeroPose | null {
  switch (event.type) {
    case 'blowResolved':
      return POSE_OF_OUTCOME[event.outcome];
    case 'whiffed':
      return 'off';
    case 'strikeResolved':
      return 'lean';
    // Un coup reçu reste visible pendant l'avancée suivante ou la transition vers le héros.
    case 'strikeStarted':
    case 'windUpStarted':
    case 'heroPhaseStarted':
      return 'idle';
    case 'phaseTransitionStarted':
      return event.to === 'enemy' ? 'idle' : null;
    case 'offBalanceEnded':
      return pose === 'off' ? 'idle' : null;
    case 'battleEnded':
      return event.outcome === 'defeat' ? 'fallen' : 'idle';
    default:
      return null;
  }
}

/** L'éclat et la secousse d'un coup : lumière à la parade parfaite, rouge à un coup subi. */
function flashOf(event: BattleEvent): 'light' | 'red' | null {
  if (event.type !== 'blowResolved') return null;
  if (event.outcome === 'perfectParry') return 'light';
  return event.outcome === 'suffered' || event.outcome === 'perilousParry' ? 'red' : null;
}

/**
 * Les mots d'une mise à jour : « Frappe parfaite » puis « Cassure » quand la frappe brise la garde
 * (F4, F5) ; « Cassure » seul quand c'est la contre-attaque (P3b).
 */
function wordsOf(events: readonly BattleEvent[]): FeedbackText[] {
  const texts = events.flatMap((event) => feedbackText(event) ?? []);
  const broken = texts.some((text) => text.tone === 'break');
  return broken ? texts.filter((text) => text.title !== 'Parfait · contre-attaque') : texts;
}

export function displayOf(
  previous: TrialBattleDisplay,
  snapshot: BattleSnapshot,
  reducedMotion: boolean,
): TrialBattleDisplay {
  let display: TrialBattleDisplay = { ...previous, snapshot };
  const texts = wordsOf(snapshot.events);
  if (texts.length > 0) {
    display = { ...display, feedback: { texts, key: (display.feedback?.key ?? 0) + 1 } };
  }
  for (const event of snapshot.events) {
    const float = damageFloat(event);
    if (float !== null) {
      display = { ...display, float: { float, key: (display.float?.key ?? 0) + 1 } };
    }
    const pose = poseAfter(event, display.heroPose);
    if (pose !== null) display = { ...display, heroPose: pose };
    if (event.type === 'blowResolved' && event.outcome === 'perfectParry') {
      display = { ...display, streaksAt: event.at };
    }
    const flash = flashOf(event);
    if (flash !== null && !reducedMotion) {
      display = {
        ...display,
        flash: { kind: flash, key: (display.flash?.key ?? 0) + 1 },
        shakeKey: display.shakeKey + 1,
      };
    }
  }
  return display;
}

/** Ce que le lecteur d'écran annonce d'une mise à jour, dans l'ordre des événements. */
export function announcementsOf(snapshot: BattleSnapshot): string[] {
  return snapshot.events.flatMap((event) => announcement(event, snapshot.battle) ?? []);
}

type Action =
  | {
      readonly type: 'snapshot';
      readonly snapshot: BattleSnapshot;
      readonly reducedMotion: boolean;
    }
  | { readonly type: 'reset' };

function reduce(display: TrialBattleDisplay, action: Action): TrialBattleDisplay {
  return action.type === 'reset'
    ? INITIAL_DISPLAY
    : displayOf(display, action.snapshot, action.reducedMotion);
}

/**
 * Le combat d'essai affiché : la session est démarrée au montage, chaque mise à jour devient un
 * état d'affichage (mot, chiffre, pose du héros, éclat, secousse) et des annonces au lecteur
 * d'écran. Avec « réduire les animations », ni éclat ni secousse ; le son et la vibration ne
 * changent pas (la session les joue). `replay` commence un nouveau combat.
 */
export function useTrialBattle(
  session: BattleSession,
  reducedMotion: boolean,
): TrialBattleDisplay & { readonly replay: () => void } {
  const [display, dispatch] = useReducer(reduce, INITIAL_DISPLAY);

  useEffect(() => {
    const unsubscribe = session.subscribe((snapshot) => {
      dispatch({ type: 'snapshot', snapshot, reducedMotion });
      for (const announcement of announcementsOf(snapshot)) {
        AccessibilityInfo.announceForAccessibility(announcement);
      }
    });
    return unsubscribe;
  }, [session, reducedMotion]);

  useEffect(() => {
    session.start().catch(() => undefined);
    return () => session.dispose();
  }, [session]);

  const replay = useCallback(() => {
    dispatch({ type: 'reset' });
    session.start().catch(() => undefined);
  }, [session]);

  return { ...display, replay };
}
