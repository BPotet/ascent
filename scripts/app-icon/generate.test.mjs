// Icône de l'application (#166) : le générateur lit la grille figée et écrit les six PNG, sans lissage.
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { crc32, inflateSync } from 'node:zlib';

import {
  FROZEN_GRID,
  LAYERS,
  OUTPUTS,
  cropCenter,
  encodePng,
  overlay,
  parseGrid,
  renderAll,
  run,
  upscale,
} from './generate.mjs';

const here = dirname(fileURLToPath(import.meta.url));

/** Une petite grille valide : les cinq calques, en 2 × 2 (et 1 × 1 pour le petit format). */
function tinyGrid({ fond = ['12', '21'], avantPlan = ['.1', '..'] } = {}) {
  return [
    '# grille de test',
    '',
    'palette (caractère  indice  couleur)',
    '.   0  transparent',
    '1   1  #FF0000',
    '2   2  #00FF00',
    '',
    '[avant-plan] Avant-plan · 2 × 2',
    ...avantPlan,
    '',
    '[fond] Fond · 2 × 2',
    ...fond,
    '',
    '[monochrome] Monochrome · 2 × 2',
    '1.',
    '.1',
    '',
    '[petit-format] Petit format · 1 × 1',
    '2',
    '',
    '[demarrage] Écran de démarrage · 2 × 2',
    '..',
    '.2',
  ].join('\n');
}

/** Lit un PNG écrit par l'encodeur : chunks vérifiés (CRC), pixels RGBA d'une image filtre 0. */
function readPng(buffer) {
  assert.deepEqual([...buffer.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const chunks = [];
  let offset = 8;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const typeAndData = buffer.subarray(offset + 4, offset + 8 + length);
    assert.equal(buffer.readUInt32BE(offset + 8 + length), crc32(typeAndData));
    chunks.push({
      type: typeAndData.subarray(0, 4).toString('latin1'),
      data: typeAndData.subarray(4),
    });
    offset += 12 + length;
  }
  const ihdr = chunks[0].data;
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const raw = inflateSync(
    Buffer.concat(chunks.filter((c) => c.type === 'IDAT').map((c) => c.data)),
  );
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1);
    assert.equal(raw[row], 0, `filtre 0 attendu, rangée ${y}`);
    raw.copy(data, y * width * 4, row + 1, row + 1 + width * 4);
  }
  return { types: chunks.map((c) => c.type), ihdr: [...ihdr.subarray(8)], width, height, data };
}

function pixel(image, x, y) {
  const i = (y * image.width + x) * 4;
  return [...image.data.subarray(i, i + 4)];
}

const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

describe('frozen grid of proposal A', () => {
  it('keeps the two files validated by the owner, byte for byte', () => {
    assert.equal(
      sha256(join(here, 'A-export.txt')),
      '1d77b927a0d7cee630f19a6ebf68e75e8ee8de95393786cebda8f21725dbb091',
    );
    assert.equal(
      sha256(join(here, 'A.json')),
      '6b89b0d9cb100c2179d45a986771a636a88ff0b72bf72d90a533f3ec82438ba7',
    );
  });

  it('is the default input of the generator', () => {
    assert.equal(FROZEN_GRID, join(here, 'A-export.txt'));
  });

  it('has the art palette and the five layers at their size', () => {
    const grid = parseGrid(readFileSync(FROZEN_GRID, 'utf8'));
    assert.deepEqual(grid.palette.get('.'), [0, 0, 0, 0]);
    assert.deepEqual(grid.palette.get('Z'), [0x22, 0x2c, 0x52, 255]);
    assert.equal(grid.palette.size, 18);
    assert.deepEqual(
      LAYERS.map((name) => [name, grid.layers[name].width, grid.layers[name].height]),
      [
        ['avant-plan', 54, 54],
        ['fond', 54, 54],
        ['monochrome', 54, 54],
        ['petit-format', 16, 16],
        ['demarrage', 54, 54],
      ],
    );
  });

  it('has a background without any transparent art pixel, so the full icon is opaque', () => {
    const { layers } = parseGrid(readFileSync(FROZEN_GRID, 'utf8'));
    assert.ok(layers.fond.rows.every((row) => !row.includes('.')));
  });
});

