// Les icônes des pouvoirs (#235) : recopiées de l'Atelier (ADR 0010, avenant #235), 16 × 16, de
// teintes de la palette d'art, et fidèles pixel pour pixel à la maquette validée
// (`docs/mockups/232-arbre-de-pouvoirs/`, proposition retenue : `A`, sauf Rafale en `B`).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { artPalette } from '../../artPalette';
import { HERO_ANIMATIONS } from '../battle/heroAnimations';
import { heroFrames } from '../battle/battleCharacters';
import { CRUSHING_BLOW_POSES } from './data/crushingBlow';
import { POWER_ICONS } from './data/powerIcons';
import { SENTINEL_ANIMATION } from './data/sentinel';
import { tintCode } from './fullAnimation';
import { mockupArt, pixels } from './testing/mockup208';

const RETAINED: Readonly<Record<keyof typeof POWER_ICONS, 'A' | 'B'>> = {
  bulwark: 'A',
  shieldBash: 'A',
  crushingBlow: 'A',
  retaliation: 'A',
  holdFast: 'A',
  shadowStep: 'A',
  rend: 'A',
  flurry: 'B',
  mist: 'A',
  ambush: 'A',
};

const ICONS = Object.entries(POWER_ICONS);

describe('the power icons (#235)', () => {
  const art = mockupArt('232-arbre-de-pouvoirs');

  it('copies the 10 icons of the power trees', () => {
    expect(Object.keys(POWER_ICONS).sort()).toEqual(Object.keys(RETAINED).sort());
  });

  it.each(ICONS)('draws %s on 16 × 16 pixels, with tints of the art palette', (_, image) => {
    expect([image.w, image.h]).toEqual([16, 16]);
    expect(image.rows).toHaveLength(16);
    image.rows.forEach((row) => {
      expect(row).toHaveLength(16);
      Array.from(row).forEach((char) => {
        if (char !== '.') expect(parseInt(char, 36)).toBeLessThan(image.palette.length);
      });
    });
    image.palette.forEach((tint) =>
      expect(artPalette.tints[tintCode(tint)]).toBe(tint.toUpperCase()),
    );
  });

  it.each(ICONS)(
    'copies %s pixel for pixel from the retained proposal of the mockup 232',
    (id, image) => {
      const mockup = art[id]?.[RETAINED[id as keyof typeof RETAINED]];
      if (mockup === undefined) throw new Error(`The mockup 232 has no ART.${id}`);
      expect([image.w, image.h]).toEqual([mockup.w, mockup.h]);
      expect(pixels(image)).toEqual(pixels(mockup));
    },
  );
});

// Les poses de Fracas (#236) : recopiées de `assets/powerCrushingBlow` version 3, proposition B
// « Lame chargée », sur la case et la palette de la Sentinelle (ADR 0010, avenant #236).
describe('the poses of Crushing Blow (#236)', () => {
  it('cites the version 3 of its document and its sha256 in its header', () => {
    const header = readFileSync(join(__dirname, 'data', 'crushingBlow.ts'), 'utf8');

    expect(header).toContain('`assets/powerCrushingBlow`, clé `animation.proposals[1]`');
    expect(header).toContain('document version 3');
    expect(header).toContain('f0090acf0a93892c84640c79a6d86ad65b8b48e4c6648d9e1fcc0b35d1caec7c');
  });

  it('has exactly the palette of the Sentinel, 19 tints, and her cell of 36 × 44', () => {
    expect(CRUSHING_BLOW_POSES.pal).toEqual(SENTINEL_ANIMATION.pal);
    expect(CRUSHING_BLOW_POSES.pal).toHaveLength(19);
    expect([CRUSHING_BLOW_POSES.w, CRUSHING_BLOW_POSES.h]).toEqual([
      SENTINEL_ANIMATION.w,
      SENTINEL_ANIMATION.h,
    ]);
  });

  it.each(['crush0', 'crush1'] as const)('draws %s on 36 × 44 pixels of the palette', (pose) => {
    const rows = CRUSHING_BLOW_POSES.frames[pose];
    expect(rows).toHaveLength(44);
    rows.forEach((row) => {
      expect(row).toHaveLength(36);
      Array.from(row).forEach((char) => {
        if (char !== '.') expect(parseInt(char, 36)).toBeLessThan(CRUSHING_BLOW_POSES.pal.length);
      });
    });
    expect(Object.keys(CRUSHING_BLOW_POSES.anchors[pose]).sort()).toEqual(['eye', 'head', 'tips']);
  });

  it('joins the poses of the Sentinel, hers kept', () => {
    const sentinel = HERO_ANIMATIONS.sentinel;

    expect(heroFrames('sentinel')).toEqual(expect.arrayContaining(['bash', 'crush0', 'crush1']));
    expect(heroFrames('wanderer')).not.toContain('crush0');
    expect(sentinel.frames['crush1']).toBe(CRUSHING_BLOW_POSES.frames.crush1);
    expect(sentinel.anchors['crush0']).toEqual(CRUSHING_BLOW_POSES.anchors.crush0);
    expect(sentinel.frames['bash']).toBe(SENTINEL_ANIMATION.frames.bash);
    expect(sentinel.pal).toBe(SENTINEL_ANIMATION.pal);
  });
});
