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
  | 'wishGranter'
  // La Brûlure (#171) : l'Embrasé, la Gargouille, le Fondeur de cloches, puis l'Élite.
  | 'burningHusk'
  | 'gargoyle'
  | 'bellFounder'
  | 'brambleBurner'
  // L'Invocation (#172) : la Reine des phalènes, boss du palier 2, et ses Phalénides.
  | 'mothQueen'
  | 'mothkin'
  // Le Beffroi (#214) : le Novice des cloches, la Sonneuse de matines et le Jaquemart.
  | 'bellNovice'
  | 'matinsRinger'
  | 'clockJack';

/** Le Saignement (`Bleed`, prototype #107) : `damage` PV perdus au début de `rounds` manches. */
export interface Bleed {
  readonly damage: number;
  readonly rounds: number;
}

/**
 * L'Invocation (`Summon`, #172, champ `summon` d'une phase de boss du Codex) : au changement de
 * phase, le boss appelle jusqu'à `count` ennemis `enemy` (nom de code) aux places libres de la
 * première ligne. La règle est dans `summon.ts`.
 */
export interface Summon {
  readonly enemy: EnemyKind;
  readonly count: 1 | 2;
}

/** Un coup qu'un ennemi peut porter, avec ses dégâts. */
export interface Move {
  readonly attack: AttackKind;
  readonly damage: number;
  /** Son poids dans le tirage du coup (K6) : 1 par défaut. */
  readonly weight?: number;
  /** Le Saignement qu'il inflige au héros (prototype #107). */
  readonly bleed?: Bleed;
  /** Les charges de Brûlure qu'il allume (`stacks` du modificateur `burn` du Codex, #171), 1 à 3. */
  readonly burn?: number;
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
  /** L'Invocation de sa phase 2 (#172) ; absente, le boss n'appelle personne. */
  readonly phase2Summon?: Summon;
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
  // `codex/scarecrow` v3 (0126979e…), Élite : Faucille, Bras ballant, Moisson ; se relève seul 1 fois,
  // à 40 %. Garde 50 (#211).
  scarecrow: {
    maxHp: 190,
    maxGuard: 50,
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
  // La Brûlure (#171) : valeurs du Codex de l'Atelier recopiées le 01/11/2026, à l'échelle du
  // palier 1 pour les ennemis ordinaires, telles quelles pour l'Élite. « Une chance sur deux » et
  // « un tiers chacun » : des coups à poids égaux. Le nom de code de `codex/smolderingBrand` est
  // `burningHusk`.
  // `codex/smolderingBrand` (2256be2b…): Main de braise (poids 2), puis Embrasement.
  burningHusk: {
    maxHp: 20,
    maxGuard: 8,
    moves: [
      { attack: 'basic', damage: 4, weight: 2, burn: 1 },
      { attack: 'perilous', damage: 8 },
    ],
    supports: false,
  },
  // `codex/gargoyle` (65e5fd1d…): Piqué de pierre, puis Gueule de feu.
  gargoyle: {
    maxHp: 30,
    maxGuard: 22,
    moves: [
      { attack: 'feint', damage: 5 },
      { attack: 'delayed', damage: 3, burn: 1 },
    ],
    supports: false,
  },
  // `codex/bellFounder` (3b84a4e7…): Marteau de fonte, puis Coulée.
  bellFounder: {
    maxHp: 42,
    maxGuard: 14,
    moves: [
      { attack: 'double', damage: 3 },
      { attack: 'delayed', damage: 4, burn: 1 },
    ],
    supports: false,
  },
  // `codex/brambleBurner` v4 (4ac53d4f…), Élite : Torche, Fagot d'épines, Feu de broussailles.
  // Garde 55 (#211).
  brambleBurner: {
    maxHp: 210,
    maxGuard: 55,
    moves: [
      { attack: 'basic', damage: 10, burn: 2 },
      { attack: 'double', damage: 6, bleed: { damage: 2, rounds: 3 } },
      { attack: 'delayedPerilous', damage: 15 },
    ],
    supports: false,
  },
  // L'Invocation (#172) : valeurs du Codex de l'Atelier recopiées le 03/11/2026, à l'échelle du
  // palier 1 pour la Phalénide (le palier multiplie aussi les Phalénides invoquées), telles quelles
  // pour la Reine. « Un tiers chacun », « une chance sur deux » : des coups à poids égaux.
  // `codex/mothQueen` (af0af679…), boss : Voile de poussière, Ailes de cendre ; en phase 2, +
  // Flamme de la lampe et l'Invocation de deux Phalénides.
  mothQueen: {
    maxHp: 400,
    maxGuard: 70,
    moves: [
      { attack: 'feint', damage: 11 },
      { attack: 'double', damage: 6 },
    ],
    phase2Moves: [{ attack: 'perilous', damage: 19 }],
    phaseShiftPercent: BOSS_PHASE_SHIFT_PERCENT,
    phase2Initiative: 11,
    phase2Summon: { enemy: 'mothkin', count: 2 },
    supports: false,
  },
  // `codex/ashMoth` (593d7c38…), nom de code `mothkin` : Vol brisé, puis Mandibules.
  mothkin: {
    maxHp: 25,
    maxGuard: 6,
    moves: [
      { attack: 'feint', damage: 4 },
      { attack: 'double', damage: 3 },
    ],
    supports: false,
  },
  // Le Beffroi (#214) : valeurs du Codex de l'Atelier (version 2, 04/11/2026), recopiées le
  // 05/11/2026, à l'échelle du palier 1. La Sonneuse de matines a le rôle soutien (`role:
  // "support"`) : Relever et Garde.
  // `codex/bellNovice` (0a96b76b…): Bout de corde (poids 2), puis Volée manquée.
  bellNovice: {
    maxHp: 26,
    maxGuard: 8,
    moves: [
      { attack: 'basic', damage: 4, weight: 2 },
      { attack: 'delayed', damage: 6 },
    ],
    supports: false,
  },
  // `codex/matinsRinger` (27cccb02…): Angélus ; soutien : Relever et Garde.
  matinsRinger: {
    maxHp: 42,
    maxGuard: 16,
    moves: [{ attack: 'delayed', damage: 4 }],
    supports: true,
  },
  // `codex/clockJack` (77c063ab…): Demi-heure (poids 2), puis Heure pleine.
  clockJack: {
    maxHp: 48,
    maxGuard: 20,
    moves: [
      { attack: 'double', damage: 3, weight: 2 },
      { attack: 'perilous', damage: 9 },
    ],
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
  // La Brûlure (#171), celles du Codex.
  burningHusk: 7,
  gargoyle: 7,
  bellFounder: 4,
  brambleBurner: 6,
  // L'Invocation (#172), celles du Codex ; 11 pour la Reine en phase 2.
  mothQueen: 8,
  mothkin: 10,
  // Le Beffroi (#214), celles du Codex.
  bellNovice: 6,
  matinsRinger: 3,
  clockJack: 1,
};
