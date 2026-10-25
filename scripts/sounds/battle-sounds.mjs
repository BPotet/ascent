#!/usr/bin/env node
// Sons provisoires du combat (#31) : des WAV courts générés à partir des tonalités du prototype de
// la maquette (`docs/mockups/30-premiere-ascension/index.html`, fonction `tone`). Aucune licence
// tierce. Les sons définitifs sont hors du périmètre de #31.
//   node scripts/sounds/battle-sounds.mjs  : écrit les fichiers dans src/adapters/device/sound/assets/
import { Buffer } from 'node:buffer';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const SAMPLE_RATE = 22_050;
export const OUTPUT_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../src/adapters/device/sound/assets',
);

/**
 * Les sons, comme dans la maquette : [fréquence (Hz), durée (s), forme, volume, départ (s)].
 * La victoire et la défaite n'ont pas de son dans la maquette : un arpège montant, une chute.
 */
export const CUES = {
  'perfect-parry': [
    [1_320, 0.18, 'triangle', 0.16, 0],
    [660, 0.3, 'sine', 0.08, 0],
  ],
  parry: [[520, 0.12, 'triangle', 0.12, 0]],
  dodge: [[520, 0.1, 'triangle', 0.12, 0]],
  hit: [[110, 0.2, 'sawtooth', 0.07, 0]],
  whiff: [[140, 0.12, 'square', 0.05, 0]],
  seal: [[330, 0.35, 'sawtooth', 0.06, 0]],
  'enemy-phase': [
    [196, 0.32, 'sine', 0.12, 0],
    [147, 0.4, 'sine', 0.1, 0.12],
  ],
  'hero-phase': [
    [660, 0.14, 'triangle', 0.1, 0],
    [880, 0.2, 'triangle', 0.1, 0.1],
  ],
  victory: [
    [523, 0.16, 'triangle', 0.12, 0],
    [659, 0.16, 'triangle', 0.12, 0.12],
    [784, 0.3, 'triangle', 0.12, 0.24],
  ],
  defeat: [
    [220, 0.3, 'sine', 0.12, 0],
    [165, 0.4, 'sine', 0.12, 0.2],
  ],
};

const WAVES = {
  sine: (phase) => Math.sin(2 * Math.PI * phase),
  triangle: (phase) => 1 - 4 * Math.abs(Math.round(phase - 0.25) - (phase - 0.25)),
  square: (phase) => (phase % 1 < 0.5 ? 1 : -1),
  sawtooth: (phase) => 2 * (phase - Math.floor(phase + 0.5)),
};

/** Les échantillons d'un son : chaque note décroît de son volume à 0,0001 (rampe exponentielle). */
export function renderSamples(notes) {
  const length = Math.ceil(
    Math.max(...notes.map(([, duration, , , at]) => at + duration)) * SAMPLE_RATE,
  );
  const samples = new Float64Array(length);
  for (const [frequency, duration, wave, volume, at] of notes) {
    const first = Math.round(at * SAMPLE_RATE);
    const count = Math.round(duration * SAMPLE_RATE);
    for (let index = 0; index < count; index += 1) {
      const time = index / SAMPLE_RATE;
      const gain = volume * Math.pow(0.0001 / volume, time / duration);
      samples[first + index] += gain * WAVES[wave](frequency * time);
    }
  }
  return samples;
}

/** Un fichier WAV PCM 16 bits, mono. */
export function encodeWav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((sample, index) => {
    const clamped = Math.max(-1, Math.min(1, sample));
    data.writeInt16LE(Math.round(clamped * 32_767), index * 2);
  });
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16); // taille du bloc « fmt »
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28); // octets par seconde
  header.writeUInt16LE(2, 32); // octets par échantillon
  header.writeUInt16LE(16, 34); // bits par échantillon
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

/** Le contenu du fichier de chaque son, par nom de fichier. */
export function renderAll() {
  return Object.fromEntries(
    Object.entries(CUES).map(([name, notes]) => [`${name}.wav`, encodeWav(renderSamples(notes))]),
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  for (const [file, content] of Object.entries(renderAll())) {
    writeFileSync(join(OUTPUT_DIR, file), content);
    console.log(`${file}: ${content.length} bytes`);
  }
}
