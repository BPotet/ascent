// Les portraits (#175) : recopiés de l'Atelier (ADR 0010, avenant #175), un par héros et par ennemi,
// 24 × 24, de teintes connues de la palette d'art, et fidèles pixel pour pixel à la maquette
// validée (`docs/mockups/174-tier-identity/`, `ART.ic_<id>` et `ART.ic_<id>2`).
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { ENEMIES, type EnemyKind, type HeroKind } from '../../../../../domain/battle/combatants';
import { artPalette } from '../../artPalette';
import { hasPhase2 } from '../battle/battleCharacters';
import { PHASE_2_PORTRAITS, PORTRAITS } from './data/portraits';
import { tintCode, type AssetImage } from './fullAnimation';

const MOCKUP = path.join(__dirname, '../../../../../../docs/mockups/174-tier-identity/index.html');

const HEROES: readonly HeroKind[] = ['sentinel', 'wanderer'];
const ENEMY_KINDS = Object.keys(ENEMIES) as EnemyKind[];

/** L'id de l'Atelier de chaque combattant, quand il n'est pas son nom de code. */
const ATELIER_IDS: Partial<Record<HeroKind | EnemyKind, string>> = {
  skeleton: 'nouvelEnnemi',
  madVillager: 'nouvelEnnemi2',
  twins: 'nouvelleElite',
  burningHusk: 'smolderingBrand',
  mothkin: 'ashMoth',
};

/**
 * Les combattants que la maquette 174 ne connaît pas : leur portrait, recopié par la conversation,
 * se vérifie par son empreinte (`belfryEnemies.data.test.ts`, ADR 0010, avenant #214).
 */
const WITHOUT_MOCKUP: readonly (HeroKind | EnemyKind)[] = [
  'bellNovice',
  'matinsRinger',
  'clockJack',
];

interface MockupImage {
  readonly w: number;
  readonly h: number;
  readonly pal: readonly string[];
  readonly f: { readonly i: readonly string[] };
}

function mockupArt(): Record<string, MockupImage> {
  const html = readFileSync(MOCKUP, 'utf8');
  const json = /const ART=(\{.*?\});\n/.exec(html)?.[1];
  if (json === undefined) throw new Error('The mockup has no ART');
  return JSON.parse(json) as Record<string, MockupImage>;
}

/**
 * La teinte de chaque pixel (`null` : transparent). La maquette encode certaines palettes dans un
 * autre ordre, ou avec des teintes inutilisées : la fidélité se juge pixel pour pixel.
 */
function pixels(palette: readonly string[], rows: readonly string[]): (string | null)[][] {
  return rows.map((row) =>
    Array.from(row, (char) => (char === '.' ? null : palette[parseInt(char, 36)]!.toLowerCase())),
  );
}

function expectSamePixels(image: AssetImage, mockup: MockupImage | undefined): void {
  if (mockup === undefined) throw new Error('The mockup has no such portrait');
  expect([image.w, image.h]).toEqual([mockup.w, mockup.h]);
  expect(pixels(image.palette, image.rows)).toEqual(pixels(mockup.pal, mockup.f.i));
}

function portraitOf(kind: HeroKind | EnemyKind): AssetImage {
  const portrait = PORTRAITS[kind];
  if (portrait === null) throw new Error(`${kind} has no portrait`);
  return portrait;
}

function expectWellFormed(image: AssetImage): void {
  expect([image.w, image.h]).toEqual([24, 24]);
  expect(image.rows).toHaveLength(24);
  image.rows.forEach((row) => {
    expect(row).toHaveLength(24);
    Array.from(row).forEach((char) => {
      if (char !== '.') expect(parseInt(char, 36)).toBeLessThan(image.palette.length);
    });
  });
  image.palette.forEach((tint) =>
    expect(artPalette.tints[tintCode(tint)]).toBe(tint.toUpperCase()),
  );
}

describe('PORTRAITS', () => {
  it('gives a portrait to every hero and every enemy, none missing today', () => {
    expect(Object.keys(PORTRAITS).sort()).toEqual([...HEROES, ...ENEMY_KINDS].sort());
    Object.values(PORTRAITS).forEach((portrait) => expect(portrait).not.toBeNull());
  });

  it.each([...HEROES, ...ENEMY_KINDS])(
    'draws the portrait of %s in 24 × 24 art pixels of known tints',
    (kind) => expectWellFormed(portraitOf(kind)),
  );

  it.each([...HEROES, ...ENEMY_KINDS].filter((kind) => !WITHOUT_MOCKUP.includes(kind)))(
    'copies the portrait of %s pixel for pixel from the validated mockup',
    (kind) => {
      expectSamePixels(portraitOf(kind), mockupArt()[`ic_${ATELIER_IDS[kind] ?? kind}`]);
    },
  );

  it('compares every portrait to the mockup 174 but the three enemies of the Belfry (#214)', () => {
    expect(WITHOUT_MOCKUP.filter((kind) => mockupArt()[`ic_${kind}`] !== undefined)).toEqual([]);
    expect(WITHOUT_MOCKUP.every((kind) => PORTRAITS[kind] !== null)).toBe(true);
  });
});

describe('PHASE_2_PORTRAITS', () => {
  it('covers exactly the bosses with a phase 2 aspect', () => {
    expect(Object.keys(PHASE_2_PORTRAITS).sort()).toEqual(ENEMY_KINDS.filter(hasPhase2).sort());
  });

  it.each(Object.keys(PHASE_2_PORTRAITS) as EnemyKind[])(
    'draws the phase 2 portrait of %s, pixel for pixel from the mockup, unlike its first portrait',
    (kind) => {
      const portrait = PHASE_2_PORTRAITS[kind]!;
      expectWellFormed(portrait);
      expectSamePixels(portrait, mockupArt()[`ic_${kind}2`]);
      expect(pixels(portrait.palette, portrait.rows)).not.toEqual(
        pixels(portraitOf(kind).palette, portraitOf(kind).rows),
      );
    },
  );
});
