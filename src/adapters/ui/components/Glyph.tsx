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

/** Le « i » cerclé des messages d'information (« S'applique à toute cette semaine… »). Décoratif. */
export function InfoGlyph({ color }: { readonly color: string }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="info-glyph"
      style={[styles.alert, { borderColor: color, width: 16, height: 16, borderRadius: 8 }]}
    >
      <Text style={[styles.alertMark, { color, fontSize: 11 }]}>i</Text>
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

/** La lune du rappel d'hier. Décorative. */
export function MoonGlyph({ color }: { readonly color: string }) {
  return (
    <Text
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.moon, { color }]}
    >
      ☾
    </Text>
  );
}

/** La croix d'un bouton « Fermer ». Décorative : le bouton a son libellé. */
export function CloseGlyph({ color }: { readonly color: string }) {
  return (
    <Text
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.close, { color }]}
    >
      ×
    </Text>
  );
}

/** Le sommet de l'avatar du personnage, dans l'en-tête des vues. Décoratif. */
export function PeakGlyph({ color }: { readonly color: string }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.peak}
    >
      <View style={[styles.peakBig, { borderBottomColor: color }]} />
      <View style={[styles.peakSmall, { borderBottomColor: color }]} />
    </View>
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

/** Les trois points « ⋯ » du bouton qui ouvre « Modifier l'habitude ». Décoratifs. */
export function MoreGlyph({ color }: { readonly color: string }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="more-glyph"
      style={styles.more}
    >
      {[0, 1, 2].map((dot) => (
        <View key={dot} style={[styles.moreDot, { backgroundColor: color }]} />
      ))}
    </View>
  );
}

/** Le crayon du nom d'une habitude dans la Vue Semaine (le toucher la modifie). Décoratif. */
export function PencilGlyph({ color }: { readonly color: string }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="pencil-glyph"
      style={styles.pencil}
    >
      <View style={[styles.pencilBody, { borderColor: color }]} />
      <View style={[styles.pencilTip, { borderTopColor: color }]} />
    </View>
  );
}

/**
 * Le drapeau planté au sommet de l'objectif atteint (badge, puce). Décoratif : « Objectif atteint »
 * est écrit à côté et lu par le lecteur d'écran.
 */
export function FlagGlyph({ color }: { readonly color: string }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="flag-glyph"
      style={styles.flag}
    >
      <View style={[styles.flagPole, { backgroundColor: color }]} />
      <View style={[styles.flagCloth, { backgroundColor: color }]} />
    </View>
  );
}

/** La coche de la puce « Objectif atteint ». Décorative. */
export function SmallCheckGlyph({ color }: { readonly color: string }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="small-check-glyph"
      style={[styles.smallCheck, { borderColor: color }]}
    />
  );
}

/**
 * La corbeille des actions de suppression : elle signale l'action destructive autrement que par la
 * couleur. Décorative : le libellé du bouton suffit au lecteur d'écran.
 */
export function TrashGlyph({ color }: { readonly color: string }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="trash-glyph"
      style={styles.trash}
    >
      <View style={[styles.trashHandle, { borderColor: color }]} />
      <View style={[styles.trashLid, { backgroundColor: color }]} />
      <View style={[styles.trashBin, { borderColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  plus: { fontSize: 24, lineHeight: 26, fontWeight: '600' },
  spark: { fontSize: 16, lineHeight: 20 },
  moon: { fontSize: 18, lineHeight: 20 },
  close: { fontSize: 24, lineHeight: 26 },
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
  peak: { width: 26, height: 18, opacity: 0.92 },
  peakBig: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderBottomWidth: 15,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  peakSmall: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  chevron: { width: 12, height: 12, borderLeftWidth: 2.4, borderBottomWidth: 2.4, borderRadius: 1 },
  chevronLeft: { marginLeft: 5, transform: [{ rotate: '45deg' }] },
  chevronRight: { marginRight: 5, transform: [{ rotate: '-135deg' }] },
  more: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  moreDot: { width: 4, height: 4, borderRadius: 2 },
  pencil: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  pencilBody: {
    width: 6,
    height: 14,
    borderWidth: 2,
    borderRadius: 1,
    transform: [{ rotate: '45deg' }, { translateY: -1 }],
  },
  pencilTip: {
    position: 'absolute',
    left: 2,
    bottom: 1,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderRightColor: 'transparent',
  },
  flag: { width: 14, height: 14 },
  flagPole: { position: 'absolute', left: 2, top: 1, width: 2.4, height: 13, borderRadius: 1.2 },
  flagCloth: { position: 'absolute', left: 4, top: 1.5, width: 9, height: 6.5, borderRadius: 1 },
  smallCheck: {
    width: 6,
    height: 10,
    marginTop: -2,
    marginHorizontal: 2,
    borderRightWidth: 2.2,
    borderBottomWidth: 2.2,
    transform: [{ rotate: '45deg' }],
  },
  trash: { width: 18, height: 18, alignItems: 'center' },
  trashHandle: { width: 7, height: 3, borderWidth: 2, borderBottomWidth: 0, marginTop: 1 },
  trashLid: { width: 14, height: 2, borderRadius: 1 },
  trashBin: {
    width: 10,
    height: 11,
    borderWidth: 2,
    borderTopWidth: 0,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
});
// Stryker restore all
