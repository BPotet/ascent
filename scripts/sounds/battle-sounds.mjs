#!/usr/bin/env node
// Sons provisoires du combat (#31, complétés par #32 et #81) : des WAV courts générés à partir des
// tonalités du prototype de la maquette (`docs/mockups/30-premiere-ascension/index.html`, fonctions
// `tone` et `sfx`). Aucune licence tierce. Les sons définitifs sont hors du périmètre.
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
 * Les sons, comme dans la maquette : [fréquence (Hz), durée (s), forme, volume, départ (s)], et
 * la fréquence d'arrivée (Hz) d'une note qui glisse. La victoire et la défaite n'ont pas de son
 * dans la maquette : un arpège montant, une chute.
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
  // #32 : sans bruit blanc ni glissando (le script ne joue que des notes tenues), au plus proche.
  strike: [
    [1_200, 0.08, 'sawtooth', 0.06, 0],
    [600, 0.12, 'triangle', 0.08, 0.03],
  ],
  'perfect-strike': [
    [1_568, 0.3, 'sine', 0.12, 0],
    [2_093, 0.3, 'sine', 0.12, 0.025],
    [2_637, 0.3, 'sine', 0.12, 0.05],
    [1_250, 0.3, 'triangle', 0.16, 0],
  ],
  'guard-break': [
    [880, 0.28, 'triangle', 0.14, 0],
    [660, 0.28, 'triangle', 0.14, 0.06],
    [494, 0.28, 'triangle', 0.14, 0.12],
    [330, 0.28, 'triangle', 0.14, 0.18],
  ],
  'lost-action': [[300, 0.05, 'triangle', 0.04, 0]],
  'guard-restore': [
    [320, 0.2, 'sine', 0.06, 0],
    [480, 0.25, 'sine', 0.06, 0.15],
  ],
  'guard-up': [
    [392, 0.4, 'triangle', 0.12, 0],
    [523, 0.4, 'sine', 0.08, 0.08],
  ],
  raise: [
    [262, 0.4, 'sawtooth', 0.04, 0],
    [311, 0.4, 'sawtooth', 0.04, 0.12],
    [370, 0.4, 'sawtooth', 0.04, 0.24],
  ],
  bulwark: [
    [196, 0.6, 'triangle', 0.16, 0],
    [294, 0.5, 'sine', 0.1, 0.05],
  ],
  // #81 : les reflets (C2.10), d'après `sfx.tell` de la maquette, sans le bruit blanc.
  glint: [
    [2_700, 0.09, 'triangle', 0.17, 0],
    [4_000, 0.06, 'sine', 0.06, 0],
  ],
  'glint-double': [
    [2_700, 0.09, 'triangle', 0.17, 0],
    [4_000, 0.06, 'sine', 0.06, 0],
    [3_200, 0.08, 'triangle', 0.15, 0.055],
    [4_600, 0.05, 'sine', 0.05, 0.055],
  ],
  'glint-perilous': [[1_500, 0.16, 'sawtooth', 0.07, 0, 900]],
  'glint-dull': [[520, 0.07, 'square', 0.035, 0, 380]],
  // #106 : le cliquetis d'os de l'ennemi qui se relève seul ; la maquette n'en a pas, des claquements secs.
  'bone-rattle': [
    [900, 0.04, 'square', 0.05, 0],
    [1_200, 0.04, 'square', 0.05, 0.07],
    [750, 0.04, 'square', 0.05, 0.14],
    [1_050, 0.05, 'square', 0.05, 0.21],
  ],
  // #107 : la goutte sourde du Saignement, une note grave qui tombe.
  bleed: [[420, 0.16, 'sine', 0.16, 0, 180]],
  // #128 : le choc de bouclier de la Riposte du Rempart, grave et mat (bois cerclé de fer), sans
  // glissando aigu : on ne le confond ni avec la parade parfaite ni avec la cassure.
  'shield-clash': [
    [180, 0.04, 'square', 0.06, 0],
    [130, 0.15, 'triangle', 0.2, 0],
    [85, 0.15, 'sine', 0.18, 0],
  ],
};

const WAVES = {
  sine: (phase) => Math.sin(2 * Math.PI * phase),
  triangle: (phase) => 1 - 4 * Math.abs(Math.round(phase - 0.25) - (phase - 0.25)),
  square: (phase) => (phase % 1 < 0.5 ? 1 : -1),
  sawtooth: (phase) => 2 * (phase - Math.floor(phase + 0.5)),
};

/**
 * La phase d'une note à l'instant `time` : sa fréquence glisse de `from` à `to` en `duration`
 * (rampe exponentielle, comme `exponentialRampToValueAtTime`), ou reste à `from`.
 */
function phaseAt(from, to, duration, time) {
  if (to === undefined || to === from) return from * time;
  const ratio = Math.log(to / from);
  return (from * duration * (Math.exp((ratio * time) / duration) - 1)) / ratio;
}

/** Les échantillons d'un son : chaque note décroît de son volume à 0,0001 (rampe exponentielle). */
export function renderSamples(notes) {
  const length = Math.ceil(
    Math.max(...notes.map(([, duration, , , at]) => at + duration)) * SAMPLE_RATE,
  );
  const samples = new Float64Array(length);
  for (const [frequency, duration, wave, volume, at, to] of notes) {
    const first = Math.round(at * SAMPLE_RATE);
    const count = Math.round(duration * SAMPLE_RATE);
    for (let index = 0; index < count; index += 1) {
      const time = index / SAMPLE_RATE;
      const gain = volume * Math.pow(0.0001 / volume, time / duration);
      samples[first + index] += gain * WAVES[wave](phaseAt(frequency, to, duration, time));
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
