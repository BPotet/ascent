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

      for (const scale of [1, 2, 3] as const) {
        const physical = artPixelSize(scale) * density;
        expect(physical).toBeCloseTo(Math.round(physical), 9);
        expect(Math.abs(artPixelSize(scale) - scale)).toBeLessThanOrEqual(0.5 / density);
      }
    },
  );

  it('is exactly the scale on a whole density', () => {
    jest.spyOn(PixelRatio, 'roundToNearestPixel').mockImplementation((size) => size);
    expect(artPixelSize(1)).toBe(1);
    expect(artPixelSize(2)).toBe(2);
    expect(artPixelSize(3)).toBe(3);
  });

  it('rounds the ×1 art pixel of an image of the Atelier to 3 physical pixels at 2.625 (#155)', () => {
    jest
      .spyOn(PixelRatio, 'roundToNearestPixel')
      .mockImplementation((size) => Math.round(size * 2.625) / 2.625);
    expect(artPixelSize(1) * 2.625).toBeCloseTo(3, 9);
  });
});
