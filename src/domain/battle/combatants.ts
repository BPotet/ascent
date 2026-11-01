import type { AttackKind } from './attacks';
import { heroInitiative } from './initiative';
import type { PowerKind } from './momentum';
import type { BulwarkCounterShares } from './strike';

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
  /**
   * Le pouvoir instantané (`powerInstant`, #173) : il se lance pendant la phase du héros, avant
   * son action, sans être une action (ni durée d'action, ni transition de phase).
   */
  readonly powerInstant: boolean;
  /** La Riposte du Rempart (#128) ; absente, le Rempart ne riposte pas. */
  readonly bulwarkCounter?: BulwarkCounterShares;
  /** Le trait de l'Errante : chaque impact esquivé dans la fenêtre de parade donne +1 Élan. */
  readonly dodgeMomentum: boolean;
  readonly startingKit: StartingKit;
}

/**
 * La Sentinelle (`Sentinel`) : 80 PV, Attaque 10 (1 coup), Brise-garde 12, réduction des dégâts
 * 10 % (plafonnée à 40 %), trait « contre-attaque ×1,3 », pouvoir de base Rempart, qui riposte
 * (#128).
 */
export const SENTINEL: {
  readonly maxHp: number;
  readonly attackPower: number;
  readonly guardDamage: number;
  readonly damageReductionPercent: number;
  readonly counterPercent: number;
  readonly power: PowerKind;
  readonly bulwarkCounter: BulwarkCounterShares;
} = {
  maxHp: 80,
  attackPower: 10,
  /** Le Brise-garde (`GuardDamage`) : les points de garde retirés par une frappe. */
  guardDamage: 12,
  damageReductionPercent: 10,
  /** Le trait : la contre-attaque vaut 50 % de l'Attaque, × 1,3. */
  counterPercent: 130,
  power: 'bulwark',
  /** Les valeurs du Codex (`sentinel`), recopiées le 29/10/2026 (#128). */
  bulwarkCounter: { bulwarkCounterPercent: 50, bulwarkCounterGuardPercent: 25 },
};

/**
 * Les héros (section 2 des règles du prototype #88, provisoires). La Sentinelle, avec son
 * Initiative et son équipement de base. L'Errante (Codex `wanderer` v3, #173) : 55 PV, Attaque 6 ×
 * 2 coups (le 2e à +300 ms), Brise-garde 5 par coup, aucune réduction, contre-attaque à 200 % (P10),
 * trait d'esquive, Pas de l'ombre en pouvoir instantané.
 */
