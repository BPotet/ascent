import { act, renderHook, waitFor } from '@testing-library/react-native';

import { TOUCH_PROBE_TARGET } from './touchProbeReport';
import {
  calibrateClocks,
  jsThreadNow,
  touchProbeBegin,
  uiThreadNow,
  useTouchProbe,
} from './useTouchProbe';

/** Laisse passer les retours vers le fil JS (scheduleOnRN, simulé par une micro-tâche). */
async function flushToJs() {
  await act(async () => {
    await Promise.resolve();
  });
}

/** Une horloge qui renvoie les valeurs données, l'une après l'autre. */
function clockReading(...values: number[]) {
  const reads = [...values];
  return jest.fn(() => {
    const value = reads.shift();
    if (value === undefined) throw new Error('clock read too many times');
    return value;
  });
}

describe('touchProbeBegin, the work of the onBegin worklet', () => {
  // fireGestureHandler (Gesture Handler 2.32) complète toujours un geste jusqu'à sa fin : seul
  // l'appel direct de ce traitement prouve qu'un toucher est daté par son seul début (BEGAN sans END).
  it('dates a touch at its beginning, on its own, then hands it over to the JS thread', async () => {
    let uiTime = 1_000;
    const uiNow = jest.fn(() => uiTime);
    const onTouch = jest.fn();

    touchProbeBegin(uiNow, onTouch)();
    uiTime = 1_250;

    expect(uiNow).toHaveBeenCalledTimes(1);
    expect(onTouch).not.toHaveBeenCalled();
    await flushToJs();
    expect(onTouch).toHaveBeenCalledTimes(1);
    expect(onTouch).toHaveBeenCalledWith(1_000);
  });
});

describe('calibrateClocks', () => {
  it('measures the UI clock minus the JS clock, at the middle of a round trip', async () => {
    const now = clockReading(1_000, 1_010);
    const uiNow = clockReading(51_005);
    const onCalibrated = jest.fn();

    calibrateClocks(now, uiNow, onCalibrated);

    await waitFor(() => expect(onCalibrated).toHaveBeenCalledWith({ offset: 50_000 }));
    expect(onCalibrated).toHaveBeenCalledTimes(1);
  });
});

describe('the default clocks', () => {
  it.each([
    ['uiThreadNow', uiThreadNow],
    ['jsThreadNow', jsThreadNow],
  ])('%s reads the monotonic clock of the runtime it runs on', (_, clock) => {
    const performanceNow = jest.spyOn(performance, 'now').mockReturnValue(4_321);

    expect(clock()).toBe(4_321);
    performanceNow.mockRestore();
  });
});

describe('useTouchProbe', () => {
  /** Une horloge factice partagée par les deux fils, réglable par le test. */
  function fakeClock(start = 1_000) {
    const clock = { time: start, now: () => clock.time };
    return clock;
  }

  async function renderProbe(clock = fakeClock(), uiOffset = 0) {
    const uiNow = () => clock.time + uiOffset;
    const rendered = await renderHook(() => useTouchProbe({ now: clock.now, uiNow }));
    await waitFor(() => expect(rendered.result.current.calibration).toBeDefined());
    return { ...rendered, clock };
  }

  /** Un toucher : début daté sur le fil UI, reçu par le JS `gap` ms plus tard. */
  async function touch(probe: Awaited<ReturnType<typeof renderProbe>>, gap: number): Promise<void> {
    probe.result.current.onBegin();
    probe.clock.time += gap;
    await flushToJs();
    probe.clock.time += 1_000;
  }

  it('starts empty, and calibrates the two clocks once mounted', async () => {
    const probe = await renderProbe(fakeClock(), 50_000);

    expect(probe.result.current.report.count).toBe(0);
    expect(probe.result.current.lastGap).toBeNull();
    expect(probe.result.current.calibration).toEqual({ offset: 50_000 });
  });

  it('records each touch with its gap, dated at its beginning and at its reception', async () => {
    const probe = await renderProbe();

    await touch(probe, 12);

    expect(probe.result.current.report.count).toBe(1);
    expect(probe.result.current.lastGap).toBe(12);
  });

  it(`reports the median, the p95 and the method after ${TOUCH_PROBE_TARGET} touches`, async () => {
    const probe = await renderProbe();

    for (let index = 0; index < TOUCH_PROBE_TARGET; index += 1) await touch(probe, 10);

    expect(probe.result.current.report).toEqual({
      count: 20,
      complete: true,
      measure: { median: 10, p95: 10, method: 'a' },
    });
  });

  it('applies the calibrated offset when the two clocks are on different bases', async () => {
    const probe = await renderProbe(fakeClock(), 50_000);

    for (let index = 0; index < TOUCH_PROBE_TARGET; index += 1) await touch(probe, 10);

    expect(probe.result.current.report.measure?.method).toBe('b');
    expect(probe.result.current.report.measure?.median).toBe(10);
  });

  it('starts over from zero', async () => {
    const probe = await renderProbe();
    await touch(probe, 12);

    await act(() => probe.result.current.restart());

    expect(probe.result.current.report.count).toBe(0);
    expect(probe.result.current.lastGap).toBeNull();
  });

  describe('when its clocks change while mounted', () => {
    async function renderWithClocks(clock: { time: number }) {
      const initial = { now: () => clock.time, uiNow: () => clock.time };
      const rendered = await renderHook(
        (clocks: { now: () => number; uiNow: () => number }) => useTouchProbe(clocks),
        { initialProps: initial },
      );
      await waitFor(() => expect(rendered.result.current.calibration).toEqual({ offset: 0 }));
      return rendered;
    }

    it('calibrates again, and dates the next touches with the new UI clock', async () => {
      const clock = { time: 1_000 };
      const probe = await renderWithClocks(clock);

      await probe.rerender({ now: () => clock.time, uiNow: () => clock.time + 50_000 });
      await waitFor(() => expect(probe.result.current.calibration).toEqual({ offset: 50_000 }));
      probe.result.current.onBegin();
      clock.time += 10;
      await flushToJs();

      expect(probe.result.current.lastGap).toBe(10 - 50_000);
    });

    it('dates the reception of the next touches with the new JS clock', async () => {
      const clock = { time: 1_000 };
      const probe = await renderWithClocks(clock);

      await probe.rerender({ now: () => clock.time + 40, uiNow: () => clock.time });
      probe.result.current.onBegin();
      clock.time += 10;
      await flushToJs();

      expect(probe.result.current.lastGap).toBe(50);
    });
  });
});
