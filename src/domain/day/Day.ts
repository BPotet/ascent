/**
 * Jour (`Day`) — une date du calendrier local du téléphone, sans heure ni fuseau.
 * Voir `docs/glossary.md`.
 */
export class InvalidDayError extends Error {
  constructor(description: string) {
    super(`Invalid day: ${description}`);
    this.name = 'InvalidDayError';
  }
}

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MIN_YEAR = 1;
const MAX_YEAR = 9999;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function pad(value: number, length: number): string {
  return String(value).padStart(length, '0');
}

export class Day {
  private constructor(
    readonly year: number,
    readonly month: number,
    readonly dayOfMonth: number,
  ) {}

  /** `month` va de 1 (janvier) à 12 (décembre). */
  static of(year: number, month: number, dayOfMonth: number): Day {
    if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
      throw new InvalidDayError(`year ${year}`);
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new InvalidDayError(`month ${month}`);
    }
    if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > daysInMonth(year, month)) {
      throw new InvalidDayError(`${year}-${pad(month, 2)}-${dayOfMonth}`);
    }
    return new Day(year, month, dayOfMonth);
  }

  /** Lit une date au format `AAAA-MM-JJ`. */
  static fromIso(iso: string): Day {
    const match = ISO_DAY.exec(iso);
    if (match === null) {
      throw new InvalidDayError(`"${iso}"`);
    }
    return Day.of(Number(match[1]), Number(match[2]), Number(match[3]));
  }

  /** La date locale (calendrier du téléphone) d'un instant. */
  static fromLocalDate(instant: Date): Day {
    return Day.of(instant.getFullYear(), instant.getMonth() + 1, instant.getDate());
  }

  toIso(): string {
    return `${pad(this.year, 4)}-${pad(this.month, 2)}-${pad(this.dayOfMonth, 2)}`;
  }

  equals(other: Day): boolean {
    return this.compareTo(other) === 0;
  }

  isBefore(other: Day): boolean {
    return this.compareTo(other) < 0;
  }

  isAfter(other: Day): boolean {
    return this.compareTo(other) > 0;
  }

  /** Négatif si ce jour est avant `other`, 0 si égal, positif s'il est après. */
  compareTo(other: Day): number {
    return this.year - other.year || this.month - other.month || this.dayOfMonth - other.dayOfMonth;
  }

  toString(): string {
    return this.toIso();
  }
}
