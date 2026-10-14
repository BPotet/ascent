import type { Clock } from '../../../application/ports/Clock';
import { Day } from '../../../domain/day/Day';

/** Horloge du téléphone : aujourd'hui est la date locale au moment de l'appel. */
export class SystemClock implements Clock {
  constructor(private readonly now: () => Date = () => new Date()) {}

  today(): Day {
    return Day.fromLocalDate(this.now());
  }
}
