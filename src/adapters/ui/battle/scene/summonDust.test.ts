// La poussière de l'Invocation sur la scène (#172, maquette 170, I2, I3, I5, planche de l'effet) :
// l'effet `summon` image par image, l'apparition et la chute des Phalénides, le mouvement réduit,
// et la disposition du boss qui invoque.
import { sceneGeometry } from './sceneGeometry';
import { summonDustFrame, summonedOpacity, type SceneSummon } from './summonDust';

const NONE: SceneSummon = { pending: [], calledAt: null, entered: {}, fell: {} };
const announced: SceneSummon = { ...NONE, pending: [1, 2], calledAt: 1_000 };
const resumed: SceneSummon = { ...NONE, pending: [1, 2] };
const out: SceneSummon = { ...NONE, entered: { 1: 5_000 } };
const fallen: SceneSummon = { ...NONE, entered: { 1: 5_000 }, fell: { 1: 9_000 } };

const frames = (summon: SceneSummon, times: readonly number[], reduced = false) =>
  times.map((now) => summonDustFrame(summon, 1, now, reduced));

describe('the dust of the Summon (#172)', () => {
  it('raises nothing without a summon', () => {
    expect(frames(NONE, [0, 1_000, 5_000])).toEqual([null, null, null]);
  });

  it('plays images 1 and 2, 160 ms each, at the announcement, then holds image 2', () => {
    expect(frames(announced, [1_000, 1_159, 1_160, 4_000])).toEqual([0, 0, 1, 1]);
  });

  it('holds image 2 from the start in a resumed battle, without the announcement', () => {
    expect(frames(resumed, [0, 50_000])).toEqual([1, 1]);
  });

  it('holds image 2 on its slot only', () => {
    expect(summonDustFrame(announced, 0, 2_000, false)).toBeNull();
  });

  it('plays images 3 and 4, 200 ms each, at the entry, then lets the Mothkin stand', () => {
    expect(frames(out, [4_999, 5_000, 5_199, 5_200, 5_399, 5_400])).toEqual([1, 2, 2, 3, 3, null]);
  });

  it('plays the effect backwards 300 ms after the fall of the Queen: images 4, 3, 2', () => {
    expect(frames(fallen, [9_000, 9_299, 9_300, 9_460, 9_620, 9_779, 9_780])).toEqual([
      null,
      null,
      3,
      2,
      1,
      1,
      null,
    ]);
  });

  it('holds image 2 only, with reduced motion, until the entry', () => {
    expect(frames(announced, [1_000, 1_200], true)).toEqual([1, 1]);
    expect(frames(out, [4_999, 5_000, 5_200], true)).toEqual([1, null, null]);
    expect(frames(fallen, [9_300, 9_500], true)).toEqual([null, null]);
  });
});

describe('the Mothkin coming out of the dust and falling back into it (#172)', () => {
  const opacity = (summon: SceneSummon, times: readonly number[], reduced = false) =>
    times.map((now) => summonedOpacity(summon, 1, now, reduced));

  it('keeps an enemy that was not summoned in view', () => {
    expect(opacity(NONE, [0, 9_999])).toEqual([1, 1]);
  });

  it('shows the Mothkin once images 3 and 4 are played', () => {
    expect(opacity(out, [4_999, 5_000, 5_399, 5_400])).toEqual([0, 0, 0, 1]);
  });

  it('hides the Mothkin 300 ms after the fall of the Queen, for good', () => {
    expect(opacity(fallen, [9_000, 9_299, 9_300, 20_000])).toEqual([1, 1, 0, 0]);
  });

  it('fades the Mothkin in over 300 ms and out over 400 ms with reduced motion', () => {
    expect(opacity(out, [4_999, 5_000, 5_150, 5_300], true)).toEqual([0, 0, 0.5, 1]);
    expect(opacity(fallen, [9_000, 9_200, 9_400], true)).toEqual([1, 0.5, 0]);
  });
});

describe('the layout of a boss that summons (#172, maquette « boss3 »)', () => {
  it.each([360, 412])(
    'gives the Queen a column of 1.25 and each Mothkin at least 104 dp at %i dp',
    (width) => {
      const { enemies } = sceneGeometry(width, 440, 3, { summoner: true });
      const [queen, first, second] = enemies.map((slot) => slot.column.width);

      expect(first).toBeGreaterThanOrEqual(104);
      expect(second).toBe(first);
      expect(queen).toBe(Math.floor(first! * 1.25));
      expect(enemies[2]!.column.x + second!).toBeLessThanOrEqual(width);
    },
  );

  it('puts the Queen highest and the Mothkin lower, from left to right', () => {
    const { enemies } = sceneGeometry(412, 440, 3, { summoner: true });

    expect(enemies.map((slot) => slot.column.y - enemies[0]!.column.y)).toEqual([0, 22, 40]);
    expect(enemies[0]!.column.x).toBe(Math.round(412 * 0.04));
  });

  it('keeps the layout of an ordinary battle of three', () => {
    expect(sceneGeometry(412, 440, 3, { summoner: false })).toEqual(sceneGeometry(412, 440, 3));
    expect(sceneGeometry(412, 440, 1, { summoner: true })).toEqual(sceneGeometry(412, 440, 1));
  });
});
