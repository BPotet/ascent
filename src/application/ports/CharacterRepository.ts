import type { Character } from '../../domain/character/Character';

/**
 * Dépôt du personnage (`CharacterRepository`). On ne l'obtient que dans une unité de travail
 * (`UnitOfWork`) : l'expérience change dans la même transaction que le suivi qui la fait varier
 * (ADR 0002, décision 5). Il n'y a qu'un personnage. Une panne de stockage est une exception.
 */
export interface CharacterRepository {
  /** Le personnage, avec son expérience et son Xp conservée (0 et 0 pour un nouveau joueur). */
  get(): Promise<Character>;
  /** Enregistre le personnage, en remplaçant le précédent. */
  save(character: Character): Promise<void>;
}
