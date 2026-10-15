import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { MIN_TOUCH_SIZE } from '../theme/metrics';
import { typography } from '../theme/typography';
import { ChevronGlyph } from './Glyph';

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
      style={styles.arrow}
    >
      <ChevronGlyph color={enabled ? colors.text : colors.iconDisabled} direction={direction} />
    </Pressable>
  );
}

/**
 * Barre de navigation d'une période (semaine, plus tard mois) : la période d'avant, son titre et
 * ses jours, la période d'après. Une action qui sortirait de l'historique est désactivée. Le titre
 * est lu en entier (`label`) par le lecteur d'écran à chaque changement de période.
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
        <Text style={[typography.periodTitle, styles.title]}>{title}</Text>
        <Text style={[typography.label, styles.subtitle]}>{subtitle}</Text>
      </View>
      <Arrow direction="right" label={nextLabel} enabled={canGoNext} onPress={onNext} />
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  bar: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    marginHorizontal: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  arrow: {
    width: MIN_TOUCH_SIZE,
    height: MIN_TOUCH_SIZE,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titles: { flex: 1, alignItems: 'center' },
  title: { color: colors.text, textAlign: 'center' },
  subtitle: { color: colors.muted, textAlign: 'center' },
});
// Stryker restore all
