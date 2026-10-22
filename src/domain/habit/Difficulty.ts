/**
 * Difficulté (`Difficulty`), voir `docs/glossary.md` : le niveau d'effort d'une habitude, **Facile**
 * (`easy`), **Moyenne** (`medium`) ou **Difficile** (`hard`). Elle fixe l'expérience d'une case
 * « fait » (R1) et la prime unitaire de la prime d'objectif (#26, R8). Un changement s'applique à toute la semaine en cours et aux suivantes, jamais aux
 * semaines closes (R12) : la difficulté d'une semaine se lit dans ses réglages (`WeekSettings`).
 */
export type Difficulty = 'easy' | 'medium' | 'hard';

/** Les difficultés, dans l'ordre d'affichage. */
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

/** Moyenne, à la création comme pour les habitudes créées avant la difficulté (R2). */
export const DEFAULT_DIFFICULTY: Difficulty = 'medium';

/** Le barème : l'expérience d'une case « fait », selon la difficulté de sa semaine (R1). */
export const XP_PER_CHECK_IN: Readonly<Record<Difficulty, number>> = {
  easy: 5,
  medium: 10,
  hard: 20,
};

/**
 * La prime unitaire (#26, R8) : la prime d'objectif d'une semaine atteinte vaut l'objectif de la
 * semaine multiplié par la prime unitaire de la difficulté de la semaine (Facile 3 à 21, Moyenne 5 à
 * 35, Difficile 10 à 70). Valeurs du barème, pas un calcul à partir de `XP_PER_CHECK_IN`.
 */
export const TARGET_BONUS_PER_UNIT: Readonly<Record<Difficulty, number>> = {
  easy: 3,
  medium: 5,
  hard: 10,
};

/** Refus : la valeur n'est pas une difficulté (donnée stockée invalide, ou appel erroné). */
export class InvalidDifficultyError extends Error {
  constructor(value: unknown) {
    super(`Invalid difficulty: ${JSON.stringify(value)}`);
    this.name = 'InvalidDifficultyError';
  }
}

/** La difficulté écrite `value` (`easy`, `medium` ou `hard`), sinon `InvalidDifficultyError`. */
export function parseDifficulty(value: unknown): Difficulty {
  const difficulty = DIFFICULTIES.find((each) => each === value);
  if (difficulty === undefined) {
    throw new InvalidDifficultyError(value);
  }
  return difficulty;
}
