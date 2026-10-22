import { habitTargetBonusOf } from '../../domain/character/HabitXp';
import type { UseCaseDependencies } from './UseCaseDependencies';

/**
 * Cas d'usage : le rattrapage de la prime d'objectif (`introduceTargetBonus`), voir
 * `docs/glossary.md` (« Prime d'objectif », « Introduction ») et l'ADR 0003, §6. À appeler au
 * démarrage, juste après `introduceWeeklyTarget` et avant l'interface : la première fois, il ajoute à
 * l'expérience, sans feedback, les primes d'objectif des semaines déjà atteintes qui ont un objectif
 * (`habitTargetBonusOf` de chaque habitude existante, R17b), pour que l'invariant de l'expérience
 * tienne dès que la prime existe ; puis il enregistre l'introduction `targetBonus`, datée
 * d'aujourd'hui (lu sur l'horloge). Les semaines sans objectif (avant la mise à jour, R17) n'en
 * reçoivent aucune. L'Xp conservée n'est pas touchée.
 *
 * Une seule unité de travail : l'expérience ajoutée et la trace s'écrivent ensemble. Idempotent : si
 * l'introduction est déjà enregistrée, rien n'est lu ni écrit, il peut donc être rejoué à chaque
 * démarrage. Une panne de stockage est une exception, et rien n'est écrit : il est rejoué au
 * démarrage suivant, sans jamais accorder deux fois.
 *
 * Renvoie l'expérience ajoutée (0 au deuxième passage, et sur une première installation).
 */
export function introduceTargetBonus({ clock, unitOfWork }: UseCaseDependencies): Promise<number> {
  return unitOfWork.run(async ({ habits, checkIns, character, settingsChanges, introductions }) => {
    if (await introductions.has('targetBonus')) {
      return 0;
    }
    const today = clock.today();
    const changes = await settingsChanges.listAll();
    let bonus = 0;
    for (const habit of await habits.listAll()) {
      bonus += habitTargetBonusOf(
        await checkIns.listByHabit(habit.id),
        changes.filter(({ habitId }) => habitId === habit.id),
        habit.createdOn,
      );
    }
    if (bonus > 0) {
      await character.save((await character.get()).applyXpChange(bonus));
    }
    await introductions.add('targetBonus', today);
    return bonus;
  });
}
