import type { Battle } from '../battle/Battle';
import type { BattleEvent } from '../battle/BattleEvent';
import { kindsAlong } from '../battle/enemyKinds';
import type { Discovery } from './DiscoveryBook';

/**
 * Les découvertes d'une mise à jour d'un combat d'étage (`battleDiscoveries`, #282, D1), dans
 * l'ordre :
 * 1. les événements, dans leur ordre, chacun avec le nom de code de son ennemi suivi au fil des
 *    entrées (`kindsAlong`, D2) : l'entrée d'un Renfort, d'un invoqué ou d'un exhumé le rend
 *    rencontré (B1 b, c, d) ; une chute (`enemyDefeated`) ou la chute d'un invoqué avec celui qui
 *    l'a appelé (`summonedFell`) le rend vaincu (B4, B6, B7) ;
 * 2. puis la première ligne d'après la mise à jour, jamais la réserve ni les places d'une Invocation
 *    annoncée (B2) : chaque ennemi est rencontré, et un ennemi à 0 PV est vaincu. Elle couvre le
 *    début du combat (B1 a, sans combat d'avant) et sa reprise (B1 e) ; le reste du temps, elle ne
 *    change rien (G3).
 *
 * Un ennemi qui se relève seul n'est jamais lu à 0 PV : sa relève est immédiate (B5). Maudit,
 * d'escorte, invoqué, exhumé ou en phase 2, un ennemi garde son nom de code (B7 à B10).
 */
export function battleDiscoveries(
  before: Battle | null,
  after: Battle,
  events: readonly BattleEvent[],
): Discovery[] {
  const kinds = kindsAlong(before, events);
  const fromEvents = events.flatMap((event, index): Discovery[] => {
    switch (event.type) {
      case 'reinforcementEntered':
      case 'summonEntered':
      case 'enemyExhumed':
        return [{ kind: event.kind, state: 'encountered' }];
      case 'enemyDefeated':
      case 'summonedFell': {
        const kind = kinds[index]!;
        return kind === null ? [] : [{ kind, state: 'defeated' }];
      }
      default:
        return [];
    }
  });
  const frontLine = after.enemies.flatMap(({ kind, hp }): Discovery[] => [
    { kind, state: 'encountered' },
    ...(hp > 0 ? [] : [{ kind, state: 'defeated' } as const]),
  ]);
  return [...fromEvents, ...frontLine];
}
