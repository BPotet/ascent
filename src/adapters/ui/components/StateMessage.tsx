import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { spacing } from '../theme/metrics';
import { typography } from '../theme/typography';

/**
 * État plein écran d'une vue (vide, erreur) : un titre, une explication et une seule action.
 * `alert` fait annoncer l'état au lecteur d'écran (erreur).
 */
export function StateMessage({
  title,
  text,
  action,
  alert = false,
  testID,
}: {
  readonly title: string;
  readonly text: string;
  readonly action: ReactNode;
  readonly alert?: boolean;
  readonly testID?: string;
}) {
  return (
    <View style={styles.state} testID={testID}>
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
    gap: spacing.md,
  },
  texts: { alignItems: 'center', gap: spacing.md },
  title: { color: colors.text, textAlign: 'center' },
  text: { color: colors.muted, textAlign: 'center' },
});
// Stryker restore all
