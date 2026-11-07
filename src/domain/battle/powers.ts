/**
 * Le registre des pouvoirs (`Power`, #235) : un profil par code, recopié des fiches du Codex de
 * l'Atelier (catégorie `power`). Le héros, l'ordre de l'arbre (et des touches), le coût en Élan,
 * le type (instantané, à charge) et les paramètres d'effet.
 *
 * Recopié de l'Atelier de l'ascension (ADR 0019), fiches actives relues le 06/11/2026 en lecture
 * seule, sha256 du JSON compact de `data`, clés triées, vérifiée avant recopie ; valeurs de `stats`
 * seulement (`name`, `buttonName` et `effectText` sont dans `powerText.ts`) :
 * - `codex/bulwark` version 1, sha256 a3e954b9164ee3097c5fbe37ab7c3392113b5caed041424a7e6e976cd1c50f35 ;
 * - `codex/retaliation` version 1, sha256 e19b49116cf17ae46a733c755327906acf9e07459b06bcc6ab10e0afba384237 ;
 * - `codex/holdFast` version 1, sha256 c56753e2c88cf52d02f46d87459fa2ff02540bf0fd2866b329240e98460add69 ;
 * - `codex/shadowStep` version 1, sha256 2ba2651624cdd93a98e22d16b22bd5fe303469a56f58a488e71caf3a7a3f669c ;
 * - `codex/rend` version 1, sha256 e64fc6380f63cc0c6664e3959ed52f11afd1bcdee9ccff0200c34ee01aa99ac5 ;
 * - `codex/mist` version 1, sha256 4a492919f9abb70ca6b04556a88eed6dc2347960209f40134e069af48d5f6e98.
 * Ne pas retoucher à la main : toute retouche passe par l'Atelier.
 */
import type { HeroKind } from './combatants';

/**
 * Les pouvoirs lançables : le pouvoir de base de chaque héros, puis les pouvoirs de son arbre sans
 * frappe de pouvoir (#235) : Représailles, Tenir bon, Entaille et Brume.
 */
export type PowerKind = 'bulwark' | 'retaliation' | 'holdFast' | 'shadowStep' | 'rend' | 'mist';

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
  /** Une fois par combat (`oncePerBattle`) : indisponible ensuite jusqu'à la fin du combat. */
  readonly oncePerBattle?: true;
  /** Le soin, en % des PV max, arrondi à l'entier inférieur, au moins `healMin`. */
  readonly healMaxHpPercent?: number;
  readonly healMin?: number;
  /** La part du Brise-garde de chaque coup de la prochaine frappe en rythme. */
  readonly guardPercentNextStrike?: number;
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
  retaliation: {
    hero: 'sentinel',
    order: 64,
    cost: 2,
    instant: true,
    charge: true,
    counterHpPercent: 200,
    counterGuardPercent: 200,
  },
  holdFast: {
    hero: 'sentinel',
    order: 65,
    cost: 3,
    instant: false,
    charge: false,
    oncePerBattle: true,
    healMaxHpPercent: 20,
    healMin: 1,
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
  rend: {
    hero: 'wanderer',
    order: 67,
    cost: 1,
    instant: true,
    charge: false,
    guardPercentNextStrike: 150,
  },
  mist: {
    hero: 'wanderer',
    order: 69,
    cost: 2,
    instant: true,
    charge: true,
    damageTakenPercent: 50,
  },
};

/** La baisse du coût d'un pouvoir attisé (`KindledPower`, #237), en Élan. */
export const KINDLED_DISCOUNT = 1;

/** Le coût d'un pouvoir attisé (#237) : 1 Élan de moins, au moins 1. */
export function kindledCost(power: PowerKind): number {
  return Math.max(1, POWERS[power].cost - KINDLED_DISCOUNT);
}

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

/**
 * `powers` n'est pas le pouvoir de base de `hero` seul : les journaux ne notent les pouvoirs
 * équipés que dans ce cas (#235, avenants des ADR 0014 et 0016).
 */
export function beyondBasePower(hero: HeroKind, powers: readonly PowerKind[]): boolean {
  return powers.length !== 1 || powers[0] !== basePower(hero);
}

/** Les pouvoirs de `hero` parmi `powers`, sans doublon, dans l'ordre de l'arbre. */
export function powerOrder(hero: HeroKind, powers: readonly PowerKind[]): PowerKind[] {
  return [...new Set(powers)]
    .filter((power) => POWERS[power].hero === hero)
    .sort((left, right) => POWERS[left].order - POWERS[right].order);
}
