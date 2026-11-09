// Exhumer (`ExhumeIntent`, #258, X1) : la place où le Fossoyeur exhume un Squelette au début d'une
// manche paire, et l'état de sa marque de signature (D8). Pur et sans hasard.
import { startBattle, type Battle, type EnemyState } from './Battle';
import { exhumeMark, exhumeSlot } from './exhume';
import type { Intent } from './intents';

const ATTACK: Intent = {
  category: 'attack',
  attack: 'basic',
  damage: 6,
  windUpMs: 900,
  feintFraction: 0.5,
};

/** Le Fossoyeur, seul ou suivi de `others`, en début de combat. */
function battleOf(others: readonly Partial<EnemyState>[] = [], round = 1): Battle {
  const started = startBattle({
    seed: 7,
    defenseHint: false,
    at: 0,
    initiative: true,
    enemies: ['gravedigger', ...others.map(() => 'skeleton' as const)],
  }).battle;
  return {
    ...started,
    round,
    enemies: started.enemies.map((enemy, index) =>
      index === 0 ? enemy : { ...enemy, ...others[index - 1] },
    ),
  };
}

const withDigger = (battle: Battle, change: Partial<EnemyState>): Battle => ({
  ...battle,
  enemies: battle.enemies.map((enemy, index) => (index === 0 ? { ...enemy, ...change } : enemy)),
});

const STUN = { heroAction: 1, actionLost: false };
const EXHUMED = { summoned: true, exhumed: true } as const;

describe('exhumeSlot (#258, X1)', () => {
  it('gives the first empty place at an even round, the Gravedigger alone', () => {
    expect(exhumeSlot(battleOf().enemies, 0, 2)).toBe(1);
  });

  it('gives nothing at an odd round', () => {
    expect(exhumeSlot(battleOf().enemies, 0, 1)).toBeNull();
    expect(exhumeSlot(battleOf().enemies, 0, 3)).toBeNull();
  });

  it('gives nothing to a stunned Gravedigger', () => {
    const stunned = withDigger(battleOf(), { stun: STUN });

    expect(exhumeSlot(stunned.enemies, 0, 2)).toBeNull();
  });

  it('gives nothing to a fallen Gravedigger', () => {
    const fallen = withDigger(battleOf(), { hp: 0 });

    expect(exhumeSlot(fallen.enemies, 0, 2)).toBeNull();
  });

  it('gives nothing while an exhumed Skeleton stands, a revived one included', () => {
    expect(exhumeSlot(battleOf([EXHUMED]).enemies, 0, 4)).toBeNull();
    expect(exhumeSlot(battleOf([{ ...EXHUMED, hp: 17, selfRevives: 1 }]).enemies, 0, 4)).toBeNull();
  });

  it('counts only the exhumed enemies: a standing enemy that was not exhumed does not count', () => {
    expect(exhumeSlot(battleOf([{}]).enemies, 0, 2)).toBe(2);
  });

  it('gives the empty places first, then the places of the fallen, from left to right', () => {
    const fallen = { ...EXHUMED, hp: 0, selfRevives: 1 };

    expect(exhumeSlot(battleOf([fallen]).enemies, 0, 4)).toBe(2);
    expect(exhumeSlot(battleOf([fallen, fallen]).enemies, 0, 6)).toBe(1);
  });

  it('gives nothing without a free place', () => {
    expect(exhumeSlot(battleOf([{}, {}]).enemies, 0, 2)).toBeNull();
  });

  it('gives nothing to an enemy that does not exhume', () => {
    expect(exhumeSlot(battleOf([{}]).enemies, 1, 2)).toBeNull();
  });
});

describe('exhumeMark (#258, D8)', () => {
  it('says the next even round, from the first round', () => {
    expect(exhumeMark(battleOf([], 1), 0)).toEqual({ state: 'next', round: 2 });
    expect(exhumeMark(battleOf([], 3), 0)).toEqual({ state: 'next', round: 4 });
  });

  it('says now while the intent Exhume waits for its action', () => {
    const now = withDigger(battleOf([], 2), { intent: { category: 'exhume', slot: 1 } });

    expect(exhumeMark(now, 0)).toEqual({ state: 'now' });
  });

  it('says lost when the guard breaks before the action, or the Gravedigger is stunned', () => {
    const broken = withDigger(battleOf([], 2), {
      intent: { category: 'exhume', slot: 1 },
      stun: STUN,
    });
    const stunned = withDigger(battleOf([], 2), { intent: ATTACK, stun: STUN });

    expect(exhumeMark(broken, 0)).toEqual({ state: 'lost' });
    expect(exhumeMark(stunned, 0)).toEqual({ state: 'lost' });
  });

  it('says the next even round to a Gravedigger stunned at an odd round', () => {
    const stunned = withDigger(battleOf([], 3), { intent: ATTACK, stun: STUN });

    expect(exhumeMark(stunned, 0)).toEqual({ state: 'next', round: 4 });
  });

  it('says standing while an exhumed Skeleton stands', () => {
    expect(exhumeMark(battleOf([EXHUMED], 4), 0)).toEqual({ state: 'standing' });
    expect(exhumeMark(battleOf([EXHUMED], 3), 0)).toEqual({ state: 'standing' });
  });

  it('says the next even round once the exhumed Skeleton has fallen for good', () => {
    const fallen = { ...EXHUMED, hp: 0, selfRevives: 1 };

    expect(exhumeMark(battleOf([fallen], 4), 0)).toEqual({ state: 'next', round: 6 });
  });

  it('has no state of its own without a free place: the next even round', () => {
    expect(exhumeMark(battleOf([{}, {}], 2), 0)).toEqual({ state: 'next', round: 4 });
  });

  it('gives nothing for an enemy that does not exhume, or a fallen Gravedigger', () => {
    expect(exhumeMark(battleOf([{}], 2), 1)).toBeNull();
    expect(exhumeMark(withDigger(battleOf([], 2), { hp: 0 }), 0)).toBeNull();
  });
});
