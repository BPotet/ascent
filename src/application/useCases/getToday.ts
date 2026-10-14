import type { Day } from '../../domain/day/Day';
import type { Clock } from '../ports/Clock';

/** Cas d'usage : connaître aujourd'hui selon le téléphone. */
export function getToday(clock: Clock): Day {
  return clock.today();
}
