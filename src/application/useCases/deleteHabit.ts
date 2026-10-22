import type { Character } from '../../domain/character/Character';
import { type DeletionXp, deletionXpOf, targetBonusShareOf } from '../../domain/character/HabitXp';
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
       * Elle comprend la prime d'objectif de la semaine en cours si elle tombe sans ce suivi (#26).
       */
      readonly xpRemoved: number;
      /**
       * La part de `xpRemoved` qui vient de la prime d'objectif qui tombe (ex. 15 sur 25), pour le
       * texte de la confirmation ; réduite d'abord quand le plancher de 0 Xp joue.
       */
      readonly targetBonusRemoved: number;
    }
  | { readonly ok: false; readonly reason: DeleteHabitRefusal };

export type DeleteHabitResult =
  | {
      readonly ok: true;
      /** L'expérience retirée par la suppression, comme l'annonçait l'aperçu. */
      readonly xpRemoved: number;
      /** La part de `xpRemoved` qui vient de la prime d'objectif qui tombe, comme dans l'aperçu. */
      readonly targetBonusRemoved: number;
      /** L'expérience totale du personnage après la suppression, telle qu'elle est enregistrée. */
      readonly xp: number;
    }
  | { readonly ok: false; readonly reason: DeleteHabitRefusal };

interface Deletion {
  readonly habit: Habit;
  readonly before: Character;
  readonly after: Character;
  /** L'expérience que la suppression retire, et sa part de prime, avant le plancher. */
  readonly removed: DeletionXp;
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
  const removed = deletionXpOf(
    await checkIns.listByHabit(habitId),
    await settingsChanges.listByHabit(habitId),
    habit.createdOn,
    today,
  );
  return { habit, before, after: before.retainOnHabitDeletion(removed), removed };
}

/** L'expérience retirée par la suppression, et sa part de prime d'objectif. */
function removedBy({ before, after, removed }: Deletion): {
  readonly xpRemoved: number;
  readonly targetBonusRemoved: number;
} {
  const xpRemoved = before.xp - after.xp;
  const share = targetBonusShareOf(
    {
      checkInXp: removed.removedTargetBonus - removed.removed,
      targetBonus: -removed.removedTargetBonus,
    },
    -xpRemoved,
  );
  return { xpRemoved, targetBonusRemoved: -share };
}

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
    return { ok: true, name: deletion.habit.name.value, ...removedBy(deletion) };
  });
}

/**
 * Cas d'usage : supprimer définitivement l'habitude `habitId`, après confirmation (#6, R17).
 * Ses suivis et ses changements de réglages sont effacés ; l'expérience de son suivi d'aujourd'hui
 * est retirée au barème de la difficulté de la semaine en cours (−20 Xp en Difficile s'il était
 * « fait »), avec la prime d'objectif de la semaine en cours si elle tombe sans lui (#26), jamais
 * sous 0 (R16, R18) ; celle de ses autres jours, au barème de leur semaine, et les primes encore
 * acquises restent acquises (Xp conservée, R19). Tout se fait dans une seule unité de travail : une panne de stockage
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
    return { ok: true, ...removedBy(deletion), xp: deletion.after.xp };
  });
}
