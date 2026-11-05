// L'aspect de phase 2 et les poses en plus d'une animation complète (#38, avenant à l'ADR 0010) :
// lus sur une petite animation de test, à la taille d'une case de 2 × 2 pixels d'art.
import {
  animationSprite,
  tintCode,
  type AnimationAnchors,
  type FullAnimation,
} from './fullAnimation';

const anchors = (x: number): AnimationAnchors => ({ eye: [x, 0], head: [x, 1], tips: [[x, 0]] });

/** Une animation de 2 × 2 : `idle0`, `hurt`, une pose en plus `rise0`, et son aspect de phase 2. */
const ANIMATION: FullAnimation<'idle0' | 'hurt'> = {
  w: 2,
  h: 2,
  pal: ['#06070C', '#10131F', '#1C2133'],
  red: ['#06070C', '#8A1E2A', '#FF3B3B'],
  frames: { idle0: ['0.', '..'], hurt: ['.0', '..'], rise0: ['..', '1.'] },
  anchors: { idle0: anchors(0), hurt: anchors(1), rise0: anchors(0) },
  attackPoses: {
    basic: { move: 'Coup', frames: { hurt: ['..', '.0'] }, anchors: { hurt: anchors(1) } },
  },
  phase2: {
    frames: { idle0: ['1.', '..'], hurt: ['.1', '..'] },
    anchors: { idle0: anchors(1), hurt: anchors(0) },
    attackPoses: {
      basic: { move: 'Coup', frames: { idle0: ['22', '..'] }, anchors: { idle0: anchors(1) } },
    },
  },
};

const pixels = (rows: readonly string[]) => rows.join('');
/** Les pixels du sprite, `.` pour transparent, sinon l'indice de la teinte dans `palette`. */
function painted(
  sprite: { readonly pixels: Uint8Array },
  palette: readonly string[],
  codeOf: (tint: string) => number,
): string {
  const codes = palette.map(codeOf);
  return Array.from(sprite.pixels, (code) => (code === 0 ? '.' : String(codes.indexOf(code)))).join(
    '',
  );
}

describe('the phase 2 aspect of a full animation (#38)', () => {
  it('takes the poses and the anchors of the phase 2 aspect', () => {
    const { sprite, anchors: shown } = animationSprite(ANIMATION, 'idle0', [2, 2], {
      phase2: true,
    });

    expect(painted(sprite, ANIMATION.pal, tintCode)).toBe(pixels(['1.', '..']));
    expect(shown).toEqual(anchors(1));
  });

  it('keeps the poses of phase 1 without the phase 2 aspect asked', () => {
    const { sprite, anchors: shown } = animationSprite(ANIMATION, 'idle0', [2, 2]);

    expect(painted(sprite, ANIMATION.pal, tintCode)).toBe(pixels(['0.', '..']));
    expect(shown).toEqual(anchors(0));
  });

  it('takes a pose of an attack from the attack poses of phase 2', () => {
    const { sprite, anchors: shown } = animationSprite(ANIMATION, 'idle0', [2, 2], {
      phase2: true,
      attack: 'basic',
    });

    expect(painted(sprite, ANIMATION.pal, tintCode)).toBe(pixels(['22', '..']));
    expect(shown).toEqual(anchors(1));
  });

  it('takes a pose absent from the attack poses of phase 2 from the phase 2 aspect, never phase 1', () => {
    const { sprite, anchors: shown } = animationSprite(ANIMATION, 'hurt', [2, 2], {
      phase2: true,
      attack: 'basic',
    });

    expect(painted(sprite, ANIMATION.pal, tintCode)).toBe(pixels(['.1', '..']));
    expect(shown).toEqual(anchors(0));
  });

  it('paints the phase 2 aspect with the red palette of the entity', () => {
    const { sprite } = animationSprite(ANIMATION, 'idle0', [2, 2], { phase2: true, red: true });

    expect(painted(sprite, ANIMATION.red!, tintCode)).toBe(pixels(['1.', '..']));
  });

  it('keeps the poses of phase 1 for an entity without a phase 2 aspect', () => {
    const { phase2: _, ...withoutPhase2 } = ANIMATION;

    const { sprite } = animationSprite(withoutPhase2, 'idle0', [2, 2], { phase2: true });

    expect(painted(sprite, ANIMATION.pal, tintCode)).toBe(pixels(['0.', '..']));
  });

  it('refuses a pose the phase 2 aspect does not have', () => {
    expect(() => animationSprite(ANIMATION, 'rise0', [2, 2], { phase2: true })).toThrow(
      'The animation has no pose rise0',
    );
  });
});

describe('the extra poses of a full animation (#38)', () => {
  it('copies an extra pose the entity has, with its anchors', () => {
    const { sprite, anchors: shown } = animationSprite(ANIMATION, 'rise0', [2, 2]);

    expect(painted(sprite, ANIMATION.pal, tintCode)).toBe(pixels(['..', '1.']));
    expect(shown).toEqual(anchors(0));
  });

  it('refuses an extra pose the entity does not have, by its name', () => {
    expect(() => animationSprite(ANIMATION, 'guard', [2, 2])).toThrow(
      'The animation has no pose guard',
    );
  });

  it('refuses a pose without its anchors, by its name', () => {
    const withoutAnchors = { ...ANIMATION, anchors: { idle0: anchors(0), hurt: anchors(1) } };

    expect(() => animationSprite(withoutAnchors, 'rise0', [2, 2])).toThrow(
      'The animation has no anchors for the pose rise0',
    );
  });
});
