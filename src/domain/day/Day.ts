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

const MIN_YEAR = 1;
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
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
      throw new InvalidDayError(`${year}-${String(month).padStart(2, '0')}-${dayOfMonth}`);
    }
    return new Day(year, month, dayOfMonth);
  }

  /** La date locale (calendrier du téléphone) d'un instant. */
  static fromLocalDate(instant: Date): Day {
    return Day.of(instant.getFullYear(), instant.getMonth() + 1, instant.getDate());
  }

  /** Lit un jour écrit `AAAA-MM-JJ` (voir `toIsoString`). */
  static fromIsoString(text: string): Day {
    const parts = ISO_DAY.exec(text);
    if (parts === null) {
      throw new InvalidDayError(`"${text}"`);
    }
    return Day.of(Number(parts[1]), Number(parts[2]), Number(parts[3]));
  }

  /** Le jour écrit `AAAA-MM-JJ` : l'ordre alphabétique de ces textes est l'ordre chronologique. */
  toIsoString(): string {
    const pad = (value: number, width: number) => String(value).padStart(width, '0');
    return `${pad(this.year, 4)}-${pad(this.month, 2)}-${pad(this.dayOfMonth, 2)}`;
  }

  /** Le jour `days` jours après celui-ci (avant si `days` est négatif). */
  plusDays(days: number): Day {
    if (!Number.isInteger(days)) {
      throw new InvalidDayError(`${this.toIsoString()} plus ${days} days`);
    }
    const date = this.toUtcDate();
    date.setUTCDate(date.getUTCDate() + days);
    return Day.of(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }

  /** Le jour de la semaine, de 1 (lundi) à 7 (dimanche), comme la norme ISO 8601. */
  get dayOfWeek(): number {
    return this.toUtcDate().getUTCDay() || 7;
  }

  /** Minuit UTC de ce jour : en UTC, un jour dure toujours 24 h (pas d'heure d'été). */
  private toUtcDate(): Date {
    const date = new Date(0);
    date.setUTCFullYear(this.year, this.month - 1, this.dayOfMonth);
    return date;
  }

  equals(other: Day): boolean {
    return this.compareTo(other) === 0;
  }

  /** Négatif si ce jour est avant `other`, nul si c'est le même, positif s'il est après. */
  compareTo(other: Day): number {
    return this.year - other.year || this.month - other.month || this.dayOfMonth - other.dayOfMonth;
  }

  isAfter(other: Day): boolean {
    return this.compareTo(other) > 0;
  }

  isBefore(other: Day): boolean {
    return this.compareTo(other) < 0;
  }
}
