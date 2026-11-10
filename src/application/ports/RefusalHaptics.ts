/**
 * La vibration de refus (`RefusalHaptics`, #270, ADR 0026 D5) : le port de la vibration courte d'un
 * choix refusé, comme un 4e pouvoir au menu des pouvoirs (M2), distincte de la vibration de réussite
 * (`Haptics`). Implémentée sur le téléphone par `adapters/device/haptics` ; silencieuse dans les
 * tests. Ne lève jamais d'erreur : un téléphone sans vibreur ne vibre pas, c'est tout.
 */
export interface RefusalHaptics {
  /** Une vibration courte de refus. */
  refusal(): void;
}
