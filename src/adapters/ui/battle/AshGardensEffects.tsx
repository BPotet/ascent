import { useEffect, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { PixelIcon } from '../pixelArt/PixelIcon';
import { battleColors } from '../theme/battleColors';

/** Un point de la scène, en dp. */
interface Point {
  readonly x: number;
  readonly y: number;
}

/** Le vol des flammes et du losange : 500 ms (maquette 246, J2, J7). */
const FLIGHT_MS = 500;
/** La hauteur de l'arc du losange au-dessus de la ligne droite (maquette 246, J2). */
const ARC_DP = 36;
/** Les 2 flammes de l'Éclatement partent l'une après l'autre, à 60 ms d'écart. */
const FLAME_STAGGER_MS = 60;
/** Le reste visible après le vol : posées sur le héros, elles s'effacent. */
const LINGER_MS = 300;

/**
 * Une chose qui vole de `from` à `to` en arc, après `delayMs` ms, puis s'efface ; en mouvement
 * réduit, elle paraît directement à son arrivée (`landed`) ou ne bouge pas (`still`).
 */
function Flight({
  from,
  to,
  delayMs,
  arc,
  reduced,
  testID,
  children,
}: {
  readonly from: Point;
  readonly to: Point;
  readonly delayMs: number;
  readonly arc: number;
  readonly reduced: 'landed' | 'still' | null;
  readonly testID: string;
  readonly children: ReactNode;
}) {
  const progress = useSharedValue(reduced === null ? 0 : reduced === 'landed' ? 1 : 0);
  const shown = useSharedValue(0);
  useEffect(() => {
    if (reduced === null) {
      progress.set(withDelay(delayMs, withTiming(1, { duration: FLIGHT_MS })));
    }
    shown.set(
      withDelay(
        delayMs,
        withSequence(
          withTiming(1, { duration: 0 }),
          withDelay(FLIGHT_MS + LINGER_MS, withTiming(0, { duration: 200 })),
        ),
      ),
    );
  }, [delayMs, progress, reduced, shown]);
  // Dépendances explicites : le code instrumenté par Stryker n'est plus reconnu comme worklet.
  const style = useAnimatedStyle(() => {
    'worklet';
    const t = progress.get();
    return {
      opacity: shown.get(),
      transform: [
        { translateX: from.x + (to.x - from.x) * t },
        { translateY: from.y + (to.y - from.y) * t - arc * Math.sin(Math.PI * t) },
      ],
    };
  }, [progress, shown, from, to, arc]);
  return (
    <Animated.View pointerEvents="none" testID={testID} style={[styles.flight, style]}>
      {children}
    </Animated.View>
  );
}

/**
 * L'Éclatement de la Cosse de braise (#267, maquette 246, J7, J10) : 2 flammes volent de la Cosse
 * jusqu'au héros et s'y posent, après le chiffre de dégâts. En mouvement réduit, elles sont posées
 * directement sur le héros. Jamais la couleur seule : l'étiquette « Brûlure ×N », cerclée, le dit.
 */
export function EmberFlames({
  from,
  to,
  delayMs,
  reducedMotion,
}: {
  readonly from: Point;
  readonly to: Point;
  readonly delayMs: number;
  readonly reducedMotion: boolean;
}) {
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="battle-ember-flames"
      style={StyleSheet.absoluteFill}
    >
      {[0, 1].map((flame) => (
        <Flight
          key={flame}
          from={from}
          to={{ x: to.x + flame * 14, y: to.y + flame * 6 }}
          delayMs={delayMs + flame * FLAME_STAGGER_MS}
          arc={ARC_DP / 2}
          reduced={reducedMotion ? 'landed' : null}
          testID="battle-ember-flame"
        >
          <PixelIcon name="ember8" color={battleColors.burnRing} />
        </Flight>
      ))}
    </View>
  );
}

/**
 * Le Vol d'Élan de la Phalène voleuse (#267, maquette 246, J2) : 300 ms après l'impact, un losange
 * d'or quitte la barre d'Élan et file en arc vers la Phalène (500 ms), avec « −1 Élan » en or à côté
 * du chiffre de dégâts. En mouvement réduit, le losange de la barre se vide d'un coup et « −1 Élan »
 * paraît, sans trajet. Le lecteur d'écran le dit par l'annonce du vol.
 */
export function StolenMomentum({
  from,
  to,
  stolen,
  delayMs,
  reducedMotion,
}: {
  readonly from: Point;
  readonly to: Point;
  readonly stolen: number;
  readonly delayMs: number;
  readonly reducedMotion: boolean;
}) {
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="battle-stolen-momentum"
      style={StyleSheet.absoluteFill}
    >
      {reducedMotion ? null : (
        <Flight
          from={from}
          to={to}
          delayMs={delayMs}
          arc={ARC_DP}
          reduced={null}
          testID="battle-stolen-diamond"
        >
          <PixelIcon name="diamond8" color={battleColors.steal} />
        </Flight>
      )}
      <Flight
        from={{ x: from.x, y: from.y - 28 }}
        to={{ x: from.x, y: from.y - 28 }}
        delayMs={delayMs}
        arc={0}
        reduced="still"
        testID="battle-stolen-word"
      >
        <View style={styles.word}>
          <PixelIcon name="diamond8" color={battleColors.steal} />
          <Text style={styles.wordText}>{`−${stolen} Élan`}</Text>
        </View>
      </Flight>
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  flight: { position: 'absolute', left: 0, top: 0, zIndex: 8 },
  word: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  wordText: {
    color: battleColors.steal,
    fontSize: 16,
    fontWeight: '800',
    textShadowColor: '#06070C',
    textShadowRadius: 2,
    textShadowOffset: { width: 0, height: 0 },
  },
});
// Stryker restore all
