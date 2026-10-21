import type { Character } from '../../domain/character/Character';
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
       * L'expérience que la suppression retirerait : 10 si l'habitude est « fait » aujourd'hui,
       * sinon 0 (l'expérience est alors entièrement conservée), et jamais plus que le solde (R16).
       */
      readonly xpRemoved: number;
    }
  | { readonly ok: false; readonly reason: DeleteHabitRefusal };

export type DeleteHabitResult =
  | {
      readonly ok: true;
      /** L'expérience retirée par la suppression, comme l'annonçait l'aperçu (0 ou 10). */
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

/** L'effet de la suppression de l'habitude sur le personnage, aujourd'hui (R16, R17). */
async function deletionOf(
  { habits, checkIns, character }: Repositories,
  habitId: HabitId,
  { clock }: Pick<UseCaseDependencies, 'clock'>,
): Promise<Deletion | null> {
  const today = clock.today();
  const habit = await habits.findById(habitId);
  if (habit === null) {
    return null;
  }
  const before = await character.get();
  const after = before.retainOnHabitDeletion(await checkIns.listByHabit(habitId), today);
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
 * Ses suivis sont effacés ; l'expérience de son suivi d'aujourd'hui est retirée (−10 Xp s'il était
 * « fait »), jamais sous 0 (R16) ; celle de ses autres jours reste acquise (Xp conservée). Tout se
 * fait dans une seule unité de travail : une panne de stockage est une exception, et rien ne
 * change, ni l'habitude, ni ses suivis, ni l'expérience.
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
