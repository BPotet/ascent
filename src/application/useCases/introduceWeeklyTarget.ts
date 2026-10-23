import { introductionChangeOf } from '../../domain/habit/IntroductionChange';
import type { UseCaseDependencies } from './UseCaseDependencies';

/**
 * Cas d'usage : le changement d'introduction de l'objectif hebdomadaire (`introduceWeeklyTarget`),
 * voir `docs/glossary.md` et l'ADR 0003, §4. À appeler au démarrage, après les migrations et avant
 * l'interface : à chaque habitude existante dont le dernier changement de réglages saisi n'a pas
 * d'objectif, il ajoute un changement daté d'aujourd'hui (lu sur l'horloge), qui recopie la
 * difficulté de la semaine en cours et porte l'objectif 7 (R16, `introductionChangeOf`).
 *
 * Une seule unité de travail. Idempotent : un deuxième passage n'écrit rien, il peut donc être
 * rejoué à chaque démarrage. L'expérience n'est ni lue ni changée. Une panne de stockage est une
 * exception, et rien n'est écrit : il est rejoué au démarrage suivant.
 *
 * Renvoie le nombre d'habitudes qui ont reçu un changement d'introduction (0 au deuxième passage).
 */
export function introduceWeeklyTarget({ clock, unitOfWork }: UseCaseDependencies): Promise<number> {
  return unitOfWork.run(async ({ habits, settingsChanges }) => {
    const today = clock.today();
    const changes = await settingsChanges.listAll();
    let introduced = 0;
    for (const habit of await habits.listAll()) {
      const settings = introductionChangeOf(
        changes.filter(({ habitId }) => habitId === habit.id),
        habit.createdOn,
        today,
      );
      if (settings !== null) {
        await settingsChanges.add(habit.id, today, settings);
        introduced += 1;
      }
    }
    return introduced;
  });
}
