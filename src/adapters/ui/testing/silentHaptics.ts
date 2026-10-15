// Réservé aux tests de l'interface : un retour haptique qui ne vibre pas et compte les vibrations
// demandées. (L'interface n'a pas le droit d'importer l'adaptateur `device/haptics/ExpoHaptics`.)
import type { Haptics } from '../../../application/ports/Haptics';

export function silentHaptics(): Haptics & { readonly successes: () => number } {
  let successes = 0;
  return {
    success: () => {
      successes += 1;
    },
    successes: () => successes,
  };
}
