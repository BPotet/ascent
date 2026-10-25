import { Pressable, StyleSheet, Text } from 'react-native';

import { artPalette } from './artPalette';
import { MIN_TARGET_SIZE } from './PixelButton';
import { PixelIcon } from './PixelIcon';
import { pixelTypography } from './pixelTypography';
import type { IconName } from './sprites/icons';

/**
 * Une action discrète de l'identité pixel art : « Corriger », en or souligné, 48 dp de haut.
 * `color` la teinte autrement (« Supprimer l'habitude », en rouge d'erreur, son libellé toujours
 * écrit), `icon` vient devant le libellé, `accessibilityHint` est lu après lui.
 */
export function PixelLink({
  label,
  onPress,
  color = artPalette.roles.gold,
  icon,
  accessibilityHint,
  testID,
}: {
  readonly label: string;
  readonly onPress: () => void;
  readonly color?: string;
  readonly icon?: IconName;
  readonly accessibilityHint?: string;
  readonly testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      {...(accessibilityHint !== undefined && { accessibilityHint })}
      onPress={onPress}
      testID={testID}
      style={styles.link}
    >
      {icon !== undefined && <PixelIcon name={icon} color={color} testID={`${icon}-icon`} />}
      <Text style={[pixelTypography.link, styles.label, { color, textDecorationColor: color }]}>
        {label}
      </Text>
    </Pressable>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  link: {
    minHeight: MIN_TARGET_SIZE,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 6,
  },
  label: { textDecorationLine: 'underline' },
});
// Stryker restore all
