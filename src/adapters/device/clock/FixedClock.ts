import type { WatchedClock } from '../../../application/ports/Clock';
import type { Day } from '../../../domain/day/Day';

/**
 * Horloge arrêtée sur un jour choisi, pour les tests. Le jour change avec `setToday`, qui prévient
 * les abonnés de `onTodayChange` si le jour est différent.
 */
export class FixedClock implements WatchedClock {
  private readonly listeners = new Set<(today: Day) => void>();

  constructor(private current: Day) {}

  today(): Day {
    return this.current;
  }

  setToday(day: Day): void {
    const changed = !day.equals(this.current);
    this.current = day;
    if (changed) {
      [...this.listeners].forEach((listener) => listener(day));
    }
  }

  onTodayChange(listener: (today: Day) => void): () => void {
    const subscription = (today: Day) => listener(today);
    this.listeners.add(subscription);
    return () => {
      this.listeners.delete(subscription);
    };
  }
}
