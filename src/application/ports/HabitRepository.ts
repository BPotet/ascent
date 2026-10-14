import type { Day } from '../../domain/day/Day';
import type { Habit, HabitId } from '../../domain/habit/Habit';
import type { HabitName } from '../../domain/habit/HabitName';

/**
 * Dépôt des habitudes (`HabitRepository`). On ne l'obtient que dans une unité de travail
 * (`UnitOfWork`). Une panne de stockage est une exception.
 */
export interface HabitRepository {
  /** Toutes les habitudes existantes, dans leur ordre de création. */
  listAll(): Promise<Habit[]>;
  /** L'habitude qui porte cet identifiant, ou `null` si elle n'existe pas. */
  findById(id: HabitId): Promise<Habit | null>;
  /**
   * Enregistre une nouvelle habitude et lui attribue un identifiant, plus grand que tous ceux déjà
   * attribués. Les règles (limite, doublon) sont vérifiées avant par le domaine ; un nom dont la clé
   * existe déjà est tout de même refusé par une exception.
   */
  add(name: HabitName, createdOn: Day): Promise<Habit>;
}
