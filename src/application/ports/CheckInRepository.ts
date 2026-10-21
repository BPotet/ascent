import type { CheckIn } from '../../domain/checkIn/CheckIn';
import type { Day } from '../../domain/day/Day';
import type { HabitId } from '../../domain/habit/Habit';

/**
 * Dépôt des suivis (`CheckInRepository`). On ne l'obtient que dans une unité de travail
 * (`UnitOfWork`). Au plus un suivi par habitude et par jour. Une panne de stockage est une exception.
 */
export interface CheckInRepository {
  /** Le suivi enregistré de l'habitude ce jour-là, ou `null` s'il n'y en a pas. */
  find(habitId: HabitId, day: Day): Promise<CheckIn | null>;
  /**
   * Enregistre le suivi de sa case, en remplaçant le précédent. Un suivi ni « fait » ni corrigé
   * (`isBlank`) équivaut à l'absence de suivi : la case n'a alors plus de suivi enregistré.
   * Un suivi d'une habitude qui n'existe pas est refusé par une exception.
   */
  save(checkIn: CheckIn): Promise<void>;
  /** Les suivis enregistrés du jour `from` au jour `to` inclus, par jour puis par habitude. */
  listBetween(from: Day, to: Day): Promise<CheckIn[]>;
  /** Tous les suivis enregistrés d'une habitude, quelle que soit leur date, par jour (#6). */
  listByHabit(habitId: HabitId): Promise<CheckIn[]>;
}
