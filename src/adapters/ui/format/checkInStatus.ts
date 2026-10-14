import type { CheckInStatus } from '../../../domain/checkIn/CheckInStatus';

/** L'état du suivi d'une case, tel que l'écrit l'interface (glossaire, « État du suivi »). */
export const checkInStatusLabels: Readonly<Record<CheckInStatus, string>> = {
  done: 'fait',
  pending: 'à faire',
  missed: 'pas fait',
  upcoming: 'à venir',
  notStarted: 'hors habitude',
};
