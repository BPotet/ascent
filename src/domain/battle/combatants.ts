import type { AttackKind } from './attacks';
import type { PowerKind } from './momentum';

/**
 * La Sentinelle (`Sentinel`) : 80 PV, Attaque 10 (1 coup), Brise-garde 12, réduction des dégâts
 * 10 % (plafonnée à 40 %), trait « contre-attaque ×1,3 », pouvoir de base Rempart.
 */
export const SENTINEL: {
  readonly maxHp: number;
  readonly attackPower: number;
  readonly guardDamage: number;
  readonly damageReductionPercent: number;
  readonly counterPercent: number;
  readonly power: PowerKind;
} = {
  maxHp: 80,
  attackPower: 10,
  /** Le Brise-garde (`GuardDamage`) : les points de garde retirés par une frappe. */
  guardDamage: 12,
  damageReductionPercent: 10,
  /** Le trait : la contre-attaque vaut 50 % de l'Attaque, × 1,3. */
  counterPercent: 130,
  power: 'bulwark',
};

/** Le plafond de la réduction des dégâts d'un héros, en %. */
export const MAX_DAMAGE_REDUCTION_PERCENT = 40;
/** La part des dégâts subis sur une bonne parade (C8). */
export const GOOD_PARRY_PERCENT = 25;

export type EnemyKind = 'ghoul' | 'specter' | 'necromancer';

/** Un coup qu'un ennemi peut porter, avec ses dégâts. */
export interface Move {
  readonly attack: AttackKind;
  readonly damage: number;
}

export interface EnemyProfile {
  readonly maxHp: number;
  readonly maxGuard: number;
  readonly moves: readonly Move[];
  /** Il tire aussi les intentions Garde et Relever (le Nécromancien). */
  readonly supports: boolean;
}

/** Le premier jeu d'ennemis du palier 1, PV ×2,5 (décision du propriétaire du 23/10/2026). */
export const ENEMIES: Readonly<Record<EnemyKind, EnemyProfile>> = {
  ghoul: {
    maxHp: 50,
    maxGuard: 15,
    moves: [
      { attack: 'basic', damage: 5 },
      { attack: 'double', damage: 3 },
    ],
    supports: false,
  },
  specter: {
    maxHp: 35,
    maxGuard: 10,
    moves: [
      { attack: 'delayed', damage: 6 },
      { attack: 'feint', damage: 6 },
      // 6 × 1,5 (C2.7).
      { attack: 'perilous', damage: 9 },
    ],
    supports: false,
  },
  necromancer: {
    maxHp: 45,
    maxGuard: 12,
    moves: [{ attack: 'basic', damage: 4 }],
    supports: true,
  },
};

/** Les ennemis du combat d'essai, de gauche à droite : la Goule, le Spectre et le Nécromancien. */
export const TRIAL_BATTLE_ENEMIES: readonly EnemyKind[] = ['ghoul', 'specter', 'necromancer'];
