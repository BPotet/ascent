import { ATTACKS } from '../../domain/battle/attacks';
import type { BattleEvent, BlowOutcome } from '../../domain/battle/BattleEvent';
import type { BattleHapticCue } from '../ports/BattleHaptics';
import type { BattleSoundCue } from '../ports/BattleSound';

/** Le son et la vibration d'un événement de combat ; `null` quand il n'en a pas. */
export interface BattleFeedback {
  readonly sound: BattleSoundCue | null;
  readonly haptic: BattleHapticCue | null;
}

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
 * La table des sons et des vibrations du combat (#31, § 4 des notes techniques). Ils partent dès
 * le jugement de l'appui. L'annonce de phase a un son propre à chaque sens, et une vibration
 * légère pour la phase ennemie seulement (C12). L'éclat, la secousse, la bannière et le lecteur
 * d'écran restent à l'interface.
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
    default:
      return NONE;
  }
}
