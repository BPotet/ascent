import { StyleSheet, View } from 'react-native';

// Stryker disable all: pictogrammes purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
/** Pictogrammes des boutons du combat, décoratifs : chaque bouton a son libellé. */
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

/** L'épée de « Attaquer ». */
export function SwordGlyph({ color }: { readonly color: string }) {
  return (
    <Decorative size={26}>
      <View style={[styles.blade, { backgroundColor: color }]} />
      <View style={[styles.guard, { backgroundColor: color }]} />
    </Decorative>
  );
}

/** Le bouclier de « Parade ». */
export function ShieldGlyph({ color }: { readonly color: string }) {
  return (
    <Decorative size={26}>
      <View style={[styles.shield, { borderColor: color }]} />
    </Decorative>
  );
}

/** La flèche de « Esquive ». */
export function DodgeGlyph({ color }: { readonly color: string }) {
  return (
    <Decorative size={26}>
      <View style={[styles.dodgeBar, { backgroundColor: color }]} />
      <View style={[styles.dodgeArrow, { borderColor: color }]} />
      <View style={[styles.dodgeWall, { backgroundColor: color }]} />
    </Decorative>
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
  blade: {
    position: 'absolute',
    width: 3,
    height: 24,
    borderRadius: 1.5,
    transform: [{ rotate: '45deg' }],
  },
  guard: {
    position: 'absolute',
    width: 10,
    height: 3,
    borderRadius: 1.5,
    top: 15,
    left: 4,
    transform: [{ rotate: '45deg' }],
  },
  shield: {
    width: 18,
    height: 21,
    borderWidth: 2.2,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  dodgeBar: { position: 'absolute', width: 14, height: 2.4, right: 3 },
  dodgeArrow: {
    position: 'absolute',
    width: 9,
    height: 9,
    left: 8,
    borderLeftWidth: 2.4,
    borderBottomWidth: 2.4,
    transform: [{ rotate: '45deg' }],
  },
  dodgeWall: { position: 'absolute', width: 2.4, height: 16, left: 3 },
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
