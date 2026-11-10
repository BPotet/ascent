import { ImpactFeedbackStyle, impactAsync } from 'expo-haptics';

import type { Haptics } from '../../../application/ports/Haptics';
import type { RefusalHaptics } from '../../../application/ports/RefusalHaptics';

/** Demande une impulsion au téléphone, sans jamais lever d'erreur. */
function impact(style: ImpactFeedbackStyle): void {
  try {
    impactAsync(style).catch(() => undefined);
  } catch {
    // Le module natif est absent : pas de vibration.
  }
}

/**
 * Retour haptique du téléphone (`expo-haptics`) : une vibration brève et légère, comme dans la
 * maquette (« Légère vibration ») ; et la vibration de refus (#270, ADR 0026 D5), une impulsion
 * courte et sèche, distincte de la réussite. Ne lève jamais d'erreur : sans vibreur, sans
 * permission ou sans le module natif, le téléphone ne vibre pas et le reste du feedback est inchangé.
 */
export class ExpoHaptics implements Haptics, RefusalHaptics {
  success(): void {
    impact(ImpactFeedbackStyle.Light);
  }

  refusal(): void {
    impact(ImpactFeedbackStyle.Rigid);
  }
}
