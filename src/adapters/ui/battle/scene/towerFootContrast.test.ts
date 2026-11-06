// La lisibilité au pied de la tour (#233) : chaque teinte de chaque fond de palier, sous le voile du
// pied de la tour (la nuit à 75 %), garde au moins 4,5:1 avec chaque couleur de texte de l'en-tête
// et de la barre d'état ; sous la plaque du Voile de lisibilité (la nuit à 90 %), les textes posés
// hors de l'en-tête aussi. Le pire cas sur toute la palette couvre tout pixel de tout écran.
import { artPalette } from '../../pixelArt/artPalette';
import { TIER_BACKDROPS } from '../../pixelArt/sprites/battle/tierBackdrops';
import { contrast, underVeil } from '../../testing/contrast';

const { roles } = artPalette;
const TIERS = [1, 2, 3] as const;
/** Les textes de l'en-tête (« La tour », la ligne du palier, le libellé doré) et la barre d'état. */
const HEADER_TEXTS = [
  ['roles.light', roles.light],
  ['roles.parchment', roles.parchment],
  ['roles.gold', roles.gold],
  ['status bar', '#FFFFFF'],
] as const;
/** Les textes posés sur une plaque hors de l'en-tête, et ceux de l'Export du journal. */
const PLATE_TEXTS = [
  ['roles.light', roles.light],
  ['roles.muted', roles.muted],
  ['roles.parchment', roles.parchment],
  ['roles.gold', roles.gold],
  ['roles.error', roles.error],
] as const;
/** La maquette : la nuit à 70 % sous l'en-tête. */
const MOCKUP_VEIL = 'rgba(14,17,32,0.7)';

/** Le pire contraste de `text` sur les teintes du fond du palier `tier` sous `veil`. */
function worst(text: string, tier: 1 | 2 | 3, veil: string): number {
  return Math.min(
    ...TIER_BACKDROPS[tier].palette.map((tint) => contrast(text, underVeil(tint, veil))),
  );
}

/** Les textes de `texts` sous 4,5:1 sur une teinte d'un fond, sous `veil`. */
function failing(texts: readonly (readonly [string, string])[], veil: string): string[] {
  return TIERS.flatMap((tier) =>
    TIER_BACKDROPS[tier].palette.flatMap((tint) =>
      texts
        .filter(([, text]) => contrast(text, underVeil(tint, veil)) < 4.5)
        .map(([name]) => `${name} on ${tint} (tier ${tier})`),
    ),
  );
}

describe('the tower foot veil on the tier backdrops', () => {
  it('is the night of the readability veil, at 75 % under the header and 12 % below', () => {
    expect(underVeil('#FFFFFF', roles.towerFootVeil)).toBe('#4A4D58');
    expect(underVeil('#0E1120', roles.towerFootVeil)).toBe('#0E1120');
    expect(underVeil('#FFFFFF', roles.towerFootVeilLight)).toBe('#E2E2E4');
  });

  it('keeps every text of the header and the status bar at 4.5:1 at least, on every tint', () => {
    expect(failing(HEADER_TEXTS, roles.towerFootVeil)).toEqual([]);
  });

  it('measures the worst cases of the architect on the three backdrops', () => {
    const at = (text: string) =>
      Math.min(...TIERS.map((tier) => worst(text, tier, roles.towerFootVeil)));
    expect(at(roles.parchment)).toBeCloseTo(4.97, 1);
    expect(at(roles.gold)).toBeCloseTo(6.16, 1);
    expect(at(roles.light)).toBeCloseTo(8.0, 1);
    expect(at('#FFFFFF')).toBeCloseTo(8.82, 1);
  });

  it('keeps every text on a plate of the readability veil at 4.5:1 at least, on every tint', () => {
    expect(failing(PLATE_TEXTS, roles.backdropVeil)).toEqual([]);
  });

  it('shows that the 70 % of the mockup would let the tier line fall to 4.18:1 on the Catacombs', () => {
    expect(worst(roles.parchment, 1, MOCKUP_VEIL)).toBeCloseTo(4.18, 1);
  });

  it('shows that no text would be readable on the light veil alone, without a plate', () => {
    const readable = PLATE_TEXTS.filter(([, text]) =>
      TIERS.every((tier) => worst(text, tier, roles.towerFootVeilLight) >= 4.5),
    );
    expect(readable).toEqual([]);
  });
});
