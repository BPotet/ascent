import type { AttackKind } from '../../../domain/battle/attacks';
import type { Battle } from '../../../domain/battle/Battle';
import type {
  BattleEvent,
  BattleOutcome,
  BlowOutcome,
  PhaseDirection,
  WhiffReason,
} from '../../../domain/battle/BattleEvent';
import type { EnemyKind } from '../../../domain/battle/combatants';
import type { Stunned } from '../../../domain/battle/guard';
import { MOMENTUM_MAX, POWERS, type PowerKind } from '../../../domain/battle/momentum';
import type { ShownIntent } from '../../../domain/battle/shownIntent';

/** Les libellés du combat d'essai, tirés du glossaire et de la maquette de l'épique #30. */
export const HERO_NAME = 'La Sentinelle';
export const TRIAL_BATTLE_TITLE = "Combat d'essai";

export const ENEMY_NAMES: Readonly<Record<EnemyKind, string>> = {
  ghoul: 'Goule',
  specter: 'Spectre',
  necromancer: 'Nécromancien',
};

/** Le genre du nom de l'ennemi, pour « étourdie », « tombée »… */
const FEMININE: Readonly<Record<EnemyKind, boolean>> = {
  ghoul: true,
  specter: false,
  necromancer: false,
};

export const ATTACK_NAMES: Readonly<Record<AttackKind, string>> = {
  basic: 'coup simple',
  double: 'double frappe',
  delayed: 'coup retardé',
  feint: 'coup trompeur',
  perilous: 'coup imparable',
};

export const POWER_NAMES: Readonly<Record<PowerKind, string>> = { bulwark: 'Rempart' };

export const SEAL_LABEL = 'Sceau rouge : coup imparable';

/** « étourdie » pour la Goule, « étourdi » pour les autres. */
function agreed(kind: EnemyKind, word: string): string {
  return FEMININE[kind] ? `${word}e` : word;
}

function damages(count: number): string {
  return `${count} ${count > 1 ? 'dégâts' : 'dégât'}`;
}

/** Les PV sous un ennemi : « 38/50 PV ». */
export function enemyHpText(hp: number, maxHp: number): string {
  return `${hp}/${maxHp} PV`;
}

/** La garde sous un ennemi : « Garde 15/15 ». */
export function guardText(guard: number, maxGuard: number): string {
  return `Garde ${guard}/${maxGuard}`;
}

/** Le libellé d'un ennemi étourdi, à la place de sa garde : « Étourdie ×1,5 ». */
export function stunnedLabel(kind: EnemyKind): string {
  return `${agreed(kind, 'Étourdi')} ×1,5`;
}

/** Le nombre d'une intention (C2.2) : « +N » pour Garde et Soin, aucun sinon. */
export function intentNumber(intent: ShownIntent): string | null {
  return intent.category === 'guard' || intent.category === 'heal' ? `+${intent.gain}` : null;
}

/** L'intention lue par le lecteur d'écran : sa catégorie, et son nombre pour Garde et Soin. */
export function intentSpeech(kind: EnemyKind, intent: ShownIntent): string {
  switch (intent.category) {
    case 'attack':
      return 'intention : attaque';
    case 'guard':
      return `intention : garde, plus ${intent.gain}`;
    case 'heal':
      return `intention : soin, plus ${intent.gain}`;
    case 'raise':
      return 'intention : relever un allié';
    case 'skip':
      return `${agreed(kind, intent.reason === 'stunned' ? 'étourdi' : 'relevé')}, n'agit pas`;
  }
}

