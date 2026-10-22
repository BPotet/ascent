import type { Character } from '../../domain/character/Character';
import { deletionXpOf } from '../../domain/character/HabitXp';
import type { Habit, HabitId } from '../../domain/habit/Habit';
import type { Repositories } from '../ports/UnitOfWork';
import type { UseCaseDependencies } from './UseCaseDependencies';

/** Motif du refus d'une suppression ou de son aperçu : l'habitude n'existe plus. */
export type DeleteHabitRefusal = 'unknownHabit';

/** Ce que dit la fenêtre de confirmation d'une suppression (`HabitDeletionPreview`). */
export type HabitDeletionPreview =
  | {
      readonly ok: true;
      /** Le nom de l'habitude à supprimer, tel qu'il est affiché. */
      readonly name: string;
      /**
       * L'expérience que la suppression retirerait : celle de son suivi d'aujourd'hui, au barème de
       * la difficulté de la semaine en cours (ex. 20 en Difficile) s'il est « fait », sinon 0
       * (l'expérience est alors entièrement conservée), et jamais plus que le solde (R16, R18).
       */
      readonly xpRemoved: number;
    }
  | { readonly ok: false; readonly reason: DeleteHabitRefusal };

export type DeleteHabitResult =
  | {
      readonly ok: true;
      /** L'expérience retirée par la suppression, comme l'annonçait l'aperçu. */
      readonly xpRemoved: number;
      /** L'expérience totale du personnage après la suppression, telle qu'elle est enregistrée. */
      readonly xp: number;
    }
  | { readonly ok: false; readonly reason: DeleteHabitRefusal };

interface Deletion {
  readonly habit: Habit;
  readonly before: Character;
  readonly after: Character;
}

/** L'effet de la suppression de l'habitude sur le personnage, aujourd'hui (R16, R17, R18, R19). */
async function deletionOf(
  { habits, checkIns, character, settingsChanges }: Repositories,
  habitId: HabitId,
  { clock }: Pick<UseCaseDependencies, 'clock'>,
): Promise<Deletion | null> {
  const today = clock.today();
  const habit = await habits.findById(habitId);
  if (habit === null) {
    return null;
  }
  const before = await character.get();
  const after = before.retainOnHabitDeletion(
    deletionXpOf(
      await checkIns.listByHabit(habitId),
      await settingsChanges.listByHabit(habitId),
      habit.createdOn,
      today,
    ),
  );
  return { habit, before, after };
}

const xpRemovedBy = ({ before, after }: Deletion): number => before.xp - after.xp;

/**
 * Cas d'usage : le texte de la fenêtre de confirmation de la suppression de `habitId` (#6) : son
 * nom et l'expérience qui serait retirée. Ne change rien. Une panne de lecture est une exception.
 */
export function previewHabitDeletion(
  deps: UseCaseDependencies,
  habitId: HabitId,
): Promise<HabitDeletionPreview> {
  return deps.unitOfWork.run(async (repositories) => {
    const deletion = await deletionOf(repositories, habitId, deps);
    if (deletion === null) {
      return { ok: false, reason: 'unknownHabit' };
    }
    return { ok: true, name: deletion.habit.name.value, xpRemoved: xpRemovedBy(deletion) };
  });
}

/**
 * Cas d'usage : supprimer définitivement l'habitude `habitId`, après confirmation (#6, R17).
 * Ses suivis et ses changements de réglages sont effacés ; l'expérience de son suivi d'aujourd'hui
 * est retirée au barème de la difficulté de la semaine en cours (−20 Xp en Difficile s'il était
 * « fait »), jamais sous 0 (R16, R18) ; celle de ses autres jours, au barème de leur semaine, reste
 * acquise (Xp conservée, R19). Tout se fait dans une seule unité de travail : une panne de stockage
 * est une exception, et rien ne change, ni l'habitude, ni ses suivis, ni l'expérience.
 */
export function deleteHabit(
  deps: UseCaseDependencies,
  habitId: HabitId,
): Promise<DeleteHabitResult> {
  return deps.unitOfWork.run(async (repositories) => {
    const deletion = await deletionOf(repositories, habitId, deps);
    if (deletion === null) {
      return { ok: false, reason: 'unknownHabit' };
    }
    await repositories.character.save(deletion.after);
    await repositories.habits.remove(habitId);
    return { ok: true, xpRemoved: xpRemovedBy(deletion), xp: deletion.after.xp };
  });
}
