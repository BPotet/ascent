// Les 10 entrées des paliers 2 et 3 (#38), recopiées du Codex de l'Atelier du 01/11/2026 : leurs
// valeurs de combat, à l'échelle du palier 1 pour les ennemis ordinaires (le palier multiplie). La
// garde des 16 ennemis ordinaires est doublée dans le Codex (#244, G2).
import { ENEMIES, ENEMY_INITIATIVE, enemySignature } from './combatants';

describe('the ordinary enemies of the tiers two and three (#38)', () => {
  it('gives the Thorn pilgrim 60 HP, 40 guard, Initiative 2, its bleeding prayer and its staff', () => {
    expect(ENEMIES.thornPilgrim).toEqual({
      maxHp: 60,
      maxGuard: 40,
      moves: [
        { attack: 'delayed', damage: 7, bleed: { damage: 2, rounds: 3 } },
        { attack: 'basic', damage: 6 },
      ],
      supports: false,
    });
    expect(ENEMY_INITIATIVE.thornPilgrim).toBe(2);
  });

  it('gives the Ash bramble 30 HP, 20 guard, Initiative 5, and revives twice at 30 %', () => {
    expect(ENEMIES.ashBramble).toEqual({
      maxHp: 30,
      maxGuard: 20,
      moves: [
        { attack: 'double', damage: 3 },
        { attack: 'basic', damage: 4 },
      ],
      supports: false,
      selfRevive: { times: 2, hpPercent: 30 },
    });
    expect(ENEMY_INITIATIVE.ashBramble).toBe(5);
  });

  it('gives the Ash gleaner 40 HP, 28 guard, Initiative 3, its rake, and makes it a support', () => {
    expect(ENEMIES.ashGleaner).toEqual({
      maxHp: 40,
      maxGuard: 28,
      moves: [{ attack: 'basic', damage: 4 }],
      supports: true,
    });
    expect(ENEMY_INITIATIVE.ashGleaner).toBe(3);
  });

  it('gives the Bronze warden 65 HP, 48 guard, Initiative 2, its fist twice as often as its knell', () => {
    expect(ENEMIES.bronzeWarden).toEqual({
      maxHp: 65,
      maxGuard: 48,
      moves: [
        { attack: 'basic', damage: 6, weight: 2 },
        { attack: 'delayedPerilous', damage: 9 },
      ],
      supports: false,
    });
    expect(ENEMY_INITIATIVE.bronzeWarden).toBe(2);
  });
});

describe('the Elites of the tiers two and three (#38)', () => {
  it('gives the Scarecrow 190 HP, 50 guard (#211), Initiative 5, a third each, and one revival at 40 %', () => {
    expect(ENEMIES.scarecrow).toEqual({
      maxHp: 190,
      maxGuard: 50,
      moves: [
        { attack: 'basic', damage: 11 },
        { attack: 'feint', damage: 11 },
        { attack: 'perilous', damage: 16 },
      ],
      supports: false,
      selfRevive: { times: 1, hpPercent: 40 },
    });
    expect(ENEMY_INITIATIVE.scarecrow).toBe(5);
  });

  it('gives the First pilgrim 270 HP, 55 guard, Initiative 8, a quarter each', () => {
    expect(ENEMIES.firstPilgrim).toEqual({
      maxHp: 270,
      maxGuard: 55,
      moves: [
        { attack: 'double', damage: 8 },
        { attack: 'feint', damage: 14 },
        { attack: 'delayed', damage: 14 },
        { attack: 'perilous', damage: 21 },
      ],
      supports: false,
    });
    expect(ENEMY_INITIATIVE.firstPilgrim).toBe(8);
  });

  it('gives the Stone saint 250 HP, 80 guard, Initiative 3, a third each', () => {
    expect(ENEMIES.stoneSaint).toEqual({
      maxHp: 250,
      maxGuard: 80,
      moves: [
        { attack: 'basic', damage: 13 },
        { attack: 'delayed', damage: 16 },
        { attack: 'delayedPerilous', damage: 22 },
      ],
      supports: false,
    });
    expect(ENEMY_INITIATIVE.stoneSaint).toBe(3);
  });
});

