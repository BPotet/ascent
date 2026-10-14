/**
 * Nom d'une habitude (`Habit`), voir `docs/glossary.md`.
 * Les espaces superflus sont retirés ; le nom compte alors de 1 à 40 caractères (points de code :
 * un emoji simple compte pour un). Deux noms sont identiques s'ils ont la même clé (`key`) :
 * sans tenir compte des majuscules, mais en tenant compte des accents.
 */
export const MAX_HABIT_NAME_LENGTH = 40;

export class EmptyHabitNameError extends Error {
  constructor() {
    super('A habit name cannot be empty');
    this.name = 'EmptyHabitNameError';
  }
}

export class HabitNameTooLongError extends Error {
  readonly maxLength = MAX_HABIT_NAME_LENGTH;

  constructor(readonly length: number) {
    super(`A habit name has at most ${MAX_HABIT_NAME_LENGTH} characters, got ${length}`);
    this.name = 'HabitNameTooLongError';
  }
}

/**
 * Caractères sans chasse, invisibles mais absents de `\s` : espace sans chasse (U+200B),
 * antiliant et liant sans chasse (U+200C, U+200D), gluon de mots (U+2060), et U+FEFF.
 * À l'intérieur du nom, ils sont gardés : le liant (U+200D) compose les emoji (famille…).
 */
const LEADING_OR_TRAILING_BLANKS =
  /^[\s\u200b-\u200d\u2060\ufeff]+|[\s\u200b-\u200d\u2060\ufeff]+$/gu;

function clean(raw: string): string {
  return raw.normalize('NFC').replace(/\s+/gu, ' ').replace(LEADING_OR_TRAILING_BLANKS, '');
}

function countCharacters(text: string): number {
  return Array.from(text).length;
}

/** La longueur du nom une fois nettoyé, telle que la règle la compte (compteur de la saisie). */
export function habitNameLength(raw: string): number {
  return countCharacters(clean(raw));
}

export class HabitName {
  /** Le nom à comparer pour repérer les doublons : le nom nettoyé, en minuscules. */
  readonly key: string;

  private constructor(readonly value: string) {
    this.key = value.toLowerCase();
  }

  /** Nettoie le nom saisi et vérifie sa longueur. */
  static parse(raw: string): HabitName {
    const value = clean(raw);
    const length = countCharacters(value);
    if (length === 0) {
      throw new EmptyHabitNameError();
    }
    if (length > MAX_HABIT_NAME_LENGTH) {
      throw new HabitNameTooLongError(length);
    }
    return new HabitName(value);
  }

  sameAs(other: HabitName): boolean {
    return this.key === other.key;
  }
}
