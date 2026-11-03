/**
 * La bande sombre de l'annonce de l'Invocation (#172), dessinée par Skia comme le voile du fond de
 * palier (`TierBackdrop`) : elle s'efface sur les bords. Sous Jest, les tests d'écran la remplacent
 * par `testing/fakeSummonBandFade.tsx` (jest.config.js).
 */
import { Canvas, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { summonBandGradient } from './scene/summonBand';

export interface SummonBandFadeProps {
  /** La couleur de la bande, au milieu. */
  readonly color: string;
}

export function SummonBandFade({ color }: SummonBandFadeProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  };
  const gradient = summonBandGradient(size.width, color);
  return (
    <View
      pointerEvents="none"
      onLayout={onLayout}
      testID="summon-band"
      style={StyleSheet.absoluteFill}
    >
      <Canvas
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        testID="summon-band-fade"
        style={StyleSheet.absoluteFill}
      >
        <Rect x={0} y={0} width={size.width} height={size.height}>
          <LinearGradient
            start={vec(gradient.start.x, gradient.start.y)}
            end={vec(gradient.end.x, gradient.end.y)}
            colors={gradient.colors}
            positions={gradient.positions}
          />
        </Rect>
      </Canvas>
    </View>
  );
}
