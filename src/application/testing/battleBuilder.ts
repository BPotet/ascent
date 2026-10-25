// Réservé aux tests : un constructeur de combat qui pose les états des scénarios (« la garde du
// Spectre est à 8 », « la Goule est étourdie »…) sur le combat d'essai, sans événement.
import { actionOrder } from '../../domain/battle/actionOrder';
import { ATTACKS, type AttackKind } from '../../domain/battle/attacks';
import {
  startTrialBattle,
  type Battle,
  type EnemyState,
  type HeroState,
} from '../../domain/battle/Battle';
import { ENEMIES } from '../../domain/battle/combatants';
import type { Intent } from '../../domain/battle/intents';
import type { BattleFactory } from '../useCases/BattleSession';

/** Un changement de l'état d'un combat, sans événement. */
export type BattleChange = (battle: Battle) => Battle;

/**
 * Le combat d'essai, changé dès sa création : l'ordre d'action de la première manche suit les
 * ennemis debout après les changements, comme s'ils étaient ainsi au début de la manche.
 */
export function battleWith(...changes: readonly BattleChange[]): BattleFactory {
  return (options) => {
    const update = startTrialBattle(options);
    const battle = changeBattle(update.battle, ...changes);
    return {
      ...update,
      battle: { ...battle, turn: { ...battle.turn, order: actionOrder(battle.enemies) } },
    };
  };
}

export function changeBattle(battle: Battle, ...changes: readonly BattleChange[]): Battle {
  return changes.reduce((current, change) => change(current), battle);
}

export function enemyWith(enemy: number, change: Partial<EnemyState>): BattleChange {
  return (battle) => ({
    ...battle,
    enemies: battle.enemies.map((current, index) =>
      index === enemy ? { ...current, ...change } : current,
    ),
  });
}

export function heroWith(change: Partial<HeroState>): BattleChange {
  return (battle) => ({ ...battle, hero: { ...battle.hero, ...change } });
}

export function targetOn(enemy: number): BattleChange {
  return (battle) => ({ ...battle, target: enemy });
}

/** La manche en cours, sans rien changer d'autre. */
export function roundAt(round: number): BattleChange {
  return (battle) => ({ ...battle, round });
}

/**
 * Un ennemi étourdi. `heroAction` est l'action du héros pendant laquelle sa garde est tombée :
 * par défaut, la prochaine (comme s'il était brisé par elle) ; `actionLost` : son action perdue
 * est déjà passée.
 */
export function stunnedEnemy(
  enemy: number,
  {
    actionLost = false,
    heroAction,
  }: { readonly actionLost?: boolean; readonly heroAction?: number } = {},
): BattleChange {
  return (battle) =>
    enemyWith(enemy, {
      guard: 0,
      stun: { actionLost, heroAction: heroAction ?? battle.heroActions + 1 },
    })(battle);
}

/** Une intention d'attaque fixée : la préparation de base, la fausse amorce à 50 %. */
export function attackIntentOf(enemy: number, attack: AttackKind, windUpMs?: number): BattleChange {
  return (battle) => {
    const { moves } = ENEMIES[battle.enemies[enemy]!.kind];
    const move = moves.find((candidate) => candidate.attack === attack) ?? moves[0]!;
    const intent: Intent = {
      category: 'attack',
      attack,
      damage: move.damage,
      windUpMs: windUpMs ?? ATTACKS[attack].windUpMs,
      feintFraction: 0.5,
    };
    return enemyWith(enemy, { intent })(battle);
  };
}
