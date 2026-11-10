import { type ReactNode, useEffect, useState } from 'react';
import { View } from 'react-native';

import { useReducedMotion } from '../state/useReducedMotion';

/** Un pas des animations du menu des pouvoirs (#270) : 90 ms, 4 pas pour 360 ms. */
export const STEP_MS = 90;
const FLIP_STEPS = 4;

/**
 * Le pas courant d'une animation de `count` pas de `stepMs`, qui part après `delayMs` : de 0 à
 * `count`. Tous les pas sont programmés d'un coup. Pour la rejouer, l'écran remonte le composant
 * (`key`).
 */
function useSteps(count: number, stepMs: number, delayMs = 0): number {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timers = Array.from({ length: count }, (_, index) =>
      setTimeout(() => setStep(index + 1), delayMs + (index + 1) * stepMs),
    );
    return () => timers.forEach(clearTimeout);
  }, [count, stepMs, delayMs]);
  return step;
}

/**
 * Une case qui se retourne (#270, T5 et M8) : en 4 pas de 90 ms, après `delayMs`, sans
 * interpolation ; en mouvement réduit, elle apparaît en fondu, avec les mêmes durées.
 */
export function FlipIn({
  delayMs = 0,
  testID,
  children,
}: {
  readonly delayMs?: number;
  readonly testID?: string;
  readonly children: ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  const step = useSteps(FLIP_STEPS, STEP_MS, delayMs);
  const done = step / FLIP_STEPS;
  return (
    <View
      testID={testID}
      style={reducedMotion ? { opacity: done } : { transform: [{ scaleX: 0.1 + 0.9 * done }] }}
    >
      {children}
    </View>
  );
}

/** La secousse d'un refus (M2) : deux fois 3 dp de chaque côté, en pas de 60 ms. */
const NUDGE = [-3, 0, 3, 0, -3, 0, 3, 0] as const;
const NUDGE_STEP_MS = 60;

/**
 * Le décalage courant d'une ligne refusée (`active`) ; aucun en mouvement réduit (la ligne ne bouge
 * pas), ni pour une autre ligne.
 */
export function useNudge(active: boolean): number {
  const reducedMotion = useReducedMotion();
  const step = useSteps(active ? NUDGE.length : 0, NUDGE_STEP_MS);
  return reducedMotion || !active ? 0 : (NUDGE[step] ?? 0);
}
