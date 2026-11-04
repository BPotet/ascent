import { beginAscentLog } from '../../../domain/ascentLog/AscentLog';
import {
  BATTLE_LOG_MAX_ENTRIES,
  beginBattleLog,
  recordBattleEvents,
} from '../../../domain/ascentLog/BattleLog';
import { startAscent } from '../../../domain/ascent/Ascent';
import { startBattle } from '../../../domain/battle/Battle';
import type { BattleEvent } from '../../../domain/battle/BattleEvent';
import type { Intent } from '../../../domain/battle/intents';
import { Day } from '../../../domain/day/Day';
import { InMemoryKeyValueStore } from '../memory/InMemoryKeyValueStore';
import { prepareAscentDatabase } from '../sqlite/prepareAscentDatabase';
import { SqliteKeyValueStore } from '../sqlite/SqliteKeyValueStore';
import { describeAscentLogStoreContract } from '../testing/ascentLogStoreContract';
import { openNodeSqliteDatabase } from '../testing/nodeSqliteDatabase';
import { KeyValueAscentLogStore } from './KeyValueAscentLogStore';

describe('KeyValueAscentLogStore in memory', () => {
  describeAscentLogStoreContract(async () => {
    const keyValueStore = new InMemoryKeyValueStore();
    return { keyValueStore, store: new KeyValueAscentLogStore(keyValueStore) };
  });
});

describe('KeyValueAscentLogStore on SQLite', () => {
  describeAscentLogStoreContract(async () => {
    const keyValueStore = new SqliteKeyValueStore(
      await prepareAscentDatabase(openNodeSqliteDatabase()),
    );
    return { keyValueStore, store: new KeyValueAscentLogStore(keyValueStore) };
  });
});

describe('KeyValueAscentLogStore with the worst battle', () => {
  const intent: Intent = {
    category: 'attack',
    attack: 'basic',
    damage: 12,
    windUpMs: 1_100,
    feintFraction: 0.5,
    bleed: { damage: 3, rounds: 3 },
    burn: 2,
  };

  /** Un combat au garde-fou : 3 000 appuis et effets, puis 200 manches sans détail. */
  function worstBattle() {
    const { battle } = startBattle({
      seed: 3,
      defenseHint: false,
      at: 0,
      initiative: true,
      enemies: ['ghoul', 'specter', 'necromancer', 'skeleton', 'ghoul'],
    });
    let log = beginBattleLog({ tier: 3, floor: 9, encounterKind: 'boss' }, battle, 0);
    let at = 0;
    for (let round = 1; round <= 220; round += 1) {
      const events: BattleEvent[] = [
        { type: 'roundStarted', at, round, intents: [intent, intent, intent] },
      ];
      for (let enemy = 0; enemy < 3; enemy += 1) {
        events.push({
          type: 'windUpStarted',
          at,
          enemy,
          attack: 'basic',
          impacts: [at + 1_000, at + 1_400, at + 1_800],
          feintAt: at + 500,
        });
        for (let index = 0; index < 3; index += 1) {
          events.push(
            { type: 'whiffed', at: at + 100, button: 'parry', reason: 'early', delta: -230 },
            {
              type: 'blowResolved',
              at: at + 1_000,
              enemy,
              index,
              outcome: 'perfectParry',
              button: 'parry',
              delta: -45,
              damage: 0,
              heroHp: 123,
            },
            { type: 'counterAttacked', at, enemy, damage: 12, guardDamage: 8, until: at + 400 },
          );
        }
      }
      at += 9_000;
      log = recordBattleEvents(log, { ...battle, round }, events);
    }
    return log;
  }

  it('writes and reads back the worst battle on SQLite, in less than 1 MB', async () => {
    const keyValueStore = new SqliteKeyValueStore(
      await prepareAscentDatabase(openNodeSqliteDatabase()),
    );
    const store = new KeyValueAscentLogStore(keyValueStore);
    const battle = worstBattle();
    const { id } = await store.start(beginAscentLog(startAscent(1), Day.of(2026, 11, 3)), 20);
    await store.saveBattle(id!, battle);

    const [raw] = await store.readBattles(id!, [{ tier: 3, floor: 9 }]);
    expect(battle.truncated).toBe(true);
    expect(battle.entries).toBeGreaterThanOrEqual(BATTLE_LOG_MAX_ENTRIES);
    expect(JSON.parse(raw!)).toEqual(battle);
    expect(new TextEncoder().encode(raw).length).toBeLessThan(1_000_000);
  });
});
