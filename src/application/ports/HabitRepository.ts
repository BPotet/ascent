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
  /**
   * Renomme l'habitude (#6, R18). Son identifiant, son jour de création, sa place dans l'ordre de
   * création et ses suivis ne changent pas ; son ancien nom redevient libre. Les règles (doublon)
   * sont vérifiées avant par le domaine ; un nom dont la clé est celle d'une autre habitude est tout
   * de même refusé par une exception. Sans effet si l'habitude n'existe pas.
   */
  rename(id: HabitId, name: HabitName): Promise<void>;
  /**
   * Supprime définitivement l'habitude et efface tous ses suivis avec elle (#6, R17). Son nom
   * redevient libre ; son identifiant n'est jamais réattribué. Sans effet si elle n'existe pas.
   * L'expérience n'est pas touchée : c'est au cas d'usage de l'ajuster dans la même unité de travail.
   */
  remove(id: HabitId): Promise<void>;
}
