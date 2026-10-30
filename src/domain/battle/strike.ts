/**
 * Frappe en rythme (`TimedStrike`, #32, règles C6) : après « Attaquer », la préparation de la
 * frappe dure 700 ms et le joueur touche « Frapper » à l'impact. Le jugement reprend les fenêtres
 * de la parade (`judgePress`) ; aucun hasard : la frappe parfaite est le seul « critique ».
 */
import { scaleDamage, type PressJudgement } from './rules';
import { STUNNED_DAMAGE_PERCENT } from './guard';

/** La préparation de la frappe (C6.1). */
export const STRIKE_WIND_UP_MS = 700;
/** La récupération après la fin de la fenêtre de l'impact (animation, durée interne). */
export const STRIKE_RECOVERY_MS = 320;

/** Le multiplicateur de frappe parfaite de base (`PerfectStrikeMultiplier`), en % (C6.4). */
export const PERFECT_STRIKE_BASE_PERCENT = 150;
/** Le multiplicateur d'une bonne frappe : aucun bonus ne s'y applique. */
export const GOOD_STRIKE_PERCENT = 120;
/** Sans appui, ou hors de la fenêtre : ni bonus ni pénalité. */
export const PLAIN_STRIKE_PERCENT = 100;

/**
 * Le multiplicateur de frappe (`StrikeMultiplier`), en % : 150 % plus les bonus de frappe parfaite
 * pour une frappe parfaite, 120 % pour une bonne frappe, 100 % sinon ou sans appui (`null`).
 */
export function strikeMultiplier(
  judgement: PressJudgement | null,
  perfectBonusPercents: readonly number[] = [],
): number {
  if (judgement === 'perfect') {
    return perfectBonusPercents.reduce((sum, bonus) => sum + bonus, PERFECT_STRIKE_BASE_PERCENT);
  }
  return judgement === 'good' ? GOOD_STRIKE_PERCENT : PLAIN_STRIKE_PERCENT;
}

/** Le multiplicateur d'étourdi d'un coup, en % : 150 (plus Braise ardente, #92) sur un étourdi. */
function stunnedPercent(stunned: boolean, stunnedBonusPercent: number): number {
  return stunned ? STUNNED_DAMAGE_PERCENT + stunnedBonusPercent : 100;
}

/** Les PV et les points de garde qu'un coup retire à un ennemi. */
export interface EnemyBlow {
  readonly hp: number;
  readonly guard: number;
}

/**
 * Un impact de frappe (C6.5), un seul arrondi à la fin : PV = Attaque × multiplicateur de frappe ×
 * multiplicateur d'étourdi ; garde = Brise-garde × multiplicateur de frappe, 0 sur un étourdi.
 */
export function strikeBlow({
  attackPower,
  guardDamage,
  multiplier,
  stunned,
  attackPercents = [],
  guardPercents = [],
  stunnedBonusPercent = 0,
}: {
  readonly attackPower: number;
  readonly guardDamage: number;
  readonly multiplier: number;
  readonly stunned: boolean;
  /** Les pourcentages des objets (#93) et des bienfaits (#92), dans le même calcul. */
  readonly attackPercents?: readonly number[];
  readonly guardPercents?: readonly number[];
  readonly stunnedBonusPercent?: number;
}): EnemyBlow {
  return {
    hp: scaleDamage(
      attackPower,
      multiplier,
      ...attackPercents,
      stunnedPercent(stunned, stunnedBonusPercent),
    ),
    guard: stunned ? 0 : scaleDamage(guardDamage, multiplier, ...guardPercents),
  };
}

/** La part de l'Attaque que vaut une contre-attaque, avant le trait (C8). */
export const COUNTER_BASE_PERCENT = 50;
/** La part du Brise-garde que retire une contre-attaque (C8). */
export const COUNTER_GUARD_PERCENT = 100;

/**
 * La contre-attaque (C8) : 50 % de l'Attaque × le trait × le multiplicateur d'étourdi, et 100 % du
 * Brise-garde (0 sur un étourdi). Le multiplicateur de frappe ne s'y applique pas (C6.6). Les parts
 * `hpPercent` et `guardPercent` règlent les PV et la garde d'un coup qui en dérive.
 */
export function counterBlow({
  attackPower,
  guardDamage,
  counterPercent,
  stunned,
  attackPercents = [],
  guardPercents = [],
  counterPercents = [],
  stunnedBonusPercent = 0,
  hpPercent = 100,
  guardPercent = COUNTER_GUARD_PERCENT,
}: {
  readonly attackPower: number;
  readonly guardDamage: number;
  readonly counterPercent: number;
  readonly stunned: boolean;
  /** Les pourcentages des objets (#93) et des bienfaits (#92), dans le même calcul. */
  readonly attackPercents?: readonly number[];
  readonly guardPercents?: readonly number[];
  readonly counterPercents?: readonly number[];
  readonly stunnedBonusPercent?: number;
  /** La part des PV, après les 50 % de base et le trait : 100 % pour la contre-attaque. */
  readonly hpPercent?: number;
  /** La part du Brise-garde : 100 % pour la contre-attaque. */
  readonly guardPercent?: number;
}): EnemyBlow {
  return {
    hp: scaleDamage(
      attackPower,
      COUNTER_BASE_PERCENT,
      counterPercent,
      hpPercent,
      ...attackPercents,
      ...counterPercents,
      stunnedPercent(stunned, stunnedBonusPercent),
    ),
    guard: stunned ? 0 : scaleDamage(guardDamage, guardPercent, ...guardPercents),
  };
}
