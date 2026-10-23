import type { AttackKind } from '../../../domain/battle/attacks';
import type {
  BattleEvent,
  BattleOutcome,
  PhaseDirection,
  WhiffReason,
} from '../../../domain/battle/BattleEvent';
import type { EnemyKind } from '../../../domain/battle/combatants';
import type { Intent } from '../../../domain/battle/intents';

/** Les libellés du combat d'essai, tirés du glossaire et de la maquette de l'épique #30. */
export const HERO_NAME = 'La Sentinelle';
export const TRIAL_BATTLE_TITLE = "Combat d'essai";

export const ENEMY_NAMES: Readonly<Record<EnemyKind, string>> = {
  ghoul: 'Goule',
  specter: 'Spectre',
};

export const ATTACK_NAMES: Readonly<Record<AttackKind, string>> = {
  basic: 'coup simple',
  double: 'double frappe',
  delayed: 'coup retardé',
  feint: 'coup trompeur',
  perilous: 'coup imparable',
};

export const SEAL_LABEL = 'Sceau rouge : coup imparable';

function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function damages(count: number): string {
  return `${count} ${count > 1 ? 'dégâts' : 'dégât'}`;
}

/** Les dégâts d'une intention, sur sa pastille : « 5 », ou « 2×3 » pour une double frappe. */
export function intentBadge({ attack, damage }: Intent): string {
  return attack === 'double' ? `2×${damage}` : String(damage);
}

/** L'intention lue par le lecteur d'écran : « Double frappe, 2 fois 3 dégâts ». */
export function intentLabel({ attack, damage }: Intent): string {
  const hits = attack === 'double' ? '2 fois ' : '';
  return `${capitalized(ATTACK_NAMES[attack])}, ${hits}${damages(damage)}`;
}

/** Un ennemi annoncé en entier : nom, cible, PV, intention. */
export function enemyLabel(
  enemy: {
    readonly kind: EnemyKind;
    readonly hp: number;
    readonly maxHp: number;
    readonly intent: Intent;
  },
  isTarget: boolean,
): string {
  const name = ENEMY_NAMES[enemy.kind];
  if (enemy.hp <= 0) return `${name}, tombé`;
  return `${name}${isTarget ? ', cible' : ''}, PV ${enemy.hp} sur ${enemy.maxHp}, intention : ${intentLabel(enemy.intent).toLowerCase()}`;
}

export function attackButtonLabel(targetName: string): string {
  return `Attaquer, cible : ${targetName}`;
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

/** Le texte d'effet d'un résultat, comme dans la maquette (P3 à P8). */
export interface FeedbackText {
  readonly tone: 'perfect' | 'good' | 'miss' | 'neutral';
  readonly title: string;
  readonly detail: string | null;
}

const WHIFF_TITLES: Readonly<Record<WhiffReason, string>> = {
  early: 'Trop tôt',
  late: 'Trop tard',
  empty: 'Dans le vide',
};

/**
 * Le texte d'effet d'un événement, ou `null` s'il n'en a pas. Les dégâts de base d'un coup sont
 * ceux de l'intention de l'ennemi (`baseDamage`).
 */
export function feedbackText(event: BattleEvent, baseDamage: number): FeedbackText | null {
  switch (event.type) {
    case 'blowResolved':
      switch (event.outcome) {
        case 'perfectParry':
          return { tone: 'perfect', title: 'Parade parfaite', detail: null };
        case 'parry':
          return {
            tone: 'good',
            title: 'Parade',
            detail: `${damages(event.damage)} au lieu de ${baseDamage}`,
          };
        case 'dodge':
          return { tone: 'good', title: 'Esquive', detail: 'Aucun dégât' };
        case 'perilousParry':
          return { tone: 'miss', title: 'Imparable : esquive !', detail: `−${event.damage} PV` };
        case 'suffered':
          return { tone: 'miss', title: 'Touché', detail: `−${event.damage} PV` };
      }
      break;
    case 'counterAttacked':
      return {
        tone: 'perfect',
        title: 'Parade parfaite',
        detail: `Contre-attaque · ${damages(event.damage)}`,
      };
    case 'whiffed':
      return { tone: 'miss', title: WHIFF_TITLES[event.reason], detail: null };
    case 'pressIgnored':
      return event.reason === 'offBalance'
        ? { tone: 'miss', title: 'Déséquilibré', detail: null }
        : null;
    case 'heroAttacked':
      return { tone: 'neutral', title: 'Attaque', detail: damages(event.damage) };
    default:
      return null;
  }
  return null;
}

/** L'annonce au lecteur d'écran d'un texte d'effet : « Parade, 1 dégât au lieu de 5 ». */
export function feedbackAnnouncement({ title, detail }: FeedbackText): string {
  return detail === null ? title : `${title}, ${detail}`;
}

/** L'annonce d'une préparation : « Spectre : coup imparable, esquive ». */
export function windUpAnnouncement(kind: EnemyKind, attack: AttackKind): string {
  const announcement = `${ENEMY_NAMES[kind]} : ${ATTACK_NAMES[attack]}`;
  return attack === 'perilous' ? `${announcement}, esquive` : announcement;
}

export function endTitle(outcome: BattleOutcome): string {
  return outcome === 'victory' ? 'Combat gagné' : 'Combat perdu';
}

export function endLine(outcome: BattleOutcome): string {
  return outcome === 'victory'
    ? 'La Goule et le Spectre sont tombés.'
    : 'La Sentinelle est tombée.';
}

export function heroHpText(hp: number, maxHp: number): string {
  return `PV ${hp}/${maxHp}`;
}
