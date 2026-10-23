import type { Day } from '../../domain/day/Day';
import type { HabitId } from '../../domain/habit/Habit';
import type { HabitSettings, SettingsChange } from '../../domain/habit/SettingsChange';

/**
 * Dépôt des changements de réglages (`SettingsChangeRepository`), voir l'ADR 0003. On ne l'obtient
 * que dans une unité de travail (`UnitOfWork`) : un changement de réglages et la variation
 * d'expérience qu'il entraîne s'enregistrent ensemble. Les changements d'une habitude sont effacés
 * avec elle (`HabitRepository.remove`). Une panne de stockage est une exception.
 */
export interface SettingsChangeRepository {
  /** Les changements de réglages de l'habitude, par jour puis par ordre de saisie (R15). */
  listByHabit(habitId: HabitId): Promise<SettingsChange[]>;
  /**
   * Les changements de réglages de toutes les habitudes existantes, par habitude, puis par jour,
   * puis par ordre de saisie. Pour les vues : il y a au plus 10 habitudes.
   */
  listAll(): Promise<SettingsChange[]>;
  /**
   * Enregistre un changement de réglages de l'habitude, daté de `changedOn`, qui porte tous ses
   * réglages après le changement (`settings`, un instantané), et le renvoie. Son ordre de saisie
   * (`sequence`) est plus grand que celui de tout changement déjà enregistré. Un changement d'une
   * habitude qui n'existe pas est refusé par une exception.
   *
   * Tous les réglages y sont renseignés (`HabitSettings`) : un changement ne peut pas vider
   * l'objectif hebdomadaire. Seuls les changements d'avant la mise à jour de #24, déjà stockés, sont
   * relus avec un objectif vide (`weeklyTarget: null`).
   */
  add(habitId: HabitId, changedOn: Day, settings: HabitSettings): Promise<SettingsChange>;
}
