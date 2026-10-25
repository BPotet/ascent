import { useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { touchProbeBegin } from '../state/useTouchProbe';

/** Un toucher maintenu reste un seul appui ; au-delà, le geste échoue sans rien dater de plus. */
const LONG_TOUCH_MS = 60_000;

/**
 * Le geste d'un bouton de défense : le toucher est daté dans le worklet `onBegin`, sur le fil
 * UI, dès que le doigt se pose (méthode de datation (a), ADR 0005), sans attendre le relâcher.
 * Un doigt maintenu ne produit aucun autre appui. `uiNow` doit être un worklet.
 */
export function useDefenseGesture(
  testId: string,
  uiNow: () => number,
  onTouch: (touchedAt: number) => void,
) {
  return useMemo(
    () =>
      Gesture.Tap()
        .withTestId(testId)
        .maxDuration(LONG_TOUCH_MS)
        .shouldCancelWhenOutside(false)
        .onBegin(touchProbeBegin(uiNow, onTouch)),
    [testId, uiNow, onTouch],
  );
}

/**
 * Le geste d'une action de la phase du héros (« Attaquer », viser un ennemi) : elle se valide au
 * relâcher, si le doigt est encore sur le bouton, avec l'instant du début du toucher. Glisser hors
 * du bouton annule.
 */
export function useReleaseGesture(
  testId: string,
  uiNow: () => number,
  onRelease: (touchStartedAt: number, releasedAt: number) => void,
) {
  const startedAt = useSharedValue(0);
  return useMemo(
    () =>
      Gesture.Tap()
        .withTestId(testId)
        .maxDuration(LONG_TOUCH_MS)
        .shouldCancelWhenOutside(true)
        .onBegin(() => {
          'worklet';
          startedAt.set(uiNow());
        })
        .onEnd((_event, success) => {
          'worklet';
          if (success) scheduleOnRN(onRelease, startedAt.get(), uiNow());
        }),
    [testId, uiNow, onRelease, startedAt],
  );
}