describe('the bosses of the tiers two and three (#38)', () => {
  it('gives the Ash gardener 420 HP, 78 guard, Initiative 4 then 7, thorns that bleed 3 × 3', () => {
    expect(ENEMIES.ashGardener).toEqual({
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
      phaseShiftPercent: 50,
      phase2Initiative: 7,
      supports: false,
    });
    expect(ENEMY_INITIATIVE.ashGardener).toBe(4);
  });

  it('gives the Hour ringer 500 HP, 90 guard, Initiative 5 then 8', () => {
    expect(ENEMIES.hourRinger).toEqual({
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
      phaseShiftPercent: 50,
      phase2Initiative: 8,
      supports: false,
    });
    expect(ENEMY_INITIATIVE.hourRinger).toBe(5);
  });

  it('gives the Wish granter 500 HP, 84 guard, Initiative 6 then 9', () => {
    expect(ENEMIES.wishGranter).toEqual({
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
      phaseShiftPercent: 50,
      phase2Initiative: 9,
      supports: false,
    });
    expect(ENEMY_INITIATIVE.wishGranter).toBe(6);
  });

  it('shifts the tier 1 bosses at 50 % of their HP too, 150 of 300', () => {
    expect(ENEMIES.ossuaryWarden.phaseShiftPercent).toBe(50);
    expect(ENEMIES.facelessPrior.phaseShiftPercent).toBe(50);
  });
});

// La Brûlure (#171) : les valeurs du Codex de l'Atelier du 01/11/2026, à l'échelle du palier 1.
describe('the carriers of the Burn (#171)', () => {
  it('gives the burningHusk (Embrasé) 20 HP, 16 guard, Initiative 7, its burning hand twice as often', () => {
    expect(ENEMIES.burningHusk).toEqual({
      maxHp: 20,
      maxGuard: 16,
      moves: [
        { attack: 'basic', damage: 4, weight: 2, burn: 1 },
        { attack: 'perilous', damage: 8 },
      ],
      supports: false,
    });
    expect(ENEMY_INITIATIVE.burningHusk).toBe(7);
  });

  it('gives the Gargoyle 30 HP, 44 guard, Initiative 7, its dive and its burning maw', () => {
    expect(ENEMIES.gargoyle).toEqual({
      maxHp: 30,
      maxGuard: 44,
      moves: [
        { attack: 'feint', damage: 5 },
        { attack: 'delayed', damage: 3, burn: 1 },
      ],
      supports: false,
    });
    expect(ENEMY_INITIATIVE.gargoyle).toBe(7);
  });

  it('gives the Bell founder 42 HP, 28 guard, Initiative 4, its hammer and its burning pour', () => {
    expect(ENEMIES.bellFounder).toEqual({
      maxHp: 42,
      maxGuard: 28,
      moves: [
        { attack: 'double', damage: 3 },
        { attack: 'delayed', damage: 4, burn: 1 },
      ],
      supports: false,
    });
    expect(ENEMY_INITIATIVE.bellFounder).toBe(4);
  });

  it('gives the Bramble burner, an Elite, 210 HP, 55 guard (#211), Initiative 6, a third each', () => {
    expect(ENEMIES.brambleBurner).toEqual({
      maxHp: 210,
      maxGuard: 55,
      moves: [
        { attack: 'basic', damage: 10, burn: 2 },
        { attack: 'double', damage: 6, bleed: { damage: 2, rounds: 3 } },
        { attack: 'delayedPerilous', damage: 15 },
      ],
      supports: false,
    });
    expect(ENEMY_INITIATIVE.brambleBurner).toBe(6);
  });
});

