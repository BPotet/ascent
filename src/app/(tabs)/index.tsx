import { router, useLocalSearchParams } from 'expo-router';

import { DayViewScreen } from '../../adapters/ui/screens/DayViewScreen';
import type { Week } from '../../domain/week/Week';

/**
 * Ouvre la Vue Semaine sur `week`, désignée par son lundi, avec une demande toujours nouvelle :
 * « Corriger » la réaffiche même si le joueur en a changé depuis.
 */
function correctIn(week: Week): void {
  router.navigate({
    pathname: '/week',
    params: { week: week.start.toIsoString(), request: String(Date.now()) },
  });
}

/**
 * Vue Journée, l'accueil. Le paramètre `newHabit` (une nouvelle valeur à chaque demande) ouvre le
 * panneau « Nouvelle habitude » : c'est ainsi que l'état vide de la Vue Semaine mène à la création.
 * « Corriger » du rappel d'hier mène à la Vue Semaine, sur la semaine d'hier.
 */
export default function DayRoute() {
  const { newHabit } = useLocalSearchParams<{ newHabit?: string }>();
  return <DayViewScreen newHabitRequest={newHabit} onCorrectYesterday={correctIn} />;
}
