import { xpChangeOfSettings } from '../../domain/character/HabitXp';
import { type Difficulty, parseDifficulty } from '../../domain/habit/Difficulty';
import { Habit, type HabitId } from '../../domain/habit/Habit';
import {
  EmptyHabitNameError,
  HabitName,
  HabitNameTooLongError,
} from '../../domain/habit/HabitName';
import { DuplicateHabitNameError, assertNameAvailable } from '../../domain/habit/HabitRules';
import {
  DEFAULT_WEEKLY_TARGET,
  parseWeeklyTarget,
  type WeeklyTarget,
} from '../../domain/habit/WeeklyTarget';
import { weekSettingsOf, type WeekSettings } from '../../domain/habit/WeekSettings';
import { Week } from '../../domain/week/Week';
import type { UseCaseDependencies } from './UseCaseDependencies';

/** Ce que le joueur enregistre dans « Modifier l'habitude ». */
export interface UpdateHabitInput {
  /** Le nom saisi, nettoyé et vérifié comme à la création. */
  readonly name: string;
  /** La difficulté choisie ; omise, celle de la semaine en cours est gardée. */
  readonly difficulty?: Difficulty;
  /**
   * L'objectif hebdomadaire choisi, de 1 à 7 ; omis, celui de la semaine suivante
   * (`nextWeeklyTarget`, prérempli dans « Modifier l'habitude ») est gardé.
   */
  readonly weeklyTarget?: WeeklyTarget;
}

/**
 * Motif du refus d'une modification, sans rien écrire :
 * - `empty` : le nom est vide une fois nettoyé ;
 * - `tooLong` : le nom dépasse 40 caractères ;
 * - `duplicate` : une **autre** habitude porte déjà ce nom (sans tenir compte des majuscules) ;
 * - `unknownHabit` : l'habitude n'existe plus.
 */
export type UpdateHabitRefusal = 'empty' | 'tooLong' | 'duplicate' | 'unknownHabit';

export type UpdateHabitResult =
  | {
      readonly ok: true;
      /** L'habitude modifiée, telle qu'elle est enregistrée. */
      readonly habit: Habit;
      /**
       * Les réglages de la semaine en cours après la modification. Un changement d'objectif ne s'y
       * voit que le jour de création (R13) : sinon, la semaine en cours garde son objectif.
       */
      readonly weekSettings: WeekSettings;
      /**
       * L'objectif hebdomadaire de la semaine suivante après la modification : celui que
       * « Modifier l'habitude » préremplit. `null` seulement pour une habitude d'avant la mise à
       * jour qui n'a pas encore reçu son changement d'introduction.
       */
      readonly nextWeeklyTarget: WeeklyTarget | null;
      /** Vrai si le nom a changé, ne serait-ce que ses majuscules. */
      readonly nameChanged: boolean;
      /**
       * Vrai si un changement de réglages a été enregistré : la difficulté choisie diffère de celle
       * de la semaine en cours, ou l'objectif choisi de celui de la semaine suivante. Avec
       * `nameChanged`, l'interface choisit « Habitude modifiée » ou « Habitude renommée ».
       */
      readonly settingsChanged: boolean;
      /**
       * La variation de l'expérience du personnage : la semaine en cours réévaluée au barème de la
       * nouvelle difficulté (R12), ex. +20 de Moyenne à Difficile avec deux cases « fait », négative
       * à la baisse, 0 si la difficulté ne change pas ou quand le plancher de 0 Xp l'en empêche. Un
       * changement d'objectif seul donne 0 : la semaine en cours n'est pas touchée (R13).
       */
      readonly xpChange: number;
      /** L'expérience totale du personnage après la modification, telle qu'elle est enregistrée. */
      readonly xp: number;
    }
  | { readonly ok: false; readonly reason: UpdateHabitRefusal };

const refusals: readonly [new (...args: never[]) => Error, UpdateHabitRefusal][] = [
  [EmptyHabitNameError, 'empty'],
  [HabitNameTooLongError, 'tooLong'],
  [DuplicateHabitNameError, 'duplicate'],
];

function refusalOf(error: unknown): UpdateHabitRefusal | undefined {
  return refusals.find(([type]) => error instanceof type)?.[1];
}

