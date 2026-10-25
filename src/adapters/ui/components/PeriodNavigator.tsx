import { Pressable, StyleSheet, Text, View } from 'react-native';

import { artPalette } from '../pixelArt/artPalette';
import { MIN_TARGET_SIZE } from '../pixelArt/PixelButton';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { pixelFont, pixelTypography } from '../pixelArt/pixelTypography';

const { roles } = artPalette;

function Arrow({
  direction,
  label,
  enabled,
  onPress,
}: {
  readonly direction: 'left' | 'right';
  readonly label: string;
  readonly enabled: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={onPress}
      style={[styles.arrow, { opacity: enabled ? 1 : 0.35 }]}
    >
      <PixelIcon name={direction} color={roles.light} testID={`period-arrow-${direction}`} />
    </Pressable>
  );
}

/**
 * Barre de navigation d'une période (semaine, mois), dans l'identité pixel art : la flèche de la
 * période d'avant, son titre en police pixel (« Cette semaine ») et ses jours en police de texte,
 * la flèche de la période d'après, chacune dans une cible de 48 × 48 dp. Une action qui sortirait
 * de l'historique est désactivée, à 35 % d'opacité. Le titre est lu en entier (`label`) par le
 * lecteur d'écran à chaque changement de période.
 */
export function PeriodNavigator({
  title,
  subtitle,
  label,
  previousLabel,
  nextLabel,
  canGoPrevious,
  canGoNext,
  onPrevious,
  onNext,
}: {
  readonly title: string;
  readonly subtitle: string;
  readonly label: string;
  readonly previousLabel: string;
  readonly nextLabel: string;
  readonly canGoPrevious: boolean;
  readonly canGoNext: boolean;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
}) {
  return (
    <View style={styles.bar}>
      <Arrow direction="left" label={previousLabel} enabled={canGoPrevious} onPress={onPrevious} />
      <View
        accessible
        accessibilityLabel={label}
        accessibilityLiveRegion="polite"
        style={styles.titles}
      >
        <Text style={styles.title}>{title}</Text>
        <Text style={[pixelTypography.label, styles.subtitle]}>{subtitle}</Text>
      </View>
      <Arrow direction="right" label={nextLabel} enabled={canGoNext} onPress={onNext} />
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    paddingBottom: 6,
    paddingHorizontal: 8,
  },
  arrow: {
    width: MIN_TARGET_SIZE,
    height: MIN_TARGET_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titles: { flex: 1, alignItems: 'center' },
  title: {
    fontFamily: pixelFont,
    fontSize: 22,
    lineHeight: 26,
    color: roles.light,
    textAlign: 'center',
  },
  subtitle: { color: roles.parchment, textAlign: 'center' },
});
// Stryker restore all
