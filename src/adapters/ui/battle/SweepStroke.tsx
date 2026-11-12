import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { SWEEP_LABEL } from '../format/battleText';
import { PixelRows } from '../pixelArt/PixelIcon';
import { ICONS } from '../pixelArt/sprites/icons';
import { battleColors } from '../theme/battleColors';

/** Le losange pulse : 250 ms à chaque largeur (maquette 246, `.sweepm`, 0,5 s en deux temps). */
const PULSE_MS = 250;
/** Le losange s'élargit de 18 % (maquette 246, `@keyframes sweepp`). */
const PULSE_SCALE = 1.18;
/** Les chevrons au sol, de l'ennemi vers le héros (maquette 246, `.trail`, 7 chevrons). */
export const SWEEP_CHEVRONS = 7;
/** Les chevrons s'allument un à un vers le héros, puis repartent (maquette 246, A2). */
const RUN_MS = 700;

// Stryker disable all: dessin du trait de balayage, vérifié par la conformité aux maquettes.
/**
 * Le losange étiré à l'horizontale (maquette 246, `.sweepm`, 52 × 22 dp), en pixels d'art : un
 * hexagone cyan, les deux flèches rasantes du Balayage à l'encre en son centre.
 */
const STROKE_ROWS: readonly string[] = Array.from({ length: 11 }, (_, y) => {
  const inset = Math.round((5.72 * Math.abs(y - 5)) / 5);
  const glyph = ICONS.sweep8[y - 2] ?? '';
  return Array.from({ length: 26 }, (_, x) => {
    if (x < inset || x > 25 - inset) return '.';
    return glyph.charAt(x - 9) === 'X' ? 'k' : 'X';
  }).join('');
});

/** Un chevron au sol, pointé vers le héros (maquette 246, `.trail i`, 12 × 14 dp). */
const CHEVRON_ROWS: readonly string[] = [
  '...XXX',
  '..XXX.',
  '.XXX..',
  'XXX...',
  '.XXX..',
  '..XXX.',
  '...XXX',
];
// Stryker restore all

/**
 * Le trait de balayage (`SweepStroke`, #266, maquette 246, A2, A3) : pendant toute la préparation
 * d'un Balayage, un losange étiré à l'horizontale, cyan, pulse au-dessus de l'ennemi, à la place
 * du sceau d'un coup imparable. Il reste, fixe, en mouvement réduit. Jamais la couleur seule : sa
 * forme est horizontale, et le lecteur d'écran lit son libellé.
 */
export function SweepStroke({ reducedMotion = false }: { readonly reducedMotion?: boolean }) {
  const wide = useSharedValue(0);
  useEffect(() => {
    if (reducedMotion) {
      wide.set(0);
      return;
    }
    wide.set(
      withRepeat(
        withSequence(
          withTiming(0, { duration: PULSE_MS }),
          withTiming(1, { duration: 0 }),
          withTiming(1, { duration: PULSE_MS }),
          withTiming(0, { duration: 0 }),
        ),
        -1,
      ),
    );
  }, [reducedMotion, wide]);
  // Dépendances explicites : le code instrumenté par Stryker n'est plus reconnu comme worklet.
  const pulse = useAnimatedStyle(() => {
    'worklet';
    return { transform: [{ scaleX: 1 + (PULSE_SCALE - 1) * wide.get() }] };
  }, [wide]);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={SWEEP_LABEL}
      testID="sweep-stroke"
      pointerEvents="none"
      style={styles.stroke}
    >
      <Animated.View style={pulse}>
        <PixelRows rows={STROKE_ROWS} color={battleColors.sweep} />
      </Animated.View>
    </View>
  );
}

/** Un chevron du trait au sol : il s'allume quand la course l'atteint, toujours en mouvement réduit. */
function Chevron({
  index,
  run,
  reducedMotion,
}: {
  readonly index: number;
  readonly run: SharedValue<number>;
  readonly reducedMotion: boolean;
}) {
  // Le chevron le plus à droite (près de l'ennemi) s'allume le premier.
  const turn = SWEEP_CHEVRONS - 1 - index;
  const lit = useAnimatedStyle(() => {
    'worklet';
    return { opacity: reducedMotion || run.get() >= turn ? 1 : 0.25 };
  }, [run, turn, reducedMotion]);
  return (
    <Animated.View testID={`sweep-chevron-${index}`} style={lit}>
      <PixelRows rows={CHEVRON_ROWS} color={battleColors.sweep} />
    </Animated.View>
  );
}

/**
 * Les chevrons du trait de balayage (#266, maquette 246, A2, `.trail`) : au sol, de l'ennemi qui
 * balaie vers les pieds du héros, de `from` à `to` (dp), à la hauteur `y` ; ils filent vers le
 * héros jusqu'à l'impact. En mouvement réduit, ils restent fixes, tous affichés.
 */
export function SweepTrail({
  from,
  to,
  y,
  reducedMotion = false,
}: {
  readonly from: number;
  readonly to: number;
  readonly y: number;
  readonly reducedMotion?: boolean;
}) {
  const run = useSharedValue(SWEEP_CHEVRONS);
  useEffect(() => {
    if (reducedMotion) {
      run.set(SWEEP_CHEVRONS);
      return;
    }
    run.set(
      withRepeat(
        withSequence(
          withTiming(0, { duration: 0 }),
          withTiming(SWEEP_CHEVRONS, { duration: RUN_MS }),
        ),
        -1,
      ),
    );
  }, [reducedMotion, run]);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      testID="sweep-trail"
      style={[styles.trail, { left: from, width: Math.max(0, to - from), top: y - 7 }]}
    >
      {Array.from({ length: SWEEP_CHEVRONS }, (_, index) => (
        <Chevron key={index} index={index} run={run} reducedMotion={reducedMotion} />
      ))}
    </View>
  );
}

// Stryker disable all: place du trait, vérifiée par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  stroke: {
    position: 'absolute',
    top: -16,
    alignSelf: 'center',
    width: 52,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 6,
  },
  trail: {
    position: 'absolute',
    height: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    zIndex: 4,
  },
});
// Stryker restore all