export const HEROES: Readonly<Record<HeroKind, HeroProfile>> = {
  sentinel: {
    ...SENTINEL,
    initiative: 5,
    hits: 1,
    hitIntervalMs: 0,
    powerInstant: false,
    dodgeMomentum: false,
    startingKit: { weapon: 'shortSword', armor: 'dentedCuirass' },
  },
  wanderer: {
    maxHp: 55,
    initiative: 7,
    attackPower: 6,
    hits: 2,
    hitIntervalMs: 300,
    guardDamage: 5,
    damageReductionPercent: 0,
    counterPercent: 200,
    power: 'shadowStep',
    powerInstant: true,
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
  | 'ghoul'
  | 'specter'
  | 'necromancer'
  | 'fallenKnight'
  | 'twins'
  | 'ossuaryWarden'
  | 'facelessPrior'
  | 'skeleton'
  | 'madVillager'
  // Les paliers 2 et 3 (#38) : ennemis ordinaires, Élites, puis boss.
  | 'thornPilgrim'
  | 'ashBramble'
  | 'ashGleaner'
  | 'bronzeWarden'
  | 'scarecrow'
  | 'firstPilgrim'
  | 'stoneSaint'
  | 'ashGardener'
  | 'hourRinger'
  | 'wishGranter';

/** Le Saignement (`Bleed`, prototype #107) : `damage` PV perdus au début de `rounds` manches. */
export interface Bleed {
  readonly damage: number;
  readonly rounds: number;
}

/** Un coup qu'un ennemi peut porter, avec ses dégâts. */
export interface Move {
  readonly attack: AttackKind;
  readonly damage: number;
  /** Son poids dans le tirage du coup (K6) : 1 par défaut. */
  readonly weight?: number;
  /** Le Saignement qu'il inflige au héros (prototype #107). */
  readonly bleed?: Bleed;
}

export interface EnemyProfile {
  readonly maxHp: number;
  readonly maxGuard: number;
  readonly moves: readonly Move[];
  /** Il tire aussi les intentions Garde et Relever (le Nécromancien, la Glaneuse de cendre). */
  readonly supports: boolean;
  /** Les coups qui s'ajoutent en phase 2 (boss, `BossPhaseShift`). */
  readonly phase2Moves?: readonly Move[];
  /**
   * Le changement de phase d'un boss (`phaseShiftPercent` du Codex, #38) : à ce pourcentage de ses
   * PV max ou moins (50 % : 150 PV de 300, 210 de 420, 250 de 500).
   */
  readonly phaseShiftPercent?: number;
  /** L'Initiative d'un boss en phase 2 (P13), à partir de la manche qui suit le changement. */
  readonly phase2Initiative?: number;
  /** Se relève seul (`SelfRevive`, #106) : `times` fois par combat, à `hpPercent` % de ses PV max. */
  readonly selfRevive?: { readonly times: number; readonly hpPercent: number };
}

/** Le changement de phase d'un boss : à 50 % de ses PV max ou moins (P6, #38). */
const BOSS_PHASE_SHIFT_PERCENT = 50;

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
  // La 2e Élite, prototype #108 : les valeurs du Codex (`twins`), dégâts tels quels (D6).
  twins: {
    maxHp: 200,
    maxGuard: 30,
    moves: [
      { attack: 'double', damage: 6, weight: 2 },
      { attack: 'delayedPerilous', damage: 10 },
      { attack: 'basic', damage: 5 },
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
    phaseShiftPercent: BOSS_PHASE_SHIFT_PERCENT,
    phase2Initiative: 9,
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
    phaseShiftPercent: BOSS_PHASE_SHIFT_PERCENT,
    phase2Initiative: 9,
    supports: false,
  },
  // Le Squelette (#106) : valeurs du Codex (`nouvelEnnemi`, Actif) recopiées le 28/10/2026.
  skeleton: {
    maxHp: 35,
    maxGuard: 10,
    // Tir à l'arc.
    moves: [{ attack: 'basic', damage: 5 }],
    supports: false,
    selfRevive: { times: 1, hpPercent: 50 },
  },
  // Le Villageois fou, valeurs du Codex (prototype #107) : la Fourche, puis le Coup de manche.
  madVillager: {
    maxHp: 35,
    maxGuard: 12,
    moves: [
      { attack: 'basic', damage: 5, bleed: { damage: 2, rounds: 3 } },
      { attack: 'basic', damage: 5 },
    ],
    supports: false,
  },
  // Les paliers 2 et 3 (#38) : valeurs du Codex de l'Atelier recopiées le 01/11/2026, à l'échelle
  // du palier 1 pour les ennemis ordinaires (le palier les multiplie), telles quelles pour les
  // Élites et les boss. Le Codex dit la sha256 de chaque fiche.
  // `codex/thornPilgrim` (214fc3fb…): Prière d'épines, puis Bourdon.
  thornPilgrim: {
    maxHp: 60,
    maxGuard: 20,
    moves: [
      { attack: 'delayed', damage: 7, bleed: { damage: 2, rounds: 3 } },
      { attack: 'basic', damage: 6 },
    ],
    supports: false,
  },
  // `codex/ashBramble` (ed09a2e1…): Fouet de ronce, puis Épine ; se relève seul 2 fois, à 30 %.
  ashBramble: {
    maxHp: 30,
    maxGuard: 10,
    moves: [
      { attack: 'double', damage: 3 },
      { attack: 'basic', damage: 4 },
    ],
    supports: false,
    selfRevive: { times: 2, hpPercent: 30 },
  },
  // `codex/ashGleaner` (d37ed0c5…): Râteau ; soutien, Garde 33 % des fois, comme le Nécromancien.
  ashGleaner: {
    maxHp: 40,
    maxGuard: 14,
    moves: [{ attack: 'basic', damage: 4 }],
    supports: true,
  },
  // `codex/bronzeWarden` (60712ff9…): Poing d'airain (poids 2), puis Glas.
  bronzeWarden: {
    maxHp: 65,
    maxGuard: 24,
    moves: [
      { attack: 'basic', damage: 6, weight: 2 },
      { attack: 'delayedPerilous', damage: 9 },
    ],
    supports: false,
  },
  // `codex/scarecrow` (9815a44f…), Élite : Faucille, Bras ballant, Moisson ; se relève seul 1 fois, à 40 %.
  scarecrow: {
    maxHp: 190,
    maxGuard: 35,
    moves: [
      { attack: 'basic', damage: 11 },
      { attack: 'feint', damage: 11 },
      { attack: 'perilous', damage: 16 },
    ],
    supports: false,
    selfRevive: { times: 1, hpPercent: 40 },
  },
  // `codex/firstPilgrim` (d3c0c868…), Élite : Pas des Jumeaux, Visage du Prieur, Garde du Chevalier, Dernier pas.
  firstPilgrim: {
    maxHp: 270,
    maxGuard: 55,
    moves: [
      { attack: 'double', damage: 8 },
      { attack: 'feint', damage: 14 },
      { attack: 'delayed', damage: 14 },
      { attack: 'perilous', damage: 21 },
    ],
    supports: false,
  },
  // `codex/stoneSaint` (d1a53b44…), Élite : Bénédiction de pierre, Pénitence, Chute du clocher.
  stoneSaint: {
    maxHp: 250,
    maxGuard: 80,
    moves: [
      { attack: 'basic', damage: 13 },
      { attack: 'delayed', damage: 16 },
      { attack: 'delayedPerilous', damage: 22 },
    ],
    supports: false,
  },
  // `codex/ashGardener` (0fc5cb06…), boss : Sécateur, Taille ; en phase 2, + Ronces, Mise en terre.
  ashGardener: {
    maxHp: 420,
    maxGuard: 78,
    moves: [
      { attack: 'basic', damage: 12 },
      { attack: 'delayed', damage: 13 },
    ],
    phase2Moves: [
      { attack: 'double', damage: 7, bleed: { damage: 3, rounds: 3 } },
      { attack: 'delayedPerilous', damage: 18 },
    ],
    phaseShiftPercent: BOSS_PHASE_SHIFT_PERCENT,
    phase2Initiative: 7,
    supports: false,
  },
  // `codex/hourRinger` (3d263a47…), boss : Carillon, Heure suspendue ; + Fausse heure, Glas de minuit.
  hourRinger: {
    maxHp: 500,
    maxGuard: 90,
    moves: [
      { attack: 'double', damage: 7 },
      { attack: 'delayed', damage: 14 },
    ],
    phase2Moves: [
      { attack: 'feint', damage: 13 },
      { attack: 'delayedPerilous', damage: 21 },
    ],
    phaseShiftPercent: BOSS_PHASE_SHIFT_PERCENT,
    phase2Initiative: 8,
    supports: false,
  },
  // `codex/wishGranter` (d0b4851f…), boss : Main tendue, Promesse ; + Deux vœux, Vœu exaucé.
  wishGranter: {
    maxHp: 500,
    maxGuard: 84,
    moves: [
      { attack: 'basic', damage: 13 },
      { attack: 'feint', damage: 13 },
    ],
    phase2Moves: [
      { attack: 'double', damage: 8 },
      { attack: 'perilous', damage: 22 },
    ],
    phaseShiftPercent: BOSS_PHASE_SHIFT_PERCENT,
    phase2Initiative: 9,
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
  twins: 7,
  ossuaryWarden: 6,
  facelessPrior: 6,
  skeleton: 6,
  madVillager: 5,
  // Les paliers 2 et 3 (#38), celles du Codex : jamais multipliées par le palier.
  thornPilgrim: 2,
  ashBramble: 5,
  ashGleaner: 3,
  bronzeWarden: 2,
  scarecrow: 5,
  firstPilgrim: 8,
  stoneSaint: 3,
  ashGardener: 4,
  hourRinger: 5,
  wishGranter: 6,
};
