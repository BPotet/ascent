import { type DaySky, daySkyOf } from '../../domain/day/DaySky';
import { expectedHabitsOn } from '../../domain/habit/ExpectedHabit';
import { Week } from '../../domain/week/Week';
import type { UseCaseDependencies } from './UseCaseDependencies';

/**
 * Cas d'usage : le ciel du jour d'aujourd'hui (`DaySky`, #72), pour l'en-tête du personnage de la
 * Vue Journée, de la Vue Semaine et de la Vue Mois. Il suit les habitudes faites sur les habitudes
 * attendues aujourd'hui (#25), parmi les habitudes actives aujourd'hui (`daySkyOf`).
 *
 * Aujourd'hui est lu dans l'unité de travail, avec les habitudes, les suivis du lundi à aujourd'hui
 * et les changements de réglages. Une panne de lecture est une exception.
 */
export function getDaySky({ clock, unitOfWork }: UseCaseDependencies): Promise<DaySky> {
  return unitOfWork.run(async ({ habits, checkIns, settingsChanges }) => {
    const today = clock.today();
    const active = (await habits.listAll()).filter((habit) => habit.isActiveOn(today));
    const weekCheckIns = await checkIns.listBetween(Week.containing(today).start, today);
    const expected = expectedHabitsOn(today, active, weekCheckIns, await settingsChanges.listAll());
    // Une habitude « fait » aujourd'hui est toujours attendue.
    const doneCount = expected.filter((habit) =>
      weekCheckIns.some(
        (checkIn) => checkIn.done && checkIn.habitId === habit.id && checkIn.day.equals(today),
      ),
    ).length;
    return daySkyOf(doneCount, expected.length, active.length);
  });
}
