import { ImpactFeedbackStyle, impactAsync } from 'expo-haptics';

import type { BattleHapticCue, BattleHaptics } from '../../../application/ports/BattleHaptics';

/**
 * La force de chaque vibration du combat : forte pour la parade parfaite et la cassure de garde,
 * courte et sèche pour la frappe parfaite et la Riposte du Rempart (#128), légère pour la phase
 * ennemie.
 */
export const BATTLE_HAPTIC_STYLES: Readonly<Record<BattleHapticCue, ImpactFeedbackStyle>> = {
  perfectParry: ImpactFeedbackStyle.Heavy,
  dodge: ImpactFeedbackStyle.Light,
  hit: ImpactFeedbackStyle.Medium,
  enemyPhase: ImpactFeedbackStyle.Soft,
  guardBreak: ImpactFeedbackStyle.Heavy,
  perfectStrike: ImpactFeedbackStyle.Rigid,
  bulwarkCounter: ImpactFeedbackStyle.Rigid,
};

/**
 * Vibration de combat du téléphone (`expo-haptics`). Ne lève jamais d'erreur : sans vibreur, sans
 * permission ou sans le module natif, le téléphone ne vibre pas et le combat continue.
 */
export class ExpoBattleHaptics implements BattleHaptics {
  play(cue: BattleHapticCue): void {
    try {
      impactAsync(BATTLE_HAPTIC_STYLES[cue]).catch(() => undefined);
    } catch {
      // Le module natif est absent : pas de vibration.
    }
  }
}
