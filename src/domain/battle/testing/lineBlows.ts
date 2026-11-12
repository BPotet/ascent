// Stryker disable all: aide de test, jamais du code du jeu ; ses mutants ne mesurent rien.
/**
 * Aide de test (#268) : un combat dont on fixe la première ligne (PV, étourdissement, intentions),
 * joué sans défense, le héros attaquant sans appui, jusqu'au début de la préparation d'un coup
 * choisi. La garde de chaque ennemi est portée à 999 : le héros n'étourdit personne par mégarde.
 */
import { ATTACKS, type AttackKind } from '../attacks';
import {
  advance,
  heroAction,
  nextDeadline,
  startBattle,
  type AttackStep,
  type Battle,
  type BattleOptions,
  type BattleUpdate,
  type EnemyState,
} from '../Battle';
import type { BattleEvent } from '../BattleEvent';
import type { EnemyKind } from '../combatants';

export const STUNNED = { actionLost: false, heroAction: 0 } as const;

type WindUp = Extract<BattleEvent, { type: 'windUpStarted' }>;

/** Le combat contre `enemies`, garde 999, le héros à 999 PV ; `change` retouche chaque ennemi. */
export function lineBattle(
  enemies: readonly EnemyKind[],
  change: (enemy: EnemyState, index: number) => Partial<EnemyState> = () => ({}),
  options: Partial<BattleOptions> = {},
): Battle {
  const { battle } = startBattle({ seed: 7, defenseHint: false, at: 0, enemies, ...options });
  return {
    ...battle,
    hero: { ...battle.hero, hp: 999, maxHp: 999 },
    enemies: battle.enemies.map((enemy, index) => ({
      ...enemy,
      guard: 999,
      maxGuard: 999,
      ...change(enemy, index),
    })),
  };
}

/** L'intention d'attaque `attack` de `damage` pour l'ennemi `index`, à sa manche. */
export function withAttack(
  battle: Battle,
  index: number,
  attack: AttackKind,
  damage: number,
): Battle {
  return {
    ...battle,
    enemies: battle.enemies.map((enemy, position) =>
      position === index
        ? {
            ...enemy,
            intent: {
              category: 'attack',
              attack,
              damage,
              windUpMs: ATTACKS[attack].windUpMs,
              feintFraction: 0.5,
            },
          }
        : enemy,
    ),
  };
}

export interface StartedBlow {
  readonly battle: Battle;
  readonly step: AttackStep;
  readonly windUp: WindUp;
  readonly events: readonly BattleEvent[];
}

/** Joue jusqu'au début de la préparation du `nth` coup (à partir de 1) de l'ennemi `enemy`. */
export function untilBlow(initial: Battle, enemy: number, nth = 1): StartedBlow {
  let battle = initial;
  const events: BattleEvent[] = [];
  let seen = 0;
  for (let guard = 0; guard < 500; guard += 1) {
    let update: BattleUpdate;
    if (battle.phase.kind === 'hero') {
      const releasedAt = battle.now + 100;
      update = heroAction(battle, {
        action: { kind: 'attack' },
        touchStartedAt: releasedAt - 50,
        releasedAt,
      });
    } else {
      const deadline = nextDeadline(battle);
      if (deadline === null) throw new Error('The battle is stuck');
      update = advance(battle, deadline.at + 1);
    }
    battle = update.battle;
    events.push(...update.events);
    for (const event of update.events) {
      if (event.type !== 'windUpStarted' || event.enemy !== enemy) continue;
      seen += 1;
      if (seen < nth) continue;
      const { phase } = battle;
      if (phase.kind !== 'enemy' || phase.step.kind !== 'attack') {
        throw new Error('The blow is not in its wind-up');
      }
      return { battle, step: phase.step, windUp: event, events };
    }
  }
  throw new Error(`Enemy ${enemy} never struck`);
}

/** Joue jusqu'à la fin du coup en cours, sans défense : les impacts jugés. */
export function untilResolved(
  initial: Battle,
): readonly Extract<BattleEvent, { type: 'blowResolved' }>[] {
  let battle = initial;
  const resolved: Extract<BattleEvent, { type: 'blowResolved' }>[] = [];
  const impacts = (battle.phase as { step: AttackStep }).step.impacts.length;
  for (let guard = 0; guard < 100 && resolved.length < impacts; guard += 1) {
    const deadline = nextDeadline(battle);
    if (deadline === null) break;
    const update = advance(battle, deadline.at + 1);
    battle = update.battle;
    for (const event of update.events) if (event.type === 'blowResolved') resolved.push(event);
  }
  return resolved;
}
