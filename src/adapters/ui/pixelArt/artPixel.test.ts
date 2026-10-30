import { PixelRatio } from 'react-native';

import { ART_PIXEL, artPixelSize } from './artPixel';

describe('artPixelSize', () => {
  afterEach(() => jest.restoreAllMocks());

  it('is 2 dp, the art pixel of the whole interface', () => {
    expect(ART_PIXEL).toBe(2);
  });

  it.each([2, 2.625, 2.75, 3])(
    'is a whole number of physical pixels at the density %p',
    (density) => {
      jest.spyOn(PixelRatio, 'get').mockReturnValue(density);
      jest
        .spyOn(PixelRatio, 'roundToNearestPixel')
        .mockImplementation((size) => Math.round(size * density) / density);

      for (const scale of [2, 3, 4, 6] as const) {
        const physical = artPixelSize(scale) * density;
        expect(physical).toBeCloseTo(Math.round(physical), 9);
        // Au plus un demi-pixel physique d'écart ; ×4 à 2,625 tombe pile sur la moitié.
        expect(Math.abs(artPixelSize(scale) - scale)).toBeLessThanOrEqual(0.5 / density + 1e-9);
      }
    },
  );

  it('is exactly the scale on a whole density', () => {
    jest.spyOn(PixelRatio, 'roundToNearestPixel').mockImplementation((size) => size);
    expect(artPixelSize(2)).toBe(2);
    expect(artPixelSize(3)).toBe(3);
    expect(artPixelSize(4)).toBe(4);
    expect(artPixelSize(6)).toBe(6);
  });
});
