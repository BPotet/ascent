/**
 * Aide des scénarios des Jardins de cendre (#267) : un combat ordinaire du palier 2 contre une Cosse
 * de braise à abattre, ou contre une Phalène voleuse qui frappe, les autres ennemis increvables et
 * étourdis tout le combat ; la frappe du héros, le coup de l'ennemi et ses défenses, joués par le
 * moteur du combat.
 */
import { encounterMultipliers } from '../../src/domain/ascent/tiers';
import { ATTACKS, type AttackKind } from '../../src/domain/battle/attacks';
import {
  advance,
  heroAction,
  nextDeadline,
  pressDefense,
  pressStrike,
  startBattle,
  type AttackStep,
  type Battle,
  type BattleOptions,
  type BattleUpdate,
  type EnemyState,
  type HeroAction,
  type HeroState,
} from '../../src/domain/battle/Battle';
import type { BattleEvent, DefenseButton } from '../../src/domain/battle/BattleEvent';
import type { EnemyKind } from '../../src/domain/battle/combatants';

/** Étourdi tout le combat : il perd son action à chaque manche. */
export const STUNNED = { heroAction: 999, actionLost: false };

export interface Played {
  readonly battle: Battle;
  readonly events: readonly BattleEvent[];
}

type EventOf<Type extends BattleEvent['type']> = Extract<BattleEvent, { type: Type }>;

export const eventsOf = <Type extends BattleEvent['type']>(
  events: readonly BattleEvent[],
  type: Type,
): EventOf<Type>[] => events.filter((event): event is EventOf<Type> => event.type === type);

export interface GardensOptions extends Partial<BattleOptions> {
  /** L'ennemi à la place 0, la Cosse de braise ou la Phalène voleuse. */
  readonly first: 'emberPod' | 'thievingMoth';
  /** Ce qui change sur l'ennemi de la place 0 ; une Cosse est à 1 PV, une Phalène increvable. */
  readonly change?: Partial<EnemyState>;
  readonly heroState?: Partial<HeroState>;
  /** Les autres ennemis, increvables et étourdis ; par défaut 2 Goules. */
  readonly others?: readonly EnemyKind[];
}

/** Un combat ordinaire du palier 2, au multiplicateur du palier, à 60 PV par défaut. */
export function gardensBattle({
  first,
  change = {},
  heroState = {},
  others = ['ghoul', 'ghoul'],
  ...options
}: GardensOptions): Battle {
  const enemies: readonly EnemyKind[] = [first, ...others];
  const { battle } = startBattle({
    seed: 7,
    defenseHint: false,
    at: 0,
    heroHp: 60,
    enemies,
    ...encounterMultipliers(2, { kind: 'combat', enemies }),
    ...options,
  });
  const lead = first === 'emberPod' ? { hp: 1 } : { hp: 999, maxHp: 999, guard: 999 };
  return {
    ...battle,
    hero: { ...battle.hero, ...heroState },
    enemies: battle.enemies.map((enemy, index) =>
      index === 0
        ? { ...enemy, ...lead, ...change }
        : { ...enemy, hp: 999, maxHp: 999, guard: 999, stun: STUNNED },
    ),
  };
}

const apply = (events: BattleEvent[], update: BattleUpdate) => {
  events.push(...update.events);
  return update.battle;
};

/** Le héros lance `action` (par défaut il attaque), puis chaque coup de la frappe à son impact. */
export function strike(battle: Battle, action: HeroAction = { kind: 'attack' }): Played {
  const events: BattleEvent[] = [];
  const at = Math.max(1_000, battle.now + 100);
  let current = apply(
    events,
    heroAction(battle, { action, touchStartedAt: at - 50, releasedAt: at }),
  );
  for (let step = 0; step < 50 && current.phase.kind === 'heroStrike'; step += 1) {
    const { phase } = current;
    if (!phase.resolved && phase.press === null) {
      current = apply(events, pressStrike(current, { at: phase.impactAt }));
    } else {
      const deadline = nextDeadline(current)!;
      current = apply(events, advance(current, deadline.at + (deadline.awaitsPress ? 1 : 0)));
    }
  }
  return { battle: current, events };
}

