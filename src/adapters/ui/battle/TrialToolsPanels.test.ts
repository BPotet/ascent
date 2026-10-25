import { measureLines } from './TrialToolsPanels';

const none = {
  touch: { count: 0, complete: false, measure: null },
  session: { redatedPresses: 0, deltas: [], strikeDeltas: [] },
  frames: { frames: 0, dropped: 0, worstGap: 0 },
  soundLatencies: [],
  expectedSoundLatency: 67.5,
} as const;

describe('measureLines (measures panel)', () => {
  it('says when nothing is measured yet', () => {
    expect(measureLines(none)).toEqual([
      'Toucher → JS : aucun appui',
      'Méthode recalculée : —',
      'Appuis redatés : 0',
      'Images perdues : 0 sur 0 (0 %), pire écart 0 ms',
      'Latence du son : aucune mesure',
      'Latence attendue : 67,5 ms',
      'Écarts jugés (0) : aucune mesure',
      'Répartition : −160 à −61 : 0 · ±60 : 0 · 61 à 160 : 0',
      'Écarts des frappes (0) : aucune mesure',
      'Répartition des frappes : −160 à −61 : 0 · ±60 : 0 · 61 à 160 : 0',
    ]);
  });

  it('reports the touches, the redated presses, the frames, the sound and the deltas', () => {
    expect(
      measureLines({
        touch: { count: 3, complete: false, measure: { median: 4.2, p95: 11, method: 'b' } },
        session: {
          redatedPresses: 2,
          deltas: [-150, -61, -60, 0, 60, 61, 160],
          strikeDeltas: [-300, 40],
        },
        frames: { frames: 200, dropped: 3, worstGap: 48.4 },
        soundLatencies: [30, 10, 20],
        expectedSoundLatency: 20,
      }),
    ).toEqual([
      'Toucher → JS (3 appuis) : médiane 4,2 ms, p95 11 ms',
      'Méthode recalculée : b',
      'Appuis redatés : 2',
      'Images perdues : 3 sur 200 (2 %), pire écart 48,4 ms',
      'Latence du son : médiane 20 ms, p95 30 ms',
      'Latence attendue : 20 ms',
      'Écarts jugés (7) : médiane 61 ms, p95 160 ms',
      'Répartition : −160 à −61 : 2 · ±60 : 3 · 61 à 160 : 2',
      'Écarts des frappes (2) : médiane 170 ms, p95 300 ms',
      'Répartition des frappes : −160 à −61 : 1 · ±60 : 1 · 61 à 160 : 0',
    ]);
  });
});
