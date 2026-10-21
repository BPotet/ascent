import type { Day } from '../day/Day';

const DAYS_IN_WEEK = 7;

/**
 * Semaine (`Week`), voir `docs/glossary.md` : 7 jours, du lundi au dimanche, selon la date locale
 * du téléphone (R3). Une semaine est désignée par son lundi.
 */
export class Week {
  /** Le dimanche de la semaine. */
  readonly end: Day;

  private constructor(
    /** Le lundi de la semaine. */
    readonly start: Day,
  ) {
    this.end = start.plusDays(DAYS_IN_WEEK - 1);
  }

  /** La semaine qui contient `day`. */
  static containing(day: Day): Week {
    return new Week(day.plusDays(1 - day.dayOfWeek));
  }

  /** Les 7 jours de la semaine, du lundi au dimanche. */
  days(): Day[] {
    return Array.from({ length: DAYS_IN_WEEK }, (_, index) => this.start.plusDays(index));
  }

  contains(day: Day): boolean {
    return !day.isBefore(this.start) && !day.isAfter(this.end);
  }

  /** La semaine d'avant. */
  previous(): Week {
    return new Week(this.start.plusDays(-DAYS_IN_WEEK));
  }

  /** La semaine d'après. */
  next(): Week {
    return new Week(this.start.plusDays(DAYS_IN_WEEK));
  }

  equals(other: Week): boolean {
    return this.start.equals(other.start);
  }

  isBefore(other: Week): boolean {
    return this.start.isBefore(other.start);
  }

  isAfter(other: Week): boolean {
    return this.start.isAfter(other.start);
  }
}
