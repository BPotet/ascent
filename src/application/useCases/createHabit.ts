import {
  DEFAULT_DIFFICULTY,
  type Difficulty,
  parseDifficulty,
} from '../../domain/habit/Difficulty';
import type { Habit } from '../../domain/habit/Habit';
import { creationWeekTargetOf } from '../../domain/habit/WeekSettings';
import {
  DEFAULT_WEEKLY_TARGET,
  parseWeeklyTarget,
  type WeeklyTarget,
} from '../../domain/habit/WeeklyTarget';
import {
  EmptyHabitNameError,
  HabitName,
  HabitNameTooLongError,
} from '../../domain/habit/HabitName';
import {
  DuplicateHabitNameError,
  HabitLimitReachedError,
  assertCanAddHabit,
  assertNameAvailable,
} from '../../domain/habit/HabitRules';
import type { UseCaseDependencies } from './UseCaseDependencies';

/**
 * Motif du refus d'une création :
 * - `empty` : le nom est vide une fois nettoyé ;
 * - `tooLong` : le nom dépasse 40 caractères ;
 * - `duplicate` : une habitude porte déjà ce nom (sans tenir compte des majuscules) ;
 * - `limit` : le joueur a déjà 10 habitudes.
 */
export type CreateHabitRefusal = 'empty' | 'tooLong' | 'duplicate' | 'limit';

export type CreateHabitResult =
  | {
      readonly ok: true;
      readonly habit: Habit;
      /**
       * L'objectif de la semaine de création (R6) : l'objectif hebdomadaire choisi, réduit aux jours
       * restants dans la semaine, aujourd'hui compris (`creationWeekTargetOf`). Il est réduit quand
       * il est inférieur à l'objectif hebdomadaire (« Habitude créée · objectif N cette semaine »).
       */
      readonly weekTarget: number;
    }
  | { readonly ok: false; readonly reason: CreateHabitRefusal };

const refusals: readonly [new (...args: never[]) => Error, CreateHabitRefusal][] = [
  [EmptyHabitNameError, 'empty'],
  [HabitNameTooLongError, 'tooLong'],
  [DuplicateHabitNameError, 'duplicate'],
  [HabitLimitReachedError, 'limit'],
];

function refusalOf(error: unknown): CreateHabitRefusal | undefined {
  return refusals.find(([type]) => error instanceof type)?.[1];
}

/**
 * Cas d'usage : créer une habitude, datée d'aujourd'hui (R1, R2 de #2), avec sa difficulté, Moyenne
 * par défaut (R2 de #22), et son objectif hebdomadaire, 7 (« Tous les jours ») par défaut (R4 de
 * #22). L'habitude et son premier changement de réglages, daté du jour de création, qui porte les
 * deux, sont enregistrés dans la même unité de travail. Le résultat donne aussi l'objectif de la
 * semaine de création (R6 de #24).
 * Un refus de règle est un résultat ; une panne de stockage est une exception, et rien n'est créé.
 * Une valeur qui n'est pas une difficulté, ou un objectif hors de 1 à 7, est une erreur d'appel
 * (`InvalidDifficultyError`, `InvalidWeeklyTargetError`, R3), et rien n'est créé.
 */
export function createHabit(
  { clock, unitOfWork }: UseCaseDependencies,
  rawName: string,
  difficulty: Difficulty = DEFAULT_DIFFICULTY,
  weeklyTarget: WeeklyTarget = DEFAULT_WEEKLY_TARGET,
): Promise<CreateHabitResult> {
  return unitOfWork.run(async ({ habits, settingsChanges }) => {
    const settings = {
      difficulty: parseDifficulty(difficulty),
      weeklyTarget: parseWeeklyTarget(weeklyTarget),
    };
    const today = clock.today();
    const existing = await habits.listAll();
    let name: HabitName;
    try {
      assertCanAddHabit(existing);
      name = HabitName.parse(rawName);
      assertNameAvailable(existing, name);
    } catch (error) {
      const reason = refusalOf(error);
      if (reason === undefined) {
        throw error;
      }
      return { ok: false, reason };
    }
    const habit = await habits.add(name, today);
    await settingsChanges.add(habit.id, today, settings);
    return { ok: true, habit, weekTarget: creationWeekTargetOf(settings.weeklyTarget, today) };
  });
}
