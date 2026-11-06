/**
 * Le registre des pouvoirs (`Power`, #235) : un profil par code, recopié des fiches du Codex de
 * l'Atelier (catégorie `power`). Le héros, l'ordre de l'arbre (et des touches), le coût en Élan,
 * le type (instantané, à charge) et les paramètres d'effet.
 */
import type { HeroKind } from './combatants';

/** Les pouvoirs lançables : le pouvoir de base de chaque héros. */
export type PowerKind = 'bulwark' | 'shadowStep';

export interface PowerProfile {
  readonly hero: HeroKind;
  /** L'ordre de l'arbre et des touches (`order` du Codex). */
  readonly order: number;
  /** Le coût en Élan (`momentumCost`) ; tout coût se lit par `powerCost` en combat. */
  readonly cost: number;
  /** Un pouvoir instantané : il se lance avant l'action, sans en être une (#173). */
  readonly instant: boolean;
  /** Un pouvoir à charge : actif jusqu'à son emploi ou la fin du combat (PW3). */
  readonly charge: boolean;
  /** La part des PV d'une contre-attaque ordinaire, pour la contre-attaque du pouvoir. */
  readonly counterHpPercent?: number;
  /** La part du Brise-garde d'une contre-attaque ordinaire. */
  readonly counterGuardPercent?: number;
  /** La part des dégâts du prochain impact qui en fait. */
  readonly damageTakenPercent?: number;
}

export const POWERS: Readonly<Record<PowerKind, PowerProfile>> = {
  bulwark: {
    hero: 'sentinel',
    order: 61,
    cost: 1,
    instant: false,
    charge: true,
    counterHpPercent: 50,
    counterGuardPercent: 25,
    damageTakenPercent: 50,
  },
  shadowStep: {
    hero: 'wanderer',
    order: 66,
    cost: 3,
    instant: true,
    charge: true,
    counterHpPercent: 100,
    counterGuardPercent: 100,
  },
};

/** Le Rempart : le prochain coup subi fait 50 % de ses dégâts. */
export const BULWARK_DAMAGE_PERCENT = POWERS.bulwark.damageTakenPercent!;

const BASE_POWERS: Readonly<Record<HeroKind, PowerKind>> = {
  sentinel: 'bulwark',
  wanderer: 'shadowStep',
};

/** Le pouvoir de base (`BasePower`) d'un héros : possédé d'office (PW6). */
export function basePower(hero: HeroKind): PowerKind {
  return BASE_POWERS[hero];
}

/** Les pouvoirs de `hero` parmi `powers`, sans doublon, dans l'ordre de l'arbre. */
export function powerOrder(hero: HeroKind, powers: readonly PowerKind[]): PowerKind[] {
  return [...new Set(powers)]
    .filter((power) => POWERS[power].hero === hero)
    .sort((left, right) => POWERS[left].order - POWERS[right].order);
}
