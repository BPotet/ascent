import type { Actor } from '../../../domain/battle/actionOrder';
import {
  heroProfile,
  nextRoundOrder,
  type Battle,
  type EnemyState,
} from '../../../domain/battle/Battle';
import type { PhaseDirection } from '../../../domain/battle/BattleEvent';
import type { EnemyKind } from '../../../domain/battle/combatants';
import { POWERS, missingMomentum, type PowerKind } from '../../../domain/battle/momentum';
import { shownIntent, type ShownIntent } from '../../../domain/battle/shownIntent';
import {
  ENEMY_NAMES,
  enemyHpText,
  enemyLabel,
  guardText,
  stunnedLabel,
} from '../format/battleText';

/** Le temps mort affiché par l'étiquette « Attends » : de son début à sa fin, en ms. */
export interface LockSpan {
  readonly since: number;
  readonly until: number;
}

/** Le pouvoir de la case de gauche : son coût, et l'Élan qui manque (0 s'il est disponible). */
export interface PowerSlot {
  readonly power: PowerKind;
  readonly cost: number;
  readonly missing: number;
  /** Pas de l'ombre est actif : indisponible jusqu'à son emploi (prototype #90). */
  readonly active?: true;
}

/**
 * La frise d'action (prototype #90, maquette F2, F6) : le combattant en cours et ceux qui n'ont
 * pas encore agi dans la manche, ennemis debout seulement, puis l'aperçu de la manche suivante.
 */
export interface ActionTrackView {
  readonly round: number;
  readonly current: readonly Actor[];
  readonly next: readonly Actor[];
}

/**
 * La zone d'action (grille de deux cases, maquette F1, F3, P0) : en phase du héros, « Pouvoir » à
 * gauche et « Attaquer » à droite ; pendant la frappe en rythme, « Frapper » sur toute la largeur ;
 * en phase ennemie, Esquive à gauche et Parade à droite. `locked` : inactifs, sans hachures
 * (transition de phase) ; `offBalance` : grisés et hachurés, toujours actifs (déséquilibre).
 */
export type ActionPad =
  | {
      readonly kind: 'hero';
      readonly locked: boolean;
      readonly lock: LockSpan | null;
      readonly power: PowerSlot;
    }
  | {
      readonly kind: 'strike';
      readonly since: number;
      readonly impactAt: number;
      readonly resolved: boolean;
    }
  | {
      readonly kind: 'defense';
      readonly locked: boolean;
      readonly lock: LockSpan | null;
      readonly offBalance: boolean;
    }
  | { readonly kind: 'none' };

/** La ligne au-dessus des boutons : « Cible : Goule », « Touche Frapper quand… ». */
export interface ZoneLine {
  readonly before: string;
  readonly strong: string;
  readonly after: string;
}

/**
 * La plaque d'un ennemi et son état dans la scène (contrat avec #81, qui le dessine) : à terre et
 * étoiles (`stunned`), étoiles qui sursautent (`losingAction`), relèvement (`rising`), premier
 * plan (`active`) et estompé (`dimmed`). En phase ennemie épurée, le nom et les chiffres sont
 * masqués (`null`) ; le lecteur d'écran garde tout (`label`).
 */
export interface EnemyView {
  readonly kind: EnemyKind;
  readonly name: string | null;
  readonly standing: boolean;
  readonly target: boolean;
  readonly hpRatio: number;
  readonly hpText: string | null;
  readonly guardRatio: number;
  /** « Garde 15/15 », « Étourdie ×1,5 », ou `null` (masqué). */
  readonly guardText: string | null;
  readonly stunned: boolean;
  readonly losingAction: boolean;
  readonly rising: { readonly since: number; readonly until: number } | null;
  readonly intent: ShownIntent | null;
  readonly active: boolean;
  readonly dimmed: boolean;
  readonly label: string;
}

export interface BattleView {
  /** La pastille de phase en haut de la scène, `null` à la fin du combat ou hors des phases. */
  readonly phase: PhaseDirection | null;
  readonly banner: {
    readonly to: PhaseDirection;
    readonly since: number;
    readonly until: number;
  } | null;
  readonly pad: ActionPad;
  readonly line: ZoneLine | null;
  readonly enemies: readonly EnemyView[];
  /** L'ennemi qui porte le sceau rouge. */
  readonly sealed: number | null;
  readonly defenseHint: boolean;
  /** Les actions de la phase du héros sont possibles (cible, « Attaquer », « Pouvoir »). */
  readonly heroActions: boolean;
  /** La phase ennemie épurée : noms, chiffres des PV et ligne d'information masqués. */
  readonly trimmed: boolean;
}

/** La durée de l'annonce « À toi » quand la phase du héros commence sans transition. */
export const ANNOUNCED_BANNER_MS = 800;

const STRIKE_LINE: ZoneLine = {
  before: 'Touche ',
  strong: 'Frapper',
  after: ' quand la barre atteint le trait.',
};

