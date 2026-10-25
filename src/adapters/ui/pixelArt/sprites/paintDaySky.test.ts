import { artPalette } from '../artPalette';
import { paintDaySky, paintStartupSky, skyPaintLight } from './paintDaySky';

/** Vrai si l'image a au moins un pixel de la couleur `#RRGGBB`. */
function hasColor(rgba: Uint8Array, hex: string): boolean {
  const [r, g, b] = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
  for (let index = 0; index < rgba.length; index += 4) {
    if (rgba[index] === r && rgba[index + 1] === g && rgba[index + 2] === b) {
      return true;
    }
  }
  return false;
}

describe('paintDaySky', () => {
  it('paints an opaque image of the asked size', () => {
    const image = paintDaySky(60, 33, 0.5);
    expect(image).toMatchObject({ width: 60, height: 33 });
    expect(image.rgba).toHaveLength(60 * 33 * 4);
    for (let index = 3; index < image.rgba.length; index += 4) {
      expect(image.rgba[index]).toBe(255);
    }
  });

  it('paints the same image for the same light (fixed seed stars)', () => {
    expect(paintDaySky(80, 40, 0.4).rgba).toEqual(paintDaySky(80, 40, 0.4).rgba);
  });

  it('paints a lighter sky with one more habit done', () => {
    expect(paintDaySky(80, 40, 0.6).rgba).not.toEqual(paintDaySky(80, 40, 0.4).rgba);
  });

  it('has no sun at night, and the sun behind the tower at sunrise', () => {
    expect(hasColor(paintDaySky(120, 66, 0).rgba, artPalette.roles.light)).toBe(false);
    expect(hasColor(paintDaySky(120, 66, 1).rgba, artPalette.roles.light)).toBe(true);
  });

  it('keeps a little light in the night sky, as the mockup', () => {
    expect(skyPaintLight(0)).toBeCloseTo(0.1);
    expect(skyPaintLight(1)).toBe(1);
    expect(skyPaintLight(0.5)).toBeCloseTo(0.55);
  });

  it('paints the startup sky: the big tower in the night, with lit windows', () => {
    const image = paintStartupSky(100, 200);
    expect(image).toMatchObject({ width: 100, height: 200 });
    expect(hasColor(image.rgba, artPalette.roles.gold)).toBe(true);
    expect(hasColor(image.rgba, artPalette.roles.light)).toBe(false);
  });
});
