import { ATTACKS } from '../../domain/battle/attacks';
import type { BattleEvent, BlowOutcome } from '../../domain/battle/BattleEvent';
import type { GlintKind } from '../../domain/battle/glints';
import type { BattleHapticCue } from '../ports/BattleHaptics';
import type { BattleSoundCue } from '../ports/BattleSound';

/** Le son et la vibration d'un événement de combat ; `null` quand il n'en a pas. */
export interface BattleFeedback {
  readonly sound: BattleSoundCue | null;
  readonly haptic: BattleHapticCue | null;
}

/** Le son de chaque reflet (C2.10), joué par la session de combat en avance de sa latence. */
export const GLINT_CUES: Readonly<Record<GlintKind, BattleSoundCue>> = {
  white: 'glint',
  double: 'glintDouble',
  red: 'glintPerilous',
  dull: 'glintDull',
};

const NONE: BattleFeedback = { sound: null, haptic: null };

const BLOW_FEEDBACK: Readonly<Record<BlowOutcome, BattleFeedback>> = {
  perfectParry: { sound: 'perfectParry', haptic: 'perfectParry' },
  parry: { sound: 'parry', haptic: null },
  dodge: { sound: 'dodge', haptic: 'dodge' },
  // La parade sur un coup imparable échoue : c'est un coup reçu.
  perilousParry: { sound: 'hit', haptic: 'hit' },
  suffered: { sound: 'hit', haptic: 'hit' },
};

/**
 * La table des sons et des vibrations du combat (#31, § 4 des notes techniques, complétée par
 * #32). Ils partent dès le jugement de l'appui. L'annonce de phase a un son propre à chaque sens,
 * et une vibration légère pour la phase ennemie seulement (C12) ; « À toi » sans transition garde
 * son son. La frappe parfaite et la cassure de garde vibrent (C5.1, C6.7). L'éclat, la secousse,
 * la bannière et le lecteur d'écran restent à l'interface.
 */
export function feedbackFor(event: BattleEvent): BattleFeedback {
  switch (event.type) {
    case 'blowResolved':
      return BLOW_FEEDBACK[event.outcome];
    case 'whiffed':
      return { sound: 'whiff', haptic: null };
    case 'windUpStarted':
      return ATTACKS[event.attack].perilous ? { sound: 'seal', haptic: null } : NONE;
    case 'phaseTransitionStarted':
      return event.to === 'enemy'
        ? { sound: 'enemyPhase', haptic: 'enemyPhase' }
        : { sound: 'heroPhase', haptic: null };
    case 'battleEnded':
      return { sound: event.outcome, haptic: null };
    case 'heroPhaseStarted':
      return event.announced ? { sound: 'heroPhase', haptic: null } : NONE;
    case 'strikeResolved':
      return event.judgement === 'perfect'
        ? { sound: 'perfectStrike', haptic: 'perfectStrike' }
        : { sound: 'strike', haptic: null };
    case 'guardBroken':
      return { sound: 'guardBreak', haptic: 'guardBreak' };
    case 'actionLost':
      return { sound: 'lostAction', haptic: null };
    case 'guardRestored':
      return { sound: 'guardRestore', haptic: null };
    case 'guardRaised':
      return { sound: 'guardUp', haptic: null };
    case 'allyRaised':
      return { sound: 'raise', haptic: null };
    case 'powerUsed':
      // Pas de l'ombre (prototype #90) n'a pas de son propre : il reprend celui du Rempart.
      return { sound: 'bulwark', haptic: null };
    // La goutte du Saignement (prototype #107), sans vibration ; rien au plancher de 1 PV.
    case 'heroBleeding':
      return { sound: 'bleed', haptic: null };
    case 'bleedTicked':
      return event.loss > 0 ? { sound: 'bleed', haptic: null } : NONE;
    default:
      return NONE;
  }
}
