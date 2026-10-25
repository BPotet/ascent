import { MAX_HABITS } from '../../../domain/habit/HabitRules';

/** Le libellé de l'action qui ouvre « Nouvelle habitude ». */
export const ADD_HABIT_LABEL = 'Ajouter une habitude';

/** L'explication de la limite de 10 habitudes. */
export const HABIT_LIMIT_MESSAGE = `${MAX_HABITS} habitudes au plus. Supprime une habitude pour en ajouter une.`;
