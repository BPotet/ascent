import { useEffect, useState } from 'react';

import { useReducedMotion } from '../state/useReducedMotion';

/** La durée d'une image des animations pixel : 12 images par seconde, comme dans la tour. */
export const ART_FRAME_MS = 83;

/**
 * L'image à afficher d'une animation pixel de `count` images (de 0 à `count - 1`) : elle avance
 * d'une image toutes les `ART_FRAME_MS`, sans interpolation ni mise à l'échelle animée, puis reste
 * sur la dernière, ou recommence avec `loop`. Elle attend sur la première tant que `play` est faux.
 * En mouvement réduit, c'est tout de suite la dernière image : l'état final. Pour rejouer une
 * animation, l'écran remonte le composant (`key`).
 */
export function useArtFrames(
  count: number,
  { play = true, loop = false }: { readonly play?: boolean; readonly loop?: boolean } = {},
): number {
  const reducedMotion = useReducedMotion();
  const [frame, setFrame] = useState(0);
  const last = count - 1;
  const ended = frame >= last && !loop;

  useEffect(() => {
    if (!play || reducedMotion || ended) {
      return;
    }
    const timer = setTimeout(() => setFrame(frame >= last ? 0 : frame + 1), ART_FRAME_MS);
    return () => clearTimeout(timer);
  }, [frame, last, play, reducedMotion, ended]);

  return reducedMotion ? last : frame;
}