/** Le combat rejoué, sans action du héros, jusqu'à `done`. */
export function playUntil(
  initial: Played,
  done: (events: readonly BattleEvent[], battle: Battle) => boolean,
): Played {
  let { battle } = initial;
  const events = [...initial.events];
  for (let step = 0; step < 300 && !done(events, battle); step += 1) {
    const deadline = nextDeadline(battle);
    if (deadline === null) break;
    battle = apply(events, advance(battle, deadline.at + (deadline.awaitsPress ? 1 : 0)));
  }
  return { battle, events };
}

/** Jusqu'à la prochaine phase du héros. */
export const toHeroPhase = (played: Played): Played =>
  playUntil(played, (_, battle) => battle.phase.kind === 'hero');

/**
 * L'ennemi de la place 0 prépare `attack` (5 dégâts) ; le héros fait `action` d'abord en visant
 * l'ennemi 1, puis le combat va jusqu'au coup de l'ennemi 0, où le héros prend `hero`.
 */
export function blowOf(
  battle: Battle,
  {
    attack = 'basic',
    action = { kind: 'attack' },
    hero = {},
    keepIntent = false,
  }: {
    readonly attack?: AttackKind;
    readonly action?: HeroAction;
    readonly hero?: Partial<HeroState>;
    readonly keepIntent?: boolean;
  } = {},
): Battle {
  const intent = {
    category: 'attack' as const,
    attack,
    damage: 5,
    windUpMs: ATTACKS[attack].windUpMs,
    feintFraction: 0.5,
  };
  const ready: Battle = {
    ...battle,
    target: 1,
    enemies: battle.enemies.map((enemy, index) =>
      index === 0 && !keepIntent ? { ...enemy, intent } : enemy,
    ),
  };
  let current = heroAction(ready, { action, touchStartedAt: 50, releasedAt: 100 }).battle;
  for (let step = 0; step < 100; step += 1) {
    const { phase } = current;
    if (phase.kind === 'enemy' && phase.step.kind === 'attack') {
      return { ...current, hero: { ...current.hero, ...hero } };
    }
    const deadline = nextDeadline(current)!;
    current = advance(current, deadline.at + (deadline.awaitsPress ? 1 : 0)).battle;
  }
  throw new Error('The enemy never attacked');
}

export const stepOf = (battle: Battle) => (battle.phase as { readonly step: AttackStep }).step;

/** Une défense : le bouton et son écart à l'impact ; `null`, aucun appui. */
export type Defense = { readonly button: DefenseButton; readonly offset: number } | null;

export const SUFFERED: Defense = null;
export const GOOD_PARRY: Defense = { button: 'parry', offset: 100 };
export const PERFECT_PARRY: Defense = { button: 'parry', offset: 0 };
export const DODGE: Defense = { button: 'dodge', offset: 0 };

/** Le coup de l'ennemi jusqu'à sa fin (contre-attaque et riposte comprises), impact par impact. */
export function defend(initial: Battle, ...defenses: readonly Defense[]): Played {
  const events: BattleEvent[] = [];
  const pressed = new Set<number>();
  let battle = initial;
  const { startedAt } = stepOf(initial);
  for (let guard = 0; guard < 100; guard += 1) {
    const { phase } = battle;
    if (phase.kind !== 'enemy' || phase.step.kind !== 'attack') break;
    if (phase.step.startedAt !== startedAt) break;
    const index = phase.step.impacts.findIndex((impact) => impact.outcome === null);
    const defense = index < 0 ? null : (defenses[index] ?? null);
    if (defense !== null && !pressed.has(index)) {
      pressed.add(index);
      const at = phase.step.impacts[index]!.at + defense.offset;
      battle = apply(events, pressDefense(battle, { button: defense.button, at }));
      continue;
    }
    const deadline = nextDeadline(battle);
    if (deadline === null) break;
    battle = apply(events, advance(battle, deadline.at + (deadline.awaitsPress ? 1 : 0)));
  }
  return { battle, events };
}