describe('the Moth queen and the Mothkin (#172)', () => {
  it('gives the Moth queen, a boss, 400 HP, 70 guard, Initiative 8 then 11, and her summon', () => {
    expect(ENEMIES.mothQueen).toEqual({
      maxHp: 400,
      maxGuard: 70,
      moves: [
        { attack: 'feint', damage: 11 },
        { attack: 'double', damage: 6 },
      ],
      phase2Moves: [{ attack: 'perilous', damage: 19 }],
      phaseShiftPercent: 50,
      phase2Initiative: 11,
      phase2Summon: { enemy: 'mothkin', count: 2 },
      supports: false,
    });
    expect(ENEMY_INITIATIVE.mothQueen).toBe(8);
  });

  it('gives the Mothkin 25 HP, 12 guard, Initiative 10, its Broken flight and its Mandibles', () => {
    expect(ENEMIES.mothkin).toEqual({
      maxHp: 25,
      maxGuard: 12,
      moves: [
        { attack: 'feint', damage: 4 },
        { attack: 'double', damage: 3 },
      ],
      supports: false,
    });
    expect(ENEMY_INITIATIVE.mothkin).toBe(10);
  });

  it('gives a summon to the Moth queen only', () => {
    const summoners = Object.entries(ENEMIES).filter(([, profile]) => profile.phase2Summon);

    expect(summoners.map(([kind]) => kind)).toEqual(['mothQueen']);
  });
});

// Le Beffroi (#214) : les valeurs du Codex de l'Atelier (version 2, 04/11/2026), à l'échelle du
// palier 1. Poids 1 : la clé `weight` est absente.
describe('the enemies of the Belfry (#214)', () => {
  it('gives the Bell novice 26 HP, 16 guard, Initiative 6, its Rope end twice as often', () => {
    expect(ENEMIES.bellNovice).toEqual({
      maxHp: 26,
      maxGuard: 16,
      moves: [
        { attack: 'basic', damage: 4, weight: 2 },
        { attack: 'delayed', damage: 6 },
      ],
      supports: false,
    });
    expect(ENEMY_INITIATIVE.bellNovice).toBe(6);
  });

  it('gives the Matins ringer 42 HP, 32 guard, Initiative 3, her Angelus and the support role', () => {
    expect(ENEMIES.matinsRinger).toEqual({
      maxHp: 42,
      maxGuard: 32,
      moves: [{ attack: 'delayed', damage: 4 }],
      supports: true,
    });
    expect(ENEMY_INITIATIVE.matinsRinger).toBe(3);
  });

  it('gives the Clock jack 48 HP, 40 guard, Initiative 1, its Half hour twice as often', () => {
    expect(ENEMIES.clockJack).toEqual({
      maxHp: 48,
      maxGuard: 40,
      moves: [
        { attack: 'double', damage: 3, weight: 2 },
        { attack: 'perilous', damage: 9 },
      ],
      supports: false,
    });
    expect(ENEMY_INITIATIVE.clockJack).toBe(1);
  });
});

describe('the Bronze ram and the Bell clapper of the Belfry (#266)', () => {
  it('gives the Bronze ram 48 HP, 26 guard, Initiative 3, its Front blow twice as often as its charged Ram blow', () => {
    expect(ENEMIES.bronzeRam).toEqual({
      maxHp: 48,
      maxGuard: 26,
      moves: [
        { attack: 'basic', damage: 6, weight: 2 },
        { attack: 'delayed', damage: 12, charge: true },
      ],
      supports: false,
    });
    expect(ENEMY_INITIATIVE.bronzeRam).toBe(3);
  });

  it('gives the Bell clapper 46 HP, 30 guard, Initiative 4, its Great sweep twice as often as its Clapper blow', () => {
    expect(ENEMIES.bellClapper).toEqual({
      maxHp: 46,
      maxGuard: 30,
      moves: [
        { attack: 'sweep', damage: 6, weight: 2 },
        { attack: 'basic', damage: 5 },
      ],
      supports: false,
    });
    expect(ENEMY_INITIATIVE.bellClapper).toBe(4);
  });

  it('gives them the signature of their mechanic: the Charge and the Sweep', () => {
    expect(enemySignature('bronzeRam')).toBe('charge');
    expect(enemySignature('bellClapper')).toBe('sweep');
    expect(enemySignature('clockJack')).toBeNull();
  });
});

