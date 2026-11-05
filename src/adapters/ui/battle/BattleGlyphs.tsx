import { StyleSheet, View } from 'react-native';

import { AssetRows } from '../pixelArt/AssetRows';
import { BULWARK_SHIELD } from '../pixelArt/sprites/atelier/data/bulwarkShield';

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
 * L'écu du Rempart (`BulwarkShield`, #128) : l'image validée dans l'Atelier (#155), entière, ou
 * fendue quand le Rempart s'use, telle quelle, ni redessinée ni recolorée (ADR 0010). ×2 devant
 * « Riposte », ×1 devant le chiffre de la riposte et dans l'étiquette du Rempart. L'argent n'est
 * jamais montré sans lui. Décoratif.
 */
export function BulwarkShieldGlyph({
  cracked = false,
  scale,
}: {
  readonly cracked?: boolean;
  readonly scale: 1 | 2;
}) {
  return (
    <AssetRows
      image={cracked ? BULWARK_SHIELD.cracked : BULWARK_SHIELD.whole}
      scale={scale}
      testID={cracked ? 'battle-shield-glyph-cracked' : 'battle-shield-glyph'}
    />
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
