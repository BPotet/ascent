import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { SEAL_LABEL } from '../format/battleText';
import { SpriteCanvas } from '../pixelArt/SpriteCanvas';
import { sealSprite } from '../pixelArt/sprites/battle/battleEffects';
import { toPixelImage } from '../pixelArt/sprites/Sprite';

/** Le sceau pulse : 225 ms à chaque taille (maquette, `.pbig`, 0,45 s en deux temps). */
const PULSE_MS = 225;

const drawSmall = () => toPixelImage(sealSprite(8));
const drawBig = () => toPixelImage(sealSprite(10));

/**
 * Le sceau rouge d'un coup imparable, en grand au-dessus de l'ennemi pendant toute sa préparation,
 * et seulement là (C2.9) : un losange rouge en pixel art avec un point d'exclamation, qui pulse
 * entre ses deux tailles (fixe avec « réduire les animations »). Jamais la couleur seule : le
 * lecteur d'écran lit son libellé.
 */
export function PerilSeal({ reducedMotion = false }: { readonly reducedMotion?: boolean }) {
  const small = useSharedValue(1);
  useEffect(() => {
    if (reducedMotion) {
      small.set(1);
      return;
    }
    small.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: 0 }),
          withDelay(PULSE_MS, withTiming(0, { duration: 0 })),
          withDelay(PULSE_MS, withTiming(1, { duration: 0 })),
        ),
        -1,
      ),
    );
  }, [reducedMotion, small]);
  // Dépendances explicites : le code instrumenté par Stryker n'est plus reconnu comme worklet.
  const smallStyle = useAnimatedStyle(() => {
    'worklet';
    return { opacity: small.get() };
  }, [small]);
  const bigStyle = useAnimatedStyle(() => {
    'worklet';
    return { opacity: 1 - small.get() };
  }, [small]);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={SEAL_LABEL}
      testID="peril-seal"
      pointerEvents="none"
      style={styles.seal}
    >
      <Animated.View style={[styles.layer, smallStyle]}>
        <SpriteCanvas sprite="seal-8" draw={drawSmall} scale={2} testID="peril-seal-small" />
      </Animated.View>
      <Animated.View style={[styles.layer, bigStyle]}>
        <SpriteCanvas sprite="seal-10" draw={drawBig} scale={2} testID="peril-seal-big" />
      </Animated.View>
    </View>
  );
}

// Stryker disable all: place du sceau, vérifiée par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  seal: {
    position: 'absolute',
    top: -8,
    alignSelf: 'center',
    width: 46,
    height: 46,
    zIndex: 5,
  },
  layer: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});
// Stryker restore all
