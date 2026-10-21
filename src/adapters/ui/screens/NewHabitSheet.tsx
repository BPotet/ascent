import type { Habit } from '../../../domain/habit/Habit';
import type { CreateHabitOutcome } from '../state/useCreateHabit';
import { HabitNameSheet } from './HabitNameSheet';

const SAVE_FAILED_MESSAGE = 'L’habitude n’a pas pu être créée. Réessaie.';

/**
 * Panneau du bas « Nouvelle habitude » : un seul champ, vide, clavier ouvert (`HabitNameSheet`).
 * Une habitude créée est passée à `onCreated`.
 */
export function NewHabitSheet({
  habits,
  onCreate,
  onCreated,
  onClose,
}: {
  readonly habits: readonly Habit[];
  readonly onCreate: (rawName: string) => Promise<CreateHabitOutcome>;
  readonly onCreated: (habit: Habit) => void;
  readonly onClose: () => void;
}) {
  const submit = async (rawName: string) => {
    const outcome = await onCreate(rawName);
    if (!outcome.ok) {
      return outcome.reason;
    }
    onCreated(outcome.habit);
    return null;
  };

  return (
    <HabitNameSheet
      testID="new-habit"
      title="Nouvelle habitude"
      submitLabel="Créer l’habitude"
      submitTestID="create-habit"
      saveFailedMessage={SAVE_FAILED_MESSAGE}
      habits={habits}
      autoFocus
      onSubmit={submit}
      onClose={onClose}
    />
  );
}
