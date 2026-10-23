import type { Day } from '../../domain/day/Day';
import { expectedHabitsOn } from '../../domain/habit/ExpectedHabit';
import { Week } from '../../domain/week/Week';
import type { PreferenceDependencies } from './checkInHint';
import type { UseCaseDependencies } from './UseCaseDependencies';

/** Les ports dont a besoin le rappel d'hier : le suivi des habitudes et les préférences. */
export type YesterdayReminderDependencies = UseCaseDependencies & PreferenceDependencies;

/** Le jour (ISO) dont le rappel a été fermé par le joueur. */
export const YESTERDAY_REMINDER_DISMISSED_FOR_KEY = 'day-view.yesterday-reminder.dismissed-for';

/** Le rappel d'hier (`YesterdayReminder`) de la Vue Journée : « Hier : 1/2 faites · Corriger ». */
export interface YesterdayReminder {
  /** Hier, le jour rappelé. */
  readonly day: Day;
  /** Le nombre d'habitudes « fait » hier, corrections comprises. */
  readonly doneCount: number;
  /**
   * Le nombre d'habitudes attendues hier (#25) : actives hier, et « fait » hier ou sous l'objectif
   * de la semaine d'hier, progression comptée du lundi jusqu'à hier.
   */
  readonly expectedCount: number;
  /** La semaine à ouvrir dans la Vue Semaine pour corriger hier (celle qui contient hier). */
  readonly week: Week;
}

/**
 * Cas d'usage : le rappel d'hier à montrer en haut de la Vue Journée, ou `null` s'il ne faut rien
 * montrer : aucune habitude attendue hier, toutes « fait » hier, ou rappel fermé par le joueur pour
 * ce jour-là. Le compte suit les corrections, de hier ou d'un jour d'avant dans la semaine d'hier :
 * corriger peut faire disparaître le rappel, ou le faire revenir.
 *
 * Les suivis sont lus du lundi de la semaine **d'hier** jusqu'à hier : le lundi, hier est le
 * dimanche de la semaine précédente, et un « fait » d'aujourd'hui n'y compte pas.
 *
 * Aujourd'hui est lu une fois, dans l'unité de travail ; la préférence est lue après, hors de la
 * transaction. Une panne de lecture est une exception.
 */
export async function getYesterdayReminder({
  clock,
  unitOfWork,
  keyValueStore,
}: YesterdayReminderDependencies): Promise<YesterdayReminder | null> {
  const { day, doneCount, expectedCount } = await unitOfWork.run(
    async ({ habits, checkIns, settingsChanges }) => {
      const yesterday = clock.today().plusDays(-1);
      const weekCheckIns = await checkIns.listBetween(Week.containing(yesterday).start, yesterday);
      const expected = expectedHabitsOn(
        yesterday,
        await habits.listAll(),
        weekCheckIns,
        await settingsChanges.listAll(),
      );
      // Une habitude « fait » hier est toujours attendue hier.
      const done = expected.filter((habit) =>
        weekCheckIns.some(
          (checkIn) =>
            checkIn.done && checkIn.habitId === habit.id && checkIn.day.equals(yesterday),
        ),
      );
      return { day: yesterday, doneCount: done.length, expectedCount: expected.length };
    },
  );
  // Sans habitude attendue hier, 0/0 : rien à rappeler non plus.
  if (doneCount === expectedCount) {
    return null;
  }
  const dismissedFor = await keyValueStore.get(YESTERDAY_REMINDER_DISMISSED_FOR_KEY);
  if (dismissedFor === day.toIsoString()) {
    return null;
  }
  return { day, doneCount, expectedCount, week: Week.containing(day) };
}

/**
 * Cas d'usage : fermer le rappel d'hier (bouton ×) pour la journée. `day` est le jour rappelé
 * (`YesterdayReminder.day`) : le rappel du lendemain s'affichera de nouveau.
 */
export async function dismissYesterdayReminder(
  { keyValueStore }: PreferenceDependencies,
  day: Day,
): Promise<void> {
  await keyValueStore.set(YESTERDAY_REMINDER_DISMISSED_FOR_KEY, day.toIsoString());
}
