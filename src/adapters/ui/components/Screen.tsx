import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';

/**
 * Fond et marges communs à tous les écrans. `centered` centre un contenu court (démarrage) ;
 * `top` laisse le contenu occuper l'écran depuis le haut (vues).
 */
export function Screen({
  children,
  testID,
  layout = 'centered',
}: {
  readonly children: ReactNode;
  readonly testID?: string;
  readonly layout?: 'centered' | 'top';
}) {
  return (
    <SafeAreaView style={layout === 'centered' ? styles.screen : styles.top} testID={testID}>
      {children}
    </SafeAreaView>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  top: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
// Stryker restore all