function powerSlot(battle: Battle): PowerSlot {
  const { power } = heroProfile(battle);
  return {
    power,
    cost: POWERS[power].cost,
    missing: missingMomentum(battle.hero.momentum, power),
    ...(power === 'shadowStep' && battle.hero.shadowStep === true && { active: true as const }),
  };
}

/** La frise d'action d'un état du combat ; vide à la fin du combat. */
export function actionTrackView(battle: Battle): ActionTrackView {
  if (battle.phase.kind === 'over') return { round: battle.round, current: [], next: [] };
  const standing = (actor: Actor) => actor === 'hero' || battle.enemies[actor]!.hp > 0;
  return {
    round: battle.round,
    current: battle.turn.order.slice(battle.turn.position).filter(standing),
    next: nextRoundOrder(battle),
  };
}

function targetLine(battle: Battle): ZoneLine | null {
  const target = battle.enemies[battle.target];
  if (target === undefined) return null;
  return {
    before: 'Cible : ',
    strong: ENEMY_NAMES[target.kind],
    after: target.stun === null ? '' : ' · ×1,5',
  };
}

/** L'ennemi au premier plan : celui qui s'avance, attaque ou garde, jamais un étourdi. */
function activeEnemy(battle: Battle): number | null {
  const { phase } = battle;
  if (phase.kind !== 'enemy') return null;
  const { step } = phase;
  return step.kind === 'lostAction' || step.kind === 'guardRestore' ? null : step.enemy;
}

function enemyView(
  battle: Battle,
  enemy: EnemyState,
  index: number,
  { trimmed, active }: { readonly trimmed: boolean; readonly active: number | null },
): EnemyView {
  const { phase } = battle;
  const target = !trimmed && index === battle.target;
  const intent = shownIntent(battle, index);
  const stunned = enemy.stun !== null;
  return {
    kind: enemy.kind,
    name: trimmed ? null : ENEMY_NAMES[enemy.kind],
    standing: enemy.hp > 0,
    target,
    hpRatio: enemy.hp / enemy.maxHp,
    hpText: trimmed ? null : enemyHpText(enemy.hp, enemy.maxHp),
    guardRatio: enemy.guard / enemy.maxGuard,
    guardText: stunned
      ? stunnedLabel(enemy.kind)
      : trimmed
        ? null
        : guardText(enemy.guard, enemy.maxGuard),
    stunned,
    losingAction:
      phase.kind === 'enemy' && phase.step.kind === 'lostAction' && phase.step.enemy === index,
    rising: enemy.guardRestore,
    intent,
    active: active === index,
    dimmed: active !== null && active !== index,
    label: enemyLabel(enemy, intent, target),
  };
}

/** Ce que l'écran montre d'un état du combat. */
export function battleView(battle: Battle): BattleView {
  const { phase } = battle;
  const inEnemyPhase = phase.kind === 'enemy' && battle.lastPlayed === 'enemy';
  const trimmed =
    inEnemyPhase ||
    phase.kind === 'defenseHint' ||
    (phase.kind === 'transition' && phase.to === 'enemy');
  const active = activeEnemy(battle);
  const enemies = battle.enemies.map((enemy, index) =>
    enemyView(battle, enemy, index, { trimmed, active }),
  );
  const base = {
    banner: null,
    line: null,
    enemies,
    sealed: null,
    defenseHint: false,
    heroActions: false,
    trimmed,
  };
  const heroPad = (locked: boolean, lock: LockSpan | null): ActionPad => ({
    kind: 'hero',
    locked,
    lock,
    power: powerSlot(battle),
  });
  switch (phase.kind) {
    case 'hero':
      return {
        ...base,
        phase: 'hero',
        banner: phase.announced
          ? { to: 'hero', since: phase.since, until: phase.since + ANNOUNCED_BANNER_MS }
          : null,
        pad: heroPad(false, null),
        line: targetLine(battle),
        heroActions: true,
      };
    case 'heroStrike':
      return {
        ...base,
        phase: 'hero',
        pad: {
          kind: 'strike',
          since: phase.since,
          impactAt: phase.impactAt,
          resolved: phase.resolved,
        },
        line: STRIKE_LINE,
      };
    case 'heroPower':
      return { ...base, phase: 'hero', pad: heroPad(true, null), line: targetLine(battle) };
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
            ? heroPad(true, lock)
            : { kind: 'defense', locked: true, lock, offBalance: false },
      };
    }
    case 'enemy': {
      // Une action perdue ou un retour en garde juste après le héros : ce n'est pas encore la
      // phase ennemie (C5.4).
      if (!inEnemyPhase) return { ...base, phase: null, pad: heroPad(true, null) };
      const { step } = phase;
      return {
        ...base,
        phase: 'enemy',
        pad: {
          kind: 'defense',
          locked: false,
          lock: null,
          offBalance: battle.offBalanceUntil !== null,
        },
        sealed: step.kind === 'attack' && step.attack === 'perilous' ? step.enemy : null,
      };
    }
    case 'over':
      return { ...base, phase: null, pad: { kind: 'none' } };
  }
}
