import {
  DEFAULT_DIFFICULTY,
  DIFFICULTIES,
  InvalidDifficultyError,
  parseDifficulty,
  TARGET_BONUS_PER_UNIT,
  XP_PER_CHECK_IN,
} from './Difficulty';

describe('Difficulty', () => {
  it('pays 5, 10 and 20 Xp per check-in « fait » for Facile, Moyenne and Difficile', () => {
    expect(XP_PER_CHECK_IN).toEqual({ easy: 5, medium: 10, hard: 20 });
  });

  it('gives a unit bonus of 3, 5 and 10 Xp for Facile, Moyenne and Difficile (#26, R8)', () => {
    expect(TARGET_BONUS_PER_UNIT).toEqual({ easy: 3, medium: 5, hard: 10 });
  });

  it('lists the difficulties in display order', () => {
    expect(DIFFICULTIES).toEqual(['easy', 'medium', 'hard']);
  });

  it('is Moyenne by default (R2)', () => {
    expect(DEFAULT_DIFFICULTY).toBe('medium');
  });

  it.each(['easy', 'medium', 'hard'])('reads %p', (text) => {
    expect(parseDifficulty(text)).toBe(text);
  });

  it.each(['', 'Easy', 'MEDIUM', 'facile', 'very hard', ' hard', 'toString', null, undefined, 10])(
    'refuses %p',
    (value) => {
      expect(() => parseDifficulty(value)).toThrow(InvalidDifficultyError);
    },
  );

  it('tells which value is invalid', () => {
    expect(() => parseDifficulty('facile')).toThrow('Invalid difficulty: "facile"');
    expect(new InvalidDifficultyError(null).name).toBe('InvalidDifficultyError');
  });
});
