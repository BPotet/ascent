import {
  EmptyHabitNameError,
  HabitName,
  HabitNameTooLongError,
  MAX_HABIT_NAME_LENGTH,
  habitNameLength,
} from './HabitName';

describe('HabitName', () => {
  describe('parse', () => {
    it('keeps a clean name as typed, capitals included', () => {
      expect(HabitName.parse('Cuisiner').value).toBe('Cuisiner');
    });

    it('removes leading and trailing spaces', () => {
      expect(HabitName.parse('  Cuisiner \t').value).toBe('Cuisiner');
    });

    it('reduces inner spaces to a single one', () => {
      expect(HabitName.parse('   Lire   20  minutes  ').value).toBe('Lire 20 minutes');
    });

    it('treats non-breaking spaces and line breaks as spaces', () => {
      expect(HabitName.parse(' Lire  20\n minutes ').value).toBe('Lire 20 minutes');
    });

    it('composes accents (NFC), so that a typed and a pasted « É » are the same', () => {
      const decomposed = 'Été';

      expect(HabitName.parse(decomposed).value).toBe('Été');
    });

    it.each(['', '   ', ' \t\n'])('refuses the empty name %p', (raw) => {
      expect(() => HabitName.parse(raw)).toThrow(EmptyHabitNameError);
    });

    it.each([
      ['zero width space', '\u200b'],
      ['zero width non-joiner', '\u200c'],
      ['zero width joiner', '\u200d'],
      ['word joiner', '\u2060'],
      ['byte order mark', '\ufeff'],
      ['no-break space', '\u00a0'],
      ['ideographic space', '\u3000'],
      ['a mix of invisible characters and spaces', ' \u200b\u3000\u2060 \u200d\ufeff\u200c '],
    ])('refuses a name made only of invisible characters (%s)', (_, raw) => {
      expect(() => HabitName.parse(raw)).toThrow(EmptyHabitNameError);
      expect(habitNameLength(raw)).toBe(0);
    });

    it('removes invisible characters at the start and the end', () => {
      expect(HabitName.parse('\u200b\ufeff Cuisiner\u2060\u200c \u200d').value).toBe('Cuisiner');
      expect(HabitName.parse('\u200bCuisiner').value).toBe('Cuisiner');
      expect(HabitName.parse('Cuisiner\u200b').value).toBe('Cuisiner');
    });

    it('reduces inner Unicode spaces to a single space', () => {
      expect(HabitName.parse('Lire\u3000\u00a0 20\u2003minutes').value).toBe('Lire 20 minutes');
    });

    it('keeps the joiners inside a composed emoji', () => {
      const family = '\u{1f468}\u200d\u{1f469}\u200d\u{1f467}';

      expect(HabitName.parse(` \u200b${family}\u200b `).value).toBe(family);
      expect(HabitName.parse(`Famille ${family}`).value).toBe(`Famille ${family}`);
    });

    it('accepts 1 and 40 characters', () => {
      expect(HabitName.parse('a').value).toBe('a');
      expect(HabitName.parse('a'.repeat(40)).value).toBe('a'.repeat(40));
    });

    it('refuses 41 characters, with the limit in the error', () => {
      expect(() => HabitName.parse('a'.repeat(41))).toThrow(new HabitNameTooLongError(41));
      expect(new HabitNameTooLongError(41).maxLength).toBe(MAX_HABIT_NAME_LENGTH);
      expect(new HabitNameTooLongError(41).length).toBe(41);
    });

    it('counts the length after cleaning', () => {
      expect(HabitName.parse(`  ${'a'.repeat(40)}  `).value).toHaveLength(40);
    });

    it('counts a simple emoji as one character', () => {
      const name = `${'a'.repeat(39)}🍳`;

      expect(HabitName.parse(name).value).toBe(name);
      expect(() => HabitName.parse(`${name}a`)).toThrow(HabitNameTooLongError);
    });

    it('accepts a name made of a single emoji', () => {
      expect(HabitName.parse(' 🍳 ').value).toBe('🍳');
    });

    it('counts a composed emoji as its code points (ADR 0002)', () => {
      const family = '\u{1F468}‍\u{1F469}‍\u{1F467}';
      const flag = '\u{1F1EB}\u{1F1F7}';

      expect(habitNameLength(family)).toBe(5);
      expect(habitNameLength(flag)).toBe(2);
      expect(HabitName.parse(`${'a'.repeat(35)}${family}`).value).toBe(
        `${'a'.repeat(35)}${family}`,
      );
      expect(() => HabitName.parse(`${'a'.repeat(36)}${family}`)).toThrow(
        new HabitNameTooLongError(41),
      );
    });

    it('counts a decomposed accent as one character, after composing it (NFC)', () => {
      const decomposedE = 'é';

      expect(HabitName.parse(decomposedE.repeat(40)).value).toBe('é'.repeat(40));
      expect(() => HabitName.parse(decomposedE.repeat(41))).toThrow(new HabitNameTooLongError(41));
    });

    it('accepts 40 characters once the spaces are cleaned, and refuses 41', () => {
      const words = `${'a'.repeat(19)}   ${'b'.repeat(20)}`;

      expect(HabitName.parse(`  ${words}  `).value).toHaveLength(40);
      expect(() => HabitName.parse(`${words}b`)).toThrow(new HabitNameTooLongError(41));
    });

    it('names its errors', () => {
      expect(new EmptyHabitNameError().name).toBe('EmptyHabitNameError');
      expect(new HabitNameTooLongError(41).name).toBe('HabitNameTooLongError');
      expect(new EmptyHabitNameError().message).toBe('A habit name cannot be empty');
      expect(new HabitNameTooLongError(41).message).toBe(
        'A habit name has at most 40 characters, got 41',
      );
    });
  });

  describe('key', () => {
    it('ignores capitals', () => {
      expect(HabitName.parse('Cuisiner').key).toBe(HabitName.parse('cuisiner  ').key);
      expect(HabitName.parse('ÉTÉ').key).toBe('été');
    });

    it('keeps accents', () => {
      expect(HabitName.parse('Eté sans sucre').key).not.toBe(HabitName.parse('Été sans sucre').key);
    });

    it('is the same for a decomposed accent typed in capitals', () => {
      expect(HabitName.parse('ÉTÉ sans sucre').key).toBe(HabitName.parse('été sans sucre').key);
    });

    it('is the same for a composed and a decomposed accent', () => {
      expect(HabitName.parse('Été').key).toBe(HabitName.parse('été').key);
    });
  });

  describe('sameAs', () => {
    it('compares names by their key', () => {
      expect(HabitName.parse('Cuisiner').sameAs(HabitName.parse('CUISINER'))).toBe(true);
      expect(HabitName.parse('Eté').sameAs(HabitName.parse('Été'))).toBe(false);
    });
  });

  describe('habitNameLength', () => {
    it('gives the length of the cleaned name, for the counter', () => {
      expect(habitNameLength('')).toBe(0);
      expect(habitNameLength('   ')).toBe(0);
      expect(habitNameLength('  Lire   20 minutes ')).toBe(15);
      expect(habitNameLength('Cuisiner 🍳')).toBe(10);
      expect(habitNameLength('\u200b Lire \ufeff')).toBe(4);
      expect(habitNameLength('a'.repeat(41))).toBe(41);
    });
  });
});