describe('parseGrid', () => {
  it('reads the palette as RGBA, "transparent" as fully transparent black', () => {
    const { palette } = parseGrid(tinyGrid());
    assert.deepEqual(
      [...palette.entries()],
      [
        ['.', [0, 0, 0, 0]],
        ['1', [255, 0, 0, 255]],
        ['2', [0, 255, 0, 255]],
      ],
    );
  });

  it('reads each layer with its size and its rows', () => {
    const { layers } = parseGrid(tinyGrid());
    assert.deepEqual(layers.fond, { width: 2, height: 2, rows: ['12', '21'] });
    assert.deepEqual(layers['petit-format'], { width: 1, height: 1, rows: ['2'] });
  });

  const invalid = [
    ['a row too short', { fond: ['12', '2'] }, 'fond, rangée 2 : 1 pixels au lieu de 2'],
    ['a row too long', { fond: ['121', '21'] }, 'fond, rangée 1 : 3 pixels au lieu de 2'],
    [
      'a character missing from the palette',
      { avantPlan: ['.1', '.X'] },
      "avant-plan, rangée 2 : caractère « X » absent de la palette d'art",
    ],
    ['a missing row', { fond: ['12'] }, 'fond, rangée 2 : rangée absente'],
    ['an extra row', { fond: ['12', '21', '11'] }, 'fond, rangée 3 : rangée en trop'],
  ];
  for (const [label, change, message] of invalid) {
    it(`refuses ${label}, naming the layer and the row`, () => {
      assert.throws(() => parseGrid(tinyGrid(change)), { message });
    });
  }

  it('refuses a missing layer, naming it', () => {
    const text = tinyGrid().replace('[demarrage]', '[autre]');
    assert.throws(() => parseGrid(text), { message: 'demarrage : calque absent' });
  });
});

describe('image operations', () => {
  const { palette, layers } = parseGrid(tinyGrid());

  it('upscales with the nearest neighbour: one art pixel becomes an N × N square', () => {
    const image = upscale(layers.fond, palette, 3);
    assert.equal(image.width, 6);
    assert.equal(image.height, 6);
    for (const [x, y, colour] of [
      [0, 0, [255, 0, 0, 255]],
      [2, 2, [255, 0, 0, 255]],
      [3, 0, [0, 255, 0, 255]],
      [5, 2, [0, 255, 0, 255]],
      [0, 3, [0, 255, 0, 255]],
      [5, 5, [255, 0, 0, 255]],
    ]) {
      assert.deepEqual(pixel(image, x, y), colour, `(${x}, ${y})`);
    }
  });

  it('keeps "." fully transparent', () => {
    assert.deepEqual(pixel(upscale(layers['avant-plan'], palette, 1), 0, 0), [0, 0, 0, 0]);
  });

  it('lays the foreground over the background: only its opaque pixels replace the background', () => {
    const image = overlay(
      upscale(layers.fond, palette, 1),
      upscale(layers['avant-plan'], palette, 1),
    );
    assert.deepEqual(
      [pixel(image, 0, 0), pixel(image, 1, 0), pixel(image, 0, 1), pixel(image, 1, 1)],
      [
        [255, 0, 0, 255],
        [255, 0, 0, 255],
        [0, 255, 0, 255],
        [255, 0, 0, 255],
      ],
    );
  });

  it('crops at the centre', () => {
    const image = cropCenter(upscale(layers.fond, palette, 2), 2);
    assert.equal(image.width, 2);
    assert.deepEqual(
      [pixel(image, 0, 0), pixel(image, 1, 0), pixel(image, 0, 1), pixel(image, 1, 1)],
      [
        [255, 0, 0, 255],
        [0, 255, 0, 255],
        [0, 255, 0, 255],
        [255, 0, 0, 255],
      ],
    );
  });
});