/** Un ennemi annoncé en entier : nom, cible, PV, garde (ou étourdi) et intention montrée. */
export function enemyLabel(
  enemy: {
    readonly kind: EnemyKind;
    readonly hp: number;
    readonly maxHp: number;
    readonly guard: number;
    readonly maxGuard: number;
    readonly stun: Stunned | null;
  },
  intent: ShownIntent | null,
  isTarget: boolean,
): string {
  const name = ENEMY_NAMES[enemy.kind];
  if (enemy.hp <= 0) return `${name}, ${agreed(enemy.kind, 'tombé')}`;
  const guard =
    enemy.stun === null
      ? `garde ${enemy.guard} sur ${enemy.maxGuard}`
      : `${agreed(enemy.kind, 'étourdi')}, dégâts ×1,5`;
  const intentPart = intent === null ? '' : `, ${intentSpeech(enemy.kind, intent)}`;
  return `${name}${isTarget ? ', cible' : ''}, ${enemy.hp} PV sur ${enemy.maxHp}, ${guard}${intentPart}`;
}

export function attackButtonLabel(targetName: string): string {
  return `Attaquer, cible : ${targetName}`;
}

/** Le pouvoir et son coût, sous « Pouvoir » : « Rempart · 1 Élan ». */
export function powerCostText(power: PowerKind): string {
  return `${POWER_NAMES[power]} · ${POWERS[power].cost} Élan`;
}

/** L'Élan qui manque à un pouvoir : « Il manque 1 Élan ». */
export function missingMomentumText(missing: number): string {
  return `Il manque ${missing} Élan`;
}

export function powerButtonLabel(power: PowerKind, missing: number): string {
  const label = `Pouvoir : ${POWER_NAMES[power]}, ${POWERS[power].cost} Élan`;
  return missing > 0 ? `${label}, indisponible : il manque ${missing} Élan` : label;
}

export function momentumLabel(momentum: number): string {
  return `Élan ${momentum} sur ${MOMENTUM_MAX}`;
}

/** La bannière de l'annonce de phase : son titre et sa ligne. */
export function phaseBanner(to: PhaseDirection): { readonly title: string; readonly line: string } {
  return to === 'enemy'
    ? { title: 'Phase ennemie', line: 'Prépare ta parade' }
    : { title: 'À toi', line: 'Vise et attaque' };
}

export function phaseAnnouncement(to: PhaseDirection): string {
  const { title, line } = phaseBanner(to);
  return `${title}. ${line}.`;
}

/**
 * Le mot d'un résultat sur la scène. La phase ennemie est épurée : seuls « Parfait », « Parfait ·
 * contre-attaque » et « Cassure » s'y écrivent ; « Frappe parfaite » en phase du héros. Jamais
 * « Critique ».
 */
export interface FeedbackText {
  readonly tone: 'perfect' | 'break';
  readonly title: string;
}

/** Le mot d'un événement sur la scène, ou `null` s'il n'en a pas. */
export function feedbackText(event: BattleEvent): FeedbackText | null {
  switch (event.type) {
    case 'blowResolved':
      return event.outcome === 'perfectParry' ? { tone: 'perfect', title: 'Parfait' } : null;
    case 'counterAttacked':
      return { tone: 'perfect', title: 'Parfait · contre-attaque' };
    case 'guardBroken':
      return { tone: 'break', title: 'Cassure' };
    case 'strikeResolved':
      return event.judgement === 'perfect' ? { tone: 'perfect', title: 'Frappe parfaite' } : null;
    default:
      return null;
  }
}

/** Un chiffre qui s'envole : les dégâts (« −4 ») au-dessus du héros ou d'un ennemi, ou la garde. */
export interface DamageFloat {
  /** Le héros, ou l'indice de l'ennemi. */
  readonly at: 'hero' | number;
  readonly text: string;
  /** Agrandi pour une frappe parfaite (C6.7). */
  readonly big: boolean;
  readonly kind: 'damage' | 'guard';
}

export function damageFloat(event: BattleEvent): DamageFloat | null {
  switch (event.type) {
    case 'blowResolved':
      return event.damage > 0
        ? { at: 'hero', text: `−${event.damage}`, big: false, kind: 'damage' }
        : null;
    case 'strikeResolved':
      return {
        at: event.enemy,
        text: `−${event.damage}`,
        big: event.judgement === 'perfect',
        kind: 'damage',
      };
    case 'counterAttacked':
      return { at: event.enemy, text: `−${event.damage}`, big: false, kind: 'damage' };
    case 'guardRaised':
      return { at: event.enemy, text: `+${event.gain}`, big: false, kind: 'guard' };
    default:
      return null;
  }
}

