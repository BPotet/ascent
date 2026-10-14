import type { Day } from '../../domain/day/Day';
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
  /** Le nombre d'habitudes actives hier (créées hier ou avant). */
  readonly activeCount: number;
  /** La semaine à ouvrir dans la Vue Semaine pour corriger hier (celle qui contient hier). */
  readonly week: Week;
}

/**
 * Cas d'usage : le rappel d'hier à montrer en haut de la Vue Journée, ou `null` s'il ne faut rien
 * montrer : aucune habitude active hier, toutes « fait » hier, ou rappel fermé par le joueur pour
 * ce jour-là. Le compte suit les corrections : corriger hier peut faire disparaître le rappel.
 *
 * Aujourd'hui est lu une fois, dans l'unité de travail ; la préférence est lue après, hors de la
 * transaction. Une panne de lecture est une exception.
 */
export async function getYesterdayReminder({
  clock,
  unitOfWork,
  keyValueStore,
}: YesterdayReminderDependencies): Promise<YesterdayReminder | null> {
  const { day, doneCount, activeCount } = await unitOfWork.run(async ({ habits, checkIns }) => {
    const yesterday = clock.today().plusDays(-1);
    const active = (await habits.listAll()).filter((habit) => habit.isActiveOn(yesterday));
    const done = (await checkIns.listBetween(yesterday, yesterday)).filter(
      (checkIn) => checkIn.done && active.some((habit) => habit.id === checkIn.habitId),
    );
    return { day: yesterday, doneCount: done.length, activeCount: active.length };
  });
  if (activeCount === 0 || doneCount === activeCount) {
    return null;
  }
  const dismissedFor = await keyValueStore.get(YESTERDAY_REMINDER_DISMISSED_FOR_KEY);
  if (dismissedFor === day.toIsoString()) {
    return null;
  }
  return { day, doneCount, activeCount, week: Week.containing(day) };
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
