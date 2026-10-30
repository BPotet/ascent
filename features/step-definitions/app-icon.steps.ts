/**
 * Scénarios de « Icône de l'application et écran de démarrage » (#166). Les étapes lancent le vrai
 * script (`scripts/app-icon/generate.mjs`) dans un dossier temporaire, puis comparent chaque pixel
 * des PNG à la grille figée, lue ici par un lecteur propre aux scénarios.
 * Le scénario « Le joueur lance l'app » est le parcours Maestro `e2e/flows/launch.yaml` (voir le
 * `.feature`).
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { decodePng, type DecodedPng } from '../support/decodePng';

const ROOT = path.resolve(__dirname, '../..');
const SCRIPT = path.join(ROOT, 'scripts/app-icon/generate.mjs');
const FROZEN_GRID = path.join(ROOT, 'scripts/app-icon/A-export.txt');
const ASSETS = path.join(ROOT, 'assets');

type Rgba = readonly [number, number, number, number];
type Grid = { palette: Map<string, Rgba>; layers: Record<string, string[]> };

/** Les images de l'icône adaptative, de la favicon et du démarrage : leur calque et leur facteur. */
const DIRECT_IMAGES: Record<string, { layer: string; factor: number }> = {
  'android-icon-foreground.png': { layer: 'avant-plan', factor: 8 },
  'android-icon-background.png': { layer: 'fond', factor: 8 },
  'android-icon-monochrome.png': { layer: 'monochrome', factor: 8 },
  'favicon.png': { layer: 'petit-format', factor: 3 },
  'splash-icon.png': { layer: 'demarrage', factor: 16 },
};
const ICON_FACTOR = 28;
const ICON_SIZE = 1024;

/** Lecteur de la grille propre aux scénarios : la palette d'art, puis les rangées de chaque calque. */
function readGrid(text: string): Grid {
  const palette = new Map<string, Rgba>();
  const layers: Record<string, string[]> = {};
  let layer: string[] | undefined;
  for (const line of text.split('\n')) {
    const colour = /^(\S)\s+\d+\s+(?:#([0-9A-F]{6})|transparent)$/iu.exec(line);
    const header = /^\[([a-z-]+)\]/u.exec(line);
    if (header) {
      layer = layers[header[1]!] = [];
    } else if (colour && !layer) {
      const hex = colour[2];
      palette.set(
        colour[1]!,
        hex === undefined
          ? [0, 0, 0, 0]
          : [
              parseInt(hex.slice(0, 2), 16),
              parseInt(hex.slice(2, 4), 16),
              parseInt(hex.slice(4, 6), 16),
              255,
            ],
      );
    } else if (layer && line.trim() !== '') {
      layer.push(line);
    }
  }
  return { palette, layers };
}

const pixelAt = (image: DecodedPng, x: number, y: number): Rgba => {
  const i = (y * image.width + x) * 4;
  return [image.data[i]!, image.data[i + 1]!, image.data[i + 2]!, image.data[i + 3]!];
};
const same = (a: Rgba, b: Rgba): boolean =>
  a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];

/** Le pixel d'art de l'icône complète : l'avant-plan s'il est opaque, sinon le fond. */
function iconArt(grid: Grid, x: number, y: number): Rgba {
  const foreground = grid.palette.get(grid.layers['avant-plan']![y]![x]!)!;
  return foreground[3] === 0 ? grid.palette.get(grid.layers.fond![y]![x]!)! : foreground;
}

/** Les pixels du PNG qui diffèrent du pixel d'art qui les couvre. */
function mismatches(image: DecodedPng, art: (x: number, y: number) => Rgba, factor: number) {
  const wrong: string[] = [];
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (!same(pixelAt(image, x, y), art(Math.floor(x / factor), Math.floor(y / factor)))) {
        wrong.push(`(${x}, ${y})`);
      }
    }
  }
  return wrong;
}

function generate(grid: string, out: string): { status: number; stderr: string } {
  try {
    execFileSync(process.execPath, [SCRIPT, '--grid', grid, '--out', out], { stdio: 'pipe' });
    return { status: 0, stderr: '' };
  } catch (error) {
    const { status, stderr } = error as { status: number; stderr: Buffer };
    return { status, stderr: stderr.toString() };
  }
}

const work = mkdtempSync(path.join(tmpdir(), 'app-icon-bdd-'));
afterAll(() => rmSync(work, { recursive: true, force: true }));

let grid: Grid;
let out = '';
let images: Record<string, DecodedPng> = {};
let expectedIcon: Rgba[] = [];
type ExpoConfig = {
  icon: string;
  android: { adaptiveIcon: Record<string, string> };
  web: { favicon: string };
  plugins: unknown[];
};
let appJson: ExpoConfig;
let invalidRuns: { status: number; stderr: string; out: string; before: Map<string, Buffer> }[] =
  [];

