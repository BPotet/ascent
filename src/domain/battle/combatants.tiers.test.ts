// Les 10 entrées des paliers 2 et 3 (#38), recopiées du Codex de l'Atelier du 01/11/2026 : leurs
// valeurs de combat, à l'échelle du palier 1 pour les ennemis ordinaires (le palier multiplie).
import { ENEMIES, ENEMY_INITIATIVE } from './combatants';

describe('the ordinary enemies of the tiers two and three (#38)', () => {
  it('gives the Thorn pilgrim 60 HP, 20 guard, Initiative 2, its bleeding prayer and its staff', () => {
    expect(ENEMIES.thornPilgrim).toEqual({
      maxHp: 60,
      maxGuard: 20,
      moves: [
        { attack: 'delayed', damage: 7, bleed: { damage: 2, rounds: 3 } },
        { attack: 'basic', damage: 6 },
      ],
      supports: false,
    });
    expect(ENEMY_INITIATIVE.thornPilgrim).toBe(2);
  });

  it('gives the Ash bramble 30 HP, 10 guard, Initiative 5, and revives twice at 30 %', () => {
    expect(ENEMIES.ashBramble).toEqual({
      maxHp: 30,
      maxGuard: 10,
      moves: [
        { attack: 'double', damage: 3 },
        { attack: 'basic', damage: 4 },
      ],
      supports: false,
      selfRevive: { times: 2, hpPercent: 30 },
    });
    expect(ENEMY_INITIATIVE.ashBramble).toBe(5);
  });

  it('gives the Ash gleaner 40 HP, 14 guard, Initiative 3, its rake, and makes it a support', () => {
    expect(ENEMIES.ashGleaner).toEqual({
      maxHp: 40,
      maxGuard: 14,
      moves: [{ attack: 'basic', damage: 4 }],
      supports: true,
    });
    expect(ENEMY_INITIATIVE.ashGleaner).toBe(3);
  });

  it('gives the Bronze warden 65 HP, 24 guard, Initiative 2, its fist twice as often as its knell', () => {
    expect(ENEMIES.bronzeWarden).toEqual({
      maxHp: 65,
      maxGuard: 24,
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
  it('gives the burningHusk (Embrasé) 20 HP, 8 guard, Initiative 7, its burning hand twice as often', () => {
    expect(ENEMIES.burningHusk).toEqual({
      maxHp: 20,
      maxGuard: 8,
      moves: [
        { attack: 'basic', damage: 4, weight: 2, burn: 1 },
        { attack: 'perilous', damage: 8 },
      ],
      supports: false,
    });
    expect(ENEMY_INITIATIVE.burningHusk).toBe(7);
  });

  it('gives the Gargoyle 30 HP, 22 guard, Initiative 7, its dive and its burning maw', () => {
    expect(ENEMIES.gargoyle).toEqual({
      maxHp: 30,
      maxGuard: 22,
      moves: [
        { attack: 'feint', damage: 5 },
        { attack: 'delayed', damage: 3, burn: 1 },
      ],
      supports: false,
    });
    expect(ENEMY_INITIATIVE.gargoyle).toBe(7);
  });

  it('gives the Bell founder 42 HP, 14 guard, Initiative 4, its hammer and its burning pour', () => {
    expect(ENEMIES.bellFounder).toEqual({
      maxHp: 42,
      maxGuard: 14,
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

  it('gives the Mothkin 25 HP, 6 guard, Initiative 10, its Broken flight and its Mandibles', () => {
    expect(ENEMIES.mothkin).toEqual({
      maxHp: 25,
      maxGuard: 6,
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
