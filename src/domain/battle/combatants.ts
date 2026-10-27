import type { AttackKind } from './attacks';
import { heroInitiative } from './initiative';
import type { PowerKind } from './momentum';

/** Les héros jouables : la Sentinelle (`Sentinel`) et, en prototype (#90), l'Errante (`Wanderer`). */
export type HeroKind = 'sentinel' | 'wanderer';

/** Les armes de l'équipement de base : l'Épée courte et les Dagues jumelles. */
export type Weapon = 'shortSword' | 'twinDaggers';
/** Les armures de l'équipement de base : la Cuirasse cabossée et la Cape usée. */
export type Armor = 'dentedCuirass' | 'wornCloak';

/** Le bonus d'Initiative de chaque pièce d'équipement (P12 : neutres, sans autre effet). */
export const WEAPONS: Readonly<Record<Weapon, { readonly initiative: number }>> = {
  shortSword: { initiative: 0 },
  twinDaggers: { initiative: 0 },
};
export const ARMORS: Readonly<Record<Armor, { readonly initiative: number }>> = {
  dentedCuirass: { initiative: 0 },
  wornCloak: { initiative: 0 },
};

/** L'équipement de base (`StartingKit`) d'un héros. */
export interface StartingKit {
  readonly weapon: Weapon;
  readonly armor: Armor;
}

export interface HeroProfile {
  readonly maxHp: number;
  readonly initiative: number;
  /** L'Attaque, par coup. */
  readonly attackPower: number;
  /** Le nombre de coups d'une frappe (P12 : celui du héros, quelle que soit l'arme). */
  readonly hits: number;
  /** L'écart entre deux coups d'une frappe, en ms. */
  readonly hitIntervalMs: number;
  /** Le Brise-garde (`GuardDamage`) : les points de garde retirés par un coup. */
  readonly guardDamage: number;
  readonly damageReductionPercent: number;
  /** La contre-attaque vaut 50 % de l'Attaque, × ce pourcentage. */
  readonly counterPercent: number;
  readonly power: PowerKind;
  /** Le trait de l'Errante : chaque impact esquivé dans la fenêtre de parade donne +1 Élan. */
  readonly dodgeMomentum: boolean;
  readonly startingKit: StartingKit;
}

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

/**
 * Les héros (section 2 des règles du prototype #88, provisoires). La Sentinelle, avec son
 * Initiative et son équipement de base. L'Errante : 60 PV, Attaque 6 × 2 coups (le 2e à +300 ms),
 * Brise-garde 5 par coup, aucune réduction, contre-attaque à 200 % (P10), trait d'esquive, Pas de
 * l'ombre.
 */
export const HEROES: Readonly<Record<HeroKind, HeroProfile>> = {
  sentinel: {
    ...SENTINEL,
    initiative: 5,
    hits: 1,
    hitIntervalMs: 0,
    dodgeMomentum: false,
    startingKit: { weapon: 'shortSword', armor: 'dentedCuirass' },
  },
  wanderer: {
    maxHp: 60,
    initiative: 7,
    attackPower: 6,
    hits: 2,
    hitIntervalMs: 300,
    guardDamage: 5,
    damageReductionPercent: 0,
    counterPercent: 200,
    power: 'shadowStep',
    dodgeMomentum: true,
    startingKit: { weapon: 'twinDaggers', armor: 'wornCloak' },
  },
};

/** L'Initiative d'un héros avec son équipement de base (P15). */
export function startingInitiative(kind: HeroKind): number {
  const { initiative, startingKit } = HEROES[kind];
  return heroInitiative(
    initiative,
    WEAPONS[startingKit.weapon].initiative,
    ARMORS[startingKit.armor].initiative,
  );
}

/** Le plafond de la réduction des dégâts d'un héros, en %. */
export const MAX_DAMAGE_REDUCTION_PERCENT = 40;
/** La part des dégâts subis sur une bonne parade (C8). */
export const GOOD_PARRY_PERCENT = 25;

export type EnemyKind =
  'ghoul' | 'specter' | 'necromancer' | 'fallenKnight' | 'ossuaryWarden' | 'facelessPrior';

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
  /** Les coups qui s'ajoutent en phase 2 (boss, `BossPhaseShift`). */
  readonly phase2Moves?: readonly Move[];
  /** Les PV à partir desquels un boss change de phase (150 ou moins). */
  readonly phaseShiftHp?: number;
}

/** Le changement de phase d'un boss : à 150 PV ou moins (P6). */
export const BOSS_PHASE_SHIFT_HP = 150;

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
  // L'Élite (P4), prototype #91.
  fallenKnight: {
    maxHp: 200,
    maxGuard: 45,
    moves: [
      { attack: 'basic', damage: 8 },
      { attack: 'delayed', damage: 8 },
      { attack: 'perilous', damage: 12 },
    ],
    supports: false,
  },
  // Les boss (P6), prototype #91 : ½ par coup en phase 1, ¼ en phase 2.
  ossuaryWarden: {
    maxHp: 300,
    maxGuard: 60,
    moves: [
      { attack: 'basic', damage: 9 },
      { attack: 'delayed', damage: 10 },
    ],
    phase2Moves: [
      { attack: 'double', damage: 6 },
      { attack: 'perilous', damage: 15 },
    ],
    phaseShiftHp: BOSS_PHASE_SHIFT_HP,
    supports: false,
  },
  facelessPrior: {
    maxHp: 300,
    maxGuard: 60,
    moves: [
      { attack: 'feint', damage: 8 },
      { attack: 'double', damage: 5 },
    ],
    phase2Moves: [
      { attack: 'delayed', damage: 10 },
      { attack: 'perilous', damage: 14 },
    ],
    phaseShiftHp: BOSS_PHASE_SHIFT_HP,
    supports: false,
  },
};

/**
 * L'Initiative des ennemis (P13, prototype #90). Une table par type d'ennemi : tout nouvel
 * ennemi doit y recevoir la sienne, sinon la vérification des types échoue.
 */
export const ENEMY_INITIATIVE: Readonly<Record<EnemyKind, number>> = {
  ghoul: 4,
  specter: 8,
  necromancer: 3,
  fallenKnight: 6,
  ossuaryWarden: 6,
  facelessPrior: 6,
};

/** Les ennemis du combat d'essai, de gauche à droite : la Goule, le Spectre et le Nécromancien. */
export const TRIAL_BATTLE_ENEMIES: readonly EnemyKind[] = ['ghoul', 'specter', 'necromancer'];
