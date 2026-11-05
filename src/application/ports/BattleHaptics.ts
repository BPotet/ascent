/**
 * Les vibrations du combat : parade parfaite (forte), esquive, touché, phase ennemie (légère),
 * cassure de garde (forte), frappe parfaite (courte) et Riposte du Rempart (courte, #128).
 */
export type BattleHapticCue =
  | 'perfectParry'
  | 'dodge'
  | 'hit'
  | 'enemyPhase'
  | 'guardBreak'
  | 'perfectStrike'
  | 'bulwarkCounter';

/**
 * Vibration de combat (`BattleHaptics`) — port des vibrations du combat. Le Retour haptique
 * (`Haptics`) reste réservé au gain d'expérience. Ne lève jamais d'erreur : sans vibreur, le
 * téléphone ne vibre pas.
 */
export interface BattleHaptics {
  play(cue: BattleHapticCue): void;
}
