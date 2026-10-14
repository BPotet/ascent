import type { Day } from '../day/Day';
import type { HabitName } from './HabitName';

/** Identifiant d'une habitude, attribué au stockage. Il suit l'ordre de création. */
export type HabitId = number;

/**
 * Habitude (`Habit`), voir `docs/glossary.md`.
 * Elle est datée de son jour de création (R2) et active à partir de ce jour (R20).
 */
export class Habit {
  constructor(
    readonly id: HabitId,
    readonly name: HabitName,
    readonly createdOn: Day,
  ) {}

  /** Vrai si `day` est le jour de création ou un jour après ; avant, le jour est « hors habitude ». */
  isActiveOn(day: Day): boolean {
    return !this.createdOn.isAfter(day);
  }
}
