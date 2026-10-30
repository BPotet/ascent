// Icône de l'application (#166, ADR 0011) : contrat avec le prebuild d'Expo. `expo prebuild` tire
// chaque densité Android des PNG d'`assets/` avec `generateImageAsync` de `@expo/image-utils`. Aux
// tailles d'Android, chaque pixel d'art vaut un nombre entier de pixels : le résultat doit être
// exactement la grille agrandie au plus proche voisin (couleur et opacité ; l'opacité seule pour
// un pixel transparent). Une montée d'Expo qui lisserait fait échouer
// ce test (repli : fournir les densités à la main, voir l'ADR).
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';

import { FROZEN_GRID, OUTPUT_DIR, parseGrid } from './generate.mjs';

// Sans sharp, comme l'étape « Generate the native Android project » du build : sharp lisse.
process.env.EXPO_IMAGE_UTILS_NO_SHARP = '1';

// L'instance d'image-utils du plugin de l'écran de démarrage, celle du prebuild.
const requireFromPlugin = createRequire(
  createRequire(import.meta.url).resolve('expo-splash-screen/package.json'),
);
const { generateImageAsync, getPngInfo } = requireFromPlugin('@expo/image-utils');

const projectRoot = mkdtempSync(join(tmpdir(), 'app-icon-expo-'));
after(() => rmSync(projectRoot, { recursive: true, force: true }));

const { palette, layers } = parseGrid(readFileSync(FROZEN_GRID, 'utf8'));

/** L'icône adaptative : 108 dp aux 5 densités, en `cover`. */
const ADAPTIVE_SIZES = [108, 162, 216, 324, 432];
/** L'écran de démarrage : 216 dp aux 5 densités, en `contain`. */
const SPLASH_SIZES = [216, 324, 432, 648, 864];

const CASES = [
  ['android-icon-foreground.png', 'avant-plan', 'cover', ADAPTIVE_SIZES],
  ['android-icon-background.png', 'fond', 'cover', ADAPTIVE_SIZES],
  ['android-icon-monochrome.png', 'monochrome', 'cover', ADAPTIVE_SIZES],
  ['splash-icon.png', 'demarrage', 'contain', SPLASH_SIZES],
];

/** Les pixels qui diffèrent de la grille agrandie au plus proche voisin. */
function mismatches({ data, width, height }, layer) {
  const factor = width / layer.width;
  const wrong = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const expected = palette.get(layer.rows[Math.floor(y / factor)][Math.floor(x / factor)]);
      const i = (y * width + x) * 4;
      // Un pixel entièrement transparent n'a pas de couleur visible : Jimp y laisse parfois le RGB
      // d'un voisin (aux rapports 3/8 et 3/4), sans effet à l'écran. Seul son alpha est comparé.
      const compared = expected[3] === 0 ? [3] : [0, 1, 2, 3];
      if (compared.some((c) => data[i + c] !== expected[c])) wrong.push(`(${x}, ${y})`);
    }
  }
  return wrong;
}

describe('Android densities produced by the Expo prebuild', () => {
  for (const [file, layerName, resizeMode, sizes] of CASES) {
    for (const size of sizes) {
      it(`keeps ${file} pixel-exact at ${size} px (${resizeMode})`, async () => {
        const layer = layers[layerName];
        assert.ok(Number.isInteger(size / layer.width), 'facteur entier');
        const { source } = await generateImageAsync(
          { projectRoot, cacheType: `app-icon-${file}` },
          { src: join(OUTPUT_DIR, file), resizeMode, width: size, height: size },
        );
        const png = join(projectRoot, `${file}-${size}.png`);
        writeFileSync(png, source);
        const image = await getPngInfo(png);
        assert.deepEqual([image.width, image.height, image.bpp], [size, size, 4]);
        assert.deepEqual(mismatches(image, layer).slice(0, 5), []);
      });
    }
  }
});
