import type { AttackKind } from './attacks';
import { heroInitiative } from './initiative';
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
  readonly bulwarkCounter: BulwarkCounterShares;
} = {
  maxHp: 80,
  attackPower: 10,
  /** Le Brise-garde (`GuardDamage`) : les points de garde retirés par une frappe. */
  guardDamage: 12,
  damageReductionPercent: 10,
  /** Le trait : la contre-attaque vaut 50 % de l'Attaque, × 1,3. */
  counterPercent: 130,
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
  | 'clockJack'
  // Le Fossoyeur (#258), 3e Élite des Catacombes.
  | 'gravedigger'
  // La Mère-ronce et le Bedeau (#259), 3es Élites des Jardins de cendre et du Beffroi.
  | 'brambleMother'
  | 'beadle'
  // Le Bélier de bronze et le Battant de cloche (#266), ennemis ordinaires du Beffroi.
  | 'bronzeRam'
  | 'bellClapper'
  // La Cosse de braise et la Phalène voleuse (#267), ennemis ordinaires des Jardins de cendre.
  | 'emberPod'
  | 'thievingMoth'
  // Le Porte-cierge et le Rat de crypte (#268), ennemis ordinaires des Catacombes.
  | 'candleBearer'
  | 'cryptRat';

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

/**
 * Exhumer (`Exhume`, #258, champ `exhume` du Codex) : au début de chaque manche paire, il exhume un
 * ennemi `enemy` (nom de code) à la première place libre de la première ligne, tant qu'aucun des
 * ennemis qu'il a exhumés n'est debout (`maxStanding`). La règle est dans `exhume.ts`.
 */
export interface Exhume {
  readonly enemy: EnemyKind;
  readonly rounds: 'even';
  readonly maxStanding: 1;
}

/**
 * Les Épines (`Thorns`, #259, champ `thorns` du Codex) : chaque frappe du héros qui touche l'ennemi
 * non étourdi coûte `damage` PV au héros, une fois par frappe, jamais sous 1 PV. La règle est dans
 * `thorns.ts`.
 */
export interface Thorns {
  readonly damage: number;
}

/**
 * Le Sanctuaire (`Sanctuary`, #259, champ `sanctuary` du Codex) : tant que sa garde est au-dessus de
 * 0 et qu'il n'est pas étourdi, chaque coup du héros ne lui retire que `damagePercent` % des PV. La
 * règle est dans `sanctuary.ts`.
 */
export interface Sanctuary {
  readonly damagePercent: number;
}

/**
 * L'Éclatement (`EmberBurst`, #267, champ `burst` du Codex) : quand l'ennemi tombe sous un coup du
 * héros sans être étourdi avant ce coup, le héros prend `stacks` charges de Brûlure. Ni le palier ni
 * la malédiction ne les changent. La règle est dans `emberBurst.ts`.
 */
export interface EmberBurst {
  readonly stacks: number;
}

/**
 * Le Vol d'Élan (`MomentumTheft`, #267, champ `momentumTheft` du Codex) : chaque impact de ses coups
 * qui touche le héros lui retire `amount` Élan, au plancher de 0. Ni le palier ni la malédiction ne
 * le changent. La règle est dans `momentumTheft.ts`.
 */
export interface MomentumTheft {
  readonly amount: number;
}

/**
 * L'Aura (`Aura`, #268, champ `aura` du Codex) : tant que le Porte-cierge est debout en première
 * ligne, étourdi ou non, chaque coup des autres ennemis fait `damagePercent` % de dégâts en plus, au
 * moins +1, par impact. La règle est dans `aura.ts`.
 */
export interface Aura {
  readonly damagePercent: number;
}

/**
 * La Nuée (`Swarm`, #268, champ `swarm` du Codex) : chaque impact d'un Rat de crypte fait
 * `damagePerAlly` dégâts en plus par autre Rat de crypte debout, non étourdi, en première ligne. La
 * règle est dans `swarm.ts`.
 */
export interface Swarm {
  readonly damagePerAlly: number;
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
  /**
   * La Charge (#266, modificateur `charge` du Codex) : tiré, ce coup s'annonce par l'intention
   * Charge et part à la manche suivante. La règle est dans `intents.ts` et `Battle.ts`.
   */
  readonly charge?: true;
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
  /** Exhumer (#258) ; absent, il n'exhume personne. */
  readonly exhume?: Exhume;
  /** Les Épines (#259) ; absentes, une frappe ne coûte rien au héros. */
  readonly thorns?: Thorns;
  /** Le Sanctuaire (#259) ; absent, les coups du héros ne sont pas réduits. */
  readonly sanctuary?: Sanctuary;
  /** L'Éclatement (#267) ; absent, sa chute ne brûle pas le héros. */
  readonly emberBurst?: EmberBurst;
  /** Le Vol d'Élan (#267) ; absent, ses impacts ne volent pas d'Élan. */
  readonly momentumTheft?: MomentumTheft;
  /** L'Aura (#268) ; absente, il ne renforce pas les coups de ses alliés. */
  readonly aura?: Aura;
  /** La Nuée (#268) ; absente, ses coups ne gagnent rien des siens. */
  readonly swarm?: Swarm;
}

/** Le changement de phase d'un boss : à 50 % de ses PV max ou moins (P6, #38). */
const BOSS_PHASE_SHIFT_PERCENT = 50;

/**
 * Le premier jeu d'ennemis du palier 1, PV ×2,5 (décision du propriétaire du 23/10/2026). La garde
 * des 16 ennemis ordinaires est doublée dans le Codex (#244, G2), recopiée telle quelle.
 */
export const ENEMIES: Readonly<Record<EnemyKind, EnemyProfile>> = {
  // `codex/ghoul` v3 (31a68786…).
  ghoul: {
    maxHp: 50,
    maxGuard: 30,
    moves: [
      { attack: 'basic', damage: 5 },
      { attack: 'double', damage: 3 },
    ],
    supports: false,
  },
  // `codex/specter` v3 (76f98cad…).
  specter: {
    maxHp: 35,
    maxGuard: 20,
    moves: [
      { attack: 'delayed', damage: 6 },
      { attack: 'feint', damage: 6 },
      // 6 × 1,5 (C2.7).
      { attack: 'perilous', damage: 9 },
    ],
    supports: false,
  },
  // `codex/necromancer` v5 (967b8d4c…).
  necromancer: {
    maxHp: 45,
    maxGuard: 24,
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
  // `codex/nouvelEnnemi` v29 (6870e5af…).
  skeleton: {
    maxHp: 35,
    maxGuard: 20,
    // Tir à l'arc.
    moves: [{ attack: 'basic', damage: 5 }],
    supports: false,
    selfRevive: { times: 1, hpPercent: 50 },
  },
  // Le Villageois fou, valeurs du Codex (prototype #107) : la Fourche, puis le Coup de manche.
  // `codex/nouvelEnnemi2` v34 (dec1e963…).
  madVillager: {
    maxHp: 35,
    maxGuard: 24,
    moves: [
      { attack: 'basic', damage: 5, bleed: { damage: 2, rounds: 3 } },
      { attack: 'basic', damage: 5 },
    ],
    supports: false,
  },
  // Les paliers 2 et 3 (#38) : valeurs du Codex de l'Atelier recopiées le 01/11/2026, à l'échelle
  // du palier 1 pour les ennemis ordinaires (le palier les multiplie), telles quelles pour les
  // Élites et les boss (multipliées au combat par le multiplicateur d'Élite et de boss, #244). Le
  // Codex dit la sha256 de chaque fiche (JSON compact, clés triées), relevée avec sa version le
  // 07/11/2026 (#244).
  // `codex/thornPilgrim` v3 (6540aa3a…): Prière d'épines, puis Bourdon.
  thornPilgrim: {
    maxHp: 60,
    maxGuard: 40,
    moves: [
      { attack: 'delayed', damage: 7, bleed: { damage: 2, rounds: 3 } },
      { attack: 'basic', damage: 6 },
    ],
    supports: false,
  },
  // `codex/ashBramble` v3 (d820769f…): Fouet de ronce, puis Épine ; se relève seul 2 fois, à 30 %.
  ashBramble: {
    maxHp: 30,
    maxGuard: 20,
    moves: [
      { attack: 'double', damage: 3 },
      { attack: 'basic', damage: 4 },
    ],
    supports: false,
    selfRevive: { times: 2, hpPercent: 30 },
  },
  // `codex/ashGleaner` v3 (9636b78c…): Râteau ; soutien, Garde 33 % des fois, comme le Nécromancien.
  ashGleaner: {
    maxHp: 40,
    maxGuard: 28,
    moves: [{ attack: 'basic', damage: 4 }],
    supports: true,
  },
  // `codex/bronzeWarden` v3 (21998f92…): Poing d'airain (poids 2), puis Glas.
  bronzeWarden: {
    maxHp: 65,
    maxGuard: 48,
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
  // `codex/firstPilgrim` v2 (88c3709b…), Élite : Pas des Jumeaux, Visage du Prieur, Garde du Chevalier, Dernier pas.
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
  // `codex/stoneSaint` v2 (10dc891d…), Élite : Bénédiction de pierre, Pénitence, Chute du clocher.
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
  // `codex/ashGardener` v2 (e1bc051e…), boss : Sécateur, Taille ; en phase 2, + Ronces, Mise en terre.
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
  // `codex/hourRinger` v2 (652b2395…), boss : Carillon, Heure suspendue ; + Fausse heure, Glas de minuit.
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
  // `codex/wishGranter` v2 (b814cf17…), boss : Main tendue, Promesse ; + Deux vœux, Vœu exaucé.
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
  // `codex/smolderingBrand` v4 (555047c9…): Main de braise (poids 2), puis Embrasement.
  burningHusk: {
    maxHp: 20,
    maxGuard: 16,
    moves: [
      { attack: 'basic', damage: 4, weight: 2, burn: 1 },
      { attack: 'perilous', damage: 8 },
    ],
    supports: false,
  },
  // `codex/gargoyle` v4 (6f6d8cbb…): Piqué de pierre, puis Gueule de feu.
  gargoyle: {
    maxHp: 30,
    maxGuard: 44,
    moves: [
      { attack: 'feint', damage: 5 },
      { attack: 'delayed', damage: 3, burn: 1 },
    ],
    supports: false,
  },
  // `codex/bellFounder` v4 (0dd26622…): Marteau de fonte, puis Coulée.
  bellFounder: {
    maxHp: 42,
    maxGuard: 28,
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
  // `codex/mothQueen` v3 (a7095d17…), boss : Voile de poussière, Ailes de cendre ; en phase 2, +
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
  // `codex/ashMoth` v4 (8ce25db7…), nom de code `mothkin` : Vol brisé, puis Mandibules.
  mothkin: {
    maxHp: 25,
    maxGuard: 12,
    moves: [
      { attack: 'feint', damage: 4 },
      { attack: 'double', damage: 3 },
    ],
    supports: false,
  },
  // Le Beffroi (#214) : valeurs du Codex de l'Atelier (version 2, 04/11/2026), recopiées le
  // 05/11/2026, à l'échelle du palier 1. La Sonneuse de matines a le rôle soutien (`role:
  // "support"`) : Relever et Garde.
  // `codex/bellNovice` v3 (93b9be88…): Bout de corde (poids 2), puis Volée manquée.
  bellNovice: {
    maxHp: 26,
    maxGuard: 16,
    moves: [
      { attack: 'basic', damage: 4, weight: 2 },
      { attack: 'delayed', damage: 6 },
    ],
    supports: false,
  },
  // `codex/matinsRinger` v3 (2db12352…): Angélus ; soutien : Relever et Garde.
  matinsRinger: {
    maxHp: 42,
    maxGuard: 32,
    moves: [{ attack: 'delayed', damage: 4 }],
    supports: true,
  },
  // `codex/clockJack` v3 (0304b3c6…): Demi-heure (poids 2), puis Heure pleine.
  clockJack: {
    maxHp: 48,
    maxGuard: 40,
    moves: [
      { attack: 'double', damage: 3, weight: 2 },
      { attack: 'perilous', damage: 9 },
    ],
    supports: false,
  },
  // Le Fossoyeur (#258), Élite du palier 1 : valeurs du Codex recopiées le 09/11/2026, telles
  // quelles (multipliées au combat par le multiplicateur d'Élite et de boss). Coup de pelle, Terre
  // jetée, Fosse ouverte, un tiers chacun ; il exhume un Squelette aux manches paires.
  // `codex/gravedigger` v1 (dea86734e85556d73cac94c882f926c68dbf0fd3a7f25d5297cac6b6f7b24de6).
  gravedigger: {
    maxHp: 150,
    maxGuard: 40,
    moves: [
      { attack: 'basic', damage: 8 },
      { attack: 'double', damage: 4 },
      { attack: 'perilous', damage: 12 },
    ],
    supports: false,
    exhume: { enemy: 'skeleton', rounds: 'even', maxStanding: 1 },
  },
  // La Mère-ronce (#259), Élite du palier 2 : valeurs du Codex recopiées le 09/11/2026, telles
  // quelles (multipliées au combat par le multiplicateur d'Élite et de boss, jamais ses Épines).
  // Lianes, Étreinte d'épines, Floraison noire, un tiers chacun.
  // `codex/brambleMother` v1 (9e849bd533032c6c6f7258a6068190a8b50ac4dca73d9e26e5431dbb95ea9d66).
  brambleMother: {
    maxHp: 170,
    maxGuard: 45,
    moves: [
      { attack: 'double', damage: 4 },
      { attack: 'delayed', damage: 9, bleed: { damage: 2, rounds: 3 } },
      { attack: 'delayedPerilous', damage: 13 },
    ],
    supports: false,
    thorns: { damage: 2 },
  },
  // Le Bedeau (#259), Élite du palier 3 : valeurs du Codex recopiées le 09/11/2026, telles quelles.
  // Bâton de procession, « Silence ! », Volée du beffroi, un tiers chacun ; son Sanctuaire le
  // protège lui-même.
  // `codex/beadle` v1 (6c32e3889b60570e19cd365af03b7f42c48b6a3998b721834640ec77f6c21c4b).
  beadle: {
    maxHp: 190,
    maxGuard: 64,
    moves: [
      { attack: 'basic', damage: 11 },
      { attack: 'feint', damage: 11 },
      { attack: 'delayedPerilous', damage: 19 },
    ],
    supports: false,
    sanctuary: { damagePercent: 50 },
  },
  // Le Beffroi (#266) : valeurs du Codex de l'Atelier recopiées le 12/11/2026, à l'échelle du
  // palier 1 (le palier multiplie). Coup de front (poids 2), puis Coup de bélier, avec la Charge.
  // `codex/bronzeRam` v1 (b523363f844f4d98fa77aeebea89182a2a1114d6943998815868680b34f10b96).
  bronzeRam: {
    maxHp: 48,
    maxGuard: 26,
    moves: [
      { attack: 'basic', damage: 6, weight: 2 },
      { attack: 'delayed', damage: 12, charge: true },
    ],
    supports: false,
  },
  // Grand balayage, un Balayage (poids 2), puis Coup de battant.
  // `codex/bellClapper` v1 (baa551e284691ee32362b90d7d77ff11efcac1686c12d0e06abe50582247fe47).
  bellClapper: {
    maxHp: 46,
    maxGuard: 30,
    moves: [
      { attack: 'sweep', damage: 6, weight: 2 },
      { attack: 'basic', damage: 5 },
    ],
    supports: false,
  },
  // Les Jardins de cendre (#267) : valeurs du Codex de l'Atelier recopiées le 12/11/2026, à
  // l'échelle du palier 1 (le palier multiplie, jamais l'Éclatement ni le Vol d'Élan). Éclat de
  // coque, puis Crachin de cendre, une chance sur deux. L'Éclatement s'appelle `burst` dans le
  // Codex : son nom de code est `emberBurst` (`Burst` est l'Étincelle de l'interface).
  // `codex/emberPod` v1 (6825e825274b932c9e4c726b60a74aee44cfcb3fc4b4c77be5936f2e2cb16464).
  emberPod: {
    maxHp: 34,
    maxGuard: 18,
    moves: [
      { attack: 'basic', damage: 6 },
      { attack: 'double', damage: 3 },
    ],
    supports: false,
    emberBurst: { stacks: 2 },
  },
  // Frôlement (poids 2), puis Poudre d'ailes, avec le Vol d'Élan.
  // `codex/thievingMoth` v1 (c486543b4f7dd50e2c84c8661484e4b4f95bcea6ecee763cc83bc5762fd0bfdd).
  thievingMoth: {
    maxHp: 26,
    maxGuard: 12,
    moves: [
      { attack: 'double', damage: 3, weight: 2 },
      { attack: 'feint', damage: 6 },
    ],
    supports: false,
    momentumTheft: { amount: 1 },
  },
  // Coup de cierge ; jamais seul (`TIERS[1]`), sans être un soutien : il peut être maudit (D6).
  // `codex/candleBearer` v1 (67eac4569760a0f24eaeb22ac3b24ed777e5d32d39a5a9fe6dd1bb734aee0e2a).
  candleBearer: {
    maxHp: 36,
    maxGuard: 24,
    moves: [{ attack: 'basic', damage: 5 }],
    supports: false,
    aura: { damagePercent: 20 },
  },
  // Morsure (poids 2), puis Grouillement.
  // `codex/cryptRat` v1 (5bf7bf53b31354d8795f65e0cb782d19ad4e7811306b05f4fb57009be18f3cf0).
  cryptRat: {
    maxHp: 12,
    maxGuard: 14,
    moves: [
      { attack: 'basic', damage: 4, weight: 2 },
      { attack: 'double', damage: 3 },
    ],
    supports: false,
    swarm: { damagePerAlly: 2 },
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
  // Le Fossoyeur (#258), celle du Codex : sous celle du héros, qui peut briser sa garde avant son action.
  gravedigger: 4,
  // La Mère-ronce et le Bedeau (#259), celles du Codex.
  brambleMother: 4,
  beadle: 5,
  // Le Bélier de bronze et le Battant de cloche (#266), celles du Codex.
  bronzeRam: 3,
  bellClapper: 4,
  // La Cosse de braise et la Phalène voleuse (#267), celles du Codex.
  emberPod: 3,
  thievingMoth: 9,
  // Le Porte-cierge et le Rat de crypte (#268), celles du Codex : les Rats agissent avant le héros.
  candleBearer: 2,
  cryptRat: 7,
};

/**
 * La mécanique signature d'un ennemi (#258, D8 ; #266, D5) : celle que montrent sa marque de
 * signature et sa bulle de première rencontre ; `null` pour un ennemi qui n'en a pas. Exhumer pour
 * le Fossoyeur, les Épines pour la Mère-ronce, le Sanctuaire pour le Bedeau (#259) ; pour un ennemi
 * ordinaire, le Balayage (un coup `sweep`) ou la Charge (un coup avec `charge`) (#266),
 * l'Éclatement ou le Vol d'Élan (#267), l'Aura (#268). La Nuée n'en donne pas (#268, D7) : la
 * mécanique du Rat de crypte, c'est le nombre.
 */
export type EnemySignature =
  'exhume' | 'thorns' | 'sanctuary' | 'sweep' | 'charge' | 'emberBurst' | 'momentumTheft' | 'aura';

export function enemySignature(kind: EnemyKind): EnemySignature | null {
  const { exhume, thorns, sanctuary, emberBurst, momentumTheft, aura, moves } = ENEMIES[kind];
  if (exhume !== undefined) return 'exhume';
  if (thorns !== undefined) return 'thorns';
  if (sanctuary !== undefined) return 'sanctuary';
  if (emberBurst !== undefined) return 'emberBurst';
  if (momentumTheft !== undefined) return 'momentumTheft';
  if (aura !== undefined) return 'aura';
  if (moves.some(({ attack }) => attack === 'sweep')) return 'sweep';
  return moves.some(({ charge }) => charge === true) ? 'charge' : null;
}
