import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';

import type { BattleSound, BattleSoundCue } from '../../../application/ports/BattleSound';

/** Les fichiers des sons provisoires, générés par `scripts/sounds/battle-sounds.mjs`. */
export const BATTLE_SOUND_FILES: Readonly<Record<BattleSoundCue, number>> = {
  perfectParry: require('./assets/perfect-parry.wav'),
  parry: require('./assets/parry.wav'),
  dodge: require('./assets/dodge.wav'),
  hit: require('./assets/hit.wav'),
  whiff: require('./assets/whiff.wav'),
  seal: require('./assets/seal.wav'),
  enemyPhase: require('./assets/enemy-phase.wav'),
  heroPhase: require('./assets/hero-phase.wav'),
  victory: require('./assets/victory.wav'),
  defeat: require('./assets/defeat.wav'),
  strike: require('./assets/strike.wav'),
  perfectStrike: require('./assets/perfect-strike.wav'),
  guardBreak: require('./assets/guard-break.wav'),
  lostAction: require('./assets/lost-action.wav'),
  guardRestore: require('./assets/guard-restore.wav'),
  guardUp: require('./assets/guard-up.wav'),
  raise: require('./assets/raise.wav'),
  bulwark: require('./assets/bulwark.wav'),
};

/**
 * Son de combat du téléphone (`expo-audio`) : un lecteur préchargé par son, rejoué depuis le
 * début. Sur iOS, le mode silencieux coupe les sons ; la bannière et la vibration restent. Sur
 * Android, le jeu sonne au volume Multimédia, même en mode vibreur ou silencieux : avec
 * `playsInSilentMode: false`, expo-audio n'y joue rien hors du mode sonnerie normal. Ne lève
 * jamais d'erreur. Mesure la latence du son : de la demande au début effectif de la lecture.
 */
export class ExpoAudioBattleSound implements BattleSound {
  private readonly players = new Map<BattleSoundCue, AudioPlayer>();
  private readonly requestedAt = new Map<BattleSoundCue, number>();
  private readonly latencySamples: number[] = [];

  constructor(private readonly now: () => number = () => performance.now()) {
    setAudioModeAsync({
      playsInSilentMode: Platform.OS === 'android',
      interruptionMode: 'mixWithOthers',
    }).catch(() => undefined);
    for (const cue of Object.keys(BATTLE_SOUND_FILES) as BattleSoundCue[]) {
      try {
        const player = createAudioPlayer(BATTLE_SOUND_FILES[cue]);
        player.addListener('playbackStatusUpdate', (status) => {
          const requested = this.requestedAt.get(cue);
          if (status.playing && requested !== undefined) {
            this.requestedAt.delete(cue);
            this.latencySamples.push(this.now() - requested);
          }
        });
        this.players.set(cue, player);
      } catch {
        // Le module natif est absent : ce son ne sera pas joué.
      }
    }
  }

  play(cue: BattleSoundCue): void {
    const player = this.players.get(cue);
    if (player === undefined) return;
    try {
      this.requestedAt.set(cue, this.now());
      player.seekTo(0).catch(() => undefined);
      player.play();
    } catch {
      this.requestedAt.delete(cue);
    }
  }

  /** Les latences mesurées, en ms : de la demande au début de la lecture. */
  latencies(): readonly number[] {
    return [...this.latencySamples];
  }

  /** Libère les lecteurs, à la fermeture de l'écran du combat. */
  release(): void {
    for (const player of this.players.values()) {
      try {
        player.remove();
      } catch {
        // Déjà libéré.
      }
    }
    this.players.clear();
  }
}
