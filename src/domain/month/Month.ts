import { Day } from '../day/Day';

const MONTHS_IN_YEAR = 12;
const DAYS_IN_WEEK = 7;

/**
 * Mois (`Month`), voir `docs/glossary.md` : un mois du calendrier local du téléphone (R3). Sa grille
 * est faite de semaines du lundi au dimanche (`weeks`).
 */
export class Month {
  /** Le 1er du mois. */
  readonly start: Day;
  /** Le dernier jour du mois (28, 29, 30 ou 31). */
  readonly end: Day;

  private constructor(
    readonly year: number,
    /** De 1 (janvier) à 12 (décembre). */
    readonly month: number,
  ) {
    this.start = Day.of(year, month, 1);
    const following =
      month === MONTHS_IN_YEAR ? Day.of(year + 1, 1, 1) : Day.of(year, month + 1, 1);
    this.end = following.plusDays(-1);
  }

  /** Le mois `month` (1 à 12) de `year` ; un mois qui n'existe pas lève `InvalidDayError`. */
  static of(year: number, month: number): Month {
    return new Month(year, month);
  }

  /** Le mois qui contient `day`. */
  static containing(day: Day): Month {
    return new Month(day.year, day.month);
  }

  /** Les jours du mois, du 1er au dernier. */
  days(): Day[] {
    return Array.from({ length: this.end.dayOfMonth }, (_, index) => this.start.plusDays(index));
  }

  /**
   * La grille du mois : ses semaines, chacune de 7 places du lundi au dimanche. Les places avant le
   * 1er et après le dernier jour sont vides (`null`). De 4 à 6 semaines.
   */
  weeks(): (Day | null)[][] {
    const blanksBefore: null[] = Array(this.start.dayOfWeek - 1).fill(null);
    const blanksAfter: null[] = Array(DAYS_IN_WEEK - this.end.dayOfWeek).fill(null);
    const places = [...blanksBefore, ...this.days(), ...blanksAfter];
    return Array.from({ length: places.length / DAYS_IN_WEEK }, (_, index) =>
      places.slice(index * DAYS_IN_WEEK, (index + 1) * DAYS_IN_WEEK),
    );
  }

  contains(day: Day): boolean {
    return day.year === this.year && day.month === this.month;
  }

  /** Le mois d'avant. */
  previous(): Month {
    return Month.containing(this.start.plusDays(-1));
  }

  /** Le mois d'après. */
  next(): Month {
    return Month.containing(this.end.plusDays(1));
  }

  equals(other: Month): boolean {
    return this.start.equals(other.start);
  }

  isBefore(other: Month): boolean {
    return this.start.isBefore(other.start);
  }

  isAfter(other: Month): boolean {
    return this.start.isAfter(other.start);
  }
}
