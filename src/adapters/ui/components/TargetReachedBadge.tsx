import { StyleSheet, Text, View } from 'react-native';

import { TARGET_REACHED } from '../format/formatWeeklyTarget';
import { artPalette } from '../pixelArt/artPalette';
import { ART_PIXEL } from '../pixelArt/artPixel';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { textFont } from '../pixelArt/pixelTypography';
import { useArtFrames } from '../pixelArt/useArtFrames';
import { useReducedMotion } from '../state/useReducedMotion';

const { roles } = artPalette;

// Stryker disable all: valeurs purement visuelles, vérifiées par la conformité aux maquettes (barrière 10 bis).
/** Les 3 paliers de l'allumage du badge : lumière vive, or, puis or sombre (l'état final). */
const STEPS = [roles.light, roles.gold, roles.goldDark] as const;
// Stryker restore all

/** Le badge, au palier `step`. */
function Badge({ step, testID }: { readonly step: number; readonly testID?: string }) {
  return (
    <View
      {...(testID !== undefined && { testID })}
      style={[styles.badge, { borderColor: STEPS[step] }]}
    >
      <PixelIcon name="flag8" color={roles.gold} secondColor={roles.parchment} testID="flag-icon" />
      <Text style={styles.text}>{TARGET_REACHED}</Text>
    </View>
  );
}

/** Le badge qui s'allume en 3 paliers, à 12 images par seconde (`target-burst`). */
function LightingBadge({ testID }: { readonly testID?: string }) {
  const step = useArtFrames(STEPS.length);
  return (
    <View testID="target-burst">
      <Badge step={step} {...(testID !== undefined && { testID })} />
    </View>
  );
}

/**
 * Le badge « Objectif atteint » d'une ligne de la Vue Journée : drapeau et mots, liseré d'or sombre,
 * jamais la couleur seule. Avec `flash` (un objectif tout juste atteint, F1), il s'allume en 3
 * paliers ; en mouvement réduit, il est tout de suite dans son état final. Décoratif pour le lecteur
 * d'écran, qui entend « objectif atteint » dans l'annonce de la ligne.
 */
export function TargetReachedBadge({
  flash,
  testID,
}: {
  readonly flash?: number | undefined;
  readonly testID?: string;
}) {
  const reducedMotion = useReducedMotion();
  const props = testID !== undefined ? { testID } : {};
  return (
    <View pointerEvents="none" style={styles.slot}>
      {flash === undefined || reducedMotion ? (
        <Badge step={STEPS.length - 1} {...props} />
      ) : (
        <LightingBadge key={flash} {...props} />
      )}
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  slot: { alignSelf: 'flex-start' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 2,
    paddingBottom: 2,
    paddingLeft: 4,
    paddingRight: 6,
    borderWidth: ART_PIXEL,
    backgroundColor: roles.goldBg,
  },
  text: { fontFamily: textFont.bold, fontSize: 12, lineHeight: 16, color: roles.gold },
});
// Stryker restore all
