import { MonthViewScreen } from '../../adapters/ui/screens/MonthViewScreen';
import { addHabit } from './week';

/**
 * Vue Mois : le calendrier du mois et tout l'historique. Sans habitude, son bouton « Ajouter une
 * habitude » mène, comme celui de la Vue Semaine, au panneau « Nouvelle habitude » de la Vue
 * Journée.
 */
export default function MonthRoute() {
  return <MonthViewScreen onAddHabit={addHabit} />;
}