/**
 * Cas d'usage : modifier l'habitude `habitId`, son nom et ses réglages (#6 R18, #22 R12), en un seul
 * enregistrement. Il remplace le renommage (`renameHabit`).
 *
 * - Nom : mêmes règles qu'à la création ; l'habitude n'est pas un doublon d'elle-même, on peut donc
 *   ne changer que les majuscules. Ni ses suivis ni son jour de création ne changent.
 * - Réglages : si la difficulté diffère de celle de la semaine en cours, ou l'objectif hebdomadaire
 *   de celui de la semaine suivante (`nextWeeklyTarget`), un changement de réglages daté
 *   d'aujourd'hui est enregistré, avec les deux (un instantané). La difficulté s'applique à toute la
 *   semaine en cours et aux suivantes, jamais aux semaines closes : les cases « fait » de la semaine
 *   en cours sont réévaluées, l'expérience varie de `xpChangeOfSettings`, dans la même unité de
 *   travail. L'objectif s'applique à partir du lundi suivant, sauf le jour de création (R13) ; seul,
 *   il ne change pas l'expérience.
 *
 * Rien n'est écrit si rien ne change. Un refus de règle est un résultat ; une panne de stockage est
 * une exception, et rien ne change, ni le nom, ni les réglages, ni l'expérience. Une valeur qui n'est
 * pas une difficulté, ou un objectif hors de 1 à 7, est une erreur d'appel (`InvalidDifficultyError`,
 * `InvalidWeeklyTargetError`, R3).
 */
export function updateHabit(
  { clock, unitOfWork }: UseCaseDependencies,
  habitId: HabitId,
  input: UpdateHabitInput,
): Promise<UpdateHabitResult> {
  return unitOfWork.run(async ({ habits, checkIns, character, settingsChanges }) => {
    const chosen = input.difficulty === undefined ? undefined : parseDifficulty(input.difficulty);
    const chosenTarget =
      input.weeklyTarget === undefined ? undefined : parseWeeklyTarget(input.weeklyTarget);
    const today = clock.today();
    const existing = await habits.listAll();
    const habit = existing.find(({ id }) => id === habitId);
    if (habit === undefined) {
      return { ok: false, reason: 'unknownHabit' };
    }
    let name: HabitName;
    try {
      name = HabitName.parse(input.name);
      assertNameAvailable(existing, name, habitId);
    } catch (error) {
      const reason = refusalOf(error);
      if (reason === undefined) {
        throw error;
      }
      return { ok: false, reason };
    }

    const currentWeek = Week.containing(today);
    const before = await settingsChanges.listByHabit(habitId);
    const nextWeek = currentWeek.next();
    const current = weekSettingsOf(before, currentWeek, habit.createdOn);
    const nextTarget = weekSettingsOf(before, nextWeek, habit.createdOn).weeklyTarget;
    const nameChanged = name.value !== habit.name.value;
    const difficulty = chosen ?? current.difficulty;
    const settingsChanged =
      difficulty !== current.difficulty ||
      (chosenTarget !== undefined && chosenTarget !== nextTarget);

    if (nameChanged) {
      await habits.rename(habitId, name);
    }
    const xpBefore = await character.get();
    let xpAfter = xpBefore;
    let after = before;
    if (settingsChanged) {
      const weeklyTarget = chosenTarget ?? nextTarget ?? DEFAULT_WEEKLY_TARGET;
      after = [...before, await settingsChanges.add(habitId, today, { difficulty, weeklyTarget })];
      xpAfter = xpBefore.applyXpChange(
        xpChangeOfSettings(await checkIns.listByHabit(habitId), before, after, habit.createdOn),
      );
      await character.save(xpAfter);
    }
    return {
      ok: true,
      habit: new Habit(habit.id, name, habit.createdOn),
      weekSettings: weekSettingsOf(after, currentWeek, habit.createdOn),
      nextWeeklyTarget: weekSettingsOf(after, nextWeek, habit.createdOn).weeklyTarget,
      nameChanged,
      settingsChanged,
      xpChange: xpBefore.xpChangeTo(xpAfter),
      xp: xpAfter.xp,
    };
  });
}
