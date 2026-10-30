#!/usr/bin/env node
// Icône de l'application (#166, ADR 0011) : les six PNG d'`assets/`, tirés de la grille figée de la
// proposition A (`A-export.txt`, validée par le propriétaire le 30/10/2026), sans retouche.
// Chaque pixel d'art devient un carré N × N (plus proche voisin) : aucun lissage, aucune couleur
// intermédiaire. Le PNG est déterministe (RGBA 8 bits, filtre 0, IHDR, IDAT et IEND seulement).
//   node scripts/app-icon/generate.mjs [--grid <fichier>] [--out <dossier>]
// Toute la grille est validée et les images préparées en mémoire avant la première écriture.
import { Buffer } from 'node:buffer';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';

const here = dirname(fileURLToPath(import.meta.url));

export const FROZEN_GRID = join(here, 'A-export.txt');
export const OUTPUT_DIR = resolve(here, '../../assets');

/** Les calques de la grille, dans l'ordre de l'export. */
export const LAYERS = ['avant-plan', 'fond', 'monochrome', 'petit-format', 'demarrage'];

const ICON_SIZE = 1024;

/** Les six images : leur calque (le fond puis l'avant-plan pour l'icône complète) et leur facteur. */
export const OUTPUTS = {
  'icon.png': { layers: ['fond', 'avant-plan'], factor: 28, crop: ICON_SIZE },
  'android-icon-foreground.png': { layers: ['avant-plan'], factor: 8 },
  'android-icon-background.png': { layers: ['fond'], factor: 8 },
  'android-icon-monochrome.png': { layers: ['monochrome'], factor: 8 },
  'favicon.png': { layers: ['petit-format'], factor: 3 },
  'splash-icon.png': { layers: ['demarrage'], factor: 16 },
};

const PALETTE_LINE = /^(\S)\s+\d+\s+(#[0-9A-Fa-f]{6}|transparent)$/;
const LAYER_HEADER = /^\[([^\]]+)\].*?(\d+)\s*×\s*(\d+)\s*$/;

function colour(value) {
  if (value === 'transparent') return [0, 0, 0, 0];
  const rgb = Number.parseInt(value.slice(1), 16);
  return [(rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255, 255];
}

/**
 * Lit la grille : la palette d'art (caractère → RGBA) et les calques (taille et rangées).
 * Une erreur nomme le calque et la rangée (comptée à partir de 1) : « fond, rangée 3 : … ».
 */
export function parseGrid(text) {
  const lines = text.split(/\r?\n/);
  const palette = new Map();
  const blocks = {};
  let section = null;
  for (const line of lines) {
    const header = LAYER_HEADER.exec(line);
    if (header) {
      section = header[1];
      blocks[section] = { width: Number(header[2]), height: Number(header[3]), rows: [] };
    } else if (line.startsWith('palette')) {
      section = 'palette';
    } else if (line.trim() === '' || line.startsWith('#')) {
      section = null;
    } else if (section === 'palette') {
      const entry = PALETTE_LINE.exec(line);
      if (!entry) throw new Error(`palette : ligne illisible « ${line} »`);
      palette.set(entry[1], colour(entry[2]));
    } else if (section in blocks) {
      blocks[section].rows.push(line);
    }
  }

  const layers = {};
  for (const name of LAYERS) {
    const block = blocks[name];
    if (!block) throw new Error(`${name} : calque absent`);
    const { width, height, rows } = block;
    rows.forEach((row, index) => {
      const at = `${name}, rangée ${index + 1}`;
      if (index >= height) throw new Error(`${at} : rangée en trop`);
      const pixels = [...row];
      if (pixels.length !== width) {
        throw new Error(`${at} : ${pixels.length} pixels au lieu de ${width}`);
      }
      const unknown = pixels.find((char) => !palette.has(char));
      if (unknown !== undefined) {
        throw new Error(`${at} : caractère « ${unknown} » absent de la palette d'art`);
      }
    });
    if (rows.length < height)
      throw new Error(`${name}, rangée ${rows.length + 1} : rangée absente`);
    layers[name] = { width, height, rows };
  }
  return { palette, layers };
}

/** Agrandit un calque au plus proche voisin : un pixel d'art devient un carré factor × factor. */
export function upscale(layer, palette, factor) {
  const width = layer.width * factor;
  const height = layer.height * factor;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const row = layer.rows[Math.floor(y / factor)];
    for (let x = 0; x < width; x++) {
      data.set(palette.get(row[Math.floor(x / factor)]), (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

/** Pose `top` sur `bottom` : chaque pixel non transparent de `top` remplace celui de `bottom`. */
export function overlay(bottom, top) {
  const data = Uint8Array.from(bottom.data);
  for (let i = 0; i < data.length; i += 4) {
    if (top.data[i + 3] !== 0) data.set(top.data.subarray(i, i + 4), i);
  }
  return { width: bottom.width, height: bottom.height, data };
}

/** Recadre au centre en size × size. */
export function cropCenter(image, size) {
  const left = (image.width - size) / 2;
  const top = (image.height - size) / 2;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const start = ((top + y) * image.width + left) * 4;
    data.set(image.data.subarray(start, start + size * 4), y * size * 4);
  }
  return { width: size, height: size, data };
}

function chunk(type, data) {
  const typeAndData = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

/** PNG RGBA 8 bits, non entrelacé, filtre 0 sur chaque rangée, deflate niveau 9. */
export function encodePng({ width, height, data }) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw.set(data.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Les six PNG, en mémoire, à partir du texte de la grille. */
export function renderAll(text) {
  const { palette, layers } = parseGrid(text);
  return Object.fromEntries(
    Object.entries(OUTPUTS).map(([file, { layers: names, factor, crop }]) => {
      const image = names
        .map((name) => upscale(layers[name], palette, factor))
        .reduce((bottom, top) => overlay(bottom, top));
      return [file, encodePng(crop ? cropCenter(image, crop) : image)];
    }),
  );
}

function options(argv) {
  const values = { grid: FROZEN_GRID, out: OUTPUT_DIR };
  for (let i = 0; i < argv.length; i += 2) {
    const key = { '--grid': 'grid', '--out': 'out' }[argv[i]];
    if (!key || argv[i + 1] === undefined)
      throw new Error(`option inconnue ou incomplète : ${argv[i]}`);
    values[key] = resolve(argv[i + 1]);
  }
  return values;
}

/** Valide la grille, prépare les six images, puis seulement les écrit. Rend le code de sortie. */
export function run(argv, { error = console.error } = {}) {
  let images;
  let out;
  try {
    const values = options(argv);
    out = values.out;
    images = renderAll(readFileSync(values.grid, 'utf8'));
  } catch (cause) {
    error(cause.message);
    return 1;
  }
  mkdirSync(out, { recursive: true });
  for (const [file, png] of Object.entries(images)) writeFileSync(join(out, file), png);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = run(process.argv.slice(2));
}
