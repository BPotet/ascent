import type { Day } from '../../domain/day/Day';

/**
 * Horloge (`Clock`) — port qui donne aujourd'hui, la date du calendrier local du téléphone.
 * Injectée partout où une règle dépend du jour, pour pouvoir la fixer dans les tests.
 */
export interface Clock {
  today(): Day;
}
