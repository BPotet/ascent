import { useLocalSearchParams } from 'expo-router';

import { DayViewScreen } from '../../adapters/ui/screens/DayViewScreen';

/**
 * Vue Journée, l'accueil. Le paramètre `newHabit` (une nouvelle valeur à chaque demande) ouvre le
 * panneau « Nouvelle habitude » : c'est ainsi que l'état vide de la Vue Semaine mène à la création.
 */
export default function DayRoute() {
  const { newHabit } = useLocalSearchParams<{ newHabit?: string }>();
  return <DayViewScreen newHabitRequest={newHabit} />;
}
