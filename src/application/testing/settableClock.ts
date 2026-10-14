// Réservé aux tests des cas d'usage : une horloge dont on choisit aujourd'hui.
import type { Day } from '../../domain/day/Day';
import type { Clock } from '../ports/Clock';

export function settableClock(today: Day): Clock & { setToday(day: Day): void } {
  let current = today;
  return {
    today: () => current,
    setToday: (day) => {
      current = day;
    },
  };
}
