import type { Day } from '../../domain/day/Day';

/**
 * Horloge (`Clock`) — port qui donne aujourd'hui, la date du calendrier local du téléphone.
 * Injectée partout où une règle dépend du jour, pour pouvoir la fixer dans les tests. Les cas
 * d'usage n'ont besoin que de `today()`, lu une fois au début de leur unité de travail.
 */
export interface Clock {
  today(): Day;
}

/**
 * Horloge qui prévient quand aujourd'hui change (ADR 0002, décision 7). C'est celle que reçoit
 * l'interface, pour que les écrans se recalent seuls sur le nouveau jour.
 */
export interface WatchedClock extends Clock {
  /**
   * Appelle `listener` avec le nouvel aujourd'hui chaque fois qu'il change : à minuit heure locale,
   * au retour au premier plan, lors d'un changement de fuseau ou d'un recul de l'horloge. Jamais
   * quand le jour n'a pas changé. Renvoie la fonction qui désabonne `listener`.
   */
  onTodayChange(listener: (today: Day) => void): () => void;
}
