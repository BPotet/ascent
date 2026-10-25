// Le contexte de `features/day-view-pixel-art.feature` (#72), commun aux étapes des cas d'usage et des
// écrans : le mercredi 21 octobre 2026, 5 habitudes actives créées le lundi 19, dont 2 « fait »
// aujourd'hui (« Budget du jour » et « Lire »), et le personnage à 340 XP, comme dans la maquette.
// « Cuisiner » (Moyenne, objectif 5) et « Courir 5 km » (Difficile, objectif 3) ont chacune 2
// « fait » cette semaine, le lundi et le mardi. Tout passe par les cas d'usage et les dépôts : il
// vaut pour SQLite comme pour la mémoire.
import { createHabit } from '../../src/application/useCases/createHabit';
import type { UseCaseDependencies } from '../../src/application/useCases/UseCaseDependencies';
import { Character } from '../../src/domain/character/Character';
import { Day } from '../../src/domain/day/Day';
import type { Difficulty } from '../../src/domain/habit/Difficulty';
import type { Habit } from '../../src/domain/habit/Habit';
import type { WeeklyTarget } from '../../src/domain/habit/WeeklyTarget';

/** Aujourd'hui : le mercredi 21 octobre 2026. */
export const WEDNESDAY = Day.of(2026, 10, 21);
export const MONDAY = Day.of(2026, 10, 19);
export const TUESDAY = Day.of(2026, 10, 20);

/** L'expérience du personnage dans le contexte. */
export const CONTEXT_XP = 340;

/** Une horloge qu'on règle : `settableClock` (écrans) ou `FixedClock` (cas d'usage). */
export type StoryDependencies = UseCaseDependencies & {
  readonly clock: UseCaseDependencies['clock'] & { setToday(day: Day): void };
};

/** Les 5 habitudes du contexte, dans l'ordre de création, et leurs jours « fait » cette semaine. */
const HABITS: readonly {
  readonly name: string;
  readonly difficulty: Difficulty;
  readonly weeklyTarget: WeeklyTarget;
  readonly done: readonly Day[];
}[] = [
  { name: 'Cuisiner', difficulty: 'medium', weeklyTarget: 5, done: [MONDAY, TUESDAY] },
  { name: 'Budget du jour', difficulty: 'easy', weeklyTarget: 7, done: [WEDNESDAY] },
  { name: 'Courir 5 km', difficulty: 'hard', weeklyTarget: 3, done: [MONDAY, TUESDAY] },
  { name: 'Me coucher avant 23 h', difficulty: 'medium', weeklyTarget: 7, done: [] },
  { name: 'Lire', difficulty: 'easy', weeklyTarget: 4, done: [WEDNESDAY] },
];

/** Crée une habitude le jour `createdOn`, puis revient à aujourd'hui. */
export async function habitCreatedOn(
  deps: StoryDependencies,
  createdOn: Day,
  name: string,
  difficulty: Difficulty = 'medium',
  weeklyTarget: WeeklyTarget = 7,
): Promise<Habit> {
  const today = deps.clock.today();
  deps.clock.setToday(createdOn);
  try {
    const created = await createHabit(deps, name, difficulty, weeklyTarget);
    if (!created.ok) {
      throw new Error(`« ${name} » not created: ${created.reason}`);
    }
    return created.habit;
  } finally {
    deps.clock.setToday(today);
  }
}

/** Enregistre les suivis « fait » de `habit`, sans correction, à même les dépôts. */
export function doneOn(
  deps: UseCaseDependencies,
  habit: Habit,
  days: readonly Day[],
): Promise<void> {
  return deps.unitOfWork.run(async ({ checkIns }) => {
    for (const day of days) {
      await checkIns.save({ habitId: habit.id, day, done: true, corrected: false });
    }
  });
}

/** Fixe l'expérience du personnage. */
export function characterHas(deps: UseCaseDependencies, xp: number): Promise<void> {
  return deps.unitOfWork.run(({ character }) => character.save(new Character(xp)));
}

/** Installe le contexte : 5 habitudes actives, dont 2 « fait » aujourd'hui, et 340 XP. */
export async function storyContext(deps: StoryDependencies): Promise<Habit[]> {
  const habits = [];
  for (const { name, difficulty, weeklyTarget, done } of HABITS) {
    const habit = await habitCreatedOn(deps, MONDAY, name, difficulty, weeklyTarget);
    await doneOn(deps, habit, done);
    habits.push(habit);
  }
  await characterHas(deps, CONTEXT_XP);
  return habits;
}

/** Le lundi de la semaine dernière, jour de création des habitudes du contexte de #73. */
export const LAST_MONDAY = Day.of(2026, 10, 12);
export const LAST_THURSDAY = Day.of(2026, 10, 15);
export const LAST_SUNDAY = Day.of(2026, 10, 18);

/**
 * Le contexte de `features/week-month-pixel-art.feature` (#73) : les 5 habitudes de #72, avec
 * leurs « fait » de cette semaine, mais créées le lundi 12 octobre, pour que la semaine dernière
 * soit suivie. Le jeudi 15, toutes sont faites (jour complet de la Vue Mois) ; le dimanche 18,
 * seule « Cuisiner » l'est. « Lire » a été corrigée le mardi 20 (« fait », marque « corrigé »).
 * Le personnage a 340 XP.
 */
export async function weekMonthStoryContext(deps: StoryDependencies): Promise<Habit[]> {
  const habits = [];
  for (const { name, difficulty, weeklyTarget, done } of HABITS) {
    const habit = await habitCreatedOn(deps, LAST_MONDAY, name, difficulty, weeklyTarget);
    await doneOn(deps, habit, [LAST_THURSDAY, ...done]);
    habits.push(habit);
  }
  const [cooking, , , , reading] = habits;
  if (cooking !== undefined) {
    await doneOn(deps, cooking, [LAST_SUNDAY]);
  }
  if (reading !== undefined) {
    await deps.unitOfWork.run(({ checkIns }) =>
      checkIns.save({ habitId: reading.id, day: TUESDAY, done: true, corrected: true }),
    );
  }
  await characterHas(deps, CONTEXT_XP);
  return habits;
}
