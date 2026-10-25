import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { artPalette } from './artPalette';
import { artPixelSize, notchedCorners } from './artPixel';

const { roles } = artPalette;

/** Le fond d'un cadre : la surface, relevé (dialogues) ou creux (champs). */
export type FrameVariant = 'surface' | 'raised' | 'inset';

/** Le ton du trait d'un cadre. */
export type FrameTone = 'default' | 'gold' | 'goldDark' | 'done' | 'hint' | 'error';

// Stryker disable all: valeurs purement visuelles, vérifiées par la conformité aux maquettes (barrière 10 bis).
const BACKGROUNDS: Readonly<Record<FrameVariant, string>> = {
  surface: roles.surface,
  raised: roles.raised,
  inset: roles.night,
};
const LIGHTS: Readonly<Record<FrameVariant, string>> = {
  surface: roles.raised,
  raised: roles.line,
  inset: roles.ink,
};
const TONES: Readonly<Record<FrameTone, string>> = {
  default: roles.line,
  gold: roles.gold,
  goldDark: roles.goldDark,
  done: roles.doneLine,
  hint: roles.blue,
  error: roles.curse,
};
// Stryker restore all

/**
 * Le cadre cranté (`PixelFrame`) : trait d'un pixel d'art (2 dp, arrondis au pixel physique), coins coupés d'un pixel d'art (4 carrés de la
 * couleur du fond dessous, `under`), arête haute éclairée et bas dans l'ombre. `variant` choisit le
 * fond, `tone` le trait ; `background` remplace le fond (messages teintés). Les autres propriétés
 * vont à la `View` du cadre (accessibilité, `testID`, style).
 */
export function PixelFrame({
  variant = 'surface',
  tone = 'default',
  under = roles.night,
  background,
  style,
  children,
  ...props
}: ViewProps & {
  readonly variant?: FrameVariant;
  readonly tone?: FrameTone;
  readonly under?: string;
  readonly background?: string;
  readonly children?: ReactNode;
}) {
  const line = artPixelSize(2);
  return (
    <View
      {...props}
      style={[
        { borderWidth: line },
        { borderColor: TONES[tone], backgroundColor: background ?? BACKGROUNDS[variant] },
        style,
      ]}
    >
      <View
        pointerEvents="none"
        testID="pixel-frame-light"
        style={[styles.strip, { top: 0, height: line, backgroundColor: LIGHTS[variant] }]}
      />
      {variant !== 'inset' && (
        <View
          pointerEvents="none"
          testID="pixel-frame-shade"
          style={[styles.strip, { bottom: 0, height: line, backgroundColor: roles.ink }]}
        />
      )}
      {children}
      {notchedCorners(line).map((corner, index) => (
        <View
          key={index}
          pointerEvents="none"
          testID="pixel-frame-corner"
          style={[styles.corner, corner, { backgroundColor: under }]}
        />
      ))}
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  strip: { position: 'absolute', left: 0, right: 0 },
  corner: { position: 'absolute' },
});
// Stryker restore all
