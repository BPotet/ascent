import type { ReactNode } from 'react';
import { Image, type ImageSourcePropType, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { spacing } from '../theme/metrics';
import { typography } from '../theme/typography';

/**
 * Illustrations des états de la maquette validée, exportées de ses SVG (1x, 2x, 3x) :
 * `summit` (montagne, état vide) et `alert` (grande icône d'alerte de 56 pt, erreur).
 */
const illustrations = {
  summit: { source: require('../assets/summit.png'), width: 180, height: 130 },
  alert: { source: require('../assets/alert.png'), width: 56, height: 56 },
} as const satisfies Record<string, { source: ImageSourcePropType; width: number; height: number }>;

export type Illustration = keyof typeof illustrations;

/**
 * État plein écran d'une vue (vide, erreur) : une illustration, un titre, une explication et une
 * seule action. `alert` fait annoncer l'état au lecteur d'écran (erreur). L'illustration est
 * décorative : le lecteur d'écran ne la lit pas.
 */
export function StateMessage({
  illustration,
  title,
  text,
  action,
  alert = false,
  testID,
}: {
  readonly illustration: Illustration;
  readonly title: string;
  readonly text: string;
  readonly action: ReactNode;
  readonly alert?: boolean;
  readonly testID?: string;
}) {
  return (
    <View style={styles.state} testID={testID}>
      <Image
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        source={illustrations[illustration].source}
        testID={`illustration-${illustration}`}
        style={{
          width: illustrations[illustration].width,
          height: illustrations[illustration].height,
        }}
      />
      <View
        accessible
        accessibilityRole={alert ? 'alert' : 'header'}
        accessibilityLiveRegion={alert ? 'assertive' : 'none'}
        accessibilityLabel={`${title} ${text}`}
        style={styles.texts}
      >
        <Text style={[typography.stateTitle, styles.title]}>{title}</Text>
        <Text style={[typography.body, styles.text]}>{text}</Text>
      </View>
      {action}
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  state: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 120,
    gap: 10,
  },
  texts: { alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  title: { color: colors.text, textAlign: 'center' },
  text: { color: colors.muted, textAlign: 'center' },
});
// Stryker restore all
