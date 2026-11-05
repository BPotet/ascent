// Le voile de lisibilité (#176) : la nuit à 90 % au-dessus et en dessous du cadre de la scène,
// fondue sur 24 dp sous l'en-tête et 28 dp au-dessus de la zone du pouce ; tout l'écran sans mesure.
import { BOTTOM_FADE, TOP_FADE, backdropVeil } from './backdropVeil';

const WINDOW = { width: 390, height: 844 };

describe('backdropVeil', () => {
  it('fades over 24 dp under the header and 28 dp above the thumb zone, as in the mockup', () => {
    expect([TOP_FADE, BOTTOM_FADE]).toEqual([24, 28]);
  });

  it('stops the bands at the edges of the scene frame, the fades inside it', () => {
    const veil = backdropVeil(WINDOW, { top: 160, bottom: 600 });

    expect(veil.bands).toEqual([
      { y: 0, height: 160 },
      { y: 600, height: 244 },
    ]);
    expect(veil.fades).toEqual([
      { y: 160, height: 24, opaque: 'top' },
      { y: 572, height: 28, opaque: 'bottom' },
    ]);
  });

  it('covers the whole screen while the scene is not measured', () => {
    expect(backdropVeil(WINDOW, null)).toEqual({
      bands: [{ y: 0, height: 844 }],
      fades: [],
    });
  });

  it('keeps the fades within a scene shorter than both of them', () => {
    const veil = backdropVeil(WINDOW, { top: 300, bottom: 340 });

    expect(veil.fades).toEqual([
      { y: 300, height: 20, opaque: 'top' },
      { y: 320, height: 20, opaque: 'bottom' },
    ]);
  });

  it('veils a scene measured upside down from its top, without any fade', () => {
    expect(backdropVeil(WINDOW, { top: 600, bottom: 500 })).toEqual({
      bands: [
        { y: 0, height: 600 },
        { y: 600, height: 244 },
      ],
      fades: [
        { y: 600, height: 0, opaque: 'top' },
        { y: 600, height: 0, opaque: 'bottom' },
      ],
    });
  });

  it('clamps a scene measured out of the window', () => {
    const veil = backdropVeil(WINDOW, { top: -10, bottom: 900 });

    expect(veil.bands).toEqual([
      { y: 0, height: 0 },
      { y: 844, height: 0 },
    ]);
  });
});
