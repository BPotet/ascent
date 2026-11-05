// Les porteurs de la Brûlure et l'effet de la Brûlure, recopiés de l'Atelier le 01/11/2026 (#171,
// ADR 0010) : leur taille, leurs poses, leurs palettes, leurs poses d'un coup, et les séquences de
// l'effet.
import { artPalette } from '../../artPalette';
import { ENEMY_FRAMES } from '../battle/battleCharacters';
import { BELL_FOUNDER_ANIMATION } from './data/bellFounder';
import { BRAMBLE_BURNER_ANIMATION } from './data/brambleBurner';
import { BURN_EFFECT } from './data/burn';
import { BURNING_HUSK_ANIMATION } from './data/burningHusk';
import { GARGOYLE_ANIMATION } from './data/gargoyle';
import { animationSprite, battleCell, type FullAnimation } from './fullAnimation';

/** Chaque entrée : sa taille, ses types de coup qui ont des poses d'un coup, sa palette rouge. */
const ENTRIES = [
  ['burningHusk', BURNING_HUSK_ANIMATION, [44, 52], ['basic', 'perilous'], true],
  ['gargoyle', GARGOYLE_ANIMATION, [44, 52], ['delayed', 'feint'], false],
  ['bellFounder', BELL_FOUNDER_ANIMATION, [44, 52], ['delayed', 'double'], false],
  [
    'brambleBurner',
    BRAMBLE_BURNER_ANIMATION,
    [44, 54],
    ['basic', 'delayedPerilous', 'double'],
    true,
  ],
] as const;

const codeOf = (tint: string) =>
  artPalette.tints.findIndex((known) => known?.toLowerCase() === tint.toLowerCase());

function expectRows(rows: readonly string[], w: number, h: number, tints: number): void {
  expect(rows).toHaveLength(h);
  for (const row of rows) {
    expect(row).toHaveLength(w);
    expect(row).toMatch(/^[.0-9a-z]*$/);
    for (const char of row.replaceAll('.', '')) expect(parseInt(char, 36)).toBeLessThan(tints);
  }
}

describe.each(ENTRIES)('the full animation of %s (#171)', (_, animation, size, kinds, red) => {
  const full: FullAnimation = animation;

  it('has its size, and a battle cell at least 44 × 52', () => {
    expect([full.w, full.h]).toEqual(size);
    expect(battleCell(full)).toEqual([44, Math.max(52, size[1])]);
  });

  it('has the 17 poses of the battle, of h lines of w characters, one anchor each', () => {
    expect(Object.keys(full.frames).sort()).toEqual([...ENEMY_FRAMES].sort());
    expect(Object.keys(full.anchors).sort()).toEqual([...ENEMY_FRAMES].sort());
    for (const rows of Object.values(full.frames))
      expectRows(rows, full.w, full.h, full.pal.length);
  });

  it('has its tints in the art palette, and a red palette only with a perilous attack', () => {
    for (const tint of [...full.pal, ...(full.red ?? [])]) {
      expect([tint, codeOf(tint) > 0]).toEqual([tint, true]);
    }
    expect(full.red?.length).toBe(red ? full.pal.length : undefined);
  });

  it('has its attack poses, one move per attack kind, at its size', () => {
    expect(Object.keys(full.attackPoses ?? {}).sort()).toEqual([...kinds].sort());
    for (const poses of Object.values(full.attackPoses ?? {})) {
      expect(typeof poses!.move).toBe('string');
      expect(Object.keys(poses!.anchors).sort()).toEqual(Object.keys(poses!.frames).sort());
      for (const [pose, rows] of Object.entries(poses!.frames)) {
        expect(ENEMY_FRAMES).toContain(pose);
        expectRows(rows!, full.w, full.h, full.pal.length);
      }
    }
  });

  it('paints every pose in its cell', () => {
    for (const pose of Object.keys(full.frames)) {
      expect(animationSprite(full, pose).sprite.height).toBe(battleCell(full)[1]);
    }
  });

  it('copies no icon', () => {
    expect(Object.keys(full)).not.toContain('icon');
  });
});

describe('the attack poses of the Bell founder (#171)', () => {
  it('lifts the lunge of the Pour by 9 art pixels, and nothing else', () => {
    expect(BELL_FOUNDER_ANIMATION.attackPoses.delayed.lift).toEqual({
      ant0: 0,
      ant1: 0,
      ant2: 0,
      hes: 0,
      impact: 0,
      lunge: 9,
    });
    expect(BELL_FOUNDER_ANIMATION.attackPoses.double).not.toHaveProperty('lift');
  });
});

describe('the effect of the Burn (#171)', () => {
  it('has its tints in the art palette', () => {
    for (const tint of BURN_EFFECT.pal) expect([tint, codeOf(tint) > 0]).toEqual([tint, true]);
  });

  it('has a flame of 3 images of 8 × 11, at 5 places in the cell of the hero', () => {
    const { burn } = BURN_EFFECT.effects;

    expect(burn.frames).toHaveLength(3);
    expect(burn.cell).toEqual([36, 44]);
    expect(burn.slots).toEqual([
      [10, 30],
      [24, 26],
      [16, 18],
      [27, 38],
      [8, 40],
    ]);
    for (const rows of burn.frames) expectRows(rows, 8, 11, BURN_EFFECT.pal.length);
  });

  it('has a burning hit of 2 images of 16 × 16 and a smoke of 3 images of 8 × 11', () => {
    const { burnHit, burnOut } = BURN_EFFECT.effects;

    expect(burnHit.frames).toHaveLength(2);
    for (const rows of burnHit.frames) expectRows(rows, 16, 16, BURN_EFFECT.pal.length);
    expect(burnOut.frames).toHaveLength(3);
    for (const rows of burnOut.frames) expectRows(rows, 8, 11, BURN_EFFECT.pal.length);
  });
});
