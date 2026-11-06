/**
 * Aide des scénarios de « L'arbre de pouvoirs » (#235) : un combat de test avec les pouvoirs
 * équipés d'un héros, un héros changé, une action datée, et un coup ennemi construit pour juger
 * ses impacts. Le combat part de la phase du héros (C1).
 */
import {
  heroAction,
  startBattle,
  type AttackStep,
  type Battle,
  type BattleUpdate,
  type HeroAction,
} from '../../src/domain/battle/Battle';
import type { BattleEvent } from '../../src/domain/battle/BattleEvent';
import type { AttackKind } from '../../src/domain/battle/attacks';
import type { HeroKind } from '../../src/domain/battle/combatants';
import type { PowerKind } from '../../src/domain/battle/powers';
import { TEST_BATTLE_ENEMIES } from '../../src/domain/battle/testing/testBattle';

/** Les pouvoirs équipés d'office quand les trois pouvoirs de l'arbre sont débloqués. */
export const EQUIPPED: Readonly<Record<HeroKind, readonly PowerKind[]>> = {
  sentinel: ['bulwark', 'retaliation', 'holdFast'],
  wanderer: ['shadowStep', 'rend', 'mist'],
};

/** Le combat de test de `hero`, avec ses trois pouvoirs équipés, le héros changé par `change`. */
export function powerBattle(hero: HeroKind, change: Partial<Battle['hero']> = {}): Battle {
  const { battle } = startBattle({
    seed: 7,
    defenseHint: false,
    at: 0,
    hero,
    enemies: TEST_BATTLE_ENEMIES,
    powers: EQUIPPED[hero],
  });
  return { ...battle, hero: { ...battle.hero, ...change } };
}

export const cast = (power: PowerKind): HeroAction => ({ kind: 'power', power });

/** Une action du héros, relâchée à `at`, le doigt posé 50 ms avant. */
export function act(battle: Battle, action: HeroAction, at: number): BattleUpdate {
  return heroAction(battle, { action, touchStartedAt: at - 50, releasedAt: at });
}

/** Un coup de la Goule en préparation, de `damage` dégâts, ses impacts aux instants donnés. */
export function underAttack(
  battle: Battle,
  impacts: readonly number[],
  { damage = 10, attack }: { readonly damage?: number; readonly attack?: AttackKind } = {},
): Battle {
  const step: AttackStep = {
    kind: 'attack',
    enemy: 0,
    attack: attack ?? (impacts.length > 1 ? 'double' : 'basic'),
    damage,
    startedAt: 1_000,
    feintAt: null,
    feintShown: false,
    impacts: impacts.map((at) => ({ at, landed: false, lost: false, outcome: null })),
    resolvedAt: impacts.at(-1)! + 160,
    counter: null,
  };
  return { ...battle, now: 1_900, lastPlayed: 'enemy', phase: { kind: 'enemy', step } };
}

/** La manche suivante commence à 1 250 ms : le dernier de l'ordre vient de perdre son action. */
export function atRoundEnd(battle: Battle): Battle {
  const order = battle.turn.order;
  return {
    ...battle,
    now: 1_000,
    lastPlayed: 'enemy',
    turn: { order, position: order.length - 1 },
    phase: { kind: 'enemy', step: { kind: 'lostAction', enemy: 0, since: 1_000, until: 1_250 } },
  };
}

type EventOf<Type extends BattleEvent['type']> = Extract<BattleEvent, { type: Type }>;

export function eventsOf<Type extends BattleEvent['type']>(
  events: readonly BattleEvent[],
  type: Type,
): EventOf<Type>[] {
  return events.filter((event): event is EventOf<Type> => event.type === type);
}
