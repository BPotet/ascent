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

const styles = StyleSheet.create({
  plus: { fontSize: 24, lineHeight: 26, fontWeight: '600' },
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
});
// Stryker restore all
