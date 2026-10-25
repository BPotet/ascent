// Sons provisoires du combat : des WAV valides, courts (< 30 ko) et reproductibles.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  CUES,
  OUTPUT_DIR,
  SAMPLE_RATE,
  encodeWav,
  renderAll,
  renderSamples,
} from './battle-sounds.mjs';

describe('provisional battle sounds', () => {
  const rendered = renderAll();

  it('gives one sound per cue of the battle', () => {
    assert.deepEqual(Object.keys(rendered).sort(), [
      'bulwark.wav',
      'defeat.wav',
      'dodge.wav',
      'enemy-phase.wav',
      'glint-double.wav',
      'glint-dull.wav',
      'glint-perilous.wav',
      'glint.wav',
      'guard-break.wav',
      'guard-restore.wav',
      'guard-up.wav',
      'hero-phase.wav',
      'hit.wav',
      'lost-action.wav',
      'parry.wav',
      'perfect-parry.wav',
      'perfect-strike.wav',
      'raise.wav',
      'seal.wav',
      'strike.wav',
      'victory.wav',
      'whiff.wav',
    ]);
  });

  for (const [file, content] of Object.entries(rendered)) {
    it(`writes ${file} as a valid 16-bit mono PCM WAV under 30 kB`, () => {
      assert.equal(content.toString('ascii', 0, 4), 'RIFF');
      assert.equal(content.readUInt32LE(4), content.length - 8);
      assert.equal(content.toString('ascii', 8, 16), 'WAVEfmt ');
      assert.equal(content.readUInt16LE(20), 1);
      assert.equal(content.readUInt16LE(22), 1);
      assert.equal(content.readUInt32LE(24), SAMPLE_RATE);
      assert.equal(content.readUInt16LE(34), 16);
      assert.equal(content.toString('ascii', 36, 40), 'data');
      assert.equal(content.readUInt32LE(40), content.length - 44);
      assert.ok(content.length < 30_000, `${file} is ${content.length} bytes`);
    });
  }

  it('renders the same bytes every time', () => {
    assert.deepEqual(renderAll(), rendered);
  });

  it('matches the files of the app, so they are regenerated after a change', () => {
    assert.deepEqual(readdirSync(OUTPUT_DIR).sort(), Object.keys(rendered).sort());
    for (const [file, content] of Object.entries(rendered)) {
      assert.ok(readFileSync(join(OUTPUT_DIR, file)).equals(content), `${file} is outdated`);
    }
  });

  it('lasts as long as its last note, and stays within [-1, 1]', () => {
    const samples = renderSamples(CUES['enemy-phase']);
    assert.equal(samples.length, Math.ceil(0.52 * SAMPLE_RATE));
    assert.ok(samples.every((sample) => sample >= -1 && sample <= 1));
    assert.ok(samples.some((sample) => Math.abs(sample) > 0.05));
  });

  it('makes the dull glint a square sound sliding from 520 to 380 Hz, like the mockup', () => {
    assert.deepEqual(CUES['glint-dull'], [[520, 0.07, 'square', 0.035, 0, 380]]);
  });

  it('slides a note to its last frequency (exponential ramp)', () => {
    const crossings = (samples) =>
      samples.slice(1).filter((sample, index) => Math.sign(sample) !== Math.sign(samples[index]))
        .length;
    const tenth = Math.round(0.1 * SAMPLE_RATE);
    const glide = renderSamples([[2_000, 1, 'sine', 0.5, 0, 500]]);
    const start = crossings(glide.slice(0, tenth));
    const end = crossings(glide.slice(-tenth));
    assert.ok(start > 3 * end, `${start} crossings at the start, ${end} at the end`);
    assert.deepEqual(
      renderSamples([[440, 0.1, 'sine', 0.5, 0, 440]]),
      renderSamples([[440, 0.1, 'sine', 0.5, 0]]),
    );
  });

  it('clips the samples beyond full scale', () => {
    const wav = encodeWav(Float64Array.from([2, -2, 0]));
    assert.deepEqual(
      [wav.readInt16LE(44), wav.readInt16LE(46), wav.readInt16LE(48)],
      [32_767, -32_767, 0],
    );
  });
});
