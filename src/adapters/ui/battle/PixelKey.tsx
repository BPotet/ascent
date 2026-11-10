import { type ReactNode, type Ref, useMemo } from 'react';
import { type StyleProp, StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';
import {
  type ComposedGesture,
  Gesture,
  GestureDetector,
  type GestureType,
} from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { artPalette } from '../pixelArt/artPalette';
import { artPixelSize, notchedCorners } from '../pixelArt/artPixel';
import { battleColors } from '../theme/battleColors';

const { roles } = artPalette;
/** Le trait des touches : un pixel d'art. */
const LINE = artPixelSize(2);
/** Un doigt maintenu reste appuyé (même durée que le geste de datation, `touchGestures`). */
const LOOK_MAX_MS = 60_000;

// Stryker disable all: valeurs purement visuelles, vérifiées par la conformité aux maquettes (barrière 10 bis).
/**
 * Les habillages d'une touche de combat (maquette #118, C1 à C7) : or (Attaquer, Parade), surface
 * (Pouvoirs, Esquive), grisé (déséquilibre), indisponible (hachuré), actif (trait d'or) et Frapper.
 */
export const KEY_LOOKS = {
  gold: {
    background: roles.gold,
    line: roles.ink,
    light: roles.light,
    shade: roles.goldDark,
    text: battleColors.onLight,
    note: battleColors.onLight,
  },
  surface: {
    background: roles.surface,
    line: roles.line,
    light: roles.raised,
    shade: roles.ink,
    text: battleColors.text,
    note: roles.parchment,
  },
  grey: {
    background: roles.surface,
    line: roles.line,
    light: roles.raised,
    shade: roles.ink,
    text: roles.muted,
    note: roles.muted,
  },
  unavailable: {
    background: roles.surface,
    line: roles.raised,
    light: roles.surface,
    shade: roles.surface,
    text: roles.muted,
    note: roles.muted,
  },
  kindled: {
    background: roles.surface,
    line: roles.ember,
    light: roles.raised,
    shade: roles.ink,
    text: battleColors.text,
    note: roles.light,
  },
  active: {
    background: roles.surface,
    line: roles.gold,
    light: roles.raised,
    shade: roles.ink,
    text: battleColors.text,
    note: roles.gold,
  },
  strike: {
    background: roles.goldBg,
    line: roles.goldDark,
    light: roles.goldBg,
    shade: roles.ink,
    text: roles.gold,
    note: roles.gold,
  },
} as const;

/** Les hachures d'une touche indisponible : celles du bouton pixel inactif (`PixelButton`, `hatch`). */
export const UNAVAILABLE_HATCH = 'rgba(62,72,112,0.35)';
// Stryker restore all

export type KeyLook = (typeof KEY_LOOKS)[keyof typeof KEY_LOOKS];

/** Des rayures décoratives : l'état est aussi écrit (« Déséquilibré », « Il manque 1 Élan »). */
export function Hatching({ testID, color }: { readonly testID: string; readonly color: string }) {
  return (
    <View pointerEvents="none" testID={testID} style={styles.hatching}>
      {Array.from({ length: 24 }, (_, stripe) => (
        <View
          key={stripe}
          style={[styles.stripe, { left: -120 + stripe * 18, backgroundColor: color }]}
        />
      ))}
    </View>
  );
}

/**
 * L'habillage du bouton pixel d'une touche de combat (`PixelButton`, à 112 dp) : cadre cranté, arête
 * haute éclairée, bas dans l'ombre. Le geste de la touche (`gesture`) est inchangé ; un geste de
 * look lui est composé en simultané : il n'écrit que `pressed`, sur le fil UI, pour que la touche
 * descende de 2 dp et que son arête s'inverse dès que le doigt se pose. Le décalage est fixe, sans
 * animation : le mouvement réduit est respecté.
 */
export function PixelKey({
  name,
  look,
  pressable,
  gesture,
  under = battleColors.background,
  style,
  children,
  ...props
}: Omit<ViewProps, 'style'> & {
  readonly ref?: Ref<View>;
  readonly name: string;
  readonly look: KeyLook;
  /** Faux pour une touche inactive : elle ne s'enfonce pas. */
  readonly pressable: boolean;
  readonly gesture: GestureType | ComposedGesture;
  /** La couleur des coins coupés : le fond derrière la touche (par défaut, celui du combat). */
  readonly under?: string;
  readonly style: StyleProp<ViewStyle>;
  readonly children: ReactNode;
}) {
  const pressed = useSharedValue(0);
  const both = useMemo(
    () =>
      Gesture.Simultaneous(
        gesture,
        Gesture.Tap()
          .withTestId(`battle-${name}-look`)
          .maxDuration(LOOK_MAX_MS)
          .shouldCancelWhenOutside(false)
          .onBegin(() => {
            'worklet';
            pressed.set(1);
          })
          .onFinalize(() => {
            'worklet';
            pressed.set(0);
          }),
      ),
    [gesture, name, pressed],
  );
  const { light, shade } = look;
  // Le geste de look reste le même quand la touche devient inactive : seul son effet s'éteint.
  // Dépendances explicites : le code instrumenté par Stryker n'est plus reconnu comme worklet.
  const down = useAnimatedStyle(() => {
    'worklet';
    return { transform: [{ translateY: pressable ? pressed.get() * LINE : 0 }] };
  }, [pressed, pressable]);
  const edge = useAnimatedStyle(() => {
    'worklet';
    return { backgroundColor: pressable && pressed.get() === 1 ? shade : light };
  }, [pressed, pressable, light, shade]);
  return (
    <GestureDetector gesture={both}>
      <Animated.View
        {...props}
        style={[
          styles.key,
          { borderWidth: LINE, backgroundColor: look.background, borderColor: look.line },
          style,
          down,
        ]}
      >
        <Animated.View
          pointerEvents="none"
          testID={`battle-${name}-edge`}
          style={[styles.strip, { top: 0, height: LINE }, edge]}
        />
        <View
          pointerEvents="none"
          style={[styles.strip, { bottom: 0, height: 3 * LINE, backgroundColor: shade }]}
        />
        {children}
        {notchedCorners(LINE).map((corner, index) => (
          <View
            key={index}
            pointerEvents="none"
            testID="pixel-key-corner"
            style={[styles.corner, corner, { backgroundColor: under }]}
          />
        ))}
      </Animated.View>
    </GestureDetector>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  key: {
    minHeight: 112,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
    overflow: 'hidden',
  },
  strip: { position: 'absolute', left: 0, right: 0 },
  // Les coins coupés, de la couleur du fond derrière la touche (`under`).
  corner: { position: 'absolute' },
  hatching: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  stripe: {
    position: 'absolute',
    top: -60,
    width: 8,
    height: 260,
    transform: [{ rotate: '45deg' }],
  },
});
// Stryker restore all
