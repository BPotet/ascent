import type { BattleSeed } from '../../domain/battle/SeededRandom';

/**
 * Source de graine (`SeedSource`) — port qui fournit une graine du combat pour chaque nouveau
 * combat : au hasard sur le téléphone, fixée dans les tests.
 */
export interface SeedSource {
  next(): BattleSeed;
}
