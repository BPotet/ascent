/**
 * Retour haptique (`Haptics`) — port de la vibration légère qui accompagne un gain d'expérience
 * (#5). Implémenté sur le téléphone par `adapters/device/haptics` ; silencieux dans les tests.
 * Utilisé par l'interface seulement quand une case passe à « fait » (`xpChange > 0`), jamais pour
 * un retour en arrière. Ne lève jamais d'erreur : un téléphone sans vibreur ne vibre pas, c'est tout.
 */
export interface Haptics {
  /** Une vibration légère de réussite. */
  success(): void;
}
