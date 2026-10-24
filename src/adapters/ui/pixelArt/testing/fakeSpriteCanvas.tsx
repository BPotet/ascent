// Réservé aux tests : `SpriteCanvas` sans Skia (limité à son test de fumée sous Jest), branché par
// `jest.config.js` dans les projets `integration` et `bdd`. Il dessine le sprite (une fois par nom,
// comme le vrai) et expose son nom, son échelle et sa taille en pixels d'art, pour que les tests
// d'écran vérifient ce qui est dessiné, sans Skia.
import { View } from 'react-native';

import type { SpriteCanvasProps } from '../SpriteCanvas';

const drawn = new Map<string, { readonly width: number; readonly height: number }>();

function sizeOf(sprite: string, draw: SpriteCanvasProps['draw']) {
  const known = drawn.get(sprite);
  if (known !== undefined) {
    return known;
  }
  const { width, height } = draw();
  drawn.set(sprite, { width, height });
  return { width, height };
}

export function SpriteCanvas({ sprite, draw, scale, style, testID }: SpriteCanvasProps) {
  const { width, height } = sizeOf(sprite, draw);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      testID={testID ?? 'sprite-canvas'}
      style={style}
      {...{ sprite, scale, pixelWidth: width, pixelHeight: height }}
    />
  );
}
