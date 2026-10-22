import { ImpactFeedbackStyle, impactAsync } from 'expo-haptics';
import type * as ExpoHapticsModule from 'expo-haptics';

import { BATTLE_HAPTIC_STYLES, ExpoBattleHaptics } from './ExpoBattleHaptics';

// Le vrai expo-haptics (module natif simulé par jest-expo), dont on peut provoquer l'échec.
jest.mock('expo-haptics', () => {
  const actual = jest.requireActual<typeof ExpoHapticsModule>('expo-haptics');
  return { ...actual, impactAsync: jest.fn(actual.impactAsync) };
});

const impact = jest.mocked(impactAsync);
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('ExpoBattleHaptics', () => {
  beforeEach(() => impact.mockClear());

  it('vibrates strongly for a perfect parry and lightly for the enemy phase', () => {
    expect(BATTLE_HAPTIC_STYLES).toEqual({
      perfectParry: ImpactFeedbackStyle.Heavy,
      dodge: ImpactFeedbackStyle.Light,
      hit: ImpactFeedbackStyle.Medium,
      enemyPhase: ImpactFeedbackStyle.Soft,
    });
  });

  it.each(Object.entries(BATTLE_HAPTIC_STYLES))(
    'asks the phone for one %s vibration',
    async (cue, style) => {
      new ExpoBattleHaptics().play(cue as keyof typeof BATTLE_HAPTIC_STYLES);
      await flush();

      expect(impact).toHaveBeenCalledTimes(1);
      expect(impact).toHaveBeenCalledWith(style);
    },
  );

  it('stays silent, without error, on a phone without vibrator', async () => {
    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);
    try {
      impact.mockRejectedValueOnce(new Error('Vibrator unavailable'));

      expect(() => new ExpoBattleHaptics().play('hit')).not.toThrow();
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

    expect(() => new ExpoBattleHaptics().play('perfectParry')).not.toThrow();
  });
});
