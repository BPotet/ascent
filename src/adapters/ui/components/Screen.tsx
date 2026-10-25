import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';

/**
 * Fond et marges communs à tous les écrans. `centered` centre un contenu court (démarrage) ;
 * `top` laisse le contenu occuper l'écran depuis le haut (vues). `background` remplace la couleur
 * du fond (la nuit de l'identité pixel art, #72) ; par défaut, celle de l'ancien thème.
 */
export function Screen({
  children,
  testID,
  layout = 'centered',
  background,
}: {
  readonly children: ReactNode;
  readonly testID?: string;
  readonly layout?: 'centered' | 'top';
  readonly background?: string;
}) {
  return (
    <SafeAreaView
      style={[
        layout === 'centered' ? styles.screen : styles.top,
        background !== undefined && { backgroundColor: background },
      ]}
      testID={testID}
    >
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
