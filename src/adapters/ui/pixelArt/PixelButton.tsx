import { useState } from 'react';
import { Pressable, type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { artPalette } from './artPalette';
import { ART_PIXEL } from './artPixel';
import { PixelIcon } from './PixelIcon';
import { pixelTypography } from './pixelTypography';
import type { IconName } from './sprites/icons';

const { roles } = artPalette;

/** Le bouton principal (or) ou secondaire (surface). La variante `danger` viendra avec #73. */
export type ButtonVariant = 'primary' | 'secondary';

/** La hauteur minimale d'un bouton, et de tout ce qui se touche : 48 dp. */
export const MIN_TARGET_SIZE = 48;

// Stryker disable all: valeurs purement visuelles, vérifiées par la conformité aux maquettes (barrière 10 bis).
const LOOKS = {
  primary: {
    background: roles.gold,
    line: roles.ink,
    light: roles.light,
    shade: roles.goldDark,
    text: roles.ink,
  },
  secondary: {
    background: roles.surface,
    line: roles.line,
    light: roles.raised,
    shade: roles.ink,
    text: roles.light,
  },
} as const;
// Stryker restore all

/**
 * Un bouton de l'identité pixel art (`PixelButton`) : cadre cranté, 48 dp de haut au moins, libellé
 * en police de texte, `icon` devant le libellé. Enfoncé, il descend de 2 dp. Désactivé, il est
 * hachuré et annoncé désactivé.
 */
export function PixelButton({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  accessibilityHint,
  style,
  testID,
}: {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: ButtonVariant;
  readonly icon?: IconName;
  readonly disabled?: boolean;
  readonly accessibilityHint?: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}) {
  const [pressed, setPressed] = useState(false);
  const look = LOOKS[variant];
  const textColor = disabled ? roles.muted : look.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      {...(accessibilityHint !== undefined && { accessibilityHint })}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      testID={testID}
      style={[
        styles.button,
        disabled ? styles.disabled : { backgroundColor: look.background, borderColor: look.line },
        { transform: [{ translateY: pressed && !disabled ? ART_PIXEL : 0 }] },
        style,
      ]}
    >
      {disabled ? (
        <View pointerEvents="none" testID="pixel-button-hatching" style={styles.hatching}>
          {Array.from({ length: 24 }, (_, index) => (
            <View key={index} style={styles.hatch} />
          ))}
        </View>
      ) : (
        <>
          <View style={[styles.light, { backgroundColor: pressed ? look.shade : look.light }]} />
          <View style={[styles.shade, { backgroundColor: look.shade }]} />
        </>
      )}
      {icon !== undefined && <PixelIcon name={icon} color={textColor} testID="pixel-button-icon" />}
      <Text style={[pixelTypography.button, { color: textColor }]}>{label}</Text>
      {(['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] as const).map((corner) => (
        <View key={corner} pointerEvents="none" style={[styles.corner, styles[corner]]} />
      ))}
    </Pressable>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  button: {
    minHeight: MIN_TARGET_SIZE,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: ART_PIXEL,
    overflow: 'hidden',
  },
  disabled: { backgroundColor: roles.surface, borderColor: roles.raised },
  light: { position: 'absolute', top: 0, left: 0, right: 0, height: ART_PIXEL },
  shade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2 * ART_PIXEL },
  hatching: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    gap: 4,
    transform: [{ skewX: '-45deg' }],
  },
  hatch: { width: ART_PIXEL, height: '100%', backgroundColor: 'rgba(62,72,112,0.35)' },
  corner: {
    position: 'absolute',
    width: ART_PIXEL,
    height: ART_PIXEL,
    backgroundColor: roles.night,
  },
  topLeft: { top: -ART_PIXEL, left: -ART_PIXEL },
  topRight: { top: -ART_PIXEL, right: -ART_PIXEL },
  bottomLeft: { bottom: -ART_PIXEL, left: -ART_PIXEL },
  bottomRight: { bottom: -ART_PIXEL, right: -ART_PIXEL },
});
// Stryker restore all
