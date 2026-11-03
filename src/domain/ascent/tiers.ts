/**
 * Les paliers (`Tier`, #38, § 3 de la note du Game Designer) : les Catacombes (`Catacombs`), les
 * Jardins de cendre (`AshGardens`) et le Beffroi (`Belfry`), 6 étages chacun. La table `TIERS` est
 * la règle du palier (ADR 0012) : son multiplicateur, son Or, la taille de ses groupes, les
 * ennemis qu'il tire, ses Élites, ses boss et les Éclats de son boss.
 */
import type { EnemyKind } from '../battle/combatants';
import type { TierMultiplier } from '../battle/tierMultiplier';

export type Tier = 1 | 2 | 3;

/** Le nom de code d'un palier. */
export type TierName = 'catacombs' | 'ashGardens' | 'belfry';

/** Le palier du Sommet : son boss vaincu, l'ascension est réussie. */
export const TOP_TIER = 3;

/** Un ennemi tiré dans les groupes d'un palier : son poids, son plafond par groupe. */
export interface EnemyDraw {
  readonly kind: EnemyKind;
  readonly weight: number;
  readonly cap: number;
  /** Un soutien : jamais seul dans un groupe d'un ennemi. */
  readonly neverAlone?: true;
}

export interface TierRule {
  readonly name: TierName;
  /** Le multiplicateur des ennemis de ses combats ordinaires. */
  readonly multiplier: TierMultiplier;
  /** Le pourcentage de l'Or gagné : 100, 125 ou 150. */
  readonly goldPercent: number;
  /** Les poids de la taille du groupe (1 à 5 ennemis), par étage, de 1 à 5. */
  readonly groupSizeWeights: Readonly<Record<number, readonly number[]>>;
  /** Les ennemis tirés, dans l'ordre du tirage. */
  readonly enemies: readonly EnemyDraw[];
  /** Ses Élites, tirées à égalité (une seule n'est pas tirée). */
  readonly elites: readonly EnemyKind[];
  /** Ses boss, tirés à égalité. */
  readonly bosses: readonly EnemyKind[];
  /** Les Éclats de son boss. */
  readonly bossShards: number;
}

export const TIERS: Readonly<Record<Tier, TierRule>> = {
  1: {
    name: 'catacombs',
    multiplier: { hpPercent: 100, guardPercent: 100 },
    goldPercent: 100,
    groupSizeWeights: {
      1: [4, 10, 6, 0, 0],
      2: [1, 6, 9, 4, 0],
      3: [0, 5, 9, 5, 1],
      4: [0, 4, 8, 7, 1],
      5: [0, 2, 8, 8, 2],
    },
    // L'ordre du Codex : Goule 3, Spectre 2, Nécromancien 1, Squelette 3, Villageois fou 2.
    enemies: [
      { kind: 'ghoul', weight: 3, cap: 5 },
      { kind: 'specter', weight: 2, cap: 1 },
      { kind: 'necromancer', weight: 1, cap: 1, neverAlone: true },
      { kind: 'skeleton', weight: 3, cap: 1 },
      { kind: 'madVillager', weight: 2, cap: 1 },
    ],
    elites: ['fallenKnight', 'twins'],
    bosses: ['ossuaryWarden', 'facelessPrior'],
    bossShards: 8,
  },
  2: {
    name: 'ashGardens',
    multiplier: { hpPercent: 135, guardPercent: 125 },
    goldPercent: 125,
    groupSizeWeights: {
      1: [0, 6, 8, 2, 0],
      2: [0, 4, 9, 4, 0],
      3: [0, 3, 9, 6, 0],
      4: [0, 2, 8, 7, 0],
      5: [0, 1, 7, 9, 0],
    },
    // Dans l'ordre des stories : l'Embrasé (#171), puis la Phalénide (#172).
    enemies: [
      { kind: 'ghoul', weight: 3, cap: 5 },
      { kind: 'thornPilgrim', weight: 2, cap: 1 },
      { kind: 'madVillager', weight: 2, cap: 1 },
      { kind: 'ashBramble', weight: 2, cap: 1 },
      { kind: 'ashGleaner', weight: 1, cap: 1, neverAlone: true },
      { kind: 'burningHusk', weight: 2, cap: 1 },
      { kind: 'mothkin', weight: 3, cap: 2 },
    ],
    elites: ['scarecrow', 'brambleBurner'],
    // La Reine des phalènes (#172), tirée à égalité avec la Jardinière.
    bosses: ['ashGardener', 'mothQueen'],
    bossShards: 12,
  },
  3: {
    name: 'belfry',
    multiplier: { hpPercent: 175, guardPercent: 150 },
    goldPercent: 150,
    groupSizeWeights: {
      1: [0, 0, 9, 4, 0],
      2: [0, 0, 8, 5, 0],
      3: [0, 0, 7, 6, 0],
      4: [0, 0, 6, 7, 0],
      5: [0, 0, 5, 8, 0],
    },
    // Dans l'ordre des stories : la Gargouille et le Fondeur de cloches (#171), puis la Phalénide (#172).
    enemies: [
      { kind: 'skeleton', weight: 3, cap: 1 },
      { kind: 'bronzeWarden', weight: 2, cap: 1 },
      { kind: 'specter', weight: 2, cap: 1 },
      { kind: 'necromancer', weight: 1, cap: 1, neverAlone: true },
      { kind: 'gargoyle', weight: 2, cap: 1 },
      { kind: 'bellFounder', weight: 2, cap: 1 },
      { kind: 'mothkin', weight: 3, cap: 2 },
    ],
    elites: ['firstPilgrim', 'stoneSaint'],
    bosses: ['hourRinger', 'wishGranter'],
    bossShards: 18,
  },
};
