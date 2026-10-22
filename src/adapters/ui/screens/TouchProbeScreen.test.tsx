// La sonde de toucher (outil du build de preview). Les toucher sont simulés par
// fireGestureHandler, qui complète toujours la séquence d'un geste jusqu'à sa fin (Gesture Handler
// 2.32) : un toucher envoyé seulement en BEGAN devient BEGAN, ACTIVE, END. Pour prouver qu'un
// toucher est daté à son début, l'horloge factice avance de 100 ms à chaque étape du geste qui suit
// le début (onStart, onEnd, onFinalize…) : un toucher daté à sa fin aurait un autre écart. Le cas
// « BEGAN sans END » proprement dit est le test unitaire de touchProbeBegin (useTouchProbe.test.ts).
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { TOUCH_PROBE_TAP_TEST_ID, TouchProbeScreen } from './TouchProbeScreen';

const TEST_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/** Les étapes d'un geste qui suivent son début. */
const LATER_STEPS = [
  'onStart',
  'onUpdate',
  'onChange',
  'onEnd',
  'onFinalize',
  'onTouchesMove',
  'onTouchesUp',
  'onTouchesCancelled',
] as const;

type GestureHandlers = Record<string, ((...args: unknown[]) => void) | undefined>;

/** Horloge factice partagée par les deux fils ; `uiOffset` décale celle du fil UI. */
function fakeClock(uiOffset = 0) {
  const clock = {
    time: 10_000,
    step: 100,
    now: () => clock.time,
    uiNow: () => clock.time + uiOffset,
  };
  return clock;
}

type Clock = ReturnType<typeof fakeClock>;

/** Fait avancer l'horloge de `clock.step` ms à chaque étape du geste qui suit son début. */
function advanceOnLaterSteps(clock: Clock) {
  const gesture = getByGestureTestId(TOUCH_PROBE_TAP_TEST_ID) as unknown as {
    handlers: GestureHandlers & { advancesClock?: true };
  };
  if (gesture.handlers.advancesClock) return;
  for (const step of LATER_STEPS) {
    const original = gesture.handlers[step];
    gesture.handlers[step] = (...args) => {
      clock.time += clock.step;
      original?.(...args);
    };
  }
  gesture.handlers.advancesClock = true;
}

async function renderProbe(clock: Clock = fakeClock(), onClose = jest.fn()) {
  await render(
    <SafeAreaProvider initialMetrics={TEST_METRICS}>
      <TouchProbeScreen onClose={onClose} now={clock.now} uiNow={clock.uiNow} />
    </SafeAreaProvider>,
  );
  await waitFor(() => expect(screen.queryByText('Décalage calibré : en cours')).toBeNull());
  return { clock, onClose };
}

/** Un toucher sur la zone d'essai ; les retours vers le fil JS passent avant la suite. */
async function touch(clock: Clock, states: State[] = [State.BEGAN]) {
  advanceOnLaterSteps(clock);
  fireGestureHandler(
    getByGestureTestId(TOUCH_PROBE_TAP_TEST_ID),
    states.map((state) => ({ state })),
  );
  await act(async () => {
    await Promise.resolve();
  });
  clock.time += 1_000;
}

