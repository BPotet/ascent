// Les trois ennemis du Beffroi (#214), recopiés de l'Atelier par la conversation (ADR 0010, avenant
// #214) : sans maquette à laquelle les comparer, la fidélité de la copie repose sur ses empreintes
// (sha256 du JSON canonique de chaque partie recopiée, la règle de `json.dumps(sort_keys=True,
// separators=(',', ':'), ensure_ascii=False)`), recalculées ici, et sur une seconde lecture de
// l'Atelier à la revue. La cohérence structurelle attrape les fautes de forme.
import { createHash } from 'node:crypto';

import { artPalette } from '../../artPalette';
import { ENEMY_FRAMES } from '../battle/battleCharacters';
import { BELL_NOVICE_ANIMATION } from './data/bellNovice';
import { CLOCK_JACK_ANIMATION } from './data/clockJack';
import { MATINS_RINGER_ANIMATION } from './data/matinsRinger';
import { MOTHKIN_ANIMATION } from './data/mothkin';
import { animationSprite, battleCell, type FullAnimation } from './fullAnimation';

/** Le JSON canonique : clés triées à tous les niveaux, sans espaces, caractères non ASCII tels quels. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([, each]) => each !== undefined,
    );
    return `{${entries
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, each]) => `${JSON.stringify(key)}:${canonicalJson(each)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

const sha256 = (value: unknown) =>
  createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');

/** Chaque ennemi : son animation, l'empreinte de la copie, sa case, ses poses en plus et ses poses d'un coup. */
const ENTRIES = [
  [
    'bellNovice',
    BELL_NOVICE_ANIMATION,
    '72133f8383841ada6a86e372ce05dcc8d4c9c02dec3219b7d00cae79552e67cf',
    [44, 52],
    [],
    { delayed: 'Volée manquée' },
  ],
  [
    'matinsRinger',
    MATINS_RINGER_ANIMATION,
    'edb7f08351db6df792c23166a3efe6b49d2c0c76c219ab741638d8003f2f746e',
    [44, 52],
    ['guard', 'raiseAlly'],
    {},
  ],
  [
    'clockJack',
    CLOCK_JACK_ANIMATION,
    '5949bb247aae067f825ecade78be8899e8aa3e32ef677445f484944a1d5d689b',
    [48, 54],
    [],
    { perilous: 'Heure pleine' },
  ],
] as const;

/** Les poses propres d'un coup, lues dans l'Atelier (story #214, « Données de l'Atelier »). */
const ATTACK_POSE_FRAMES: Readonly<Record<string, readonly string[]>> = {
  delayed: ['ant0', 'ant1', 'ant2', 'hes', 'impact', 'lunge'],
  perilous: ['ant0', 'ant1', 'ant2', 'impact', 'lunge', 'rec0'],
};

const codeOf = (tint: string) =>
  artPalette.tints.findIndex((known) => known?.toLowerCase() === tint.toLowerCase());

/** Des poses de `w` × `h` en caractères de la palette, une ancre par pose. */
function expectPoses(
  full: FullAnimation,
  frames: Readonly<Partial<Record<string, readonly string[]>>>,
  anchors: Readonly<Partial<Record<string, unknown>>>,
): void {
  expect(Object.keys(anchors).sort()).toEqual(Object.keys(frames).sort());
  for (const [pose, rows] of Object.entries(frames)) {
    expect([pose, rows!.length]).toEqual([pose, full.h]);
    for (const row of rows!) {
      expect([pose, row.length]).toEqual([pose, full.w]);
      expect(row).toMatch(/^[.0-9a-z]*$/);
      for (const char of row.replaceAll('.', '')) {
        expect(parseInt(char, 36)).toBeLessThan(full.pal.length);
      }
    }
  }
}

describe('the canonical JSON of the copies (#214)', () => {
  it('gives the bytes of json.dumps on an animation already copied: the Mothkin', () => {
    // Calculée par Python sur la même animation, avant de figer les empreintes de #214.
    expect(sha256(MOTHKIN_ANIMATION)).toBe(
      '620c92503486fbe2e82ad1ab593ac3cd744778293ae9e810d96fe7be95d7dc51',
    );
  });

  it('keeps the characters that are not ASCII, and escapes nothing else', () => {
    expect(canonicalJson({ b: [1, 'Volée'], a: { d: null, c: "l'heure" } })).toBe(
      '{"a":{"c":"l\'heure","d":null},"b":[1,"Volée"]}',
    );
  });
});

describe.each(ENTRIES)(
  'the full animation of %s (#214)',
  (_, animation, fingerprint, size, extra, moves) => {
    const full: FullAnimation = animation;

    it('is the copy of the Atelier: the sha256 of the key animation', () => {
      expect(sha256(full)).toBe(fingerprint);
    });

    it('has its size and its battle cell', () => {
      expect([full.w, full.h]).toEqual(size);
      expect(battleCell(full)).toEqual(size);
    });

    it('has the 17 poses of the battle and its extra poses, of h lines of w characters', () => {
      expect(Object.keys(full.frames).sort()).toEqual([...ENEMY_FRAMES, ...extra].sort());
      expectPoses(full, full.frames, full.anchors);
    });

    it('has its tints in the art palette, and a red palette only with a perilous attack', () => {
      for (const tint of [...full.pal, ...(full.red ?? [])]) {
        expect([tint, codeOf(tint) > 0]).toEqual([tint, true]);
      }
      expect(full.red?.length).toBe('perilous' in moves ? full.pal.length : undefined);
    });

    it('has the poses of its moves, with their names', () => {
      const attackPoses = full.attackPoses ?? {};
      expect(
        Object.fromEntries(Object.entries(attackPoses).map(([kind, poses]) => [kind, poses!.move])),
      ).toEqual(moves);
      for (const [kind, poses] of Object.entries(attackPoses)) {
        expect(Object.keys(poses!.frames).sort()).toEqual(ATTACK_POSE_FRAMES[kind]);
        expectPoses(full, poses!.frames, poses!.anchors);
      }
    });

    it('paints every pose of its own in its cell, extra poses included', () => {
      for (const pose of Object.keys(full.frames)) {
        expect(animationSprite(full, pose).sprite.height).toBe(battleCell(full)[1]);
      }
    });

    it('copies the keys of the animation only, neither the icon nor the proposals', () => {
      expect(Object.keys(full).sort()).toEqual(
        ['w', 'h', 'pal', 'frames', 'anchors', 'red', 'attackPoses']
          .filter((key) => key in full)
          .sort(),
      );
      expect(Object.keys(full)).not.toContain('icon');
      expect(Object.keys(full)).not.toContain('proposals');
    });
  },
);
