import { type Ref, useState } from 'react';
import { Pressable, type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { artPalette } from './artPalette';
import { artPixelSize, notchedCorners } from './artPixel';
import { PixelIcon } from './PixelIcon';
import { pixelTypography } from './pixelTypography';
import type { IconName } from './sprites/icons';

const { roles } = artPalette;

/**
 * Le bouton principal (or), secondaire (surface), ou `danger` (rouge d'erreur), qui confirme une
 * action définitive : son libellé est toujours écrit, le rouge ne porte jamais le sens seul.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'danger';

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
  danger: {
    background: roles.errorBg,
    line: roles.curse,
    light: roles.errorBg,
    shade: roles.ink,
    text: roles.pink,
  },
} as const;
// Stryker restore all

/**
 * Un bouton de l'identité pixel art (`PixelButton`) : cadre cranté, 48 dp de haut au moins, libellé
 * en police de texte, `icon` devant le libellé. Enfoncé, il descend de 2 dp. Désactivé, il est
 * hachuré et annoncé désactivé. `text` remplace le libellé affiché, sans changer le libellé lu.
 * `ref` permet à un écran d'y placer le lecteur d'écran (action par défaut d'une fenêtre).
 */
export function PixelButton({
  label,
  text = label,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  accessibilityHint,
  style,
  testID,
  ref,
}: {
  readonly label: string;
  readonly text?: string;
  readonly onPress: () => void;
  readonly variant?: ButtonVariant;
  readonly icon?: IconName;
  readonly disabled?: boolean;
  readonly accessibilityHint?: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
  readonly ref?: Ref<View>;
}) {
  const [pressed, setPressed] = useState(false);
  const look = LOOKS[variant];
  const textColor = disabled ? roles.muted : look.text;
  const line = artPixelSize(2);
  return (
    <Pressable
      ref={ref}
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
        { borderWidth: line },
        disabled ? styles.disabled : { backgroundColor: look.background, borderColor: look.line },
        { transform: [{ translateY: pressed && !disabled ? line : 0 }] },
        style,
      ]}
    >
      {disabled ? (
        <View pointerEvents="none" testID="pixel-button-hatching" style={styles.hatching}>
          {Array.from({ length: 24 }, (_, index) => (
            <View key={index} style={[styles.hatch, { width: line }]} />
          ))}
        </View>
      ) : (
        <>
          <View
            style={[
              styles.strip,
              { top: 0, height: line, backgroundColor: pressed ? look.shade : look.light },
            ]}
          />
          <View
            style={[styles.strip, { bottom: 0, height: 2 * line, backgroundColor: look.shade }]}
          />
        </>
      )}
      {icon !== undefined && <PixelIcon name={icon} color={textColor} testID="pixel-button-icon" />}
      <Text style={[pixelTypography.button, { color: textColor }]}>{text}</Text>
      {notchedCorners(line).map((corner, index) => (
        <View key={index} pointerEvents="none" style={[styles.corner, corner]} />
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
    overflow: 'hidden',
  },
  disabled: { backgroundColor: roles.surface, borderColor: roles.raised },
  strip: { position: 'absolute', left: 0, right: 0 },
  hatching: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    gap: 4,
    transform: [{ skewX: '-45deg' }],
  },
  hatch: { height: '100%', backgroundColor: 'rgba(62,72,112,0.35)' },
  corner: { position: 'absolute', backgroundColor: roles.night },
});
// Stryker restore all