describe('TouchProbeScreen', () => {
  it('presents itself as a tool of the preview build, with an empty counter', async () => {
    await renderProbe();

    expect(screen.getByRole('header', { name: 'Sonde de toucher' })).toBeOnTheScreen();
    expect(screen.getByText('Outil du build de preview')).toBeOnTheScreen();
    expect(screen.getByText('Touche ici')).toBeOnTheScreen();
    expect(screen.getByText('0 / 20')).toBeOnTheScreen();
    expect(screen.queryByTestId('touch-probe-result')).toBeNull();
  });

  it('shows the calibrated offset between the two clocks', async () => {
    await renderProbe(fakeClock(50_000));

    expect(screen.getByText('Décalage calibré : 50 000 ms')).toBeOnTheScreen();
  });

  it('dates and counts a touch at its beginning, not when the gesture ends', async () => {
    const { clock } = await renderProbe();

    await touch(clock);

    expect(screen.getByText('1 / 20')).toBeOnTheScreen();
    // Daté à onBegin, puis onStart, onEnd et onFinalize : la réception arrive 3 × 100 ms plus tard.
    // Daté à onEnd, l'écart serait de 100 ms ; à onFinalize, de 0 ms.
    expect(screen.getByText('Dernier écart : 300 ms')).toBeOnTheScreen();
  });

  it('counts a touch that begins then fails, never becoming a valid tap', async () => {
    const { clock } = await renderProbe();

    await touch(clock, [State.BEGAN, State.FAILED]);

    expect(screen.getByText('1 / 20')).toBeOnTheScreen();
    // fireGestureHandler insère ACTIVE avant FAILED : onStart, onEnd (en échec) puis onFinalize.
    expect(screen.getByText('Dernier écart : 300 ms')).toBeOnTheScreen();
  });

  it('shows the median, the p95 and the method retained after 20 touches', async () => {
    const { clock } = await renderProbe();

    // Écarts de 3, 6, 9… 60 ms : trois étapes après le début, de 1, 2, 3… 20 ms chacune.
    for (let index = 1; index <= 20; index += 1) {
      clock.step = index;
      await touch(clock);
    }

    expect(screen.getByText('20 / 20')).toBeOnTheScreen();
    const result = screen.getByTestId('touch-probe-result');
    expect(result).toHaveTextContent('Écart médian : 31,5 ms', { exact: false });
    expect(result).toHaveTextContent('Écart p95 : 57 ms', { exact: false });
    expect(result).toHaveTextContent('Méthode retenue : a', { exact: false });
    expect(result).toHaveTextContent('Base commune : oui', { exact: false });
    expect(result).toHaveAccessibleName(
      'Résultat. Écart médian : 31,5 ms. Écart p95 : 57 ms. Méthode retenue : a. Base commune : oui.',
    );
  });

  it('retains the calibrated method when the two clocks are on different bases', async () => {
    const { clock } = await renderProbe(fakeClock(50_000));

    for (let index = 0; index < 20; index += 1) await touch(clock);

    const result = screen.getByTestId('touch-probe-result');
    expect(result).toHaveTextContent('Écart médian : 300 ms', { exact: false });
    expect(result).toHaveTextContent('Méthode retenue : b', { exact: false });
    expect(result).toHaveTextContent('Base commune : non', { exact: false });
  });

  it('ignores the touches after the 20th', async () => {
    const { clock } = await renderProbe();
    for (let index = 0; index < 20; index += 1) await touch(clock);

    await touch(clock);

    expect(screen.getByText('20 / 20')).toBeOnTheScreen();
  });

  it('starts over from zero', async () => {
    const { clock } = await renderProbe();
    for (let index = 0; index < 20; index += 1) await touch(clock);

    await fireEvent.press(screen.getByRole('button', { name: 'Recommencer' }));

    expect(screen.getByText('0 / 20')).toBeOnTheScreen();
    expect(screen.queryByTestId('touch-probe-result')).toBeNull();
    expect(screen.queryByText(/Dernier écart/)).toBeNull();
  });

  it('counts touches with its default clocks', async () => {
    await render(
      <SafeAreaProvider initialMetrics={TEST_METRICS}>
        <TouchProbeScreen onClose={jest.fn()} />
      </SafeAreaProvider>,
    );
    await waitFor(() => expect(screen.queryByText('Décalage calibré : en cours')).toBeNull());

    fireGestureHandler(getByGestureTestId(TOUCH_PROBE_TAP_TEST_ID), [{ state: State.BEGAN }]);

    expect(await screen.findByText('1 / 20')).toBeOnTheScreen();
    expect(screen.getByText(/^Dernier écart : \d/)).toBeOnTheScreen();
  });

  it('closes', async () => {
    const { onClose } = await renderProbe();

    await fireEvent.press(screen.getByRole('button', { name: 'Fermer' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('labels the touch area for the screen reader, with the counter', async () => {
    const { clock } = await renderProbe();

    await touch(clock);

    expect(screen.getByTestId('touch-probe-target')).toHaveAccessibleName(
      'Zone d’essai, touche ici. 1 appui sur 20.',
    );
  });

  it('counts the touches in the label, in the plural from 2', async () => {
    const { clock } = await renderProbe();

    await touch(clock);
    await touch(clock);

    expect(screen.getByTestId('touch-probe-target')).toHaveAccessibleName(
      'Zone d’essai, touche ici. 2 appuis sur 20.',
    );
  });

  it('follows a new JS clock given while open', async () => {
    const { clock } = await renderProbe();
    const later = { ...clock, now: () => clock.time + 40 };

    await screen.rerender(
      <SafeAreaProvider initialMetrics={TEST_METRICS}>
        <TouchProbeScreen onClose={jest.fn()} now={later.now} uiNow={clock.uiNow} />
      </SafeAreaProvider>,
    );
    await touch(clock);

    expect(screen.getByText('Dernier écart : 340 ms')).toBeOnTheScreen();
  });

  it('offers touch targets of at least 48 points', async () => {
    const { clock } = await renderProbe();
    for (let index = 0; index < 20; index += 1) await touch(clock);

    for (const target of [
      screen.getByTestId('touch-probe-target'),
      screen.getByRole('button', { name: 'Fermer' }),
      screen.getByRole('button', { name: 'Recommencer' }),
    ]) {
      const style = StyleSheet.flatten(target.props.style as never) as { minHeight?: number };
      expect(style.minHeight).toBeGreaterThanOrEqual(48);
    }
  });
});
