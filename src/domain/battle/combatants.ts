import type { AttackKind } from './attacks';

/** La Sentinelle (`Sentinel`) : 80 PV, Attaque 10 (1 coup), réduction des dégâts 10 %, trait « contre-attaque ×1,3 ». */
export const SENTINEL = {
  maxHp: 80,
  attackPower: 10,
  damageReductionPercent: 10,
  /** Le trait : la contre-attaque vaut 50 % de l'Attaque, × 1,3. */
  counterPercent: 130,
} as const;

/** La part de l'Attaque que vaut une contre-attaque, avant le trait. */
export const COUNTER_BASE_PERCENT = 50;
/** La part des dégâts subis sur une bonne parade (C8). */
export const GOOD_PARRY_PERCENT = 25;

export type EnemyKind = 'ghoul' | 'specter';

/** Un coup qu'un ennemi peut annoncer, avec ses dégâts. */
export interface Move {
  readonly attack: AttackKind;
  readonly damage: number;
}

export interface EnemyProfile {
  readonly maxHp: number;
  readonly moves: readonly Move[];
}

export const ENEMIES: Readonly<Record<EnemyKind, EnemyProfile>> = {
  ghoul: {
    maxHp: 20,
    moves: [
      { attack: 'basic', damage: 5 },
      { attack: 'double', damage: 3 },
    ],
  },
  specter: {
    maxHp: 14,
    moves: [
      { attack: 'delayed', damage: 6 },
      { attack: 'feint', damage: 6 },
      // Pour l'essai seulement : 6 × 1,5, pour exercer les cinq types de coups.
      { attack: 'perilous', damage: 9 },
    ],
  },
};

/** Les ennemis du combat d'essai, de gauche à droite : une Goule et un Spectre. */
export const TRIAL_BATTLE_ENEMIES: readonly EnemyKind[] = ['ghoul', 'specter'];
