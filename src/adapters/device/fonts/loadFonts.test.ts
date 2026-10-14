import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Sora_600SemiBold } from '@expo-google-fonts/sora/600SemiBold';
import { Sora_700Bold } from '@expo-google-fonts/sora/700Bold';
import type * as ExpoFont from 'expo-font';
import { isLoaded, loadAsync } from 'expo-font';

import { loadFonts } from './loadFonts';

// Le vrai expo-font (module natif simulé par jest-expo), dont on peut provoquer l'échec.
jest.mock('expo-font', () => {
  const actual = jest.requireActual<typeof ExpoFont>('expo-font');
  return { ...actual, loadAsync: jest.fn(actual.loadAsync) };
});

describe('loadFonts', () => {
  it('registers the embedded font files under the names used by the interface', async () => {
    await expect(loadFonts({ Sora_700Bold, Inter_400Regular })).resolves.toBe(true);

    expect(isLoaded('Sora_700Bold')).toBe(true);
    expect(isLoaded('Inter_400Regular')).toBe(true);
  });

  it('keeps the phone system font when the files cannot be loaded', async () => {
    jest.mocked(loadAsync).mockRejectedValueOnce(new Error('font file is corrupted'));

    await expect(loadFonts({ Sora_600SemiBold })).resolves.toBe(false);
    expect(isLoaded('Sora_600SemiBold')).toBe(false);
  });
});
