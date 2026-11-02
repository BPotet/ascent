// La Brûlure sur la scène (#171, maquette 170, B1 à B7 et la planche de l'effet) : une flamme par
// charge aux places de l'effet, les flammes allumées une à une, l'éclat de braise, la fumée.
import { BURN_EFFECT } from '../../pixelArt/sprites/atelier/data/burn';
import type { SceneBurn } from '../sceneTypes';
import { burnFlames, burnHitFrame } from './burnFlames';

const SLOTS = BURN_EFFECT.effects.burn.slots;
/** Le centre d'une flamme de 8 × 11 posée à sa place, en pixels d'art de la case du héros. */
const center = (slot: number) => [SLOTS[slot]![0] + 4.5, SLOTS[slot]![1] + 5.5];

const burning = (stacks: number, change: Partial<SceneBurn> = {}): SceneBurn => ({
  stacks,
  lit: null,
  ticked: null,
  out: null,
  ...change,
});

describe('the flames of the Burn on the hero (#171)', () => {
  it('draws nothing without Burn', () => {
    expect(burnFlames(burning(0), 1_000, false)).toEqual([]);
    expect(burnFlames(null, 1_000, false)).toEqual([]);
  });

  it('draws one flame per stack, at the places of the effect, the first stack at the first place', () => {
    const flames = burnFlames(burning(3), 0, false);

    expect(flames.map(({ effect }) => effect)).toEqual(['burn', 'burn', 'burn']);
    expect(flames.map(({ x, y }) => [x, y])).toEqual([center(0), center(1), center(2)]);
    expect(burnFlames(burning(5), 0, false).map(({ x, y }) => [x, y])).toEqual(
      [0, 1, 2, 3, 4].map(center),
    );
  });

  it('loops each flame over its 3 images at 150 ms, each flame 50 ms behind the previous one', () => {
    const framesAt = (now: number) => burnFlames(burning(3), now, false).map(({ frame }) => frame);

    expect(framesAt(0)).toEqual([0, 2, 2]);
    expect(framesAt(150)).toEqual([1, 0, 0]);
    expect(framesAt(200)).toEqual([1, 1, 0]);
    expect(framesAt(450)).toEqual([0, 2, 2]);
  });

  it('keeps the flames still on their first image with reduced motion', () => {
    expect(burnFlames(burning(3), 275, true).map(({ frame }) => frame)).toEqual([0, 0, 0]);
  });

  it('lights the new flames one by one, 80 ms apart, after the ember burst of the blow', () => {
    const lit = burning(3, { lit: { at: 1_000, from: 1 } });
    const count = (now: number) => burnFlames(lit, now, false).length;

    expect([1_000, 1_079, 1_080, 1_159, 1_160].map(count)).toEqual([1, 1, 2, 2, 3]);
  });

  it('grows the flames with the crackle: their 2nd image held 300 ms (B5)', () => {
    const ticked = burning(3, { ticked: 1_000 });
    const framesAt = (now: number) => burnFlames(ticked, now, false).map(({ frame }) => frame);

    expect(framesAt(1_000)).toEqual([1, 1, 1]);
    expect(framesAt(1_299)).toEqual([1, 1, 1]);
    expect(framesAt(1_300)).toEqual(burnFlames(burning(3), 1_300, false).map(({ frame }) => frame));
    expect(framesAt(999)).toEqual(burnFlames(burning(3), 999, false).map(({ frame }) => frame));
  });

  it('never grows the flames with reduced motion', () => {
    expect(
      burnFlames(burning(3, { ticked: 1_000 }), 1_100, true).map(({ frame }) => frame),
    ).toEqual([0, 0, 0]);
  });

  it('plays the ember burst of a burning blow on 2 images of 100 ms, even at 5 stacks', () => {
    const lit = { at: 1_000, from: 5 };

    expect([999, 1_000, 1_099, 1_100, 1_199, 1_200].map((now) => burnHitFrame(lit, now))).toEqual([
      null,
      0,
      0,
      1,
      1,
      null,
    ]);
    expect(burnHitFrame(null, 1_000)).toBeNull();
  });

  it('turns the flame going out into grey smoke, 3 images of 120 ms, at its place', () => {
    const out = burning(1, { out: { at: 2_000, slots: [1] } });
    const smoke = (now: number) =>
      burnFlames(out, now, false).filter(({ effect }) => effect !== 'burn');

    // Avant la fumée, la flamme brûle encore à sa place.
    expect(burnFlames(out, 1_990, false)).toHaveLength(2);
    expect(smoke(2_000)).toEqual([
      { effect: 'burnOut', frame: 0, x: center(1)[0], y: center(1)[1] },
    ]);
    expect([2_119, 2_120, 2_240, 2_359].map((now) => smoke(now)[0]?.frame)).toEqual([0, 1, 2, 2]);
    expect(smoke(2_360)).toEqual([]);
    expect(burnFlames(out, 2_360, false)).toHaveLength(1);
  });

  it('goes straight to the small smoke for 250 ms with reduced motion', () => {
    const out = burning(0, { out: { at: 2_000, slots: [0] } });

    expect([2_000, 2_249].map((now) => burnFlames(out, now, true)[0]?.frame)).toEqual([2, 2]);
    expect(burnFlames(out, 2_250, true)).toEqual([]);
  });

  it('puts out every flame together at the end of the battle', () => {
    const cleared = burning(0, { out: { at: 3_000, slots: [0, 1, 2] } });

    expect(burnFlames(cleared, 3_000, false)).toEqual(
      [0, 1, 2].map((slot) => ({
        effect: 'burnOut',
        frame: 0,
        x: center(slot)[0],
        y: center(slot)[1],
      })),
    );
  });

  it('never draws smoke on a place lit again', () => {
    const relit = burning(2, { out: { at: 2_000, slots: [1] } });

    expect(burnFlames(relit, 2_000, false).map(({ effect }) => effect)).toEqual(['burn', 'burn']);
  });
});
