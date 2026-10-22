// Le contexte de `features/targets-by-week.feature` (#27), commun aux étapes des cas d'usage et des
// écrans : les 4 habitudes avec un objectif hebdomadaire et leurs objectifs atteints, semaine par
// semaine. Tout passe par les cas d'usage et les dépôts : il vaut pour SQLite comme pour la mémoire.
import { experienceInvariant } from '../../src/application/testing/experienceInvariant';
import { createHabit } from '../../src/application/useCases/createHabit';
import type { UseCaseDependencies } from '../../src/application/useCases/UseCaseDependencies';
import { Character } from '../../src/domain/character/Character';
import { Day } from '../../src/domain/day/Day';
import type { Habit } from '../../src/domain/habit/Habit';
import type { WeeklyTarget } from '../../src/domain/habit/WeeklyTarget';
import type { WeekTargetsRow } from '../../src/domain/month/TargetsByWeek';
import { Week } from '../../src/domain/week/Week';
import { frenchDay, frenchDayAndMonth } from './frenchDay';

/** Une horloge qu'on règle : `FixedClock` (cas d'usage) ou `settableClock` (écrans). */
export interface StoryDependencies extends UseCaseDependencies {
  readonly clock: UseCaseDependencies['clock'] & { setToday(day: Day): void };
}

/**
 * Les 4 habitudes du contexte, dans l'ordre de création, avec leur objectif hebdomadaire : les
 * premières atteignent leur objectif en premier (`reachTargets`). « Courir 5 km », objectif 3, est
 * celle des scénarios du Détail du jour.
 */
export const STORY_HABITS: readonly {
  readonly name: string;
  readonly weeklyTarget: WeeklyTarget;
}[] = [
  { name: 'Cuisiner', weeklyTarget: 1 },
  { name: 'Me coucher avant 23 h', weeklyTarget: 1 },
  { name: 'Lire 20 minutes', weeklyTarget: 2 },
  { name: 'Courir 5 km', weeklyTarget: 3 },
];

/**
 * Les objectifs atteints du scénario 1, semaine par semaine (le lundi, le nombre d'habitudes) :
 * 2/4 la semaine du 28 septembre, 3/4 la semaine du 5 octobre, 4/4 la semaine du 12 octobre, 1/4
 * cette semaine. Les scénarios 2 et 9 les lisent (« 3/4 », « 4 objectifs atteints sur 4 ») sans
 * les redonner : le contexte les installe, et chaque « N habitudes sur 4 l'ont atteint… » les fixe
 * de nouveau.
 */
export const STORY_WEEKS: readonly (readonly [Day, number])[] = [
  [Day.of(2026, 9, 28), 2],
  [Day.of(2026, 10, 5), 3],
  [Day.of(2026, 10, 12), 4],
  [Day.of(2026, 10, 19), 1],
];

/** Fait `work` le jour `day`, puis revient à aujourd'hui. */
export async function on<T>(deps: StoryDependencies, day: Day, work: () => Promise<T>): Promise<T> {
  const today = deps.clock.today();
  deps.clock.setToday(day);
  try {
    return await work();
  } finally {
    deps.clock.setToday(today);
  }
}

/** Les habitudes existantes, dans l'ordre de création. */
export const habitsOf = (deps: UseCaseDependencies): Promise<Habit[]> =>
  deps.unitOfWork.run(({ habits }) => habits.listAll());

export async function habitNamed(deps: UseCaseDependencies, name: string): Promise<Habit> {
  const habit = (await habitsOf(deps)).find((each) => each.name.value === name);
  if (habit === undefined) {
    throw new Error(`No habit « ${name} »`);
  }
  return habit;
}

/** Crée les 4 habitudes du contexte le `createdOn`, en « Moyenne », par `createHabit`. */
export async function createStoryHabits(deps: StoryDependencies, createdOn: Day): Promise<void> {
  for (const { name, weeklyTarget } of STORY_HABITS) {
    const created = await on(deps, createdOn, () =>
      createHabit(deps, name, 'medium', weeklyTarget),
    );
    if (!created.ok) {
      throw new Error(`« ${name} » not created`);
    }
  }
}

/**
 * Les jours « fait » de `habit` la semaine `week` : exactement `days`, enregistrés pendant ces jours
 * (ni correction, ni marque « corrigé »). L'expérience enregistrée suit : c'est celle de l'invariant.
 */
export async function setDoneDays(
  deps: UseCaseDependencies,
  habit: Habit,
  week: Week,
  days: readonly Day[],
): Promise<void> {
  const today = deps.clock.today();
  if (days.some((day) => day.isAfter(today) || !week.contains(day))) {
    throw new Error(`Days « fait » out of the week of ${week.start.toIsoString()} or after today`);
  }
  await deps.unitOfWork.run(async ({ checkIns }) => {
    for (const day of week.days()) {
      const done = days.some((each) => each.equals(day));
      await checkIns.save({ habitId: habit.id, day, done, corrected: false });
    }
  });
  const { expected } = await experienceInvariant(deps.unitOfWork);
  await deps.unitOfWork.run(({ character }) => character.save(new Character(expected)));
}

/**
 * « N habitudes sur 4 ont atteint leur objectif la semaine de `week` » : les `count` premières
 * habitudes du contexte sont « fait » les premiers jours de la semaine, autant que leur objectif ;
 * les autres n'y sont jamais « fait ».
 */
export async function reachTargets(
  deps: UseCaseDependencies,
  week: Week,
  count: number,
): Promise<void> {
  for (const [index, { name, weeklyTarget }] of STORY_HABITS.entries()) {
    const days = index < count ? week.days().slice(0, weeklyTarget) : [];
    await setDoneDays(deps, await habitNamed(deps, name), week, days);
  }
}

/** Installe les objectifs atteints du scénario 1 (`STORY_WEEKS`). */
export async function reachStoryTargets(deps: UseCaseDependencies): Promise<void> {
  for (const [monday, count] of STORY_WEEKS) {
    await reachTargets(deps, Week.containing(monday), count);
  }
}

/** « semaine du 12 octobre », ou « cette semaine » pour la semaine en cours, comme l'interface. */
export function weekNameOf(week: Week, today: Day): string {
  return week.equals(Week.containing(today))
    ? 'cette semaine'
    : `semaine du ${frenchDayAndMonth(week.start)}`;
}

/** Le titre d'une ligne de la section : « Semaine du 5 octobre », « Cette semaine ». */
export function rowTitleOf(row: Pick<WeekTargetsRow, 'week'>, today: Day): string {
  const name = weekNameOf(row.week, today);
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Une ligne de la section : « Semaine du 5 octobre · 3/4 objectifs atteints ». */
export function rowTextOf(row: WeekTargetsRow, today: Day): string {
  const reached = row.targetCount > 1 ? 'objectifs atteints' : 'objectif atteint';
  return `${rowTitleOf(row, today)} · ${row.reachedCount}/${row.targetCount} ${reached}`;
}

/** « la semaine du 28 septembre » ou « cette semaine » dans un scénario : la semaine de ce lundi. */
export function weekOfText(text: string, today: Day): Week {
  const trimmed = text.trim();
  if (trimmed === 'cette semaine') {
    return Week.containing(today);
  }
  const parts = /^(?:la )?semaine du (\d{1,2} \S+)$/u.exec(trimmed);
  if (parts === null) {
    throw new Error(`Not a week: "${text}"`);
  }
  return Week.containing(frenchDay(`lundi ${parts[1]}`, today.year));
}
