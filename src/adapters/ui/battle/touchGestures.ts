import { useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { touchProbeBegin } from '../state/useTouchProbe';

/** Un toucher maintenu reste un seul appui ; au-delà, le geste échoue sans rien dater de plus. */
const LONG_TOUCH_MS = 60_000;
/** Le doigt maintenu peut bouger un peu sans fermer l'effet (#235). */
const LONG_TOUCH_DISTANCE = 48;

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

/** Le toucher maintenu d'une touche de pouvoir (#235, K10) : sa durée, puis l'ouverture et la fin. */
export interface HoldOptions {
  readonly ms: number;
  readonly onHold: () => void;
  readonly onHoldEnd: () => void;
}

/**
 * Le geste d'une action de la phase du héros (« Attaquer », viser un ennemi, un pouvoir) : elle se
 * valide au relâcher, si le doigt est encore sur le bouton, avec l'instant du début du toucher.
 * Glisser hors du bouton annule. Avec `hold` (#235) : maintenu `hold.ms`, le doigt ouvre l'effet
 * (`onHold`) et le relâcher ne lance plus rien, même sur le bouton ; `onHoldEnd` le referme.
 */
export function useReleaseGesture(
  testId: string,
  uiNow: () => number,
  onRelease: (touchStartedAt: number, releasedAt: number) => void,
  hold?: HoldOptions,
) {
  const startedAt = useSharedValue(0);
  const held = useSharedValue(false);
  const holdMs = hold?.ms;
  const onHold = hold?.onHold;
  const onHoldEnd = hold?.onHoldEnd;
  return useMemo(() => {
    const tap = Gesture.Tap()
      .withTestId(testId)
      .maxDuration(LONG_TOUCH_MS)
      .shouldCancelWhenOutside(true)
      .onBegin(() => {
        'worklet';
        startedAt.set(uiNow());
      })
      .onEnd((_event, success) => {
        'worklet';
        if (success && !held.get()) scheduleOnRN(onRelease, startedAt.get(), uiNow());
      })
      .onFinalize(() => {
        'worklet';
        // Le toucher suivant repart sans maintien.
        held.set(false);
      });
    if (holdMs === undefined || onHold === undefined || onHoldEnd === undefined) return tap;
    const press = Gesture.LongPress()
      .withTestId(`${testId}-hold`)
      .minDuration(holdMs)
      .maxDistance(LONG_TOUCH_DISTANCE)
      .onStart(() => {
        'worklet';
        held.set(true);
        scheduleOnRN(onHold);
      })
      .onFinalize(() => {
        'worklet';
        // Le doigt levé ou le maintien annulé : la bulle se ferme toujours.
        scheduleOnRN(onHoldEnd);
      });
    return Gesture.Simultaneous(tap, press);
  }, [testId, uiNow, onRelease, startedAt, held, holdMs, onHold, onHoldEnd]);
}
