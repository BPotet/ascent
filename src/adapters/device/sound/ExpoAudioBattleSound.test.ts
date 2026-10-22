import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

import { BATTLE_SOUND_CUES } from '../../../application/ports/BattleSound';
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

  it('respects the silent mode of the phone and mixes with other sounds', () => {
    new ExpoAudioBattleSound();

    expect(audioMode).toHaveBeenCalledWith({
      playsInSilentMode: false,
      interruptionMode: 'mixWithOthers',
    });
  });

  it('plays a sound from its start', () => {
    const sound = new ExpoAudioBattleSound();

    sound.play('perfectParry');

    expect(playerOf('perfectParry').calls).toEqual(['seekTo', 'play']);
    expect(playerOf('perfectParry').seekTo).toHaveBeenCalledWith(0);
    expect(playerOf('hit').calls).toEqual([]);
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
});
