import { ImpactFeedbackStyle, impactAsync } from 'expo-haptics';
import type * as ExpoHapticsModule from 'expo-haptics';

import { ExpoHaptics } from './ExpoHaptics';

// Le vrai expo-haptics (module natif simulé par jest-expo), dont on peut provoquer l'échec.
jest.mock('expo-haptics', () => {
  const actual = jest.requireActual<typeof ExpoHapticsModule>('expo-haptics');
  return { ...actual, impactAsync: jest.fn(actual.impactAsync) };
});

const impact = jest.mocked(impactAsync);

/** Laisse le téléphone répondre (ou échouer) à la demande de vibration. */
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('ExpoHaptics', () => {
  beforeEach(() => impact.mockClear());

  it('asks the phone for one light vibration on a success', async () => {
    new ExpoHaptics().success();
    await flush();

    expect(impact).toHaveBeenCalledTimes(1);
    expect(impact).toHaveBeenCalledWith(ImpactFeedbackStyle.Light);
  });

  it('stays silent, without error, on a phone without vibrator or permission', async () => {
    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);
    try {
      impact.mockRejectedValueOnce(new Error('Vibrator unavailable'));

      expect(() => new ExpoHaptics().success()).not.toThrow();
      await flush();

      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('stays silent, without error, when the native module is missing', () => {
    impact.mockImplementationOnce(() => {
      throw new Error('ExpoHaptics native module is not available');
    });

    expect(() => new ExpoHaptics().success()).not.toThrow();
  });
});
