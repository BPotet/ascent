import type { DeletionXp } from './HabitXp';

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
 * Personnage (`Character`), voir `docs/glossary.md`, l'ADR 0002 et l'ADR 0003. Il n'y en a qu'un.
 * - `xp` : son expérience totale, toutes habitudes confondues, un solde jamais négatif (R16) ;
 * - `retainedXp` : l'Xp conservée, acquise sur les jours clos d'habitudes supprimées (R17, #6).
 *
 * Invariant de l'expérience (ADR 0003, qui remplace la décision 5 de l'ADR 0002) : `xp` vaut la
 * somme, sur les habitudes existantes, des suivis « fait » de toutes dates, chacun au barème de la
 * difficulté de sa semaine, plus les primes d'objectif des semaines où l'objectif est atteint
 * (`habitXpOf`, #26), plus `retainedXp`, tant que le plancher n'a pas joué. Il ne dépend pas
 * d'aujourd'hui : un recul d'horloge, un changement de fuseau ou un changement de réglages ne change
 * jamais une semaine close. Le solde est tenu par les variations que calcule `HabitXp`.
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
   * Le personnage après une variation `xpChange` de son expérience, calculée par `HabitXp` : un vrai
   * changement d'état d'une case, aujourd'hui ou par correction (R1, R14), ou un changement de
   * difficulté (R12). Jamais sous 0 ; l'Xp conservée ne change pas.
   */
  applyXpChange(xpChange: number): Character {
    return new Character(Math.max(0, this.xp + xpChange), this.retainedXp);
  }

  /**
   * Le personnage après la suppression d'une habitude, selon `deletionXpOf` (R18, R19) :
   * l'expérience `removed` (celle de son suivi d'aujourd'hui, et la prime d'objectif qui tombe sans
   * lui) est retirée, jamais sous 0 ; l'expérience `retained` (celle de ses autres jours, primes
   * d'objectif encore acquises comprises) reste acquise et passe dans l'Xp conservée. L'invariant de
   * l'expérience est ainsi préservé une fois ses suivis effacés.
   */
  retainOnHabitDeletion({
    removed,
    retained,
  }: Pick<DeletionXp, 'removed' | 'retained'>): Character {
    return new Character(Math.max(0, this.xp - removed), this.retainedXp + retained);
  }

  /** La variation d'expérience de ce personnage à `next` (ex. +20, −5, ou 0 au plancher). */
  xpChangeTo(next: Character): number {
    return next.xp - this.xp;
  }
}
