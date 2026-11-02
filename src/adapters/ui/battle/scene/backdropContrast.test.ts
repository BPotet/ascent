// La lisibilité sur le fond de palier (#176) : chaque teinte de chaque fond, sous le voile de
// lisibilité, garde au moins 4,5:1 avec chaque couleur de texte de l'en-tête et de la zone du pouce.
import { artPalette } from '../../pixelArt/artPalette';
import { TIER_BACKDROPS } from '../../pixelArt/sprites/battle/tierBackdrops';
import { contrast, underVeil } from '../../testing/contrast';
import { battleColors } from '../../theme/battleColors';

const { roles } = artPalette;
const TEXTS = [
  ['battleColors.text', battleColors.text],
  ['battleColors.muted', battleColors.muted],
  ['roles.gold', roles.gold],
  ['roles.light', roles.light],
  ['roles.muted', roles.muted],
  ['roles.parchment', roles.parchment],
] as const;

describe('the readability veil on the tier backdrops', () => {
  it('is the night of the mockup at 90 %', () => {
    expect(underVeil('#FFFFFF')).toBe('#262936');
    expect(underVeil('#0E1120')).toBe('#0E1120');
  });

  it.each([1, 2, 3] as const)(
    'keeps every text at 4.5:1 at least on every tint of the tier %i backdrop',
    (tier) => {
      const failing = TIER_BACKDROPS[tier].palette.flatMap((tint) =>
        TEXTS.filter(([, text]) => contrast(text, underVeil(tint)) < 4.5).map(
          ([name]) => `${name} on ${tint}`,
        ),
      );
      expect(failing).toEqual([]);
    },
  );

  it('measures the worst case of the architect: the discreet grey at 4.79:1 on the Catacombs', () => {
    const worst = Math.min(
      ...TIER_BACKDROPS[1].palette.map((tint) => contrast(roles.muted, underVeil(tint))),
    );
    expect(worst).toBeCloseTo(4.79, 1);
  });

  it('shows that the backdrop alone, without the veil, would not be readable', () => {
    const worst = Math.min(
      ...TIER_BACKDROPS[1].palette.map((tint) => contrast(battleColors.text, tint)),
    );
    expect(worst).toBeLessThan(1.2);
  });
});