describe('encodePng', () => {
  const { palette, layers } = parseGrid(tinyGrid());
  const image = upscale(layers['avant-plan'], palette, 2);
  const png = encodePng(image);

  it('writes 8-bit RGBA, non interlaced, with IHDR, IDAT and IEND only and valid CRCs', () => {
    const decoded = readPng(png);
    assert.deepEqual(decoded.types, ['IHDR', 'IDAT', 'IEND']);
    assert.deepEqual(decoded.ihdr, [8, 6, 0, 0, 0]);
    assert.equal(decoded.width, 4);
    assert.equal(decoded.height, 4);
    assert.deepEqual(decoded.data, Buffer.from(image.data));
  });

  it('is deterministic', () => {
    assert.deepEqual(encodePng(image), png);
  });
});

describe('renderAll', () => {
  it('gives the six images at the size of the mock-up', () => {
    const images = renderAll(readFileSync(FROZEN_GRID, 'utf8'));
    assert.deepEqual(Object.keys(images).sort(), Object.keys(OUTPUTS).sort());
    const sizes = Object.fromEntries(
      Object.entries(images).map(([file, png]) => [
        file,
        readPng(png).width + ' × ' + readPng(png).height,
      ]),
    );
    assert.deepEqual(sizes, {
      'icon.png': '1024 × 1024',
      'android-icon-foreground.png': '432 × 432',
      'android-icon-background.png': '432 × 432',
      'android-icon-monochrome.png': '432 × 432',
      'favicon.png': '48 × 48',
      'splash-icon.png': '864 × 864',
    });
  });

  it('crops the ×28 icon from pixel 244, so that art pixel (9, 9) starts at (8, 8)', () => {
    const { palette, layers } = parseGrid(readFileSync(FROZEN_GRID, 'utf8'));
    const icon = readPng(renderAll(readFileSync(FROZEN_GRID, 'utf8'))['icon.png']);
    // 244 = 8 × 28 + 20 : le pixel (0, 0) de l'icône est dans le pixel d'art (8, 8), à 20 px de son bord.
    const art = (x, y) => {
      const fg = palette.get(layers['avant-plan'].rows[y][x]);
      return fg[3] === 0 ? palette.get(layers.fond.rows[y][x]) : fg;
    };
    assert.deepEqual(pixel(icon, 0, 0), art(8, 8));
    assert.deepEqual(pixel(icon, 7, 7), art(8, 8));
    assert.deepEqual(pixel(icon, 8, 8), art(9, 9));
    assert.deepEqual(pixel(icon, 1023, 1023), art(45, 45));
  });
});

describe('run', () => {
  const work = mkdtempSync(join(tmpdir(), 'app-icon-'));
  after(() => rmSync(work, { recursive: true, force: true }));

  it('writes the six images into the output folder', () => {
    const out = join(work, 'ok');
    const errors = [];
    const code = run(['--grid', FROZEN_GRID, '--out', out], { error: (m) => errors.push(m) });
    assert.equal(code, 0);
    assert.deepEqual(errors, []);
    assert.deepEqual(readdirSync(out).sort(), Object.keys(OUTPUTS).sort());
  });

  it('writes nothing and names the layer and the row when the grid is invalid', () => {
    const grid = join(work, 'invalid.txt');
    writeFileSync(grid, tinyGrid({ fond: ['12', '2X'] }));
    const out = join(work, 'kept');
    run(['--grid', FROZEN_GRID, '--out', out], { error: () => {} });
    const before = Object.fromEntries(readdirSync(out).map((f) => [f, readFileSync(join(out, f))]));
    writeFileSync(join(out, 'favicon.png'), 'ancienne image');
    before['favicon.png'] = Buffer.from('ancienne image');

    const errors = [];
    const code = run(['--grid', grid, '--out', out], { error: (m) => errors.push(m) });

    assert.notEqual(code, 0);
    assert.deepEqual(errors, ["fond, rangée 2 : caractère « X » absent de la palette d'art"]);
    for (const [file, content] of Object.entries(before)) {
      assert.deepEqual(readFileSync(join(out, file)), content, file);
    }
  });

  it('refuses an unknown option', () => {
    const errors = [];
    assert.notEqual(run(['--outt', work], { error: (m) => errors.push(m) }), 0);
    assert.match(errors[0], /--outt/);
  });
});
