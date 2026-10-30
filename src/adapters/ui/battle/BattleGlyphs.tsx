import { StyleSheet, View } from 'react-native';

import { artPalette } from '../pixelArt/artPalette';

// Stryker disable all: pictogrammes purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
/** Pictogrammes du combat, décoratifs : le cadenas de « Attends » est écrit à côté. */
function Decorative({
  children,
  size,
}: {
  readonly children: React.ReactNode;
  readonly size: number;
}) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      {children}
    </View>
  );
}

/** Le cadenas de l'étiquette « Attends ». */
export function LockGlyph({ color }: { readonly color: string }) {
  return (
    <Decorative size={14}>
      <View style={[styles.lockArc, { borderColor: color }]} />
      <View style={[styles.lockBody, { backgroundColor: color }]} />
    </Decorative>
  );
}

/**
 * L'écu du Rempart (#128) : un bouclier en pointe, plein, ou fendu quand le Rempart s'use. La forme
 * dit l'état ; l'argent n'est jamais montré sans lui. `size` est sa largeur, en dp.
 */
export function ShieldGlyph({
  color,
  size,
  cracked = false,
}: {
  readonly color: string;
  readonly size: number;
  readonly cracked?: boolean;
}) {
  const height = Math.round(size * 1.2);
  const top = Math.round(height * 0.58);
  return (
    <View
      testID={cracked ? 'battle-shield-glyph-cracked' : 'battle-shield-glyph'}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height }}
    >
      <View style={{ width: size, height: top, backgroundColor: color }} />
      <View
        style={[
          styles.point,
          {
            borderLeftWidth: size / 2,
            borderRightWidth: size / 2,
            borderTopWidth: height - top,
            borderTopColor: color,
          },
        ]}
      />
      {cracked ? <View style={[styles.crack, { left: size / 2 - 1, height }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  point: {
    width: 0,
    height: 0,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  crack: {
    position: 'absolute',
    top: 0,
    width: 2,
    backgroundColor: artPalette.roles.ink,
    transform: [{ skewX: '-18deg' }],
  },
  lockArc: {
    width: 8,
    height: 7,
    borderWidth: 1.8,
    borderBottomWidth: 0,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  lockBody: { width: 11, height: 7, borderRadius: 1.5 },
});
// Stryker restore all
