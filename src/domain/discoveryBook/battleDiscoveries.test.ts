import { startBattle, type Battle } from '../battle/Battle';
import type { BattleEvent } from '../battle/BattleEvent';
import type { EnemyKind } from '../battle/combatants';
import { withEnemyAt } from '../battle/testing/withEnemyAt';
import { battleDiscoveries } from './battleDiscoveries';
import { EMPTY_DISCOVERY_BOOK, recordDiscoveries } from './DiscoveryBook';

const battleOf = (enemies: readonly EnemyKind[]): Battle =>
  startBattle({ seed: 3, defenseHint: false, at: 0, enemies }).battle;

/** L'état de chaque entrée après avoir enregistré les découvertes, dans un carnet vide. */
const statesOf = (before: Battle | null, after: Battle, events: readonly BattleEvent[] = []) =>
  Object.fromEntries(
    Object.entries(
      recordDiscoveries(EMPTY_DISCOVERY_BOOK, battleDiscoveries(before, after, events)).book
        .enemies,
    ).map(([kind, { state }]) => [kind, state]),
  );

const fall = (battle: Battle, index: number) => withEnemyAt(battle, index, { hp: 0 });

describe('the discoveries of a floor battle update (#282, D1)', () => {
  const group = battleOf(['ghoul', 'ghoul', 'specter', 'necromancer']);

  it('meets the front line at the start of the battle, once per code name, not the reserve (B1 a, B2)', () => {
    expect(group.reserve).toEqual(['necromancer']);
    expect(statesOf(null, group)).toEqual({ ghoul: 'encountered', specter: 'encountered' });
  });

  it('leaves the reserve unknown when the hero falls before any reinforcement (B2)', () => {
    const lost = { ...group, hero: { ...group.hero, hp: 0 } };
    expect(statesOf(group, lost, [{ type: 'battleEnded', at: 1, outcome: 'defeat' }])).toEqual({
      ghoul: 'encountered',
      specter: 'encountered',
    });
  });

  it('meets an enemy at the entry of a reinforcement, a summon or an exhumation (B1 b, c, d)', () => {
    const entered = withEnemyAt(fall(group, 0), 0, { kind: 'necromancer', hp: 30 });
    expect(
      statesOf(fall(group, 0), entered, [
        { type: 'reinforcementEntered', at: 1, enemy: 0, kind: 'necromancer' },
      ]),
    ).toMatchObject({ necromancer: 'encountered' });
    const queen = battleOf(['mothQueen']);
    const summoned = {
      ...queen,
      enemies: [...queen.enemies, { ...queen.enemies[0]!, kind: 'mothkin' as const }],
    };
    expect(
      statesOf(queen, summoned, [{ type: 'summonEntered', at: 1, enemy: 1, kind: 'mothkin' }]),
    ).toEqual({ mothQueen: 'encountered', mothkin: 'encountered' });
    const digger = battleOf(['gravedigger']);
    expect(
      statesOf(digger, digger, [
        { type: 'enemyExhumed', at: 1, enemy: 0, slot: 1, kind: 'skeleton' },
      ]),
    ).toEqual({ gravedigger: 'encountered', skeleton: 'encountered' });
  });

  it('meets nobody for an announced summon that never enters (B2)', () => {
    const queen = battleOf(['mothQueen']);
    const called = { ...queen, summon: { summoner: 0, kind: 'mothkin' as const, slots: [1, 2] } };
    expect(
      statesOf(queen, called, [
        { type: 'summonCalled', at: 1, enemy: 0, kind: 'mothkin', slots: [1, 2] },
      ]),
    ).toEqual({ mothQueen: 'encountered' });
    expect(statesOf(called, fall(queen, 0), [{ type: 'enemyDefeated', at: 2, enemy: 0 }])).toEqual({
      mothQueen: 'defeated',
    });
  });

  it('defeats an enemy that falls for good, even when the hero falls next (B4, B11)', () => {
    const fallen = fall(group, 0);
    expect(statesOf(group, fallen, [{ type: 'enemyDefeated', at: 1, enemy: 0 }])).toEqual({
      ghoul: 'defeated',
      specter: 'encountered',
    });
  });

  it('does not defeat an enemy that rises by itself, only at its fall for good (B5)', () => {
    const skeleton = battleOf(['skeleton', 'ghoul']);
    const revived = withEnemyAt(skeleton, 0, { hp: 5, selfRevives: 1 });
    expect(
      statesOf(skeleton, revived, [{ type: 'enemySelfRevived', at: 1, enemy: 0, hp: 5 }]),
    ).toEqual({ skeleton: 'encountered', ghoul: 'encountered' });
    expect(
      statesOf(revived, fall(revived, 0), [{ type: 'enemyDefeated', at: 2, enemy: 0 }]),
    ).toEqual({ skeleton: 'defeated', ghoul: 'encountered' });
  });

  it('defeats an enemy raised by an ally at its first fall (B6)', () => {
    const fallen = fall(group, 0);
    expect(statesOf(group, fallen, [{ type: 'enemyDefeated', at: 1, enemy: 0 }])).toMatchObject({
      ghoul: 'defeated',
    });
    const raised = withEnemyAt(fallen, 0, { hp: 10, raised: true });
    expect(
      statesOf(fallen, raised, [{ type: 'allyRaised', at: 2, enemy: 2, ally: 0, hp: 10 }]),
    ).toMatchObject({ ghoul: 'encountered' });
  });

  it('defeats the summoned enemies that fall with the one who called them (B7)', () => {
    const queen = battleOf(['mothQueen', 'mothkin', 'mothkin']);
    const after = fall(fall(fall(queen, 0), 1), 2);
    expect(
      statesOf(queen, after, [
        { type: 'enemyDefeated', at: 1, enemy: 0 },
        { type: 'summonedFell', at: 1, enemy: 1 },
        { type: 'summonedFell', at: 1, enemy: 2 },
      ]),
    ).toEqual({ mothQueen: 'defeated', mothkin: 'defeated' });
  });

  it('counts each enemy of an escort for itself: the Elite falls, its escort stands (B8)', () => {
    const escorted = battleOf(['scarecrow', 'burningHusk']);
    expect(
      statesOf(escorted, fall(escorted, 0), [{ type: 'enemyDefeated', at: 1, enemy: 0 }]),
    ).toEqual({ scarecrow: 'defeated', burningHusk: 'encountered' });
  });

  it('gives a cursed enemy the entry of the ordinary enemy (B9)', () => {
    const cursed = withEnemyAt(battleOf(['burningHusk']), 0, { cursed: true });
    expect(statesOf(cursed, fall(cursed, 0), [{ type: 'enemyDefeated', at: 1, enemy: 0 }])).toEqual(
      { burningHusk: 'defeated' },
    );
  });

  it('keeps a boss in its second phase encountered (B10)', () => {
    const boss = battleOf(['ossuaryWarden']);
    expect(statesOf(boss, boss, [{ type: 'bossPhaseShifted', at: 1, enemy: 0 }])).toEqual({
      ossuaryWarden: 'encountered',
    });
  });

  it('reads the front line of a resumed battle: fallen enemies defeated, standing ones met (B1 e)', () => {
    const saved = fall(group, 0);
    expect(statesOf(saved, saved)).toEqual({ ghoul: 'defeated', specter: 'encountered' });
    const resumedWithoutBook = battleOf(['ghoul', 'specter', 'necromancer', 'skeleton']);
    expect(statesOf(null, fall(resumedWithoutBook, 0))).toEqual({
      ghoul: 'defeated',
      specter: 'encountered',
      necromancer: 'encountered',
    });
  });

  it('gives a fall to the enemy that fell, when a reinforcement takes its place in the same update (D2)', () => {
    const trio = battleOf(['ghoul', 'specter', 'necromancer', 'skeleton']);
    const after = withEnemyAt(trio, 0, { kind: 'skeleton' });
    const discoveries = battleDiscoveries(trio, after, [
      { type: 'enemyDefeated', at: 1, enemy: 0 },
      { type: 'reinforcementEntered', at: 1, enemy: 0, kind: 'skeleton' },
    ]);
    expect(discoveries.slice(0, 2)).toEqual([
      { kind: 'ghoul', state: 'defeated' },
      { kind: 'skeleton', state: 'encountered' },
    ]);
    expect(
      statesOf(trio, after, [
        { type: 'enemyDefeated', at: 1, enemy: 0 },
        { type: 'reinforcementEntered', at: 1, enemy: 0, kind: 'skeleton' },
      ]),
    ).toEqual({
      ghoul: 'defeated',
      skeleton: 'encountered',
      specter: 'encountered',
      necromancer: 'encountered',
    });
  });

  it('lists the falls of the events first, in their order, then the front line', () => {
    const trio = battleOf(['ghoul', 'specter', 'necromancer']);
    const after = fall(fall(trio, 2), 0);
    expect(
      battleDiscoveries(trio, after, [
        { type: 'enemyDefeated', at: 1, enemy: 2 },
        { type: 'enemyDefeated', at: 2, enemy: 0 },
      ]).slice(0, 2),
    ).toEqual([
      { kind: 'necromancer', state: 'defeated' },
      { kind: 'ghoul', state: 'defeated' },
    ]);
  });

  it('reads a fall without a battle before from the front line only', () => {
    const fallen = fall(group, 0);
    expect(battleDiscoveries(null, fallen, [{ type: 'enemyDefeated', at: 1, enemy: 0 }])).toEqual([
      { kind: 'ghoul', state: 'encountered' },
      { kind: 'ghoul', state: 'defeated' },
      { kind: 'ghoul', state: 'encountered' },
      { kind: 'specter', state: 'encountered' },
    ]);
  });

  it('never reads the reserve or the places of an announced summon', () => {
    const queen = battleOf(['mothQueen', 'ghoul', 'ghoul', 'specter']);
    const called = { ...queen, summon: { summoner: 0, kind: 'mothkin' as const, slots: [1] } };
    const kinds = battleDiscoveries(null, called, []).map(({ kind }) => kind);
    expect(kinds).not.toContain('specter');
    expect(kinds).not.toContain('mothkin');
  });
});
