// Réservé aux tests des cas d'usage et des écrans : une horloge dont on choisit aujourd'hui.
// `setToday` prévient les abonnés de `onTodayChange` quand le jour change, comme `SystemClock`.
import type { Day } from '../../domain/day/Day';
import type { WatchedClock } from '../ports/Clock';

export function settableClock(today: Day): WatchedClock & { setToday(day: Day): void } {
  let current = today;
  const listeners = new Set<(today: Day) => void>();
  return {
    today: () => current,
    setToday: (day) => {
      const changed = !day.equals(current);
      current = day;
      if (changed) {
        [...listeners].forEach((listener) => listener(day));
      }
    },
    onTodayChange: (listener) => {
      const subscription = (day: Day) => listener(day);
      listeners.add(subscription);
      return () => {
        listeners.delete(subscription);
      };
    },
  };
}
