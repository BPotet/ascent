import type { ReactNode } from 'react';
import { type StyleProp, StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';

import { artPalette } from './artPalette';
import { artPixelSize } from './artPixel';

const { roles } = artPalette;

/** Cache un élément décoratif au lecteur d'écran (Android et iOS). */
const decorative = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
  pointerEvents: 'none',
} as const;

/**
 * Le cadre d'un panneau du bas (`PixelSheet`), sans logique : la surface, les coins hauts crantés
 * d'un pixel d'art, l'arête haute en trait puis relevée, et la poignée de 40 × 4 dp. Les écrans
 * gardent leur voile, leur clavier, leur hauteur et leurs `testID` ; `style` va au contenu, les
 * autres propriétés au panneau. Le décor n'est pas lu.
 */
export function PixelSheet({
  style,
  children,
  testID,
  ...props
}: ViewProps & {
  readonly style?: StyleProp<ViewStyle>;
  readonly children?: ReactNode;
}) {
  const line = artPixelSize(2);
  return (
    <View {...props} {...(testID !== undefined && { testID })}>
      <View
        {...decorative}
        testID="pixel-sheet-edge"
        style={{ height: line, marginHorizontal: 2 * line, backgroundColor: roles.line }}
      />
      <View
        {...decorative}
        testID="pixel-sheet-edge"
        style={{ height: line, marginHorizontal: line, backgroundColor: roles.raised }}
      />
      <View
        {...(testID !== undefined && { testID: `${testID}-body` })}
        style={[styles.body, { borderTopWidth: line }, style]}
      >
        <View {...decorative} testID="pixel-sheet-grab" style={styles.grab} />
        {children}
      </View>
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  body: { backgroundColor: roles.surface, borderTopColor: roles.raised },
  grab: {
    width: 40,
    height: 4,
    backgroundColor: roles.line,
    alignSelf: 'center',
    marginTop: 4,
    marginBottom: 2,
  },
});
// Stryker restore all
