import { ATTACKS } from '../../domain/battle/attacks';
import { isStanding, type Battle } from '../../domain/battle/Battle';
import type { BattleEvent, BlowOutcome } from '../../domain/battle/BattleEvent';
import { ENEMIES, type EnemyKind } from '../../domain/battle/combatants';
import type { GlintKind } from '../../domain/battle/glints';
import type { BattleHapticCue } from '../ports/BattleHaptics';
import type { BattleSoundCue } from '../ports/BattleSound';

/** Le son et la vibration d'un événement de combat ; `null` quand il n'en a pas. */
export interface BattleFeedback {
  readonly sound: BattleSoundCue | null;
  readonly haptic: BattleHapticCue | null;
  /**
   * Le son et la vibration partent `delayMs` ms après l'événement (#171) ; absent, aussitôt. Pendant
   * une frappe du héros, le délai court à partir de sa fin (#259).
   */
  readonly delayMs?: number;
}

/** L'extinction d'une flamme suit le son de la parade parfaite ou de l'esquive (#171). */
export const BURN_OUT_AFTER_BLOW_MS = 80;
/** L'extinction d'une flamme au début de la manche suit le crépitement (#171, maquette B5, B7). */
export const BURN_OUT_AFTER_CRACKLE_MS = 800;
/** Au début d'une manche, la Brûlure (crépitement, chiffre) suit le Saignement (maquette B5). */
export const BURN_AFTER_BLEED_MS = 700;
/**
 * Au début d'une manche, l'entrée des invoqués suit la Brûlure (#172) : son bruissement vient après
 * le crépitement et l'extinction d'une flamme (800 ms plus tard).
 */
export const SUMMON_AFTER_BURN_MS = 1_000;
/**
 * Le prix des Épines se paie 300 ms après la fin de la frappe qui pique (#259, maquette M2, M3) : le
 * chiffre, le mot, les pointes et la vibration. Après le dernier coup d'une Rafale. L'écran et la
 * session le partagent.
 */
export const THORNS_AFTER_STRIKE_MS = 300;

/**
 * Une frappe du héros est en cours : un de ses coups reste à résoudre (#259). Elle finit à la
 * résolution de son dernier coup, ou plus tôt si sa cible tombe.
 */
export function strikeUnderway({ phase }: Battle): boolean {
  return phase.kind === 'heroStrike' && !phase.resolved;
}

/** Le son de chaque reflet (C2.10), joué par la session de combat en avance de sa latence. */
export const GLINT_CUES: Readonly<Record<GlintKind, BattleSoundCue>> = {
  white: 'glint',
  double: 'glintDouble',
  red: 'glintPerilous',
  dull: 'glintDull',
  // Le reflet de balayage (#266), le 5e son du reflet.
  sweep: 'glintSweep',
};

const NONE: BattleFeedback = { sound: null, haptic: null };

/**
 * Le gong fêlé de la Charge brisée suit le son de la cassure de 100 ms (#266, maquette A9), avec
 * les éclats de bronze.
 */
export const CHARGE_BROKEN_AFTER_BREAK_MS = 100;

/**
 * La bougie soufflée suit la chute du Porte-cierge de 200 ms (#268, maquette C4), avec la fumée et
 * « L'aura s'éteint ».
 */
export const CANDLE_SNUFF_AFTER_FALL_MS = 200;

/**
 * Ce que le retour d'un événement lit du combat (#268) : le nom de code de l'ennemi de l'événement,
 * et si un autre ennemi est debout après la mise à jour. Absent, aucun son propre à un ennemi.
 */
export interface FeedbackContext {
  readonly kind: EnemyKind | null;
  readonly allyStanding: boolean;
}

const NO_CONTEXT: FeedbackContext = { kind: null, allyStanding: false };

const BLOW_FEEDBACK: Readonly<Record<BlowOutcome, BattleFeedback>> = {
  perfectParry: { sound: 'perfectParry', haptic: 'perfectParry' },
  parry: { sound: 'parry', haptic: null },
  dodge: { sound: 'dodge', haptic: 'dodge' },
  // La parade sur un coup imparable échoue : c'est un coup reçu.
  perilousParry: { sound: 'hit', haptic: 'hit' },
  suffered: { sound: 'hit', haptic: 'hit' },
  // L'esquive sur un Balayage échoue : c'est un coup reçu (#266).
  sweepDodge: { sound: 'hit', haptic: 'hit' },
};

