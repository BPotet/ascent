// Réservé aux tests : une graine du combat dont la première manche annonce les coups voulus.
import type { AttackKind } from '../../domain/battle/attacks';
import type { Intent } from '../../domain/battle/intents';
import { startTestBattle } from '../../domain/battle/testing/testBattle';

/** Les coups voulus à la première manche, par ennemi (Goule, Spectre). */
export interface FirstRound {
  readonly ghoul?: AttackKind;
  readonly specter?: AttackKind;
}

function attacks(intent: Intent | null, wanted: AttackKind | undefined): boolean {
  return wanted === undefined || (intent?.category === 'attack' && intent.attack === wanted);
}

/** La plus petite graine dont la première manche annonce `wanted`. */
export function seedFor(wanted: FirstRound): number {
  for (let seed = 1; seed < 10_000; seed += 1) {
    const [ghoul, specter] = startTestBattle({ seed, defenseHint: false, at: 0 }).battle.enemies;
    if (attacks(ghoul!.intent, wanted.ghoul) && attacks(specter!.intent, wanted.specter)) {
      return seed;
    }
  }
  throw new Error(`No battle seed opens with ${JSON.stringify(wanted)}`);
}