describe('the Candle bearer and the Crypt rat of the Catacombs (#268)', () => {
  it('gives the Candle bearer 36 HP, 24 guard, Initiative 2, its Candle blow and its Aura of 20 %', () => {
    expect(ENEMIES.candleBearer).toEqual({
      maxHp: 36,
      maxGuard: 24,
      moves: [{ attack: 'basic', damage: 5 }],
      supports: false,
      aura: { damagePercent: 20 },
    });
    expect(ENEMY_INITIATIVE.candleBearer).toBe(2);
  });

  it('gives the Crypt rat 12 HP, 14 guard, Initiative 7, its Bite twice as often as its Swarming, and its Swarm of +2', () => {
    expect(ENEMIES.cryptRat).toEqual({
      maxHp: 12,
      maxGuard: 14,
      moves: [
        { attack: 'basic', damage: 4, weight: 2 },
        { attack: 'double', damage: 3 },
      ],
      supports: false,
      swarm: { damagePerAlly: 2 },
    });
    expect(ENEMY_INITIATIVE.cryptRat).toBe(7);
  });

  it('gives the Candle bearer the signature of its Aura, and none to the Crypt rat (D7)', () => {
    expect(enemySignature('candleBearer')).toBe('aura');
    expect(enemySignature('cryptRat')).toBeNull();
  });
});

describe('the guards of the ordinary enemies, doubled in the Codex (#244, G2)', () => {
  it('gives the 16 ordinary enemies their new guard', () => {
    expect({
      ghoul: ENEMIES.ghoul.maxGuard,
      specter: ENEMIES.specter.maxGuard,
      necromancer: ENEMIES.necromancer.maxGuard,
      skeleton: ENEMIES.skeleton.maxGuard,
      madVillager: ENEMIES.madVillager.maxGuard,
      thornPilgrim: ENEMIES.thornPilgrim.maxGuard,
      ashBramble: ENEMIES.ashBramble.maxGuard,
      ashGleaner: ENEMIES.ashGleaner.maxGuard,
      burningHusk: ENEMIES.burningHusk.maxGuard,
      mothkin: ENEMIES.mothkin.maxGuard,
      bronzeWarden: ENEMIES.bronzeWarden.maxGuard,
      gargoyle: ENEMIES.gargoyle.maxGuard,
      bellFounder: ENEMIES.bellFounder.maxGuard,
      bellNovice: ENEMIES.bellNovice.maxGuard,
      matinsRinger: ENEMIES.matinsRinger.maxGuard,
      clockJack: ENEMIES.clockJack.maxGuard,
    }).toEqual({
      ghoul: 30,
      specter: 20,
      necromancer: 24,
      skeleton: 20,
      madVillager: 24,
      thornPilgrim: 40,
      ashBramble: 20,
      ashGleaner: 28,
      burningHusk: 16,
      mothkin: 12,
      bronzeWarden: 48,
      gargoyle: 44,
      bellFounder: 28,
      bellNovice: 16,
      matinsRinger: 32,
      clockJack: 40,
    });
  });

  it('keeps the guard of the Elites and the bosses in the Codex', () => {
    expect(
      (
        [
          'twins',
          'fallenKnight',
          'ossuaryWarden',
          'facelessPrior',
          'scarecrow',
          'brambleBurner',
          'ashGardener',
          'mothQueen',
          'firstPilgrim',
          'stoneSaint',
          'hourRinger',
          'wishGranter',
        ] as const
      ).map((kind) => ENEMIES[kind].maxGuard),
    ).toEqual([30, 45, 60, 60, 50, 55, 78, 70, 55, 80, 90, 84]);
  });
});
