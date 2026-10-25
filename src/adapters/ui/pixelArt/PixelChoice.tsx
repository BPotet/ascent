import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { artPalette } from './artPalette';
import { MIN_TARGET_SIZE } from './PixelButton';
import { PixelFrame } from './PixelFrame';
import { PixelIcon } from './PixelIcon';
import { textFont } from './pixelTypography';

const { roles } = artPalette;

/** La coche d'une option choisie : `check8`, 8 pixels d'art de 2 dp. */
export const TICK_SIZE = 16;
/** L'écart de la coche en coin au haut et au bord droit d'une option large. */
export const TICK_TOP = 4;

/**
 * Une option d'un choix unique (`PixelChoice`), de 48 dp au moins : un bouton radio, annoncé
 * choisi ou non. Choisie, elle a un cadre d'or, la coche en coin et un texte en gras, jamais la
 * couleur seule ; sinon un cadre simple et un texte demi-gras. `filled` la remplit d'or quand elle
 * est choisie (objectif hebdomadaire). La coche ne recouvre jamais le texte : sur une option
 * remplie, étroite (environ 37 dp sur un écran de 320 dp), elle a sa propre ligne au-dessus du
 * chiffre ; sur une option large (difficulté, 92 dp au moins), elle est en coin, à droite du
 * contenu centré. `picture` vient au-dessus du texte (les sommets d'une
 * difficulté), `detail` dessous (« +10 XP »). Elle sert à la difficulté et à l'objectif.
 */
export function PixelChoice({
  label,
  text,
  detail,
  picture,
  checked,
  filled = false,
  under = roles.surface,
  minHeight = MIN_TARGET_SIZE,
  onPress,
  testID,
}: {
  readonly label: string;
  readonly text: string;
  readonly detail?: string;
  readonly picture?: ReactNode;
  readonly checked: boolean;
  readonly filled?: boolean;
  /** La couleur sous l'option, qui coupe ses coins. */
  readonly under?: string;
  /** La hauteur de l'option, au moins : 48 dp par défaut. */
  readonly minHeight?: number;
  readonly onPress: () => void;
  readonly testID?: string;
}) {
  const gold = checked && filled;
  const textColor = gold ? roles.ink : roles.light;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked, selected: checked }}
      onPress={onPress}
      testID={testID}
      style={[styles.choice, { minHeight }]}
    >
      <PixelFrame
        tone={checked ? 'gold' : 'default'}
        under={under}
        {...(checked && { background: gold ? roles.gold : roles.goldBg })}
        testID={testID === undefined ? 'choice-frame' : `choice-frame-${testID}`}
        style={styles.frame}
      >
        {filled && (
          <View pointerEvents="none" testID="choice-tick-slot" style={styles.tickSlot}>
            {checked && <PixelIcon name="check8" color={roles.ink} testID="choice-tick" />}
          </View>
        )}
        {picture}
        <Text
          style={[
            filled ? styles.big : styles.text,
            { color: textColor, fontFamily: checked ? textFont.bold : textFont.semiBold },
          ]}
        >
          {text}
        </Text>
        {detail !== undefined && (
          <Text style={[styles.detail, { color: checked ? roles.gold : roles.parchment }]}>
            {detail}
          </Text>
        )}
        {checked && !filled && (
          <View pointerEvents="none" testID="choice-tick-corner" style={styles.tickCorner}>
            <PixelIcon name="check8" color={roles.gold} testID="choice-tick" />
          </View>
        )}
      </PixelFrame>
    </Pressable>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  choice: { flex: 1 },
  frame: {
    flexGrow: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  text: { fontSize: 13, lineHeight: 16, textAlign: 'center' },
  big: { fontSize: 18, lineHeight: 22, textAlign: 'center' },
  detail: { fontFamily: textFont.medium, fontSize: 12, lineHeight: 15, textAlign: 'center' },
  tickSlot: { height: TICK_SIZE, justifyContent: 'center' },
  tickCorner: { position: 'absolute', right: TICK_TOP, top: TICK_TOP },
});
// Stryker restore all
