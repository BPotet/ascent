// Réservé aux tests des cas d'usage et des scénarios BDD : l'invariant de l'expérience (ADR 0003),
// recalculé à partir de ce qui est enregistré, pour le vérifier après chaque étape.
import { XP_PER_CHECK_IN } from '../../domain/habit/Difficulty';
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
 * existante, chaque suivi « fait », de toutes dates, au barème de la difficulté de sa semaine, plus
 * l'Xp conservée. Les deux sont égales tant que le plancher de 0 Xp n'a pas joué.
 *
 * Le calcul suit la formule suivi par suivi, sans passer par `HabitXp`, pour le vérifier.
 */
export function experienceInvariant(unitOfWork: UnitOfWork): Promise<ExperienceInvariant> {
  return unitOfWork.run(async ({ habits, checkIns, character, settingsChanges }) => {
    const { xp, retainedXp } = await character.get();
    let expected = retainedXp;
    for (const habit of await habits.listAll()) {
      const changes = await settingsChanges.listByHabit(habit.id);
      for (const checkIn of await checkIns.listByHabit(habit.id)) {
        if (checkIn.done) {
          const { difficulty } = weekSettingsOf(
            changes,
            Week.containing(checkIn.day),
            habit.createdOn,
          );
          expected += XP_PER_CHECK_IN[difficulty];
        }
      }
    }
    return { xp, expected };
  });
}
