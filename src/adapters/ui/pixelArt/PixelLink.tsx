import { Pressable, StyleSheet, Text } from 'react-native';

import { artPalette } from './artPalette';
import { MIN_TARGET_SIZE } from './PixelButton';
import { pixelTypography } from './pixelTypography';

/** Une action discrète de l'identité pixel art : « Corriger », en or souligné, 48 dp de haut. */
export function PixelLink({
  label,
  onPress,
  testID,
}: {
  readonly label: string;
  readonly onPress: () => void;
  readonly testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      testID={testID}
      style={styles.link}
    >
      <Text style={[pixelTypography.link, styles.label]}>{label}</Text>
    </Pressable>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  link: { minHeight: MIN_TARGET_SIZE, justifyContent: 'center', paddingHorizontal: 6 },
  label: {
    color: artPalette.roles.gold,
    textDecorationLine: 'underline',
    textDecorationColor: artPalette.roles.gold,
  },
});
// Stryker restore all
