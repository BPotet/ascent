// La sortie de terre du Squelette exhumé (#258, maquette 245, F2, F3) : le tas d'os à l'action du
// Fossoyeur (400 ms), puis le Squelette qui monte de 16 dp (600 ms), découpé au sol ; en mouvement
// réduit, 4 dp et un fondu. La poussière d'os s'élève sous lui. Fonctions pures, lues sur le fil UI.
import { EXHUME_PILE_MS, EXHUME_RISE_MS, exhumeDustFrame, exhumeLook } from './exhumeRise';

const AT = 10_000;

describe('the Skeleton that comes out of the ground (#258, F2, F3)', () => {
  it('lasts 400 ms of bone pile, then 600 ms of rise', () => {
    expect([EXHUME_PILE_MS, EXHUME_RISE_MS]).toEqual([400, 600]);
  });

  it('shows the bone pile at the action: the pose down, at 70 %, on the ground', () => {
    expect(exhumeLook(AT, AT + 10, false)).toEqual({ frame: 'down', opacity: 0.7, sink: 0 });
    expect(exhumeLook(AT, AT + 399, false)).toEqual({ frame: 'down', opacity: 0.7, sink: 0 });
  });

  it('then rises from 16 dp under the ground to its place, standing', () => {
    expect(exhumeLook(AT, AT + 400, false)).toEqual({ frame: 'idle0', opacity: 1, sink: 16 });
    expect(exhumeLook(AT, AT + 700, false)).toEqual({ frame: 'idle0', opacity: 1, sink: 8 });
    expect(exhumeLook(AT, AT + 1_000, false)).toBeNull();
  });

  it('rises by 4 dp only, mostly fading in, with reduced motion', () => {
    expect(exhumeLook(AT, AT + 400, true)).toEqual({ frame: 'idle0', opacity: 0, sink: 4 });
    expect(exhumeLook(AT, AT + 700, true)).toEqual({ frame: 'idle0', opacity: 0.5, sink: 2 });
    expect(exhumeLook(AT, AT + 1_000, true)).toBeNull();
  });

  it('changes nothing before the action, or without an exhumation', () => {
    expect(exhumeLook(AT, AT - 1, false)).toBeNull();
    expect(exhumeLook(null, AT, false)).toBeNull();
  });

  it('raises the bone dust: 2 images on the pile, 2 at the rise, none after', () => {
    expect(
      [0, 200, 400, 600, 800].map((offset) => exhumeDustFrame(AT, AT + offset, false)),
    ).toEqual([0, 1, 2, 3, null]);
    expect(exhumeDustFrame(null, AT, false)).toBeNull();
  });

  it('holds one image of dust on the pile with reduced motion, none at the rise', () => {
    expect([0, 300, 500].map((offset) => exhumeDustFrame(AT, AT + offset, true))).toEqual([
      1,
      1,
      null,
    ]);
  });
});
