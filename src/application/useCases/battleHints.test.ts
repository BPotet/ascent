import type { KeyValueStore } from '../ports/KeyValueStore';
import { BATTLE_HINT_SEEN_KEYS, dismissBattleHint, getBattleHint } from './battleHints';

function mapStore(): KeyValueStore & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    get: async (key) => values.get(key) ?? null,
    set: async (key, value) => {
      values.set(key, value);
    },
    remove: async (key) => {
      values.delete(key);
    },
  };
}

describe('battle hints (bulles d’aide du combat)', () => {
  it('are stored under their own keys', () => {
    expect(BATTLE_HINT_SEEN_KEYS).toEqual({
      hero: 'battle.hint.hero.seen',
      defense: 'battle.hint.defense.seen',
    });
  });

  it.each(['hero', 'defense'] as const)('shows the %s hint until it is seen', async (kind) => {
    const keyValueStore = mapStore();
    await expect(getBattleHint({ keyValueStore }, kind)).resolves.toBe(true);

    await dismissBattleHint({ keyValueStore }, kind);

    await expect(getBattleHint({ keyValueStore }, kind)).resolves.toBe(false);
    expect(keyValueStore.values.get(BATTLE_HINT_SEEN_KEYS[kind])).toBe('1');
  });

  it('keeps the two hints apart', async () => {
    const keyValueStore = mapStore();
    await dismissBattleHint({ keyValueStore }, 'hero');

    await expect(getBattleHint({ keyValueStore }, 'defense')).resolves.toBe(true);
  });
});
