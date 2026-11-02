// La place du fond de palier à l'écran (#176) : rempli en hauteur, centré, à un nombre entier de
// pixels physiques par pixel d'art (ADR 0007 § 3).
import { backdropPlacement } from './backdropPlacement';

describe('backdropPlacement', () => {
  it('fills the height of a 390 × 844 screen at ×3 with 16 physical pixels per art pixel', () => {
    const placement = backdropPlacement({ width: 390, height: 844 }, 3);
    expect(placement.artPixel).toBeCloseTo(16 / 3, 10);
    expect(placement.width).toBeCloseTo(512, 10);
    expect(placement.height).toBeCloseTo(853 + 1 / 3, 10);
    expect(placement.x).toBeCloseTo(-61, 10);
    expect(placement.y).toBeCloseTo(-14 / 3, 10);
  });

  it('shows about 73 of the 96 art pixels across a 390 dp screen', () => {
    const { artPixel } = backdropPlacement({ width: 390, height: 844 }, 3);
    expect(Math.round(390 / artPixel)).toBe(73);
  });

  it('keeps a whole number of physical pixels per art pixel, covering the whole height (360 × 800 at ×2.625)', () => {
    const ratio = 2.625;
    const placement = backdropPlacement({ width: 360, height: 800 }, ratio);
    const physical = placement.artPixel * ratio;
    expect(physical).toBeCloseTo(Math.round(physical), 10);
    expect(Math.round(physical)).toBe(14);
    expect(placement.y).toBeLessThanOrEqual(0);
    expect(placement.y + placement.height).toBeGreaterThanOrEqual(800);
    // Le surplus est rogné à parts égales en haut et en bas.
    expect(-placement.y).toBeCloseTo(placement.y + placement.height - 800, 10);
    expect(placement.x + placement.width / 2).toBeCloseTo(180, 10);
  });

  it('never rounds down, so that the backdrop always covers the height', () => {
    // 160 art pixels at exactly 4 physical pixels: no surplus at all.
    const exact = backdropPlacement({ width: 300, height: 320 }, 2);
    expect(exact.artPixel).toBe(2);
    expect(exact.y).toBe(0);
    const above = backdropPlacement({ width: 300, height: 321 }, 2);
    expect(above.artPixel).toBe(2.5);
  });

  it('centres the backdrop on a screen wider than it, the night showing on the sides', () => {
    const placement = backdropPlacement({ width: 1024, height: 768 }, 2);
    expect(placement.width).toBeLessThan(1024);
    expect(placement.x).toBeGreaterThan(0);
    expect(placement.x + placement.width / 2).toBeCloseTo(512, 10);
  });
});
