import { StyleSheet, View } from 'react-native';

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

const styles = StyleSheet.create({
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
