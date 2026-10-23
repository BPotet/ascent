import { useCallback, useEffect, useReducer } from 'react';
import { AccessibilityInfo } from 'react-native';

import type { BattleSession, BattleSnapshot } from '../../../application/useCases/BattleSession';
import type { Battle } from '../../../domain/battle/Battle';
import type { BattleEvent, BlowOutcome } from '../../../domain/battle/BattleEvent';
import type { HeroPose } from '../battle/sceneTypes';
import {
  endTitle,
  feedbackAnnouncement,
  feedbackText,
  phaseAnnouncement,
  windUpAnnouncement,
  type FeedbackText,
} from '../format/battleText';

/** L'état d'affichage de l'écran du combat d'essai, tiré des événements de combat. */
export interface TrialBattleDisplay {
  readonly snapshot: BattleSnapshot | null;
  readonly feedback: { readonly text: FeedbackText; readonly key: number } | null;
  readonly heroPose: HeroPose;
  readonly flash: { readonly kind: 'light' | 'red'; readonly key: number } | null;
  readonly shakeKey: number;
  /** L'instant de la dernière parade parfaite, pour les traînées de la scène. */
  readonly streaksAt: number | null;
}

export const INITIAL_DISPLAY: TrialBattleDisplay = {
  snapshot: null,
  feedback: null,
  heroPose: 'idle',
  flash: null,
  shakeKey: 0,
  streaksAt: null,
};

/** Les dégâts de base du coup en cours de l'ennemi : ceux de son attaque, sinon de son intention. */
function baseDamage(battle: Battle, event: BattleEvent): number {
  const { phase } = battle;
  if (phase.kind === 'enemy' && phase.step.kind === 'attack') return phase.step.damage;
  const enemy = 'enemy' in event ? battle.enemies[event.enemy] : undefined;
  return enemy?.intent.damage ?? 0;
}

const POSE_OF_OUTCOME: Readonly<Record<BlowOutcome, HeroPose>> = {
  perfectParry: 'counter',
  parry: 'lean',
  dodge: 'dodge',
  perilousParry: 'hit',
  suffered: 'hit',
};

export function displayOf(
  previous: TrialBattleDisplay,
  snapshot: BattleSnapshot,
  reducedMotion: boolean,
): TrialBattleDisplay {
  let display: TrialBattleDisplay = { ...previous, snapshot };
  for (const event of snapshot.events) {
    const text = feedbackText(event, baseDamage(snapshot.battle, event));
    if (text !== null) {
      display = { ...display, feedback: { text, key: (display.feedback?.key ?? 0) + 1 } };
    }
    switch (event.type) {
      case 'blowResolved': {
        display = { ...display, heroPose: POSE_OF_OUTCOME[event.outcome] };
        const perfect = event.outcome === 'perfectParry';
        const hurt = event.outcome === 'suffered' || event.outcome === 'perilousParry';
        if (perfect) display = { ...display, streaksAt: event.at };
        if ((perfect || hurt) && !reducedMotion) {
          display = {
            ...display,
            flash: { kind: perfect ? 'light' : 'red', key: (display.flash?.key ?? 0) + 1 },
            shakeKey: display.shakeKey + 1,
          };
        }
        break;
      }
      case 'whiffed':
        display = { ...display, heroPose: 'off' };
        break;
      case 'heroAttacked':
        display = { ...display, heroPose: 'lean' };
        break;
      // Un coup reçu reste visible pendant l'avancée suivante ou la transition vers le héros.
      case 'windUpStarted':
      case 'heroPhaseStarted':
        display = { ...display, heroPose: 'idle' };
        break;
      case 'phaseTransitionStarted':
        if (event.to === 'enemy') display = { ...display, heroPose: 'idle' };
        break;
      case 'offBalanceEnded':
        if (display.heroPose === 'off') display = { ...display, heroPose: 'idle' };
        break;
      case 'battleEnded':
        display = { ...display, heroPose: event.outcome === 'defeat' ? 'fallen' : 'idle' };
        break;
      default:
        break;
    }
  }
  return display;
}

/** Ce que le lecteur d'écran annonce d'une mise à jour : phase, préparation, résultat, fin. */
export function announcementsOf(snapshot: BattleSnapshot): string[] {
  const { battle } = snapshot;
  return snapshot.events.flatMap((event) => {
    switch (event.type) {
      case 'phaseTransitionStarted':
        return [phaseAnnouncement(event.to)];
      case 'windUpStarted':
        return [windUpAnnouncement(battle.enemies[event.enemy]!.kind, event.attack)];
      case 'battleEnded':
        return [`${endTitle(event.outcome)}.`];
      default: {
        const text = feedbackText(event, baseDamage(battle, event));
        return text === null || event.type === 'heroAttacked' ? [] : [feedbackAnnouncement(text)];
      }
    }
  });
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
 * état d'affichage (texte d'effet, pose du héros, éclat, secousse) et des annonces au lecteur
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
