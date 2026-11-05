/**
 * Aide des scénarios de l'Invocation (#172) : un combat contre la Reine des phalènes (ou un groupe
 * mené par elle), aux valeurs du palier pour ses Phalénides, rejoué sans défense, le héros attaquant
 * sa cible à son tour, jusqu'à un événement voulu.
 */
import {
  advance,
  heroAction,
  nextDeadline,
  startBattle,
  type Battle,
  type BattleUpdate,
  type EnemyState,
} from '../../src/domain/battle/Battle';
import type { BattleEvent } from '../../src/domain/battle/BattleEvent';
import type { EnemyKind } from '../../src/domain/battle/combatants';
import { TIERS, type Tier } from '../../src/domain/ascent/tiers';

export interface Played {
  readonly battle: Battle;
  readonly events: BattleEvent[];
}

/** Un combat d'étage du palier `tier` contre `enemies`, ordre d'action par Initiative. */
export function summonBattle(
  enemies: readonly EnemyKind[] = ['mothQueen'],
  tier: Tier = 2,
): Battle {
  return startBattle({
    seed: 7,
    defenseHint: false,
    at: 0,
    initiative: true,
    enemies,
    summonMultiplier: TIERS[tier].multiplier,
  }).battle;
}

export function withEnemy(battle: Battle, index: number, change: Partial<EnemyState>): Battle {
  return {
    ...battle,
    enemies: battle.enemies.map((enemy, place) =>
      place === index ? { ...enemy, ...change } : enemy,
    ),
  };
}

/** Le 1er ennemi (la Reine) à `hp` PV, sa garde haute : le prochain coup ne la brise pas. */
export function queenAt(battle: Battle, hp: number): Battle {
  return withEnemy(battle, 0, { hp, guard: 60 });
}

/** Rejoue le combat, sans défense, le héros attaque la Reine à son tour, jusqu'à `done`. */
export function playUntil(
  initial: Battle,
  done: (events: readonly BattleEvent[]) => boolean,
): Played {
  let battle = initial;
  const events: BattleEvent[] = [];
  for (let step = 0; step < 600; step += 1) {
    if (done(events)) return { battle, events };
    let update: BattleUpdate;
    if (battle.phase.kind === 'hero') {
      const releasedAt = battle.now + 100;
      update = heroAction(
        { ...battle, target: 0 },
        { action: { kind: 'attack' }, touchStartedAt: releasedAt - 50, releasedAt },
      );
    } else {
      const deadline = nextDeadline(battle);
      if (deadline === null) throw new Error('The battle is stuck');
      update = advance(battle, deadline.at + 40);
    }
    battle = update.battle;
    events.push(...update.events);
  }
  throw new Error('The battle never reached the expected state');
}

export const happened =
  (type: BattleEvent['type']) =>
  (events: readonly BattleEvent[]): boolean =>
    events.some((event) => event.type === type);

export const typesOf = (events: readonly BattleEvent[]) => events.map((event) => event.type);

/** Joue `battle` jusqu'à l'annonce de l'Invocation, puis jusqu'à la manche suivante. */
export function playToEntry(battle: Battle): { readonly called: Played; readonly entered: Played } {
  const called = playUntil(battle, happened('summonCalled'));
  const entered = playUntil(called.battle, happened('roundStarted'));
  return { called, entered };
}
