import { StyleSheet, Text, View } from 'react-native';

// Stryker disable all: pictogrammes purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
/** Le « + » des boutons d'ajout. Décoratif : le libellé du bouton suffit au lecteur d'écran. */
export function PlusGlyph({ color }: { readonly color: string }) {
  return (
    <Text
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.plus, { color }]}
    >
      +
    </Text>
  );
}

/** Le « ! » cerclé des messages d'erreur. Décoratif. */
export function AlertGlyph({
  color,
  size = 16,
}: {
  readonly color: string;
  readonly size?: number;
}) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.alert,
        { borderColor: color, width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.alertMark, { color, fontSize: size * 0.7 }]}>!</Text>
    </View>
  );
}

/** L'étoile de l'expérience, devant l'aide et l'encouragement. Décorative. */
export function SparkGlyph({ color }: { readonly color: string }) {
  return (
    <Text
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.spark, { color }]}
    >
      ✦
    </Text>
  );
}

/** La coche d'une habitude « fait ». Décorative : l'état est écrit et lu par le lecteur d'écran. */
export function CheckGlyph({ color }: { readonly color: string }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="check-mark"
      style={[styles.check, { borderColor: color }]}
    />
  );
}

/** La croix d'une case « pas fait ». Décorative : l'état est lu par le lecteur d'écran. */
export function CrossGlyph({ color }: { readonly color: string }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="cross-mark"
      style={styles.cross}
    >
      <View
        style={[styles.crossBar, { backgroundColor: color, transform: [{ rotate: '45deg' }] }]}
      />
      <View
        style={[styles.crossBar, { backgroundColor: color, transform: [{ rotate: '-45deg' }] }]}
      />
    </View>
  );
}

/** Le point seul d'une case « hors habitude ». Décoratif. */
export function DotGlyph({ color }: { readonly color: string }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="dot-mark"
      style={[styles.dot, { backgroundColor: color }]}
    />
  );
}

/** Le chevron des boutons « Semaine précédente » (`left`) et « Semaine suivante » (`right`). */
export function ChevronGlyph({
  color,
  direction,
}: {
  readonly color: string;
  readonly direction: 'left' | 'right';
}) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.chevron,
        { borderColor: color },
        direction === 'left' ? styles.chevronLeft : styles.chevronRight,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  plus: { fontSize: 24, lineHeight: 26, fontWeight: '600' },
  spark: { fontSize: 16, lineHeight: 20 },
  alert: { borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  alertMark: { fontWeight: '700', lineHeight: undefined },
  check: {
    width: 11,
    height: 20,
    marginTop: -4,
    borderRightWidth: 3,
    borderBottomWidth: 3,
    borderRadius: 1,
    transform: [{ rotate: '45deg' }],
  },
  cross: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  crossBar: { position: 'absolute', width: 17, height: 2.4, borderRadius: 1.2 },
  dot: { width: 6.4, height: 6.4, borderRadius: 3.2 },
  chevron: { width: 12, height: 12, borderLeftWidth: 2.4, borderBottomWidth: 2.4, borderRadius: 1 },
  chevronLeft: { marginLeft: 5, transform: [{ rotate: '45deg' }] },
  chevronRight: { marginRight: 5, transform: [{ rotate: '-135deg' }] },
});
// Stryker restore all
