import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { useReducedMotion } from './useReducedMotion';

const isReduceMotionEnabled = jest.mocked(AccessibilityInfo.isReduceMotionEnabled);
const addEventListener = jest.mocked(AccessibilityInfo.addEventListener);

describe('useReducedMotion', () => {
  it('is false by default', async () => {
    const { result } = await renderHook(() => useReducedMotion());

    expect(result.current).toBe(false);
  });

  it('is false while the phone has not answered yet', async () => {
    isReduceMotionEnabled.mockReturnValueOnce(new Promise<boolean>(() => undefined));

    const { result } = await renderHook(() => useReducedMotion());

    expect(result.current).toBe(false);
  });

  it('follows the setting of the phone', async () => {
    isReduceMotionEnabled.mockResolvedValueOnce(true);

    const { result } = await renderHook(() => useReducedMotion());

    await waitFor(() => expect(result.current).toBe(true));
  });

  it('follows changes of the setting, until unmounted', async () => {
    const remove = jest.fn();
    addEventListener.mockReturnValueOnce({ remove } as never);
    const { result, unmount } = await renderHook(() => useReducedMotion());
    const [event, listener] = addEventListener.mock.calls.at(-1) ?? [];

    expect(event).toBe('reduceMotionChanged');
    await act(() => (listener as unknown as (enabled: boolean) => void)(true));
    expect(result.current).toBe(true);

    await unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
