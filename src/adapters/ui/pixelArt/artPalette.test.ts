import { artPalette } from './artPalette';

/** La luminance relative d'une couleur `#RRGGBB` (WCAG 2.1). */
function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Le rapport de contraste de deux couleurs (WCAG 2.1). */
function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

describe('artPalette', () => {
  const { roles, tints } = artPalette;

  it('keeps the tints of the tower prototype, 0 being transparent', () => {
    expect(tints).toHaveLength(42);
    expect(tints[0]).toBeNull();
    expect(tints[1]).toBe('#06070C');
    expect(tints[8]).toBe('#F2D49B');
    expect(tints[30]).toBe('#FF8E8E');
    // La palette rouge du Chevalier déchu et du Prieur sans visage (#138), ajoutée en fin.
    expect(tints[31]).toBe('#5A1420');
    tints.slice(1).forEach((tint) => expect(tint).toMatch(/^#[0-9A-F]{6}$/));
  });

  it('keeps the code of every tint, the tints of the Sentinel 2.5D (#140) added at the end', () => {
    expect(tints.slice(1, 32)).toEqual([
      '#06070C',
      '#10131F',
      '#1C2133',
      '#2A3150',
      '#3E4870',
      '#6B5A7A',
      '#B98E5A',
      '#F2D49B',
      '#FFF3D6',
      '#8C93A8',
      '#D9DCE6',
      '#3E4639',
      '#646D58',
      '#949B7E',
      '#252B48',
      '#47527A',
      '#8995BE',
      '#2A1F36',
      '#4A3660',
      '#BFE6DA',
      '#5B4636',
      '#FF3B3B',
      '#8A1E2A',
      '#E0607A',
      '#FFD0D8',
      '#2C3D6B',
      '#4B63A0',
      '#C9C2B0',
      '#B32E3C',
      '#FF8E8E',
      '#5A1420',
    ]);
    expect(tints.slice(32, 38)).toEqual([
      '#8A6A42',
      '#B4B9C8',
      '#646B80',
      '#222C52',
      '#3B5089',
      '#323A62',
    ]);
  });

  it('adds the 4 tints of the 16 × 16 icons at the end, without moving the other codes (#157)', () => {
    const icons = ['#DEE0E7', '#C3C7D3', '#EEA8B6', '#F8E7C8'];
    expect(tints.slice(-icons.length)).toEqual(icons);
    expect(tints.slice(0, -icons.length)).not.toEqual(expect.arrayContaining(icons));
  });

  it('gives the interface roles of the mockup', () => {
    expect(roles).toMatchObject({
      ink: '#06070C',
      night: '#10131F',
      surface: '#1C2133',
      raised: '#2A3150',
      line: '#3E4870',
      goldDark: '#B98E5A',
      gold: '#F2D49B',
      light: '#FFF3D6',
      muted: '#8C93A8',
      parchment: '#C9C2B0',
      done: '#6FD3A0',
      error: '#FF8E8E',
    });
  });

  it('gives the silver of the Bulwark, never without its shield (#128)', () => {
    expect([roles.bulwark, roles.bulwarkText]).toEqual(['#D9DCE6', '#E6EAF2']);
  });

  it('gives the rarities and the icon well of the mockup #153 (#157)', () => {
    expect([roles.rarityCommon, roles.rarityRare, roles.rarityEpic, roles.well]).toEqual([
      '#C3C7D3',
      '#7C9CFF',
      '#C49BFF',
      '#0B0D18',
    ]);
  });

  it('gives the darker background of a chip in a frame, from the mockup #153 (#159)', () => {
    expect(roles.sunken).toBe('#141829');
  });

  it.each([
    ['common', roles.rarityCommon],
    ['rare', roles.rarityRare],
    ['epic', roles.rarityEpic],
  ])('gives the %s rarity a contrast of at least 6.1:1 on the surface (#157)', (_, rarity) => {
    expect(contrast(rarity, roles.surface)).toBeGreaterThanOrEqual(6.1);
  });

  it.each([
    ['common', roles.rarityCommon],
    ['rare', roles.rarityRare],
    ['epic', roles.rarityEpic],
    ['main text', roles.light],
  ])('gives the %s a contrast of at least 4.5:1 on a chip in a frame (#159)', (_, text) => {
    expect(contrast(text, roles.sunken)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ['the Bulwark chip', roles.bulwarkText, roles.raised, 10.5],
    ['main text', roles.light, roles.surface, 14.5],
    ['secondary text', roles.parchment, roles.surface, 9.0],
    ['discreet text on the surface', roles.muted, roles.surface, 5.2],
    ['discreet text on the night', roles.muted, roles.night, 6.0],
    ['gold (Xp, active tab)', roles.gold, roles.surface, 11.2],
    ['ink on a gold button', roles.ink, roles.gold, 14.1],
    ['« Fait »', roles.done, roles.surface, 8.9],
    ['error', roles.error, roles.surface, 7.2],
    ['« pas fait » cross', roles.muted, roles.missedBg, 5.1],
  ])('gives the %s a contrast of at least 4.5:1, as documented', (_, text, background, ratio) => {
    const measured = contrast(text, background);
    expect(measured).toBeGreaterThanOrEqual(4.5);
    expect(measured).toBeCloseTo(ratio, 0);
  });

  it.each([
    ['« fait » box', roles.done, roles.surface],
    ['« à faire » box', roles.gold, roles.night],
  ])('gives the line of the %s a contrast of at least 3:1', (_, line, background) => {
    expect(contrast(line, background)).toBeGreaterThanOrEqual(3);
  });
});
