import { ImpactFeedbackStyle, impactAsync } from 'expo-haptics';

import type { Haptics } from '../../../application/ports/Haptics';

/**
 * Retour haptique du téléphone (`expo-haptics`) : une vibration brève et légère, comme dans la
 * maquette (« Légère vibration »). Ne lève jamais d'erreur : sans vibreur, sans permission ou sans
 * le module natif, le téléphone ne vibre pas et le reste du feedback est inchangé.
 */
export class ExpoHaptics implements Haptics {
  success(): void {
    try {
      impactAsync(ImpactFeedbackStyle.Light).catch(() => undefined);
    } catch {
      // Le module natif est absent : pas de vibration.
    }
  }
}
