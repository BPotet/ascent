import { DEFAULT_SOUND_LATENCY_MS } from '../ports/BattleSound';
import { silentBattleSound } from './recordingBattleFeedback';

describe('silentBattleSound (test double)', () => {
  it('records the cues and expects the default latency, or the one it is given', () => {
    const sound = silentBattleSound();
    sound.play('glint');

    expect(sound.played).toEqual(['glint']);
    expect(sound.expectedLatency()).toBe(DEFAULT_SOUND_LATENCY_MS);
    expect(silentBattleSound({ latency: 120 }).expectedLatency()).toBe(120);
  });
});
