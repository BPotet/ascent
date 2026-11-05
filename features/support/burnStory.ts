/**
 * Aide des scénarios de la Brûlure (#171) : un combat dont les ennemis sont increvables, un coup
 * posé sur le 1er ennemi, des ennemis qui restent étourdis (ils ne frappent jamais), et le combat
 * rejoué jusqu'à un instant voulu, chaque impact recevant la défense demandée.
 */
import {
  advance,
  heroAction,
  nextDeadline,
  pressDefense,
  startBattle,
  type Battle,
  type BattleUpdate,
  type HeroState,
} from '../../src/domain/battle/Battle';
import type { BattleEvent, DefenseButton } from '../../src/domain/battle/BattleEvent';
import { ATTACKS } from '../../src/domain/battle/attacks';
import type { EnemyKind, Move } from '../../src/domain/battle/combatants';
import type { HeroModifiers } from '../../src/domain/battle/heroModifiers';

export type Defense = { readonly button: DefenseButton; readonly offset: number } | null;

/** Le combat contre `enemies`, ennemis increvables, le héros tel que donné. */
export function burnBattle(
  enemies: readonly EnemyKind[],
  hero: Partial<HeroState> = {},
  modifiers?: HeroModifiers,
): Battle {
  const { battle } = startBattle({
    seed: 7,
    defenseHint: false,
    at: 0,
    heroHp: 50,
    enemies,
    ...(modifiers && { modifiers }),
  });
  return {
    ...battle,
    hero: { ...battle.hero, ...hero },
    enemies: battle.enemies.map((enemy) => ({ ...enemy, hp: 999, guard: 999 })),
  };
}

/** Les ennemis à partir de `from` restent étourdis : ils perdent leur action, sans frapper. */
export function idle(battle: Battle, from = 0): Battle {
  return {
    ...battle,
    enemies: battle.enemies.map((enemy, index) =>
      index < from ? enemy : { ...enemy, stun: { actionLost: false, heroAction: 999 } },
    ),
  };
}

/** Le 1er ennemi porte le coup `move` à sa prochaine action. */
export function intending(battle: Battle, move: Move): Battle {
  const intent = {
    category: 'attack' as const,
    attack: move.attack,
    damage: move.damage,
    windUpMs: ATTACKS[move.attack].windUpMs,
    feintFraction: 0.5,
    ...(move.burn !== undefined && { burn: move.burn }),
  };
  return {
    ...battle,
    enemies: battle.enemies.map((enemy, index) => (index ? enemy : { ...enemy, intent })),
  };
}

/** Rejoue jusqu'à `done` : le héros attaque à son tour, chaque impact reçoit `defense`. */
export function playBurn(
  initial: Battle,
  done: (events: readonly BattleEvent[], battle: Battle) => boolean,
  defense: Defense = null,
): { readonly battle: Battle; readonly events: BattleEvent[] } {
  let battle = initial;
  const events: BattleEvent[] = [];
  for (let guard = 0; guard < 300; guard += 1) {
    if (done(events, battle) || battle.phase.kind === 'over') return { battle, events };
    const { phase } = battle;
    const impact =
      phase.kind === 'enemy' && phase.step.kind === 'attack'
        ? phase.step.impacts.find((candidate) => candidate.outcome === null)
        : undefined;
    let update: BattleUpdate;
    if (phase.kind === 'hero') {
      const releasedAt = battle.now + 100;
      update = heroAction(battle, {
        action: { kind: 'attack' },
        touchStartedAt: releasedAt - 50,
        releasedAt,
      });
    } else if (defense !== null && impact !== undefined) {
      update = pressDefense(battle, { button: defense.button, at: impact.at + defense.offset });
    } else {
      update = advance(battle, nextDeadline(battle)!.at + 40);
    }
    battle = update.battle;
    events.push(...update.events);
  }
  throw new Error('The battle never reached the expected state');
}

export const ofType = <Type extends BattleEvent['type']>(
  events: readonly BattleEvent[],
  type: Type,
) => events.filter((event): event is Extract<BattleEvent, { type: Type }> => event.type === type);

export const blowsResolved = (count: number) => (events: readonly BattleEvent[]) =>
  ofType(events, 'blowResolved').length >= count;

export const roundStarted = (round: number) => (events: readonly BattleEvent[]) =>
  events.some((event) => event.type === 'roundStarted' && event.round === round);
