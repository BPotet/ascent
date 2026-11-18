// Réservé aux tests des écrans : un glissement vertical d'un doigt, donné aux gestionnaires d'un
// `PanResponder` (le toucher, le mouvement, le relâcher), comme le ferait le système de réponse
// aux touchers.
import { act } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';

/** Un toucher d'un doigt, posé en (0, 0) à 0 ms, à `y` dp vers le bas à l'instant `at` (ms). */
function touchAt(y: number, at: number) {
  return {
    touchHistory: {
      numberActiveTouches: 1,
      indexOfSingleActiveTouch: 0,
      mostRecentTimeStamp: at,
      touchBank: [
        {
          touchActive: true,
          startPageX: 0,
          startPageY: 0,
          startTimeStamp: 0,
          currentPageX: 0,
          currentPageY: y,
          currentTimeStamp: at,
          previousPageX: 0,
          previousPageY: 0,
          previousTimeStamp: 0,
        },
      ],
    },
    nativeEvent: { touches: [], changedTouches: [] },
  };
}

/** Glisse `element` de `dy` dp vers le bas (vers le haut si négatif) en `ms` millisecondes. */
export async function swipe(element: TestInstance, dy: number, ms: number): Promise<void> {
  const { onResponderGrant, onResponderMove, onResponderRelease } = element.props;
  await act(async () => {
    onResponderGrant(touchAt(0, 0));
    onResponderMove(touchAt(dy, ms));
    onResponderRelease(touchAt(dy, ms));
  });
}
