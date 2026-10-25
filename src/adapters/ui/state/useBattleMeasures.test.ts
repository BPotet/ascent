import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useBattleMeasures } from './useBattleMeasures';

describe('useBattleMeasures', () => {
  it('keeps the last 500 touches, dated at their reception', async () => {
    let now = 0;
    // Des horloges stables : la calibration ne se refait qu'à leur changement.
    const clocks = { now: () => now, uiNow: () => 0 };
    const { result } = await renderHook(() => useBattleMeasures(clocks));
    await waitFor(() => expect(result.current).not.toBeNull());
    const { record } = result.current;

    await act(async () => {
      for (let touch = 0; touch < 501; touch += 1) {
        now = touch + 5;
        record(touch);
      }
    });

    expect(result.current.report.count).toBe(500);
    expect(result.current.report.measure).toEqual({ median: 5, p95: 5, method: 'a' });

    await act(async () => result.current.reset());
    expect(result.current.report.count).toBe(0);
  });
});
