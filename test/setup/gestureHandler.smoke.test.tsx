// Test de fumée de Gesture Handler sous Jest (setup commun des projets « integration » et « bdd ») :
// un toucher simulé déclenche onBegin dès son début, avant toute autre étape du geste.
//
// fireGestureHandler complète toujours la séquence jusqu'à une fin (BEGAN seul devient BEGAN,
// ACTIVE, END) : « sans attendre le relâcher » se vérifie donc par l'ordre des appels, et par un
// toucher qui échoue (jamais un appui valide) mais qui a bien été vu à son début.
import { Text } from 'react-native';
import { Gesture, GestureDetector, State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { render } from '@testing-library/react-native';

async function renderTap() {
  const calls: string[] = [];
  const tap = Gesture.Tap()
    .withTestId('smoke-tap')
    .onBegin((event) => calls.push(`begin:${event.state}`))
    .onStart(() => calls.push('start'))
    .onEnd((_, success) => calls.push(`end:${success}`));
  await render(
    <GestureDetector gesture={tap}>
      <Text>Touch</Text>
    </GestureDetector>,
  );
  return calls;
}

describe('Gesture Handler under Jest', () => {
  it('reports a touch at its beginning, before it is recognised and released', async () => {
    const calls = await renderTap();

    fireGestureHandler(getByGestureTestId('smoke-tap'), [{ state: State.BEGAN }]);

    expect(calls).toEqual([`begin:${State.BEGAN}`, 'start', 'end:true']);
  });

  it('reports the beginning of a touch that fails', async () => {
    const calls = await renderTap();

    fireGestureHandler(getByGestureTestId('smoke-tap'), [
      { state: State.BEGAN },
      { state: State.FAILED },
    ]);

    expect(calls[0]).toBe(`begin:${State.BEGAN}`);
    expect(calls).toContain('end:false');
  });
});
