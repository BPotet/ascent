import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Platform } from 'react-native';

import {
  BATTLE_SOUND_CUES,
  DEFAULT_SOUND_LATENCY_MS,
} from '../../../application/ports/BattleSound';
import { BATTLE_SOUND_FILES, ExpoAudioBattleSound } from './ExpoAudioBattleSound';

type StatusListener = (status: { readonly playing: boolean }) => void;

/** Un lecteur simulé, qui note ce qu'on lui demande. */
function fakePlayer(source: unknown) {
  const listeners: StatusListener[] = [];
  return {
    source,
    calls: [] as string[],
    addListener: jest.fn((event: string, listener: StatusListener) => {
      expect(event).toBe('playbackStatusUpdate');
      listeners.push(listener);
      return { remove: jest.fn() };
    }),
    emit(status: { readonly playing: boolean }) {
      for (const listener of listeners) listener(status);
    },
    seekTo: jest.fn(async function (this: { calls: string[] }) {
      this.calls.push('seekTo');
    }),
    play: jest.fn(function (this: { calls: string[] }) {
      this.calls.push('play');
    }),
    remove: jest.fn(),
  };
}

type FakePlayer = ReturnType<typeof fakePlayer>;

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(),
  setAudioModeAsync: jest.fn(async () => undefined),
}));

const create = jest.mocked(createAudioPlayer);
const audioMode = jest.mocked(setAudioModeAsync);
let players: FakePlayer[];

beforeEach(() => {
  players = [];
  create.mockReset();
  create.mockImplementation(((source: unknown) => {
    const player = fakePlayer(source);
    players.push(player);
    return player;
  }) as unknown as typeof createAudioPlayer);
  audioMode.mockClear();
});

/** Le lecteur d'un son : sous Jest, tous les fichiers valent 1 ; les lecteurs sont créés dans l'ordre. */
function playerOf(cue: keyof typeof BATTLE_SOUND_FILES): FakePlayer {
  return players[Object.keys(BATTLE_SOUND_FILES).indexOf(cue)]!;
}

describe('ExpoAudioBattleSound', () => {
  it('preloads one player per sound of the battle, from its file', () => {
    new ExpoAudioBattleSound();

    expect(Object.keys(BATTLE_SOUND_FILES).sort()).toEqual([...BATTLE_SOUND_CUES].sort());
    expect(players.map((player) => player.source)).toEqual(Object.values(BATTLE_SOUND_FILES));
  });

  it.each([
    ['ios', false],
    ['android', true],
  ] as const)(
    'on %s, mixes with other sounds and plays in silent mode: %s',
    (os, playsInSilentMode) => {
      // iOS : le mode silencieux coupe les sons du jeu, c'est voulu. Android : expo-audio ne joue
      // rien hors du mode sonnerie normal si playsInSilentMode vaut false ; le jeu doit sonner au
      // volume Multimédia, même en mode vibreur.
      const platform = jest.replaceProperty(Platform, 'OS', os);
      try {
        new ExpoAudioBattleSound();

        expect(audioMode).toHaveBeenCalledWith({
          playsInSilentMode,
          interruptionMode: 'mixWithOthers',
        });
      } finally {
        platform.restore();
      }
    },
  );

  it('plays a sound from its start', () => {
    const sound = new ExpoAudioBattleSound();

    sound.play('perfectParry');

    expect(playerOf('perfectParry').calls).toEqual(['seekTo', 'play']);
    expect(playerOf('perfectParry').seekTo).toHaveBeenCalledWith(0);
    expect(playerOf('hit').calls).toEqual([]);
  });

  it('preloads and plays the shield clash of the Bulwark riposte (#128)', () => {
    const sound = new ExpoAudioBattleSound();

    sound.play('shieldClash');

    expect(playerOf('shieldClash').calls).toEqual(['seekTo', 'play']);
    expect(playerOf('bulwark').calls).toEqual([]);
  });

  it('measures the sound latency with the monotonic clock of the phone by default', () => {
    const now = jest
      .spyOn(performance, 'now')
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(1_032);
    try {
      const sound = new ExpoAudioBattleSound();

      sound.play('dodge');
      playerOf('dodge').emit({ playing: true });

      expect(sound.latencies()).toEqual([32]);
    } finally {
      now.mockRestore();
    }
  });

  it('measures the latency from the request to the start of the playback', () => {
    let now = 1_000;
    const sound = new ExpoAudioBattleSound(() => now);

    sound.play('dodge');
    now = 1_032;
    playerOf('dodge').emit({ playing: false });
    playerOf('dodge').emit({ playing: true });
    playerOf('dodge').emit({ playing: true });

    expect(sound.latencies()).toEqual([32]);
  });

  it('ignores a playing status that nobody asked for', () => {
    const sound = new ExpoAudioBattleSound(() => 0);

    playerOf('seal').emit({ playing: true });

    expect(sound.latencies()).toEqual([]);
  });

  it('never throws when a player fails, and does not measure it', () => {
    const sound = new ExpoAudioBattleSound(() => 0);
    playerOf('hit').play.mockImplementation(() => {
      throw new Error('Player released');
    });

    expect(() => sound.play('hit')).not.toThrow();
    playerOf('hit').emit({ playing: true });
    expect(sound.latencies()).toEqual([]);
  });

  it('stays silent, without error, when the native module is missing', () => {
    create.mockImplementation(() => {
      throw new Error('ExpoAudio native module is not available');
    });
    audioMode.mockRejectedValueOnce(new Error('ExpoAudio native module is not available'));

    const sound = new ExpoAudioBattleSound();

    expect(() => sound.play('victory')).not.toThrow();
  });

  it('releases its players, once', () => {
    const sound = new ExpoAudioBattleSound();
    players[0]!.remove.mockImplementation(() => {
      throw new Error('Already released');
    });

    sound.release();
    sound.release();
    sound.play('parry');

    for (const player of players) expect(player.remove).toHaveBeenCalledTimes(1);
    expect(playerOf('parry').play).not.toHaveBeenCalled();
  });

  describe('the expected latency', () => {
    /** Mesure les latences `latencies`, une à une, sur le son de l'esquive. */
    function measured(latencies: readonly number[]): ExpoAudioBattleSound {
      let now = 0;
      const sound = new ExpoAudioBattleSound(() => now);
      for (const latency of latencies) {
        now += 1_000;
        sound.play('dodge');
        now += latency;
        playerOf('dodge').emit({ playing: true });
      }
      return sound;
    }

    it('is the default latency under 5 measures', () => {
      expect(new ExpoAudioBattleSound().expectedLatency()).toBe(DEFAULT_SOUND_LATENCY_MS);
      expect(measured([10, 20, 30, 40]).expectedLatency()).toBe(DEFAULT_SOUND_LATENCY_MS);
    });

    it('is the median of the measures from 5 measures on', () => {
      expect(measured([90, 10, 50, 30, 70]).expectedLatency()).toBe(50);
    });

    it('takes the mean of the two middle measures for an even count', () => {
      expect(measured([90, 10, 50, 30, 70, 20]).expectedLatency()).toBe(40);
    });

    it('only keeps the last 20 measures', () => {
      const old = Array.from({ length: 10 }, () => 500);
      const recent = Array.from({ length: 20 }, (_, index) => 10 + index);

      expect(measured([...old, ...recent]).expectedLatency()).toBe(19.5);
    });
  });
});
