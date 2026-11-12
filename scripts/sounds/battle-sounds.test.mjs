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
      'bleed.wav',
      'bone-rattle.wav',
      'bulwark.wav',
      'burn-crackle.wav',
      'burn-out.wav',
      'candle-snuff.wav',
      'charge-broken.wav',
      'charge-scrape.wav',
      'defeat.wav',
      'dodge.wav',
      'ember-burst.wav',
      'ember-smother.wav',
      'enemy-phase.wav',
      'flame-breath.wav',
      'glint-double.wav',
      'glint-dull.wav',
      'glint-perilous.wav',
      'glint-sweep.wav',
      'glint.wav',
      'guard-break.wav',
      'guard-restore.wav',
      'guard-up.wav',
      'hero-phase.wav',
      'hit.wav',
      'lost-action.wav',
      'momentum-steal.wav',
      'parry.wav',
      'perfect-parry.wav',
      'perfect-strike.wav',
      'raise.wav',
      'rat-squeak.wav',
      'seal.wav',
      'shield-clash.wav',
      'strike.wav',
      'sweep-drone.wav',
      'victory.wav',
      'whiff.wav',
      'wing-rustle-loud.wav',
      'wing-rustle.wav',
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

  it('makes the shield clash low and dull: under 200 Hz, about 150 ms, without a slide (#128)', () => {
    const notes = CUES['shield-clash'];
    assert.ok(notes.every(([frequency]) => frequency < 200));
    assert.ok(
      notes.every((note) => note.length === 5),
      'no sliding note',
    );
    assert.equal(Math.max(...notes.map(([, duration, , , at]) => at + duration)), 0.15);
  });

  const lasts = (notes) => Math.max(...notes.map(([, duration, , , at]) => at + duration));

  it('makes the flame breath of the Burn short, over the hit or the parry (#171)', () => {
    assert.ok(lasts(CUES['flame-breath']) <= 0.2);
  });

  it('makes the crackle of the Burn dry, 400 ms long, more discreet than the hit (#171)', () => {
    const notes = CUES['burn-crackle'];
    const [[, , , hitVolume]] = CUES.hit;
    assert.ok(Math.abs(lasts(notes) - 0.4) < 1e-9);
    assert.ok(notes.length > 3, 'several dry clicks');
    assert.ok(notes.every(([, duration, , volume]) => duration <= 0.05 && volume < hitVolume));
  });

  it('makes a flame go out with a brief, high and soft « pschht » (#171)', () => {
    const notes = CUES['burn-out'];
    assert.ok(lasts(notes) <= 0.15);
    assert.ok(notes.every(([frequency, , , volume]) => frequency >= 1_000 && volume <= 0.06));
  });

  it('rustles the wings of the Summon softly, then louder at the entry (#172)', () => {
    const soft = CUES['wing-rustle'];
    const loud = CUES['wing-rustle-loud'];
    const peak = (notes) => Math.max(...notes.map(([, , , volume]) => volume));
    assert.ok(soft.length > 3 && loud.length > 3, 'several flutters of wings');
    assert.ok(peak(loud) > peak(soft));
    assert.ok(lasts(soft) <= 0.5 && lasts(loud) <= 0.6);
  });

  it('makes the drone of the Sweep a low bell that swells, the opposite of the seal (#266)', () => {
    const notes = CUES['sweep-drone'];
    const volumes = notes.map(([, , , volume]) => volume);
    assert.ok(
      notes.every(([frequency]) => frequency < 200),
      'low',
    );
    assert.ok(
      notes.every(([, , wave]) => wave !== 'sawtooth'),
      'not the saw of the seal',
    );
    assert.deepEqual(
      [...volumes].sort((a, b) => a - b),
      volumes,
      'it swells',
    );
    assert.ok(lasts(notes) >= 0.5 && lasts(notes) <= 0.65);
  });

  it('makes the Sweep glint a grazing whistle, its own fifth glint sound (#266)', () => {
    const notes = CUES['glint-sweep'];
    assert.ok(lasts(notes) <= 0.15);
    assert.notDeepEqual(notes, CUES.glint);
    assert.ok(
      notes.some(([from, , , , , to]) => to !== undefined && to < from),
      'it grazes down',
    );
  });

  it('makes the Charge scrape a hoof and a puff of steam, then the broken Charge a cracked gong (#266)', () => {
    const scrape = CUES['charge-scrape'];
    const gong = CUES['charge-broken'];
    assert.ok(scrape.length >= 3 && lasts(scrape) <= 0.5);
    assert.ok(gong.length >= 2 && lasts(gong) <= 0.65);
    assert.ok(
      gong.some(([frequency]) => frequency < 200),
      'a low gong',
    );
  });

  it('makes the Burst of the Ember pod a dry crack, short, louder than the flame breath (#267)', () => {
    const notes = CUES['ember-burst'];
    const loudest = (cue) => Math.max(...cue.map(([, , , volume]) => volume));
    assert.ok(lasts(notes) <= 0.3);
    assert.ok(notes[0][1] <= 0.06, 'a dry attack');
    assert.ok(loudest(notes) > loudest(CUES['flame-breath']));
  });

  it('makes a smothered pod a breath that goes out: soft, sliding down, without a crack (#267)', () => {
    const notes = CUES['ember-smother'];
    assert.ok(lasts(notes) <= 0.6);
    assert.ok(
      notes.every(([, , wave]) => wave !== 'square'),
      'no crack',
    );
    assert.ok(
      notes.every(([, , , volume]) => volume <= 0.06),
      'soft',
    );
    assert.ok(
      notes.every(([from, , , , , to]) => to !== undefined && to < from),
      'it goes out',
    );
  });

  it('makes the theft a beat of wings, then a chime that moves away (#267)', () => {
    const notes = CUES['momentum-steal'];
    const wings = notes.filter(([frequency]) => frequency < 1_000);
    const chime = notes.filter(([frequency]) => frequency >= 1_000);
    assert.ok(wings.length >= 2, 'a beat of wings');
    assert.ok(chime.length >= 1, 'a chime');
    const [first] = chime;
    assert.ok(first[4] > Math.min(...wings.map(([, , , , at]) => at)), 'after the wings');
    assert.ok(
      chime.every(([, , , volume]) => volume <= chime[0][3]),
      'it moves away',
    );
    assert.ok(lasts(notes) <= 0.6);
  });
  it('blows the candle out softly, a falling breath, under half a second (#268)', () => {
    const notes = CUES['candle-snuff'];
    assert.ok(lasts(notes) <= 0.35);
    assert.ok(
      notes.some(([from, , , , , to]) => to !== undefined && to < from),
      'a falling breath',
    );
    assert.ok(Math.max(...notes.map(([, , , volume]) => volume)) <= 0.06, 'soft');
  });

  it('makes the squeak of a Crypt rat short and high, rising (#268)', () => {
    const notes = CUES['rat-squeak'];
    assert.ok(lasts(notes) <= 0.15);
    assert.ok(notes.every(([frequency]) => frequency >= 2_000));
    assert.ok(notes.every(([from, , , , , to]) => to !== undefined && to > from));
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
