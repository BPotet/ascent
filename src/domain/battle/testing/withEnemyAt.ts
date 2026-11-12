// Stryker disable all: aide de test, jamais du code du jeu ; ses mutants ne mesurent rien.
import type { Battle, EnemyState } from '../Battle';

/** Le combat dont l'ennemi `index` est retouché par `change`. */
export function withEnemyAt(battle: Battle, index: number, change: Partial<EnemyState>): Battle {
  return {
    ...battle,
    enemies: battle.enemies.map((enemy, position) =>
      position === index ? { ...enemy, ...change } : enemy,
    ),
  };
}
