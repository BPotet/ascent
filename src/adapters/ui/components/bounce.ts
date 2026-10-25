import { Animated } from 'react-native';

/** Durée du rebond de la coche quand on touche une habitude, comme dans la maquette. */
export const BOUNCE_DURATION_MS = 320;

/** Le rebond : la coche (ou la case) grossit puis revient, sur `BOUNCE_DURATION_MS` au total. */
export function bounce(scale: Animated.Value): void {
  const grow = Math.round(BOUNCE_DURATION_MS * 0.4);
  Animated.sequence([
    Animated.timing(scale, { toValue: 1.18, duration: grow, useNativeDriver: true }),
    Animated.timing(scale, {
      toValue: 1,
      duration: BOUNCE_DURATION_MS - grow,
      useNativeDriver: true,
    }),
  ]).start();
}
