import { router } from 'expo-router';

import { WeekViewScreen } from '../../adapters/ui/screens/WeekViewScreen';

/** Ouvre le panneau « Nouvelle habitude » de la Vue Journée, avec une demande toujours nouvelle. */
function addHabit(): void {
  router.navigate({ pathname: '/', params: { newHabit: String(Date.now()) } });
}

/** Vue Semaine. Sans habitude, son bouton « Ajouter une habitude » mène à la Vue Journée. */
export default function WeekRoute() {
  return <WeekViewScreen onAddHabit={addHabit} />;
}