const WHIFF_TITLES: Readonly<Record<WhiffReason, string>> = {
  early: 'Trop tôt',
  late: 'Trop tard',
  empty: 'Dans le vide',
};

function blowAnnouncement(outcome: BlowOutcome, damage: number): string {
  switch (outcome) {
    case 'perfectParry':
      return 'Parade parfaite';
    case 'parry':
      return `Parade, ${damages(damage)}`;
    case 'dodge':
      return 'Esquive, aucun dégât';
    case 'perilousParry':
      return `Coup imparable : la parade échoue, ${damages(damage)}`;
    case 'suffered':
      return `Touché, ${damages(damage)}`;
  }
}

function strikeAnnouncement(
  judgement: Extract<BattleEvent, { type: 'strikeResolved' }>['judgement'],
  damage: number,
): string {
  const title =
    judgement === 'perfect' ? 'Frappe parfaite' : judgement === 'good' ? 'Bonne frappe' : 'Frappe';
  return `${title}, ${damages(damage)}`;
}

/**
 * La phrase complète d'un événement au lecteur d'écran, ou `null` s'il n'en a pas : la phase, le
 * type de coup au début de la préparation (jamais avant, C2.4), les résultats, la garde.
 */
export function announcement(event: BattleEvent, battle: Battle): string | null {
  const name = (enemy: number) => ENEMY_NAMES[battle.enemies[enemy]!.kind];
  const kind = (enemy: number) => battle.enemies[enemy]!.kind;
  switch (event.type) {
    case 'phaseTransitionStarted':
      return phaseAnnouncement(event.to);
    case 'heroPhaseStarted':
      return event.announced ? phaseAnnouncement('hero') : null;
    case 'windUpStarted':
      return `${name(event.enemy)}, ${ATTACK_NAMES[event.attack]}${event.attack === 'perilous' ? ', esquive' : ''}`;
    case 'blowResolved':
      return blowAnnouncement(event.outcome, event.damage);
    case 'counterAttacked':
      return `Contre-attaque, ${damages(event.damage)}`;
    case 'whiffed':
      return `${WHIFF_TITLES[event.reason]}, déséquilibré`;
    case 'pressIgnored':
      return event.reason === 'offBalance' ? 'Déséquilibré' : null;
    case 'strikeResolved':
      return strikeAnnouncement(event.judgement, event.damage);
    case 'guardBroken':
      return `Cassure, ${name(event.enemy)} ${agreed(kind(event.enemy), 'étourdi')}`;
    case 'actionLost':
      return `${name(event.enemy)}, ${agreed(kind(event.enemy), 'étourdi')}, n'agit pas`;
    case 'guardRestored':
      return `${name(event.enemy)}, retour en garde`;
    case 'guardRaised':
      return `${name(event.enemy)} relève sa garde, plus ${event.gain}`;
    case 'allyRaised':
      return `${name(event.enemy)} relève ${name(event.ally)}, ${event.hp} PV`;
    case 'powerUsed':
      return POWER_NAMES[event.power];
    case 'respite':
      return event.gain > 0 ? `Répit, plus ${event.gain} PV` : null;
    case 'battleEnded':
      return `${endTitle(event.outcome)}.`;
    default:
      return null;
  }
}

export function endTitle(outcome: BattleOutcome): string {
  return outcome === 'victory' ? 'Combat gagné' : 'Combat perdu';
}

export function endLine(outcome: BattleOutcome): string {
  return outcome === 'victory'
    ? 'La Goule, le Spectre et le Nécromancien sont tombés.'
    : 'La Sentinelle est tombée.';
}

/** Le répit regagné à la victoire : « Répit +8 PV ». */
export function respiteText(gain: number): string {
  return `Répit +${gain} PV`;
}

export function heroHpText(hp: number, maxHp: number): string {
  return `PV ${hp}/${maxHp}`;
}