/**
 * La table des sons et des vibrations du combat (#31, § 4 des notes techniques, complétée par
 * #32). Ils partent dès le jugement de l'appui. L'annonce de phase a un son propre à chaque sens,
 * et une vibration légère pour la phase ennemie seulement (C12) ; « À toi » sans transition garde
 * son son. La frappe parfaite et la cassure de garde vibrent (C5.1, C6.7). L'éclat, la secousse,
 * la bannière et le lecteur d'écran restent à l'interface.
 */
export function feedbackFor(
  event: BattleEvent,
  { kind, allyStanding }: FeedbackContext = NO_CONTEXT,
): BattleFeedback {
  switch (event.type) {
    // La chute du Porte-cierge (#268) : sa bougie soufflée, quand son Aura avait des alliés.
    case 'enemyDefeated':
      return kind !== null && ENEMIES[kind].aura !== undefined && allyStanding
        ? { sound: 'candleSnuff', haptic: null, delayMs: CANDLE_SNUFF_AFTER_FALL_MS }
        : NONE;
    // L'avancée d'un Rat de crypte (#268) : un couinement court, sans vibration.
    case 'stepInStarted':
      return kind !== null && ENEMIES[kind].swarm !== undefined
        ? { sound: 'ratSqueak', haptic: null }
        : NONE;
    case 'blowResolved':
      return BLOW_FEEDBACK[event.outcome];
    case 'whiffed':
      return { sound: 'whiff', haptic: null };
    // Le sceau d'un coup imparable ; le bourdon grave d'un Balayage, son miroir (#266).
    case 'windUpStarted':
      if (ATTACKS[event.attack].perilous) return { sound: 'seal', haptic: null };
      return ATTACKS[event.attack].sweep ? { sound: 'sweepDrone', haptic: null } : NONE;
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
    // Le choc de bouclier de la Riposte du Rempart (#128) ; son usure garde le son du touché.
    case 'bulwarkCountered':
      return { sound: 'shieldClash', haptic: 'bulwarkCounter' };
    case 'actionLost':
      return { sound: 'lostAction', haptic: null };
    case 'guardRestored':
      return { sound: 'guardRestore', haptic: null };
    case 'guardRaised':
      return { sound: 'guardUp', haptic: null };
    case 'allyRaised':
      return { sound: 'raise', haptic: null };
    case 'enemySelfRevived':
      return { sound: 'boneRattle', haptic: null };
    case 'powerUsed':
      // Pas de l'ombre (prototype #90) n'a pas de son propre : il reprend celui du Rempart.
      return { sound: 'bulwark', haptic: null };
    // La goutte du Saignement (prototype #107), sans vibration ; rien au plancher de 1 PV.
    case 'heroBleeding':
      return { sound: 'bleed', haptic: null };
    case 'bleedTicked':
      return event.loss > 0 ? { sound: 'bleed', haptic: null } : NONE;
    // La Brûlure (#171), sans vibration : le souffle de flamme par-dessus le touché ou la parade,
    // même à 5 charges ; le crépitement à chaque début de manche, plancher de 1 PV compris (B7) ;
    // l'extinction, différée. Rien quand les flammes s'éteignent ensemble à la fin du combat.
    case 'heroBurning':
      return { sound: 'flameBreath', haptic: null };
    case 'burnTicked':
      return { sound: 'burnCrackle', haptic: null };
    case 'burnExtinguished':
      return {
        sound: 'burnOut',
        haptic: null,
        delayMs: event.cause === 'blow' ? BURN_OUT_AFTER_BLOW_MS : BURN_OUT_AFTER_CRACKLE_MS,
      };
    // L'Invocation (#172), sans vibration : un bruissement d'ailes à l'annonce, un second, plus
    // fort, à l'entrée ; rien quand les invoqués tombent avec le boss.
    case 'summonCalled':
      return { sound: 'wingRustle', haptic: null };
    case 'summonEntered':
      return { sound: 'wingRustleLoud', haptic: null };
    // Les Épines (#259) : une vibration courte, sans son, après la frappe ; rien sans perte.
    case 'thornsPricked':
      return event.loss > 0
        ? { sound: null, haptic: 'thorns', delayMs: THORNS_AFTER_STRIKE_MS }
        : NONE;
    // La Charge du Bélier de bronze (#266), sans vibration : le raclement de sabot à son action,
    // le gong fêlé après le son de la cassure qui la brise.
    case 'chargeStarted':
      return { sound: 'chargeScrape', haptic: null };
    case 'chargeBroken':
      return { sound: 'chargeBroken', haptic: null, delayMs: CHARGE_BROKEN_AFTER_BREAK_MS };
    // La seconde chance n'a pas de son propre (#206) : celui du touché qui fait tomber suffit.
    default:
      return NONE;
  }
}

