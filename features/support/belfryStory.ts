/**
 * Aide des scénarios du Beffroi (#266) : un combat contre un Battant de cloche qui prépare son
 * Grand balayage, ou contre un Bélier de bronze dont l'intention est la Charge, au palier 3, et le
 * combat joué jusqu'à un événement, le héros faisant son action à chacune de ses phases.
 */
import { TIERS } from '../../src/domain/ascent/tiers';
import {
  advance,
  heroAction,
  nextDeadline,
  pressDefense,
  startBattle,
  type AttackStep,
  type Battle,
  type BattleOptions,
  type EnemyState,
  type HeroAction,
  type HeroState,
} from '../../src/domain/battle/Battle';
import type { BattleEvent, DefenseButton } from '../../src/domain/battle/BattleEvent';
import type { HeroKind } from '../../src/domain/battle/combatants';

/** Le multiplicateur du palier 3 : × 1,75 sur les PV et les dégâts, × 1,5 sur la garde. */
export const BELFRY = TIERS[3].multiplier;

export interface Played {
  readonly battle: Battle;
  readonly events: readonly BattleEvent[];
}

/**
 * Le combat joué jusqu'à ce que `done` soit vrai : le héros fait `action` (par défaut « Attaquer »)
 * à chacune de ses phases, sans jamais se défendre.
 */
export function playUntil(
  start: Battle,
  done: (events: readonly BattleEvent[], battle: Battle) => boolean,
  action: () => HeroAction = () => ({ kind: 'attack' }),
): Played {
  let battle = start;
  const events: BattleEvent[] = [];
  for (let step = 0; step < 300; step += 1) {
    if (done(events, battle)) return { battle, events };
    if (battle.phase.kind === 'hero') {
      const releasedAt = battle.now + 100;
      const update = heroAction(battle, {
        action: action(),
        touchStartedAt: releasedAt - 50,
        releasedAt,
      });
      battle = update.battle;
      events.push(...update.events);
      continue;
    }
    const deadline = nextDeadline(battle);
    if (deadline === null) break;
    const update = advance(battle, deadline.at + (deadline.awaitsPress ? 1 : 0));
    battle = update.battle;
    events.push(...update.events);
  }
  if (done(events, battle)) return { battle, events };
  throw new Error('The battle never reached the expected point');
}

export const happened =
  (type: BattleEvent['type'], enemy = 0) =>
  (events: readonly BattleEvent[]): boolean =>
    events.some(
      (event) => event.type === type && (event as { readonly enemy?: number }).enemy === enemy,
    );

export const roundStarted = (round: number) => (events: readonly BattleEvent[]) =>
  events.some((event) => event.type === 'roundStarted' && event.round === round);

export const stepOf = (battle: Battle): AttackStep =>
  (battle.phase as { readonly step: AttackStep }).step;

/**
 * Un Battant de cloche (place 0) qui prépare son Grand balayage de 10, au début de sa préparation,
 * contre `hero` qui a agi le premier ; sa garde ne tombe jamais.
 */
export function sweepWindUp(hero: HeroKind = 'sentinel', change: Partial<HeroState> = {}): Battle {
  const { battle: started } = startBattle({
    seed: 7,
    defenseHint: false,
    at: 0,
    hero,
    enemies: ['bellClapper'],
    tierMultiplier: BELFRY,
  });
  const ready: Battle = {
    ...started,
    enemies: started.enemies.map((enemy) => ({
      ...enemy,
      guard: 999,
      maxGuard: 999,
      intent: {
        category: 'attack',
        attack: 'sweep',
        damage: 10,
        windUpMs: 1_300,
        feintFraction: 0.5,
      },
    })),
  };
  const { battle } = playUntil(ready, happened('windUpStarted'));
  return { ...battle, hero: { ...battle.hero, ...change } };
}

/** Un appui sur `button` à `offset` ms de l'impact du coup en cours. */
export function pressAt(battle: Battle, button: DefenseButton, offset: number): Played {
  return pressDefense(battle, { button, at: stepOf(battle).impacts[0]!.at + offset });
}

export function blowOf(events: readonly BattleEvent[]) {
  return events.find(
    (event): event is Extract<BattleEvent, { type: 'blowResolved' }> =>
      event.type === 'blowResolved',
  );
}

/**
 * Un Bélier de bronze (place 0) au palier 3, dont l'intention de la manche 1 est la Charge, contre
 * la Sentinelle qui agit la première ; sa garde est assez haute pour ne jamais tomber, sauf `change`.
 */
export function ramBattle(
  change: Partial<EnemyState> = {},
  options: Partial<BattleOptions> = {},
): Battle {
  const { battle } = startBattle({
    seed: 7,
    defenseHint: false,
    at: 0,
    enemies: ['bronzeRam'],
    tierMultiplier: BELFRY,
    ...options,
  });
  return {
    ...battle,
    enemies: battle.enemies.map((enemy) => ({
      ...enemy,
      guard: 999,
      maxGuard: 999,
      intent: { category: 'charge' as const },
      ...change,
    })),
  };
}

/** Le Bélier qui charge : sa Charge de la manche 1 est faite, au début de la manche 2. */
export function chargingRam(
  change: Partial<EnemyState> = {},
  options: Partial<BattleOptions> = {},
): Battle {
  return playUntil(ramBattle(change, options), roundStarted(2)).battle;
}

/** La même place, avec une garde à 1 : le prochain coup la brise. */
export function weakened(battle: Battle): Battle {
  return { ...battle, enemies: battle.enemies.map((enemy) => ({ ...enemy, guard: 1 })) };
}
