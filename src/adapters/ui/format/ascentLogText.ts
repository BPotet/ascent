import type { AscentLogStatus } from '../../../application/useCases/exportAscentLog';

/** Les libellés de l'Export du journal (#196, maquette 193, tableau A1). */
export const EXPORT_LABEL = 'Exporter le journal';
export const PREPARING_LABEL = 'Préparation du journal';
export const EMPTY_LOG_LINE = "Aucune ascension dans le journal pour l'instant.";
export const EXPORT_ERROR_LINE = "Le journal n'a pas pu être exporté. Réessaie.";
const SHARE_HINT = "Ouvre le menu de partage d'Android.";

/** Au-delà de ce nombre, la ligne de compte dit « 20 dernières ascensions ». */
const KEPT = 20;

/** La ligne de compte : « 7 ascensions, dont celle en cours », « 20 dernières ascensions ». */
export function logCountLine({ count, inProgress }: AscentLogStatus): string {
  if (count === 1) return inProgress ? '1 ascension, celle en cours' : '1 ascension';
  const ascents = count >= KEPT ? `${KEPT} dernières ascensions` : `${count} ascensions`;
  return inProgress ? `${ascents}, dont celle en cours` : ascents;
}

/** L'indice du bouton actif : la ligne de compte, puis ce que fait le bouton. */
export function exportHint(status: AscentLogStatus): string {
  return `${logCountLine(status)}. ${SHARE_HINT}`;
}

/** « 1 ascension illisible laissée de côté. » */
export function ignoredLogsLine(ignored: number): string {
  return ignored === 1
    ? '1 ascension illisible laissée de côté.'
    : `${ignored} ascensions illisibles laissées de côté.`;
}
