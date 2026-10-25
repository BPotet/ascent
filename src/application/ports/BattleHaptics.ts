/** Les vibrations du combat : parade parfaite (forte), esquive, touché, phase ennemie (légère). */
export type BattleHapticCue = 'perfectParry' | 'dodge' | 'hit' | 'enemyPhase';

/**
 * Vibration de combat (`BattleHaptics`) — port des vibrations du combat. Le Retour haptique
 * (`Haptics`) reste réservé au gain d'expérience. Ne lève jamais d'erreur : sans vibreur, le
 * téléphone ne vibre pas.
 */
export interface BattleHaptics {
  play(cue: BattleHapticCue): void;
}
