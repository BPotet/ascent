/**
 * Les paliers (`Tier`, #38, § 3 de la note du Game Designer) : les Catacombes (`Catacombs`), les
 * Jardins de cendre (`AshGardens`) et le Beffroi (`Belfry`), 6 étages chacun. La table `TIERS` est
 * la règle du palier (ADR 0012) : ses multiplicateurs (ennemis ordinaires, Élites, boss), son Or, la taille de ses groupes, les
 * ennemis qu'il tire, ses Élites, ses boss et les Éclats de son boss.
 */
import type { EnemyKind } from '../battle/combatants';
import type { EliteBossMultiplier, TierMultiplier } from '../battle/tierMultiplier';

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
  /** Le multiplicateur des ennemis de ses combats ordinaires, et de ses invoqués. */
  readonly multiplier: TierMultiplier;
  /** Le multiplicateur de ses Élites (#244, R1). */
  readonly eliteMultiplier: EliteBossMultiplier;
  /** Le multiplicateur de ses boss (#244, R1). */
  readonly bossMultiplier: EliteBossMultiplier;
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
    eliteMultiplier: { hpPercent: 100, guardPercent: 125 },
    bossMultiplier: { hpPercent: 100, guardPercent: 125 },
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
    eliteMultiplier: { hpPercent: 120, guardPercent: 140 },
    bossMultiplier: { hpPercent: 100, guardPercent: 125 },
    goldPercent: 125,
    groupSizeWeights: {
      1: [0, 6, 8, 2, 0],
      2: [0, 4, 9, 4, 0],
      3: [0, 3, 9, 6, 0],
      4: [0, 2, 8, 7, 0],
      5: [0, 1, 7, 9, 0],
    },
    // Dans l'ordre des stories : l'Embrasé (#171), puis la Phalénide (#172). Ses propres ennemis
    // seulement (`tierExclusive`, #213) : ni Goule ni Villageois fou, restés au palier 1.
    enemies: [
      { kind: 'thornPilgrim', weight: 2, cap: 1 },
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
    eliteMultiplier: { hpPercent: 135, guardPercent: 150 },
    bossMultiplier: { hpPercent: 130, guardPercent: 145 },
    goldPercent: 150,
    groupSizeWeights: {
      1: [0, 0, 9, 4, 0],
      2: [0, 0, 8, 5, 0],
      3: [0, 0, 7, 6, 0],
      4: [0, 0, 6, 7, 0],
      5: [0, 0, 5, 8, 0],
    },
    // Ses propres ennemis seulement (`tierExclusive`, #214) : le Veilleur d'airain, la Gargouille et
    // le Fondeur de cloches (#171), puis les trois du Beffroi dans l'ordre du Codex. Ni Squelette, ni
    // Spectre, ni Nécromancien, restés au palier 1, ni Phalénide, restée au palier 2.
    enemies: [
      { kind: 'bronzeWarden', weight: 2, cap: 1 },
      { kind: 'gargoyle', weight: 2, cap: 1 },
      { kind: 'bellFounder', weight: 2, cap: 1 },
      { kind: 'bellNovice', weight: 3, cap: 2 },
      { kind: 'matinsRinger', weight: 1, cap: 1, neverAlone: true },
      { kind: 'clockJack', weight: 2, cap: 1 },
    ],
    elites: ['firstPilgrim', 'stoneSaint'],
    bosses: ['hourRinger', 'wishGranter'],
    bossShards: 18,
  },
};

/**
 * Le multiplicateur des ennemis d'une rencontre du palier (#244) : celui du palier pour un combat
 * ordinaire, celui d'Élite et de boss pour une Élite ou un boss. La seule lecture de la table.
 */
export function encounterMultiplier(tier: Tier, kind: 'combat' | 'elite' | 'boss'): TierMultiplier {
  const rule = TIERS[tier];
  if (kind === 'elite') return rule.eliteMultiplier;
  return kind === 'boss' ? rule.bossMultiplier : rule.multiplier;
}
