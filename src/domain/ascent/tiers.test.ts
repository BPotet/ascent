// La règle du palier (`TIERS`, #38, § 3 de la note du Game Designer) : son nom, son multiplicateur,
// son Or, la taille de ses groupes, ses ennemis, ses Élites, ses boss et leurs Éclats.
import { GROUP_SIZE_WEIGHTS } from './enemyGroup';
import { TIERS, TOP_TIER, encounterMultiplier } from './tiers';

describe('the tiers (#38)', () => {
  it('climbs three tiers: the Catacombs, the Ash gardens and the Belfry', () => {
    expect(TOP_TIER).toBe(3);
    expect([TIERS[1].name, TIERS[2].name, TIERS[3].name]).toEqual([
      'catacombs',
      'ashGardens',
      'belfry',
    ]);
  });

  it('multiplies the HP and damage, the guard and the Gold of each tier, never the Initiative', () => {
    expect([1, 2, 3].map((tier) => TIERS[tier as 1].multiplier)).toEqual([
      { hpPercent: 100, guardPercent: 100 },
      { hpPercent: 135, guardPercent: 125 },
      { hpPercent: 175, guardPercent: 150 },
    ]);
    expect([TIERS[1].goldPercent, TIERS[2].goldPercent, TIERS[3].goldPercent]).toEqual([
      100, 125, 150,
    ]);
  });

  it('multiplies its Elites and its bosses by the Elite and boss multiplier (#244, R1)', () => {
    // #257, décision du 08/11/2026 : la colonne PV et dégâts des Élites à 80 / 80 / 88 %.
    expect([1, 2, 3].map((tier) => TIERS[tier as 1].eliteMultiplier)).toEqual([
      { hpPercent: 80, guardPercent: 125 },
      { hpPercent: 80, guardPercent: 140 },
      { hpPercent: 88, guardPercent: 150 },
    ]);
    expect([1, 2, 3].map((tier) => TIERS[tier as 1].bossMultiplier)).toEqual([
      { hpPercent: 100, guardPercent: 125 },
      { hpPercent: 100, guardPercent: 125 },
      { hpPercent: 130, guardPercent: 145 },
    ]);
  });

  it.each([1, 2, 3] as const)(
    'gives each encounter of tier %i the multiplier of its kind (#244)',
    (tier) => {
      expect(encounterMultiplier(tier, 'combat')).toBe(TIERS[tier].multiplier);
      expect(encounterMultiplier(tier, 'elite')).toBe(TIERS[tier].eliteMultiplier);
      expect(encounterMultiplier(tier, 'boss')).toBe(TIERS[tier].bossMultiplier);
    },
  );

  it('gives back 10 % of the max HP as the respite at tier 1, 5 % at tiers 2 and 3 (#244, R3)', () => {
    expect([TIERS[1].respitePercent, TIERS[2].respitePercent, TIERS[3].respitePercent]).toEqual([
      10, 5, 5,
    ]);
  });

  it('keeps the group sizes of tier 1', () => {
    expect(TIERS[1].groupSizeWeights).toEqual(GROUP_SIZE_WEIGHTS);
  });

  it('draws 2 to 4 enemies at tier 2 and 3 or 4 at tier 3, with the weights of each floor', () => {
    expect(TIERS[2].groupSizeWeights).toEqual({
      1: [0, 6, 8, 2, 0],
      2: [0, 4, 9, 4, 0],
      3: [0, 3, 9, 6, 0],
      4: [0, 2, 8, 7, 0],
      5: [0, 1, 7, 9, 0],
    });
    expect(TIERS[3].groupSizeWeights).toEqual({
      1: [0, 0, 9, 4, 0],
      2: [0, 0, 8, 5, 0],
      3: [0, 0, 7, 6, 0],
      4: [0, 0, 6, 7, 0],
      5: [0, 0, 5, 8, 0],
    });
  });

  it('draws the enemies of tier 1 as before: weights, caps and order of the Codex', () => {
    expect(TIERS[1].enemies).toEqual([
      { kind: 'ghoul', weight: 3, cap: 5 },
      { kind: 'specter', weight: 2, cap: 1 },
      { kind: 'necromancer', weight: 1, cap: 1, neverAlone: true },
      { kind: 'skeleton', weight: 3, cap: 1 },
      { kind: 'madVillager', weight: 2, cap: 1 },
    ]);
  });

  it('draws only its own enemies at tier 2, in the order of the stories, the Ash gleaner never alone (#213)', () => {
    expect(TIERS[2].enemies).toEqual([
      { kind: 'thornPilgrim', weight: 2, cap: 1 },
      { kind: 'ashBramble', weight: 2, cap: 1 },
      { kind: 'ashGleaner', weight: 1, cap: 1, neverAlone: true },
      { kind: 'burningHusk', weight: 2, cap: 1 },
      { kind: 'mothkin', weight: 3, cap: 2 },
    ]);
  });

  it('draws only its own enemies at tier 3, the three that stay then the three of the Belfry (#214)', () => {
    expect(TIERS[3].enemies).toEqual([
      { kind: 'bronzeWarden', weight: 2, cap: 1 },
      { kind: 'gargoyle', weight: 2, cap: 1 },
      { kind: 'bellFounder', weight: 2, cap: 1 },
      { kind: 'bellNovice', weight: 3, cap: 2 },
      { kind: 'matinsRinger', weight: 1, cap: 1, neverAlone: true },
      { kind: 'clockJack', weight: 2, cap: 1 },
    ]);
  });

  it.each([
    [1, 2],
    [1, 3],
    [2, 3],
  ] as const)(
    'shares no enemy between the groups of tiers %d and %d (tierExclusive, #213, #214)',
    (one, other) => {
      const first = new Set(TIERS[one].enemies.map(({ kind }) => kind));

      expect(TIERS[other].enemies.filter(({ kind }) => first.has(kind))).toEqual([]);
    },
  );

  it('has its Elites and its bosses', () => {
    expect([TIERS[1].elites, TIERS[2].elites, TIERS[3].elites]).toEqual([
      ['fallenKnight', 'twins'],
      ['scarecrow', 'brambleBurner'],
      ['firstPilgrim', 'stoneSaint'],
    ]);
    expect([TIERS[1].bosses, TIERS[2].bosses, TIERS[3].bosses]).toEqual([
      ['ossuaryWarden', 'facelessPrior'],
      ['ashGardener', 'mothQueen'],
      ['hourRinger', 'wishGranter'],
    ]);
  });

  it('gives 8, 12 and 18 Shards for its boss', () => {
    expect([TIERS[1].bossShards, TIERS[2].bossShards, TIERS[3].bossShards]).toEqual([8, 12, 18]);
  });
});
