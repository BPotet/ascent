import type { Clock } from '../../../application/ports/Clock';
import type { Day } from '../../../domain/day/Day';

/** Horloge arrêtée sur un jour choisi, pour les tests. Le jour peut avancer avec `setToday`. */
export class FixedClock implements Clock {
  constructor(private current: Day) {}

  today(): Day {
    return this.current;
  }

  setToday(day: Day): void {
    this.current = day;
  }
}
