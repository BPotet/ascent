import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { Screen } from '../components/Screen';
import { colors } from '../theme/colors';

/** Pendant l'ouverture des données du téléphone. */
export function StartupLoadingScreen() {
  return (
    <Screen testID="startup-loading">
      <ActivityIndicator color={colors.accent} size="large" accessibilityLabel="Chargement" />
    </Screen>
  );
}

/** Quand les données du téléphone n'ont pas pu être ouvertes. Rien n'est effacé. */
export function StartupErrorScreen({ onRetry }: { readonly onRetry: () => void }) {
  return (
    <Screen testID="startup-error">
      <Text accessibilityRole="alert" style={styles.message}>
        Impossible d’ouvrir les données enregistrées sur le téléphone.
      </Text>
      <Pressable accessibilityRole="button" onPress={onRetry} style={styles.button}>
        <Text style={styles.buttonLabel}>Réessayer</Text>
      </Pressable>
    </Screen>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  message: { color: colors.text, fontSize: 16, textAlign: 'center' },
  button: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.accent,
  },
  buttonLabel: { color: colors.onAccent, fontSize: 16, fontWeight: '600' },
});
// Stryker restore all
