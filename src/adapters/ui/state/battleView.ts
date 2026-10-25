import type { Battle } from '../../../domain/battle/Battle';
import type { PhaseDirection } from '../../../domain/battle/BattleEvent';
import { ATTACK_NAMES, ENEMY_NAMES } from '../format/battleText';

/** Le temps mort affiché par l'étiquette « Attends » : de son début à sa fin, en ms. */
export interface LockSpan {
  readonly since: number;
  readonly until: number;
}

/**
 * La zone d'action (grille de deux cases, notes UX de #31) : en phase du héros, la case de gauche
 * est vide et « Attaquer » occupe celle de droite ; en phase ennemie, Esquive à gauche et Parade à
 * droite. `locked` : inactifs, sans hachures (transition de phase) ; `offBalance` : grisés et
 * hachurés, toujours actifs (déséquilibre).
 */
export type ActionPad =
  | { readonly kind: 'hero'; readonly locked: boolean; readonly lock: LockSpan | null }
  | {
      readonly kind: 'defense';
      readonly locked: boolean;
      readonly lock: LockSpan | null;
      readonly offBalance: boolean;
    }
  | { readonly kind: 'none' };

/** La ligne au-dessus des boutons : « Cible : Goule », « Goule s'avance », « Goule : coup simple ». */
export interface ZoneLine {
  readonly before: string;
  readonly strong: string;
  readonly after: string;
}

export interface BattleView {
  /** La pastille de phase en haut de la scène, `null` à la fin du combat. */
  readonly phase: PhaseDirection | null;
  readonly banner: {
    readonly to: PhaseDirection;
    readonly since: number;
    readonly until: number;
  } | null;
  readonly pad: ActionPad;
  readonly line: ZoneLine | null;
  /** L'ennemi qui attaque (les autres s'effacent), et celui qui s'avance. */
  readonly attacker: number | null;
  readonly steppingIn: number | null;
  /** L'ennemi qui porte le sceau rouge. */
  readonly sealed: number | null;
  readonly defenseHint: boolean;
  /** Les actions de la phase du héros sont possibles (cible, « Attaquer »). */
  readonly heroActions: boolean;
}

function enemyName(battle: Battle, enemy: number): string {
  return ENEMY_NAMES[battle.enemies[enemy]!.kind];
}

/** Ce que l'écran montre d'un état du combat. */
export function battleView(battle: Battle): BattleView {
  const { phase } = battle;
  const target = battle.enemies[battle.target];
  const targetLine: ZoneLine | null =
    target === undefined
      ? null
      : { before: 'Cible : ', strong: ENEMY_NAMES[target.kind], after: '' };
  const base = {
    banner: null,
    line: null,
    attacker: null,
    steppingIn: null,
    sealed: null,
    defenseHint: false,
    heroActions: false,
  };
  switch (phase.kind) {
    case 'hero':
      return {
        ...base,
        phase: 'hero',
        pad: { kind: 'hero', locked: false, lock: null },
        line: targetLine,
        heroActions: true,
      };
    case 'heroAction':
      return {
        ...base,
        phase: 'hero',
        pad: { kind: 'hero', locked: true, lock: null },
        line: targetLine,
      };
    case 'defenseHint':
      return {
        ...base,
        phase: 'enemy',
        pad: { kind: 'defense', locked: true, lock: null, offBalance: false },
        defenseHint: true,
      };
    case 'transition': {
      const lock = { since: phase.since, until: phase.until };
      return {
        ...base,
        phase: phase.to,
        banner: { to: phase.to, since: phase.since, until: phase.until },
        pad:
          phase.to === 'hero'
            ? { kind: 'hero', locked: true, lock }
            : { kind: 'defense', locked: true, lock, offBalance: false },
      };
    }
    case 'enemy': {
      const { step } = phase;
      const name = enemyName(battle, step.enemy);
      const offBalance = battle.offBalanceUntil !== null;
      const pad = { kind: 'defense', locked: false, lock: null, offBalance } as const;
      if (step.kind === 'stepIn') {
        return {
          ...base,
          phase: 'enemy',
          pad,
          line: { before: '', strong: name, after: ' s’avance' },
          attacker: step.enemy,
          steppingIn: step.enemy,
        };
      }
      return {
        ...base,
        phase: 'enemy',
        pad,
        line: { before: '', strong: name, after: ` : ${ATTACK_NAMES[step.attack]}` },
        attacker: step.enemy,
        sealed: step.attack === 'perilous' ? step.enemy : null,
      };
    }
    case 'over':
      return { ...base, phase: null, pad: { kind: 'none' } };
  }
}
