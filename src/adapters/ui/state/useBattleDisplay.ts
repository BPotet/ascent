import { useEffect, useReducer } from 'react';
import { AccessibilityInfo } from 'react-native';

import type { BattleSession, BattleSnapshot } from '../../../application/useCases/BattleSession';
import type { BattleEvent, BlowOutcome } from '../../../domain/battle/BattleEvent';
import type { HeroPose, SceneSpark } from '../battle/sceneTypes';
import {
  announcement,
  damageFloat,
  feedbackText,
  type DamageFloat,
  type FeedbackText,
} from '../format/battleText';

/** L'état d'affichage de l'écran de combat, tiré des événements de combat. */
export interface BattleDisplay {
  readonly snapshot: BattleSnapshot | null;
  /** Les derniers mots du combat (« Parfait », « Frappe parfaite », « Cassure »). */
  readonly feedback: { readonly texts: readonly FeedbackText[]; readonly key: number } | null;
  /** Le dernier chiffre qui s'envole (« −4 », « +3 »). */
  readonly float: { readonly float: DamageFloat; readonly key: number } | null;
  readonly heroPose: HeroPose;
  /** L'instant où la pose du héros a commencé, pour ses images. */
  readonly heroPoseSince: number;
  /** La dernière étincelle de parade : dorée (parfaite), bleu acier (bonne). */
  readonly spark: SceneSpark | null;
  /** L'instant du dernier coup reçu (vignette rouge), jamais avec « réduire les animations ». */
  readonly hurtAt: number | null;
  /** L'instant de la chute de chaque ennemi brisé, par place. */
  readonly downSince: Readonly<Record<number, number>>;
  /** Le nombre de renforts entrés à chaque place : un renfort a sa propre colonne. */
  readonly arrivals: Readonly<Record<number, number>>;
  readonly shakeKey: number;
  /** L'instant où le Rempart s'est usé (#128), jusqu'à la fin du coup ; `null` sinon. */
  readonly bulwarkWornAt: number | null;
  /** La dernière Riposte du Rempart (#128) : l'onde va de l'écu à l'ennemi qui a frappé. */
  readonly riposte: { readonly at: number; readonly enemy: number } | null;
  /**
   * Le dernier chiffre sur le héros : il reste visible quand un chiffre sur un ennemi part au même
   * instant (le touché qui use le Rempart, puis la riposte, #128).
   */
  readonly heroFloat: { readonly float: DamageFloat; readonly key: number } | null;
}

export const INITIAL_DISPLAY: BattleDisplay = {
  snapshot: null,
  feedback: null,
  float: null,
  heroPose: 'idle',
  heroPoseSince: 0,
  spark: null,
  hurtAt: null,
  downSince: {},
  arrivals: {},
  shakeKey: 0,
  bulwarkWornAt: null,
  riposte: null,
  heroFloat: null,
};

