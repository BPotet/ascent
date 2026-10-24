// Réservé aux tests : `SpriteCanvas` sans Skia (limité à son test de fumée sous Jest), branché par
// `jest.config.js` dans les projets `integration` et `bdd`. Il expose le nom du sprite et son
// échelle, pour que les tests d'écran vérifient ce qui est dessiné, sans le dessiner.
import { View } from 'react-native';

import type { SpriteCanvasProps } from '../SpriteCanvas';

export function SpriteCanvas({ sprite, scale, style, testID }: SpriteCanvasProps) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      testID={testID ?? 'sprite-canvas'}
      style={style}
      {...{ sprite, scale }}
    />
  );
}
