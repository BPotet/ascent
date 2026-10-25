import { StyleSheet, Text, View } from 'react-native';

import { TARGET_REACHED } from '../format/formatWeeklyTarget';
import { artPalette } from '../pixelArt/artPalette';
import { artPixelSize } from '../pixelArt/artPixel';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { textFont } from '../pixelArt/pixelTypography';
import { LIGHTING_STEPS, useTargetLighting } from './useTargetLighting';

const { roles } = artPalette;

/** Le pixel d'art, arrondi au pixel physique du téléphone (traits, crans, pas des envols). */
const LINE = artPixelSize(2);

/** Le badge, au palier `step`. */
function Badge({ step, testID }: { readonly step: number; readonly testID?: string }) {
  return (
    <View
      {...(testID !== undefined && { testID })}
      style={[styles.badge, { borderColor: LIGHTING_STEPS[step] }]}
    >
      <PixelIcon name="flag8" color={roles.gold} secondColor={roles.parchment} testID="flag-icon" />
      <Text style={styles.text}>{TARGET_REACHED}</Text>
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
  const { step, lighting } = useTargetLighting(flash);
  const badge = <Badge step={step} {...(testID !== undefined && { testID })} />;
  return (
    <View pointerEvents="none" style={styles.slot}>
      {lighting ? <View testID="target-burst">{badge}</View> : badge}
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
    borderWidth: LINE,
    backgroundColor: roles.goldBg,
  },
  text: { fontFamily: textFont.bold, fontSize: 12, lineHeight: 16, color: roles.gold },
});
// Stryker restore all
