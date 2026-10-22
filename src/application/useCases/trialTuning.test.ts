import type { KeyValueStore } from '../ports/KeyValueStore';
import { TRIAL_TUNING_KEY, getTrialTuning, saveTrialTuning } from './trialTuning';

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

describe('trial tuning (réglages d’essai)', () => {
  it('is stored under its own key', () => {
    expect(TRIAL_TUNING_KEY).toBe('battle.trialTuning');
  });

  it('defaults to 800 ms and 400 ms when nothing is stored', async () => {
    await expect(getTrialTuning({ keyValueStore: mapStore() })).resolves.toEqual({
      phaseTransitionMs: 800,
      stepInMs: 400,
    });
  });

  it('saves the tuning as JSON and reads it back', async () => {
    const keyValueStore = mapStore();

    await expect(
      saveTrialTuning({ keyValueStore }, { phaseTransitionMs: 1_000, stepInMs: 250 }),
    ).resolves.toEqual({ phaseTransitionMs: 1_000, stepInMs: 250 });

    expect(keyValueStore.values.get(TRIAL_TUNING_KEY)).toBe(
      '{"phaseTransitionMs":1000,"stepInMs":250}',
    );
    await expect(getTrialTuning({ keyValueStore })).resolves.toEqual({
      phaseTransitionMs: 1_000,
      stepInMs: 250,
    });
  });

  it('saves only valid durations', async () => {
    const keyValueStore = mapStore();

    await expect(
      saveTrialTuning({ keyValueStore }, { phaseTransitionMs: 1_234, stepInMs: 250 }),
    ).resolves.toEqual({ phaseTransitionMs: 800, stepInMs: 250 });
  });

  it.each(['not json', '{"phaseTransitionMs":"fast"}', 'null', '[]'])(
    'reads the defaults from an unreadable value: %s',
    async (raw) => {
      const keyValueStore = mapStore();
      keyValueStore.values.set(TRIAL_TUNING_KEY, raw);

      await expect(getTrialTuning({ keyValueStore })).resolves.toEqual({
        phaseTransitionMs: 800,
        stepInMs: 400,
      });
    },
  );
});
