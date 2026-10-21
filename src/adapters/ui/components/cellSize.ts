import { useCallback, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

import { MIN_TOUCH_SIZE } from '../theme/metrics';

/**
 * La hauteur d'une case de la Vue Semaine, d'après la largeur de sa colonne : carrée quand la
 * colonne fait au moins 44 pt, sinon 44 pt de haut sur la largeur de la colonne (comme la grille
 * `1fr` + `min-height: 44px` de la maquette). La case ne dépasse jamais sa colonne : sur un écran
 * étroit (320 dp), les 7 cases restent côte à côte dans la carte.
 */
export function useCellHeight(): {
  readonly height: number;
  readonly onLayout: (event: LayoutChangeEvent) => void;
} {
  const [height, setHeight] = useState(MIN_TOUCH_SIZE);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setHeight(Math.max(MIN_TOUCH_SIZE, Math.round(event.nativeEvent.layout.width)));
  }, []);
  return { height, onLayout };
}
