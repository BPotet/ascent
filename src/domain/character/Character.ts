/** L'expérience gagnée quand une case passe à « fait », perdue quand elle revient en arrière (R14). */
export const XP_PER_CHECK_IN = 10;

/** Refus : une expérience est toujours un nombre entier de points, jamais négatif (R16). */
export class InvalidXpError extends Error {
  constructor(field: 'xp' | 'retainedXp', value: number) {
    super(`Invalid ${field}: ${value}`);
    this.name = 'InvalidXpError';
  }
}

function assertValidXp(field: 'xp' | 'retainedXp', value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new InvalidXpError(field, value);
  }
}

/**
 * Personnage (`Character`), voir `docs/glossary.md` et l'ADR 0002 (décision 5). Il n'y en a qu'un.
 * - `xp` : son expérience totale, toutes habitudes confondues, un solde jamais négatif (R16) ;
 * - `retainedXp` : l'Xp conservée, acquise sur les jours clos d'habitudes supprimées (R17, #6).
 *
 * Invariant (R15, précisé par la note Ready de l'épique) : `xp = 10 × (suivis « fait » des
 * habitudes existantes, toutes dates confondues) + retainedXp`, tant que le plancher n'a pas joué.
 * Un recul d'horloge ou un changement de fuseau ne change donc jamais l'expérience (R6).
 * Immuable : chaque changement renvoie un nouveau personnage.
 */
export class Character {
  /** Le personnage d'un joueur qui n'a encore rien fait. */
  static readonly NEW = new Character(0, 0);

  constructor(
    readonly xp: number,
    readonly retainedXp = 0,
  ) {
    assertValidXp('xp', xp);
    assertValidXp('retainedXp', retainedXp);
  }

  /**
   * Le personnage après un vrai changement d'état d'une case, aujourd'hui ou par correction (R11,
   * R14) : +10 Xp si elle passe à « fait », −10 Xp si elle revient en arrière, jamais sous 0 (R16).
   */
  applyCheckInChange(done: boolean): Character {
    const change = done ? XP_PER_CHECK_IN : -XP_PER_CHECK_IN;
    return new Character(Math.max(0, this.xp + change), this.retainedXp);
  }

  /** La variation d'expérience de ce personnage à `next` (ex. +10, −10, ou 0 au plancher). */
  xpChangeTo(next: Character): number {
    return next.xp - this.xp;
  }
}
