// Se relève seul (`SelfRevive`, #106, règles S1, S6, S10) : la règle pure, hors du moteur.
import { ENEMIES } from './combatants';
import { selfRevive, selfRevivedHp } from './selfRevive';

const fallen = {
  hp: 0,
  maxHp: 35,
  guard: 0,
  maxGuard: 10,
  stun: { actionLost: true, heroAction: 2 },
  intent: null,
  raised: false,
};

describe('selfRevivedHp (S1)', () => {
  it('takes the floor of the max HP times the percentage, at least 1', () => {
    expect(selfRevivedHp(35, 50)).toBe(17);
    expect(selfRevivedHp(1, 50)).toBe(1);
    expect(selfRevivedHp(200, 30)).toBe(60);
  });
});

describe('selfRevive (S1, S6, S10)', () => {
  it('gives the Skeleton its Codex values: revives once at 50 %', () => {
    expect(ENEMIES.skeleton).toEqual({
      maxHp: 35,
      maxGuard: 10,
      moves: [{ attack: 'basic', damage: 5 }],
      supports: false,
      selfRevive: { times: 1, hpPercent: 50 },
    });
  });

  it('revives with its HP, its whole guard, not stunned, without intent, raised, and counts it', () => {
    expect(selfRevive(fallen, ENEMIES.skeleton)).toEqual({
      ...fallen,
      hp: 17,
      guard: 10,
      stun: null,
      intent: null,
      raised: true,
      selfRevives: 1,
    });
  });

  it('stops once it has revived `times` times', () => {
    expect(selfRevive({ ...fallen, selfRevives: 1 }, ENEMIES.skeleton)).toBeNull();
  });

  it('never revives an enemy without the trait', () => {
    expect(selfRevive(fallen, ENEMIES.ghoul)).toBeNull();
  });

  it('follows the same rule for an Elite with the trait (S10)', () => {
    const elite = { ...fallen, maxHp: 200, maxGuard: 45 };
    const profile = { ...ENEMIES.fallenKnight, selfRevive: { times: 2, hpPercent: 50 } };

    const once = selfRevive(elite, profile)!;
    expect(once).toMatchObject({ hp: 100, guard: 45, selfRevives: 1 });
    expect(selfRevive({ ...once, hp: 0 }, profile)).toMatchObject({ hp: 100, selfRevives: 2 });
    expect(selfRevive({ ...once, hp: 0, selfRevives: 2 }, profile)).toBeNull();
  });
});
