import { getToday } from '../../../application/useCases/getToday';
import type { Day } from '../../../domain/day/Day';
import { useDependencies } from './Dependencies';

/** Aujourd'hui selon l'horloge fournie à l'interface. */
export function useToday(): Day {
  return getToday(useDependencies().clock);
}
