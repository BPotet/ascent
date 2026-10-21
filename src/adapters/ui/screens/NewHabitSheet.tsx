import { useState } from 'react';

import { DEFAULT_DIFFICULTY, type Difficulty } from '../../../domain/habit/Difficulty';
import type { Habit } from '../../../domain/habit/Habit';
import { DifficultyPicker } from '../components/DifficultyPicker';
import type { CreateHabit } from '../state/useCreateHabit';
import { HabitNameSheet } from './HabitNameSheet';

const SAVE_FAILED_MESSAGE = 'L’habitude n’a pas pu être créée. Réessaie.';

/**
 * Panneau du bas « Nouvelle habitude » (E2) : le nom, vide, clavier ouvert (`HabitNameSheet`), puis
 * le bloc « Difficulté », Moyenne présélectionnée (R2). Taper un nom puis ↵ crée l'habitude avec
 * les réglages affichés. Après un refus (doublon) ou un échec d'enregistrement, la difficulté
 * choisie est conservée, comme le nom. Une habitude créée est passée à `onCreated`.
 */
export function NewHabitSheet({
  habits,
  onCreate,
  onCreated,
  onClose,
}: {
  readonly habits: readonly Habit[];
  readonly onCreate: CreateHabit;
  readonly onCreated: (habit: Habit) => void;
  readonly onClose: () => void;
}) {
  const [difficulty, setDifficulty] = useState<Difficulty>(DEFAULT_DIFFICULTY);

  const submit = async (rawName: string) => {
    const outcome = await onCreate(rawName, difficulty);
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
      settings={<DifficultyPicker value={difficulty} onChange={setDifficulty} />}
      autoFocus
      onSubmit={submit}
      onClose={onClose}
    />
  );
}
