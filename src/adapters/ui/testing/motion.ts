// Aide aux tests des écrans : le mouvement réduit, comme le joueur peut le demander au téléphone.
import { AccessibilityInfo } from 'react-native';

const isReduceMotionEnabled = () => jest.mocked(AccessibilityInfo.isReduceMotionEnabled);

/**
 * Fait tourner les tests d'un fichier d'écran avec le mouvement réduit : ils vérifient ce que
 * l'écran montre et enregistre, sans attendre la fin des animations (le compteur d'expérience se
 * met à jour image par image). Les animations sont vérifiées par les tests des composants, et par
 * les tests qui appellent `withMotion`.
 */
export function reduceMotionInEachTest(): void {
  beforeEach(() => {
    isReduceMotionEnabled().mockResolvedValue(true);
  });
  afterEach(() => {
    isReduceMotionEnabled().mockResolvedValue(false);
  });
}

/** Rend le mouvement au test en cours (le réglage par défaut du téléphone). */
export function withMotion(): void {
  isReduceMotionEnabled().mockResolvedValue(false);
}
