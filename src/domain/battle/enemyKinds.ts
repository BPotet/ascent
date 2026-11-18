import type { Battle } from './Battle';
import type { BattleEvent } from './BattleEvent';
import type { EnemyKind } from './combatants';

/**
 * Le nom de code de l'ennemi de chaque événement d'une mise à jour (#268, extrait par #282, D2) :
 * lu dans le combat d'avant la mise à jour (`before`), puis suivi au fil des entrées. Un Renfort ou
 * un invoqué prend sa place, et l'Exhumation pose le sien à sa place `slot`, avant la lecture de
 * l'événement lui-même : une chute et un Renfort à la même place, dans la même mise à jour, gardent
 * chacun leur ennemi. `null` pour un événement sans ennemi, ou sans combat d'avant.
 */
export function kindsAlong(
  before: Battle | null,
  events: readonly BattleEvent[],
): (EnemyKind | null)[] {
  const kinds: (EnemyKind | undefined)[] = before?.enemies.map((enemy) => enemy.kind) ?? [];
  return events.map((event) => {
    if (event.type === 'reinforcementEntered' || event.type === 'summonEntered') {
      kinds[event.enemy] = event.kind;
    }
    if (event.type === 'enemyExhumed') kinds[event.slot] = event.kind;
    return 'enemy' in event ? (kinds[event.enemy] ?? null) : null;
  });
}
