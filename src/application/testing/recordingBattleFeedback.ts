// Réservé aux tests : un son et une vibration de combat silencieux, qui notent ce qu'on leur demande.
import type { BattleHapticCue, BattleHaptics } from '../ports/BattleHaptics';
import type { BattleSound, BattleSoundCue } from '../ports/BattleSound';

export function silentBattleSound(): BattleSound & { readonly played: BattleSoundCue[] } {
  const played: BattleSoundCue[] = [];
  return { played, play: (cue) => void played.push(cue) };
}

export function silentBattleHaptics(): BattleHaptics & { readonly played: BattleHapticCue[] } {
  const played: BattleHapticCue[] = [];
  return { played, play: (cue) => void played.push(cue) };
}
