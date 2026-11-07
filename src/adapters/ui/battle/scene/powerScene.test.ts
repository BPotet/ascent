// Les pouvoirs de #235 sur la scène (maquette 232, K12, notes UX) : le halo d'or de Tenir bon, le
// voile de Brume, l'éclat d'or de Représailles sur la contre-attaque existante. Aucune pose
// nouvelle : tout est dessiné en code.
import {
  HOLD_FAST_HALO_MS,
  MIST_VEIL_OPACITY,
  holdFastHalo,
  mistVeilOpacity,
  retaliationBurst,
} from './powerScene';
import { riposteBurst } from './sceneEffects';

describe('the powers on the scene (#235)', () => {
  it('shows no halo without a heal, before it or after its 900 ms', () => {
    const none = { halo: 0, haloScale: 1 };

    expect(holdFastHalo(null, 1_000, false)).toEqual(none);
    expect(holdFastHalo(1_000, 999, false)).toEqual(none);
    expect(holdFastHalo(1_000, 1_000 + HOLD_FAST_HALO_MS, false)).toEqual(none);
  });

  it('grows the golden halo of Hold Fast in 6 steps, like the second chance (K12)', () => {
    expect(holdFastHalo(1_000, 1_000, false)).toEqual({ halo: 0, haloScale: 0.5 });
    const middle = holdFastHalo(1_000, 1_000 + 3 * 150, false);
    expect(middle.halo).toBeCloseTo(0.83, 2);
    expect(middle.haloScale).toBeCloseTo(0.75, 5);
    expect(holdFastHalo(1_000, 1_000 + HOLD_FAST_HALO_MS - 1, false).halo).toBeCloseTo(0.88, 2);
  });

  it('does not grow the halo with reduced motion', () => {
    expect(holdFastHalo(1_000, 1_000 + 3 * 150, true).haloScale).toBe(1);
  });

  it('veils the Wanderer while the Mist is active', () => {
    expect(mistVeilOpacity(true)).toBe(MIST_VEIL_OPACITY);
    expect(MIST_VEIL_OPACITY).toBeGreaterThan(0);
    expect(mistVeilOpacity(false)).toBe(0);
  });

  it('bursts in gold on the enemy hit by a counter of Retaliation, like the riposte', () => {
    const counter = { at: 2_000, enemy: 1 };

    expect(retaliationBurst(null, 2_000, false)).toEqual([]);
    expect(retaliationBurst(counter, 2_100, false)).toEqual(riposteBurst(counter, 2_100, false));
    expect(retaliationBurst(counter, 2_100, false).length).toBeGreaterThan(0);
  });
});
