import { useState } from 'react';

import type { Day } from '../../../domain/day/Day';
import { DEFAULT_DIFFICULTY, type Difficulty } from '../../../domain/habit/Difficulty';
import type { Habit } from '../../../domain/habit/Habit';
import { DEFAULT_WEEKLY_TARGET, type WeeklyTarget } from '../../../domain/habit/WeeklyTarget';
import { DifficultyPicker } from '../components/DifficultyPicker';
import { WeeklyTargetPicker } from '../components/WeeklyTargetPicker';
import { habitCreatedMessage } from '../format/formatWeeklyTarget';
import type { CreateHabit } from '../state/useCreateHabit';
import { HabitNameSheet } from './HabitNameSheet';

const SAVE_FAILED_MESSAGE = 'L’habitude n’a pas pu être créée. Réessaie.';

/**
 * Panneau du bas « Nouvelle habitude » (E2) : le nom, vide, clavier ouvert (`HabitNameSheet`), puis
 * le bloc « Difficulté », Moyenne présélectionnée (R2), et le bloc « Objectif », 7 (« Tous les
 * jours ») présélectionné (R4). Taper un nom puis ↵ crée l'habitude avec les réglages affichés.
 * Après un refus (doublon) ou un échec d'enregistrement, les réglages choisis sont conservés, comme
 * le nom.
 *
 * `today` est le jour de création : quand l'objectif choisi dépasse les jours restants de la
 * semaine, le bloc « Objectif » annonce l'objectif de cette semaine (« · cette semaine : 5, à partir
 * d’aujourd’hui », R6, maquette E2). Une habitude créée est passée à `onCreated` avec son message,
 * « Habitude créée », suivi de « · objectif 5 cette semaine » quand cet objectif est réduit.
 */
export function NewHabitSheet({
  habits,
  today,
  onCreate,
  onCreated,
  onClose,
}: {
  readonly habits: readonly Habit[];
  readonly today: Day;
  readonly onCreate: CreateHabit;
  readonly onCreated: (habit: Habit, message: string) => void;
  readonly onClose: () => void;
}) {
  const [difficulty, setDifficulty] = useState<Difficulty>(DEFAULT_DIFFICULTY);
  const [weeklyTarget, setWeeklyTarget] = useState<WeeklyTarget>(DEFAULT_WEEKLY_TARGET);

  const submit = async (rawName: string) => {
    const outcome = await onCreate(rawName, difficulty, weeklyTarget);
    if (!outcome.ok) {
      return outcome.reason;
    }
    onCreated(
      outcome.habit,
      habitCreatedMessage({ weeklyTarget, creationWeekTarget: outcome.weekTarget }),
    );
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
      settings={
        <>
          <DifficultyPicker value={difficulty} onChange={setDifficulty} />
          <WeeklyTargetPicker value={weeklyTarget} onChange={setWeeklyTarget} creationDay={today} />
        </>
      }
      autoFocus
      onSubmit={submit}
      onClose={onClose}
    />
  );
}