function generateFromFrozenGrid(): void {
  out = mkdtempSync(path.join(work, 'out-'));
  expect(generate(FROZEN_GRID, out).status).toBe(0);
  images = Object.fromEntries(
    readdirSync(out).map((file) => [file, decodePng(readFileSync(path.join(out, file)))]),
  );
}

const steps: StepDefinitions = ({ given, when, then, and }) => {
  given(
    /^la grille figée de la proposition A, validée par le propriétaire le 30\/10\/2026$/u,
    () => {
      grid = readGrid(readFileSync(FROZEN_GRID, 'utf8'));
      expect(Object.keys(grid.layers)).toEqual([
        'avant-plan',
        'fond',
        'monochrome',
        'petit-format',
        'demarrage',
      ]);
    },
  );

  and(
    /^le tableau « Pour la recopie » de la maquette docs\/mockups\/160-app-icon\/index.html$/u,
    () => {
      expect(Object.keys(DIRECT_IMAGES)).toHaveLength(5);
    },
  );

  // Scénario : les six images existent aux bonnes tailles.
  when("le script de génération de l'icône de l'application est lancé", generateFromFrozenGrid);

  then(
    'les fichiers suivants existent, en PNG, aux tailles suivantes :',
    (table: { Fichier: string; Taille: string }[]) => {
      expect(readdirSync(out).sort()).toEqual(
        table.map(({ Fichier }) => path.basename(Fichier)).sort(),
      );
      for (const { Fichier, Taille } of table) {
        const { width, height } = images[path.basename(Fichier)]!;
        expect(`${width} × ${height}`).toBe(Taille);
      }
    },
  );

  // Scénario : chaque pixel est identique à la grille, sans lissage.
  given("une image générée et sa grille de pixels d'art", generateFromFrozenGrid);

  when(
    "on compare chaque pixel du PNG au pixel d'art qui le couvre (agrandissement au plus proche voisin)",
    () => {
      expect(Object.keys(images)).toEqual(expect.arrayContaining(Object.keys(DIRECT_IMAGES)));
    },
  );

  then("la couleur et l'opacité sont exactement celles de la palette d'art de la grille", () => {
    for (const [file, { layer, factor }] of Object.entries(DIRECT_IMAGES)) {
      const rows = grid.layers[layer]!;
      const image = images[file]!;
      expect([file, image.width, image.height]).toEqual([
        file,
        rows[0]!.length * factor,
        rows.length * factor,
      ]);
      const art = (x: number, y: number) => grid.palette.get(rows[y]![x]!)!;
      expect([file, mismatches(image, art, factor).slice(0, 5)]).toEqual([file, []]);
    }
  });

  and('un « . » de la grille donne un pixel entièrement transparent', () => {
    expect(grid.palette.get('.')).toEqual([0, 0, 0, 0]);
    const foreground = images['android-icon-foreground.png']!;
    expect(grid.layers['avant-plan']![0]![0]).toBe('.');
    expect(pixelAt(foreground, 0, 0)).toEqual([0, 0, 0, 0]);
  });

  and(
    'aucun pixel ne porte de couleur intermédiaire (aucun lissage, aucune demi-transparence non prévue par la grille)',
    () => {
      const colours = [...grid.palette.values()];
      for (const [file, image] of Object.entries(images)) {
        const strays = new Set<string>();
        for (let y = 0; y < image.height; y++) {
          for (let x = 0; x < image.width; x++) {
            const pixel = pixelAt(image, x, y);
            if (!colours.some((colour) => same(colour, pixel))) strays.add(pixel.join(','));
          }
        }
        expect([file, [...strays]]).toEqual([file, []]);
      }
    },
  );

  // Scénario : l'icône complète est opaque et recadrée au centre.
  given("le fond puis l'avant-plan superposés, agrandis ×28 en 1512 × 1512", () => {
    generateFromFrozenGrid();
    expect(grid.layers.fond!.length * ICON_FACTOR).toBe(1512);
  });

  when("l'image est recadrée au centre en 1024 × 1024", () => {
    const offset = (1512 - ICON_SIZE) / 2;
    expectedIcon = [];
    for (let y = 0; y < ICON_SIZE; y++) {
      for (let x = 0; x < ICON_SIZE; x++) {
        expectedIcon.push(
          iconArt(
            grid,
            Math.floor((x + offset) / ICON_FACTOR),
            Math.floor((y + offset) / ICON_FACTOR),
          ),
        );
      }
    }
  });

  then('assets/icon.png correspond pixel pour pixel à ce recadrage', () => {
    const icon = images['icon.png']!;
    expect([icon.width, icon.height]).toEqual([ICON_SIZE, ICON_SIZE]);
    const wrong = expectedIcon.filter(
      (colour, i) => !same(pixelAt(icon, i % ICON_SIZE, Math.floor(i / ICON_SIZE)), colour),
    );
    expect(wrong).toHaveLength(0);
  });

  and("aucun de ses pixels n'est transparent", () => {
    const icon = images['icon.png']!;
    const alphas = new Set(icon.data.filter((_, i) => i % 4 === 3));
    expect([...alphas]).toEqual([255]);
  });

  // Scénario : la génération est reproductible.
  given('les six images déjà générées et committées', () => {
    expect(readdirSync(ASSETS)).toEqual(
      expect.arrayContaining(['icon.png', ...Object.keys(DIRECT_IMAGES)]),
    );
  });

  when('le script de génération est relancé depuis la grille figée', generateFromFrozenGrid);

  then('les six fichiers produits sont identiques, octet pour octet, à ceux committés', () => {
    const produced = readdirSync(out).sort();
    expect(produced).toHaveLength(6);
    for (const file of produced) {
      expect([
        file,
        readFileSync(path.join(out, file)).equals(readFileSync(path.join(ASSETS, file))),
      ]).toEqual([file, true]);
    }
  });

  // Scénario : une grille invalide est refusée.
  given(
    "une grille dont une rangée n'a pas la bonne largeur, ou qui utilise un caractère absent de la palette d'art",
    () => {
      const frozen = readFileSync(FROZEN_GRID, 'utf8').split('\n');
      const fond = frozen.findIndex((line) => line.startsWith('[fond]'));
      const monochrome = frozen.findIndex((line) => line.startsWith('[monochrome]'));
      // Rangée 3 du fond, un pixel en moins ; rangée 5 du monochrome, un « X » hors palette.
      const tooShort = frozen.map((line, i) => (i === fond + 3 ? line.slice(1) : line));
      const unknown = frozen.map((line, i) => (i === monochrome + 5 ? `X${line.slice(1)}` : line));
      writeFileSync(path.join(work, 'too-short.txt'), tooShort.join('\n'));
      writeFileSync(path.join(work, 'unknown.txt'), unknown.join('\n'));
    },
  );

  when('le script de génération est lancé', () => {
    invalidRuns = ['too-short.txt', 'unknown.txt'].map((name) => {
      const target = mkdtempSync(path.join(work, 'kept-'));
      generate(FROZEN_GRID, target);
      writeFileSync(path.join(target, 'icon.png'), 'ancienne icône');
      const before = new Map(
        readdirSync(target).map((file) => [file, readFileSync(path.join(target, file))]),
      );
      return { ...generate(path.join(work, name), target), out: target, before };
    });
  });

  then("il s'arrête en erreur en nommant le calque et la rangée fautifs", () => {
    expect(invalidRuns.map(({ status }) => status !== 0)).toEqual([true, true]);
    expect(invalidRuns.map(({ stderr }) => stderr.trim())).toEqual([
      'fond, rangée 3 : 53 pixels au lieu de 54',
      "monochrome, rangée 5 : caractère « X » absent de la palette d'art",
    ]);
  });

  and("aucune image existante n'est remplacée", () => {
    for (const run of invalidRuns) {
      expect(readdirSync(run.out).sort()).toEqual([...run.before.keys()].sort());
      for (const [file, content] of run.before) {
        expect(readFileSync(path.join(run.out, file)).equals(content)).toBe(true);
      }
    }
  });

  // Scénario : app.json référence les images.
  when('on lit app.json', () => {
    appJson = JSON.parse(readFileSync(path.join(ROOT, 'app.json'), 'utf8')).expo as ExpoConfig;
  });

  then('expo.icon vaut "./assets/icon.png"', () => {
    expect(appJson.icon).toBe('./assets/icon.png');
  });

  and(
    'expo.android.adaptiveIcon référence l\'avant-plan, le fond et le monochrome générés, avec backgroundColor "#0F1420"',
    () => {
      expect(appJson.android.adaptiveIcon).toEqual({
        backgroundColor: '#0F1420',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      });
    },
  );

  and('expo.web.favicon vaut "./assets/favicon.png"', () => {
    expect(appJson.web.favicon).toBe('./assets/favicon.png');
  });

  and(
    'expo.plugins contient expo-splash-screen avec image "./assets/splash-icon.png", imageWidth 216, backgroundColor "#0F1420" et resizeMode "contain"',
    () => {
      expect(appJson.plugins).toContainEqual([
        'expo-splash-screen',
        {
          image: './assets/splash-icon.png',
          imageWidth: 216,
          backgroundColor: '#0F1420',
          resizeMode: 'contain',
        },
      ]);
    },
  );
};

autoBindSteps([loadFeature('features/app-icon.feature')], [steps]);
