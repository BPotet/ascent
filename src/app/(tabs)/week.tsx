import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';

import { WeekViewScreen } from '../../adapters/ui/screens/WeekViewScreen';
import { Day } from '../../domain/day/Day';
import { Week } from '../../domain/week/Week';

/**
 * Ouvre le panneau « Nouvelle habitude » de la Vue Journée, avec une demande toujours nouvelle.
 * L'état vide de la Vue Mois mène aussi à la création par ce chemin.
 */
export function addHabit(): void {
  router.navigate({ pathname: '/', params: { newHabit: String(Date.now()) } });
}

/** La semaine du jour `day` (`AAAA-MM-JJ`), ou aucune si le paramètre manque ou n'est pas un jour. */
function weekOf(day: string | undefined): Week | undefined {
  try {
    return Week.containing(Day.fromIsoString(String(day)));
  } catch {
    return undefined;
  }
}

/**
 * Vue Semaine. Sans habitude, son bouton « Ajouter une habitude » mène à la Vue Journée. Les
 * paramètres `week` (un jour `AAAA-MM-JJ`) et `request` (une nouvelle valeur à chaque demande)
 * l'affichent sur la semaine de ce jour : c'est ainsi que le rappel d'hier mène à la correction.
 */
export default function WeekRoute() {
  const { week, request } = useLocalSearchParams<{ week?: string; request?: string }>();
  const weekRequest = useMemo(() => {
    const requested = weekOf(week);
    // Sans `request`, la semaine n'est affichée qu'une fois.
    return requested && { week: requested, id: request ?? String(week) };
  }, [week, request]);
  return <WeekViewScreen onAddHabit={addHabit} weekRequest={weekRequest} />;
}
