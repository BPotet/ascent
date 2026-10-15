import type { KeyValueStore } from '../ports/KeyValueStore';
import { CHECK_IN_HINT_DISMISSED_KEY, dismissCheckInHint, getCheckInHint } from './checkInHint';

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

describe('check-in hint (aide au premier usage)', () => {
  it('is shown until it is dismissed', async () => {
    const keyValueStore = mapStore();
    await expect(getCheckInHint({ keyValueStore })).resolves.toBe(true);

    await dismissCheckInHint({ keyValueStore });

    await expect(getCheckInHint({ keyValueStore })).resolves.toBe(false);
    expect(keyValueStore.values).toEqual(new Map([[CHECK_IN_HINT_DISMISSED_KEY, 'true']]));
  });

  it('stays dismissed when dismissed again', async () => {
    const keyValueStore = mapStore();
    await dismissCheckInHint({ keyValueStore });
    await dismissCheckInHint({ keyValueStore });

    await expect(getCheckInHint({ keyValueStore })).resolves.toBe(false);
  });

  it('is stored under its own key', () => {
    expect(CHECK_IN_HINT_DISMISSED_KEY).toBe('day-view.check-in-hint.dismissed');
  });
});
