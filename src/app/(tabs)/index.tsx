import { useLocalSearchParams } from 'expo-router';

import { DayViewScreen } from '../../adapters/ui/screens/DayViewScreen';
import { openWeek } from './week';

/**
 * Vue Journée, l'accueil. Le paramètre `newHabit` (une nouvelle valeur à chaque demande) ouvre le
 * panneau « Nouvelle habitude » : c'est ainsi que l'état vide de la Vue Semaine mène à la création.
 * « Corriger » du rappel d'hier mène à la Vue Semaine, sur la semaine d'hier.
 */
export default function DayRoute() {
  const { newHabit } = useLocalSearchParams<{ newHabit?: string }>();
  return <DayViewScreen newHabitRequest={newHabit} onCorrectYesterday={openWeek} />;
}
