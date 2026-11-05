// Aide aux tests des écrans à icônes (#157, #158, #159) : l'écrin d'un élément et son icône.
import { type screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { artPixelSize } from '../pixelArt/artPixel';

type Element = ReturnType<typeof screen.getByTestId>;

const hidden = { includeHiddenElements: true } as const;

/**
 * L'écrin d'un élément : l'écrin lui-même, son style, et le nom, l'échelle et la taille rendue (en
 * dp) de son icône.
 */
export function wellOf(element: Element) {
  const well = within(element).getByTestId('icon-well', hidden);
  const icon = within(well).getByTestId('icon-well-icon', hidden).props as {
    sprite: string;
    scale: 2 | 3 | 4 | 6;
    pixelWidth: number;
    pixelHeight: number;
  };
  return {
    well,
    style: StyleSheet.flatten(well.props.style),
    sprite: icon.sprite,
    scale: icon.scale,
    width: icon.pixelWidth * artPixelSize(icon.scale),
    height: icon.pixelHeight * artPixelSize(icon.scale),
  };
}