const POSE_OF_OUTCOME: Readonly<Record<BlowOutcome, HeroPose>> = {
  perfectParry: 'counter',
  parry: 'parry',
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
    case 'counterAttacked':
      return 'strike';
    // Le coup de bouclier, sur place (#128).
    case 'bulwarkCountered':
      return 'bash';
    case 'strikeStarted':
      return 'raise';
    // Un coup reçu reste visible pendant l'avancée suivante ou la transition vers le héros.
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

/** L'étincelle d'une parade : dorée à rayons pour une parade parfaite, bleu acier pour une bonne. */
function sparkOf(event: BattleEvent): SceneSpark | null {
  if (event.type !== 'blowResolved') return null;
  if (event.outcome === 'perfectParry') return { kind: 'gold', at: event.at };
  return event.outcome === 'parry' ? { kind: 'steel', at: event.at } : null;
}

/** Un coup reçu : la vignette rouge et la secousse. */
function hurts(event: BattleEvent): boolean {
  return (
    event.type === 'blowResolved' &&
    (event.outcome === 'suffered' || event.outcome === 'perilousParry')
  );
}

/**
 * Les mots d'une mise à jour : « Frappe parfaite » puis « Cassure » quand la frappe brise la garde
 * (F4, F5) ; « Cassure » seul quand c'est la contre-attaque (P3b) ou la riposte (#128).
 */
function wordsOf(events: readonly BattleEvent[]): FeedbackText[] {
  const texts = events.flatMap((event) => feedbackText(event) ?? []);
  const broken = texts.some((text) => text.tone === 'break');
  return broken
    ? texts.filter((text) => text.title !== 'Parfait · contre-attaque' && text.tone !== 'riposte')
    : texts;
}

/** Les événements qui finissent un coup ennemi : « Rempart usé » disparaît (#128). */
const BLOW_ENDS: ReadonlySet<BattleEvent['type']> = new Set([
  'stepInStarted',
  'windUpStarted',
  'phaseTransitionStarted',
  'heroPhaseStarted',
  'battleEnded',
]);

/** L'instant d'usure du Rempart après un événement : posé à l'usure, oublié à la fin du coup. */
function bulwarkWornAfter(event: BattleEvent, wornAt: number | null): number | null {
  if (event.type === 'bulwarkWorn') return event.at;
  return BLOW_ENDS.has(event.type) ? null : wornAt;
}

export function displayOf(
  previous: BattleDisplay,
  snapshot: BattleSnapshot,
  reducedMotion: boolean,
): BattleDisplay {
  let display: BattleDisplay = { ...previous, snapshot };
  const texts = wordsOf(snapshot.events);
  if (texts.length > 0) {
    display = { ...display, feedback: { texts, key: (display.feedback?.key ?? 0) + 1 } };
  }
  for (const event of snapshot.events) {
    const float = damageFloat(event);
    if (float !== null) {
      const flying = { float, key: (display.float?.key ?? 0) + 1 };
      display = { ...display, float: flying, ...(float.at === 'hero' && { heroFloat: flying }) };
    }
    const pose = poseAfter(event, display.heroPose);
    if (pose !== null) display = { ...display, heroPose: pose, heroPoseSince: event.at };
    const spark = sparkOf(event);
    if (spark !== null) display = { ...display, spark };
    display = { ...display, bulwarkWornAt: bulwarkWornAfter(event, display.bulwarkWornAt) };
    if (event.type === 'bulwarkCountered') {
      display = { ...display, riposte: { at: event.at, enemy: event.enemy } };
    }
    if (event.type === 'reinforcementEntered') {
      // Le renfort entre debout, sans l'animation de chute de l'ennemi qu'il remplace.
      const { [event.enemy]: _fallen, ...downSince } = display.downSince;
      display = {
        ...display,
        downSince,
        arrivals: { ...display.arrivals, [event.enemy]: (display.arrivals[event.enemy] ?? 0) + 1 },
      };
    }
    if (event.type === 'guardBroken') {
      display = { ...display, downSince: { ...display.downSince, [event.enemy]: event.at } };
    }
    const hurt = hurts(event);
    if ((hurt || spark?.kind === 'gold') && !reducedMotion) {
      display = {
        ...display,
        hurtAt: hurt ? event.at : display.hurtAt,
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

interface Action {
  readonly snapshot: BattleSnapshot;
  readonly reducedMotion: boolean;
}

function reduce(display: BattleDisplay, action: Action): BattleDisplay {
  return displayOf(display, action.snapshot, action.reducedMotion);
}

/**
 * Le combat affiché : la session est démarrée au montage, chaque mise à jour devient un état
 * d'affichage (mot, chiffre, pose du héros, étincelle, vignette, secousse) et des annonces au
 * lecteur d'écran. Avec « réduire les animations », ni vignette ni secousse ; le son et la
 * vibration ne changent pas (la session les joue).
 */
export function useBattleDisplay(session: BattleSession, reducedMotion: boolean): BattleDisplay {
  const [display, dispatch] = useReducer(reduce, INITIAL_DISPLAY);

  useEffect(() => {
    const unsubscribe = session.subscribe((snapshot) => {
      dispatch({ snapshot, reducedMotion });
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

  return display;
}
