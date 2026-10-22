import { act, renderHook } from '@testing-library/react-native';
import { Dimensions } from 'react-native';

import { LARGE_TEXT_FONT_SCALE, useLargeText } from './useLargeText';

const initial = { window: Dimensions.get('window'), screen: Dimensions.get('screen') };

/** Le réglage de taille du texte du téléphone (`fontScale`). */
function setFontScale(fontScale: number): void {
  Dimensions.set({
    window: { ...initial.window, fontScale },
    screen: { ...initial.screen, fontScale },
  });
}

describe('useLargeText', () => {
  afterEach(async () => {
    await act(() => Dimensions.set(initial));
  });

  it('is false with the usual text size', async () => {
    setFontScale(1);

    const { result } = await renderHook(() => useLargeText());

    expect(result.current).toBe(false);
  });

  it('is true from the large text sizes of the phone (×1.3)', async () => {
    expect(LARGE_TEXT_FONT_SCALE).toBe(1.3);
    setFontScale(1.29);
    const { result } = await renderHook(() => useLargeText());
    expect(result.current).toBe(false);

    await act(() => setFontScale(1.3));

    expect(result.current).toBe(true);
  });
});
