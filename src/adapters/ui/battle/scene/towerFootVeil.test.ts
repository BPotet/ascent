// Le voile du pied de la tour (#233) : la nuit à 75 % jusqu'au bas mesuré de l'en-tête, un fondu de
// 24 dp, puis la nuit à 12 % jusqu'en bas ; tout l'écran au voile fort tant que l'en-tête n'est pas
// mesuré.
import { TOWER_FOOT_FADE, towerFootVeil } from './towerFootVeil';

const WINDOW = { width: 360, height: 780 };

describe('towerFootVeil', () => {
  it('fades over 24 dp under the header, as in the mockup', () => {
    expect(TOWER_FOOT_FADE).toBe(24);
  });

  it('covers the whole screen with the strong veil while the header is not measured', () => {
    expect(towerFootVeil(WINDOW, null)).toEqual({
      strong: { y: 0, height: 780 },
      fade: { y: 780, height: 0 },
      light: { y: 780, height: 0 },
    });
  });

  it('stops the strong veil at the measured bottom of the header, then fades to the light veil', () => {
    expect(towerFootVeil(WINDOW, 156)).toEqual({
      strong: { y: 0, height: 156 },
      fade: { y: 156, height: 24 },
      light: { y: 180, height: 600 },
    });
  });

  it('keeps the fade within the window under a header near its bottom', () => {
    expect(towerFootVeil(WINDOW, 770)).toEqual({
      strong: { y: 0, height: 770 },
      fade: { y: 770, height: 10 },
      light: { y: 780, height: 0 },
    });
  });

  it('covers the whole screen with the strong veil under a header measured below the window', () => {
    expect(towerFootVeil(WINDOW, 900)).toEqual({
      strong: { y: 0, height: 780 },
      fade: { y: 780, height: 0 },
      light: { y: 780, height: 0 },
    });
  });

  it('starts the fade at the top of the window for a header measured above it', () => {
    expect(towerFootVeil(WINDOW, -40)).toEqual({
      strong: { y: 0, height: 0 },
      fade: { y: 0, height: 24 },
      light: { y: 24, height: 756 },
    });
  });
});
