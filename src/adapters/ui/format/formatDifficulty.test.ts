import {
  difficultyAccessibilityLabel,
  difficultyChangeMessage,
  difficultyLabels,
  difficultyXpLabel,
  peakCount,
} from './formatDifficulty';

describe('difficultyLabels', () => {
  it('names each difficulty as the glossary writes it', () => {
    expect(difficultyLabels).toEqual({ easy: 'Facile', medium: 'Moyenne', hard: 'Difficile' });
  });
});

describe('difficultyXpLabel', () => {
  it.each([
    ['easy', '+5 XP'],
    ['medium', '+10 XP'],
    ['hard', '+20 XP'],
  ] as const)('writes what a check-in brings in %s: « %s »', (difficulty, text) => {
    expect(difficultyXpLabel(difficulty)).toBe(text);
  });
});

describe('difficultyAccessibilityLabel', () => {
  it.each([
    ['easy', 'Facile, 5 XP par suivi'],
    ['medium', 'Moyenne, 10 XP par suivi'],
    ['hard', 'Difficile, 20 XP par suivi'],
  ] as const)('reads %s « %s » (maquette, « Lecteur d’écran »)', (difficulty, text) => {
    expect(difficultyAccessibilityLabel(difficulty)).toBe(text);
  });
});

describe('peakCount', () => {
  it.each([
    ['easy', 1],
    ['medium', 2],
    ['hard', 3],
  ] as const)('draws %s with %d summit(s)', (difficulty, count) => {
    expect(peakCount(difficulty)).toBe(count);
  });
});

describe('difficultyChangeMessage', () => {
  it('says the whole current week is re-evaluated at the chosen rate, not past weeks', () => {
    expect(difficultyChangeMessage('hard')).toBe(
      'S’applique à toute cette semaine : les suivis de la semaine rapporteront +20 XP. Les semaines passées ne changent pas.',
    );
    expect(difficultyChangeMessage('easy')).toContain('rapporteront +5 XP.');
  });
});
