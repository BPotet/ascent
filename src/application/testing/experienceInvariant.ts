// Réservé aux tests des cas d'usage et des scénarios BDD : l'invariant de l'expérience (ADR 0003),
// recalculé à partir de ce qui est enregistré, pour le vérifier après chaque étape.
import { TARGET_BONUS_PER_UNIT, XP_PER_CHECK_IN } from '../../domain/habit/Difficulty';
import { weekSettingsOf } from '../../domain/habit/WeekSettings';
import { Week } from '../../domain/week/Week';
import type { UnitOfWork } from '../ports/UnitOfWork';

/** L'expérience enregistrée, et celle que donne l'invariant. */
export interface ExperienceInvariant {
  readonly xp: number;
  readonly expected: number;
}

/**
 * L'expérience enregistrée (`xp`) et celle que donne l'invariant (`expected`) : pour chaque habitude
 * existante, chaque suivi « fait », de toutes dates, au barème de la difficulté de sa semaine, plus,
 * pour chaque semaine qui a un objectif et au moins autant de cases « fait » que lui, l'objectif de
 * la semaine multiplié par la prime unitaire de sa difficulté (prime d'objectif, #26), plus l'Xp
 * conservée. Les deux sont égales tant que le plancher de 0 Xp n'a pas joué.
 *
 * Le calcul suit la formule suivi par suivi et semaine par semaine, sans passer par `HabitXp`, pour
 * le vérifier.
 */
export function experienceInvariant(unitOfWork: UnitOfWork): Promise<ExperienceInvariant> {
  return unitOfWork.run(async ({ habits, checkIns, character, settingsChanges }) => {
    const { xp, retainedXp } = await character.get();
    let expected = retainedXp;
    for (const habit of await habits.listAll()) {
      const changes = await settingsChanges.listByHabit(habit.id);
      const doneByWeek = new Map<string, { week: Week; count: number }>();
      for (const checkIn of await checkIns.listByHabit(habit.id)) {
        if (checkIn.done) {
          const week = Week.containing(checkIn.day);
          const { difficulty } = weekSettingsOf(changes, week, habit.createdOn);
          expected += XP_PER_CHECK_IN[difficulty];
          const key = week.start.toIsoString();
          doneByWeek.set(key, { week, count: (doneByWeek.get(key)?.count ?? 0) + 1 });
        }
      }
      for (const { week, count } of doneByWeek.values()) {
        const { difficulty, weekTarget } = weekSettingsOf(changes, week, habit.createdOn);
        if (weekTarget !== null && count >= weekTarget) {
          expected += weekTarget * TARGET_BONUS_PER_UNIT[difficulty];
        }
      }
    }
    return { xp, expected };
  });
}
