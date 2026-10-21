import { act, renderHook } from '@testing-library/react-native';
import { Keyboard, Platform } from 'react-native';

import { useKeyboardVisible } from './useKeyboardVisible';

type Listener = () => void;

function spyOnKeyboard() {
  const listeners = new Map<string, Listener>();
  const removed: string[] = [];
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, listener: Listener) => {
    listeners.set(event, listener);
    return { remove: () => removed.push(event) };
  }) as never);
  return { listeners, removed };
}

describe('useKeyboardVisible', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ['ios', 'keyboardWillShow', 'keyboardWillHide'],
    ['android', 'keyboardDidShow', 'keyboardDidHide'],
  ] as const)('follows the keyboard on %s', async (os, showEvent, hideEvent) => {
    jest.replaceProperty(Platform, 'OS', os);
    const { listeners, removed } = spyOnKeyboard();
    const { result, unmount } = await renderHook(() => useKeyboardVisible());
    expect(result.current).toBe(false);

    await act(() => listeners.get(showEvent)?.());
    expect(result.current).toBe(true);
    await act(() => listeners.get(hideEvent)?.());
    expect(result.current).toBe(false);

    await unmount();
    expect(removed.sort()).toEqual([hideEvent, showEvent].sort());
  });
});
