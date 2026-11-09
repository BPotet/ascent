import type { KeyValueStore } from '../ports/KeyValueStore';
import {
  BATTLE_HINT_SEEN_KEYS,
  dismissBattleHint,
  dismissEncounterHint,
  encounterHintKey,
  getBattleHint,
  getEncounterHint,
} from './battleHints';

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
      powers: 'battle.hint.powers.seen',
    });
  });

  it.each(['hero', 'defense', 'powers'] as const)(
    'shows the %s hint until it is seen',
    async (kind) => {
      const keyValueStore = mapStore();
      await expect(getBattleHint({ keyValueStore }, kind)).resolves.toBe(true);

      await dismissBattleHint({ keyValueStore }, kind);

      await expect(getBattleHint({ keyValueStore }, kind)).resolves.toBe(false);
      expect(keyValueStore.values.get(BATTLE_HINT_SEEN_KEYS[kind])).toBe('1');
    },
  );

  it('keeps the two hints apart', async () => {
    const keyValueStore = mapStore();
    await dismissBattleHint({ keyValueStore }, 'hero');

    await expect(getBattleHint({ keyValueStore }, 'defense')).resolves.toBe(true);
  });
});

describe('the first encounter bubble of an Elite (#258, D8)', () => {
  it('is stored under a key of its own, per Elite', () => {
    expect(encounterHintKey('gravedigger')).toBe('battle.hint.encounter.gravedigger.seen');
  });

  it('shows until it is seen, once per Elite', async () => {
    const keyValueStore = mapStore();
    await expect(getEncounterHint({ keyValueStore }, 'gravedigger')).resolves.toBe(true);

    await dismissEncounterHint({ keyValueStore }, 'gravedigger');

    await expect(getEncounterHint({ keyValueStore }, 'gravedigger')).resolves.toBe(false);
    expect(keyValueStore.values.get('battle.hint.encounter.gravedigger.seen')).toBe('1');
    await expect(getEncounterHint({ keyValueStore }, 'twins')).resolves.toBe(true);
  });
});
