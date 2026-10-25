import { useEffect, useState } from 'react';

import { artPalette } from '../pixelArt/artPalette';
import { ART_FRAME_MS } from '../pixelArt/useArtFrames';
import { useReducedMotion } from '../state/useReducedMotion';

const { roles } = artPalette;

// Stryker disable all: valeurs purement visuelles, vérifiées par la conformité aux maquettes (barrière 10 bis).
/** Les 3 paliers de l'allumage : lumière vive, or, puis or sombre (l'état final). */
export const LIGHTING_STEPS = [roles.light, roles.gold, roles.goldDark] as const;
// Stryker restore all

const FINAL_STEP = LIGHTING_STEPS.length - 1;

/**
 * L'allumage en 3 paliers de ce qui marque un objectif tout juste atteint (F1) : le badge de la Vue
 * Journée, la puce de la Vue Semaine. À chaque nouveau `flash`, `step` part du premier palier et
 * avance d'un palier toutes les 83 ms (12 images par seconde) jusqu'au dernier, l'état final.
 * `lighting` reste vrai tant que `flash` est donné. En mouvement réduit, l'état final tout de suite.
 */
export function useTargetLighting(flash: number | undefined): {
  readonly step: number;
  readonly lighting: boolean;
} {
  const reducedMotion = useReducedMotion();
  const [shown, setShown] = useState({ flash, step: flash === undefined ? FINAL_STEP : 0 });
  if (shown.flash !== flash) {
    setShown({ flash, step: flash === undefined ? FINAL_STEP : 0 });
  }
  const { step } = shown;

  useEffect(() => {
    if (reducedMotion || step >= FINAL_STEP) {
      return;
    }
    const timer = setTimeout(
      () => setShown((current) => ({ ...current, step: current.step + 1 })),
      ART_FRAME_MS,
    );
    return () => clearTimeout(timer);
  }, [step, reducedMotion]);

  return reducedMotion
    ? { step: FINAL_STEP, lighting: false }
    : { step, lighting: flash !== undefined };
}
