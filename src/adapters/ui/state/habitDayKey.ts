import type { HabitDay } from '../../../domain/checkIn/HabitDay';

/** La clé d'une case : son habitude et son jour. */
export const keyOf = ({ habit, day }: Pick<HabitDay, 'habit' | 'day'>): string =>
  `${habit.id}/${day.toIsoString()}`;
