/**
 * Les vibrations du combat : parade parfaite (forte), esquive, touché, phase ennemie (légère),
 * cassure de garde (forte), frappe parfaite (courte), Riposte du Rempart (courte, #128), l'effet
 * d'un pouvoir ouvert au toucher maintenu (très courte, #235) et les Épines (courte, plus faible
 * qu'un coup reçu, #259).
 */
export type BattleHapticCue =
  | 'perfectParry'
  | 'dodge'
  | 'hit'
  | 'enemyPhase'
  | 'guardBreak'
  | 'perfectStrike'
  | 'bulwarkCounter'
  | 'powerTip'
  | 'thorns';

/**
 * Vibration de combat (`BattleHaptics`) — port des vibrations du combat. Le Retour haptique
 * (`Haptics`) reste réservé au gain d'expérience. Ne lève jamais d'erreur : sans vibreur, le
 * téléphone ne vibre pas.
 */
export interface BattleHaptics {
  play(cue: BattleHapticCue): void;
}
