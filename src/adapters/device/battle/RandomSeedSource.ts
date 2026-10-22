import type { SeedSource } from '../../../application/ports/SeedSource';
import type { BattleSeed } from '../../../domain/battle/SeededRandom';

const TWO_POW_32 = 4_294_967_296;

/** Source de graine du téléphone : une graine du combat au hasard, sur 32 bits non signés. */
export class RandomSeedSource implements SeedSource {
  constructor(private readonly random: () => number = Math.random) {}

  next(): BattleSeed {
    return Math.floor(this.random() * TWO_POW_32) >>> 0;
  }
}
