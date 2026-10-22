// Réservé aux tests : des graines du combat fixées, données dans l'ordre (la dernière se répète).
import type { BattleSeed } from '../../domain/battle/SeededRandom';
import type { SeedSource } from '../ports/SeedSource';

export class FixedSeedSource implements SeedSource {
  private index = 0;
  private readonly seeds: readonly BattleSeed[];

  constructor(...seeds: readonly BattleSeed[]) {
    this.seeds = seeds.length > 0 ? seeds : [1];
  }

  next(): BattleSeed {
    const seed = this.seeds[Math.min(this.index, this.seeds.length - 1)]!;
    this.index += 1;
    return seed;
  }
}
