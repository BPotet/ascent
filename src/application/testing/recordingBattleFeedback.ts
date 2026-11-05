// Réservé aux tests : un son et une vibration de combat silencieux, qui notent ce qu'on leur demande.
import type { BattleHapticCue, BattleHaptics } from '../ports/BattleHaptics';
import {
  DEFAULT_SOUND_LATENCY_MS,
  type BattleSound,
  type BattleSoundCue,
} from '../ports/BattleSound';

/** Un son silencieux ; sa latence attendue est celle par défaut, ou `latency`. */
export function silentBattleSound({
  latency = DEFAULT_SOUND_LATENCY_MS,
}: { readonly latency?: number } = {}): BattleSound & { readonly played: BattleSoundCue[] } {
  const played: BattleSoundCue[] = [];
  return { played, play: (cue) => void played.push(cue), expectedLatency: () => latency };
}

export function silentBattleHaptics(): BattleHaptics & { readonly played: BattleHapticCue[] } {
  const played: BattleHapticCue[] = [];
  return { played, play: (cue) => void played.push(cue) };
}