/** Le Saignement d'un début de manche se voit et s'entend : il fait perdre des PV. */
export function bledIn(events: readonly BattleEvent[]): boolean {
  return events.some((event) => event.type === 'bleedTicked' && event.loss > 0);
}

/**
 * Le délai de l'entrée des invoqués dans une mise à jour (#172), en ms : après le Saignement
 * (700 ms) puis la Brûlure (1 000 ms) de la manche. Le son et l'écran le partagent.
 */
export function summonEntryDelay(events: readonly BattleEvent[]): number {
  const afterBleed = bledIn(events) ? BURN_AFTER_BLEED_MS : 0;
  const burnt = events.some((event) => event.type === 'burnTicked');
  return afterBleed + (burnt ? SUMMON_AFTER_BURN_MS : 0);
}

/**
 * Les sons et les vibrations d'une mise à jour, dans l'ordre de ses événements. Au début d'une
 * manche où le héros saigne, la Brûlure attend 700 ms après le Saignement : le crépitement, puis
 * l'extinction 800 ms plus tard (#171, maquette B5). L'entrée des invoqués vient ensuite (#172) :
 * un seul bruissement pour toute l'Invocation, 1 000 ms après la Brûlure de la manche.
 * Les sons propres à un ennemi (#268) lisent son nom de code dans le combat d'avant la mise à jour
 * (`before`), suivi au fil des entrées, et les ennemis debout dans celui d'après (`after`).
 */
export function feedbacksFor(
  events: readonly BattleEvent[],
  before: Battle | null = null,
  after: Battle | null = null,
): BattleFeedback[] {
  const afterBleed = bledIn(events) ? BURN_AFTER_BLEED_MS : 0;
  const afterBurn = summonEntryDelay(events);
  const firstEntry = events.findIndex((event) => event.type === 'summonEntered');
  const kinds: (EnemyKind | undefined)[] = before?.enemies.map((enemy) => enemy.kind) ?? [];
  return events.map((event, index) => {
    const feedback = feedbackFor(event, contextOf(event, kinds, after));
    if (event.type === 'summonEntered') {
      if (index !== firstEntry) return NONE;
      return afterBurn === 0 ? feedback : { ...feedback, delayMs: afterBurn };
    }
    if (afterBleed === 0) return feedback;
    if (event.type === 'burnTicked') return { ...feedback, delayMs: afterBleed };
    if (event.type === 'burnExtinguished' && event.cause === 'round') {
      return { ...feedback, delayMs: afterBleed + (feedback.delayMs ?? 0) };
    }
    return feedback;
  });
}

/** Le contexte d'un événement : le nom de code de son ennemi, suivi au fil des entrées (#268). */
function contextOf(
  event: BattleEvent,
  kinds: (EnemyKind | undefined)[],
  after: Battle | null,
): FeedbackContext {
  if (event.type === 'reinforcementEntered' || event.type === 'summonEntered') {
    kinds[event.enemy] = event.kind;
  }
  if (event.type === 'enemyExhumed') kinds[event.slot] = event.kind;
  if (!('enemy' in event) || after === null) return NO_CONTEXT;
  return {
    kind: kinds[event.enemy] ?? null,
    allyStanding: after.enemies.some(
      (enemy, position) => position !== event.enemy && isStanding(enemy),
    ),
  };
}
