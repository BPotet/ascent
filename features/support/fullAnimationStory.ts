// Les outils des scénarios de « Le Spectre, le Chevalier déchu et le Prieur sans visage animés »
// (#138) : la pose recopiée de l'Atelier, peinte avec sa palette ou sa palette rouge, sa case dans
// l'atlas que la scène dessine, et les poses que la scène choisit au fil d'une action construite
// ici. Ils valent pour toute entité animée, à la taille de sa case du combat (`battleCell`), poses
// d'un coup comprises (#139).
import { enemyPose, restPose } from '../../src/adapters/ui/battle/scene/enemyPose';
import type { SceneTimeline } from '../../src/adapters/ui/battle/sceneTypes';
import { artPalette } from '../../src/adapters/ui/pixelArt/artPalette';
import type { Sprite } from '../../src/adapters/ui/pixelArt/sprites/Sprite';
import {
  battleCell,
  type FullAnimation,
} from '../../src/adapters/ui/pixelArt/sprites/atelier/fullAnimation';
import { atlasRect, battleAtlas } from '../../src/adapters/ui/pixelArt/sprites/battle/battleAtlas';
import type {
  AttackMotions,
  EnemyFrame,
} from '../../src/adapters/ui/pixelArt/sprites/battle/battleCharacters';
import type { AttackKind } from '../../src/domain/battle/attacks';
import type { AttackStep } from '../../src/domain/battle/Battle';
import type { EnemyKind, Move } from '../../src/domain/battle/combatants';
import { glintsOf } from '../../src/domain/battle/glints';

/** Une pose montrée par la scène, avec son liseré et son rouge. */
export interface ShownPose {
  readonly frame: EnemyFrame;
  readonly tier: 0 | 1 | 2;
  readonly red: boolean;
}

/** Le début de l'action et son premier impact, sur l'horloge de combat. */
export const STEP_IN_AT = 0;
export const WIND_UP_AT = 600;
export const IMPACT = 2_000;

/** Le code `artPalette` d'une teinte recopiée, cherché sans passer par le code testé. */
const codeOf = (tint: string) =>
  artPalette.tints.findIndex((known) => known?.toLowerCase() === tint.toLowerCase());

/**
 * La pose recopiée de l'Atelier, dans la case du combat de l'entité, centrée en largeur et calée
 * en bas, peinte avec sa palette, ou sa palette rouge avec `red`. Avec `attack`, la pose de ses
 * poses d'un coup quand il en a une pour cette image (#139).
 */
export function copiedPose(
  animation: FullAnimation<EnemyFrame>,
  frame: EnemyFrame,
  red = false,
  attack: AttackKind | null = null,
): Sprite {
  const [width, height] = battleCell(animation);
  const { w, h, pal, frames } = animation;
  const palette = red ? animation.red! : pal;
  const left = Math.floor((width - w) / 2);
  const pixels = new Uint8Array(width * height);
  const own = attack === null ? undefined : animation.attackPoses?.[attack]?.frames[frame];
  (own ?? frames[frame]).forEach((row, y) =>
    Array.from(row).forEach((char, x) => {
      if (char !== '.') {
        pixels[(y + height - h) * width + x + left] = codeOf(palette[parseInt(char, 36)]!);
      }
    }),
  );
  return { width, height, pixels };
}

/** Les ancrages recopiés d'une pose, dans la case du combat de l'entité, poses d'un coup comprises. */
export function copiedAnchors(
  animation: FullAnimation<EnemyFrame>,
  frame: EnemyFrame,
  attack: AttackKind | null = null,
) {
  const [width, height] = battleCell(animation);
  const left = Math.floor((width - animation.w) / 2);
  const top = height - animation.h;
  const moved = ([x, y]: readonly [number, number]) => [x + left, y + top];
  const own = attack === null ? undefined : animation.attackPoses?.[attack]?.anchors[frame];
  const { eye, head, tips } = own ?? animation.anchors[frame];
  return { eye: moved(eye), head: moved(head), tips: tips.map(moved) };
}

/** Les pixels de la case d'une variante dans l'atlas que la scène dessine, pose d'un coup comprise. */
export function atlasCell(
  kind: EnemyKind,
  frame: EnemyFrame,
  tier: number,
  red: boolean,
  attack: AttackKind | null = null,
): Uint8Array {
  const atlas = battleAtlas(kind);
  const rect = atlasRect(atlas.table, frame, tier, red, attack);
  const cell = new Uint8Array(rect.width * rect.height * 4);
  for (let row = 0; row < rect.height; row += 1) {
    const start = ((rect.y + row) * atlas.width + rect.x) * 4;
    cell.set(atlas.rgba.subarray(start, start + rect.width * 4), row * rect.width * 4);
  }
  return cell;
}

/** Le coup `move` d'un ennemi, comme le domaine le pose, impacts compris. */
function attackStep(move: Move, impacts: readonly number[], feintAt: number | null): AttackStep {
  return {
    kind: 'attack',
    enemy: 0,
    attack: move.attack,
    damage: move.damage,
    startedAt: STEP_IN_AT,
    feintAt,
    feintShown: false,
    impacts: impacts.map((at) => ({ at, landed: false, lost: false, outcome: null })),
    resolvedAt: impacts[impacts.length - 1]! + 160,
    counter: null,
  };
}

/** L'action d'un ennemi, telle que la scène la reçoit, reflets calculés par le domaine. */
export function attackTimeline(attack: AttackKind): SceneTimeline {
  const impacts = attack === 'double' ? [IMPACT, IMPACT + 420] : [IMPACT];
  const feintAt = attack === 'feint' ? IMPACT - 500 : null;
  return {
    enemy: 0,
    kind: 'attack',
    attack,
    stepInAt: STEP_IN_AT,
    windUpAt: WIND_UP_AT,
    windUpMs: IMPACT - WIND_UP_AT,
    until: impacts[impacts.length - 1]! + 600,
    impacts,
    feintAt,
    glints: glintsOf(attackStep({ attack, damage: 5 }, impacts, feintAt)),
    hitStopAt: 0,
    hitStopUntil: 0,
  };
}

/** L'avancée vers le héros, avant la préparation. */
export const STEP_IN: SceneTimeline = {
  ...attackTimeline('basic'),
  kind: 'stepIn',
  attack: null,
  until: WIND_UP_AT,
  impacts: [],
  glints: [],
};

/** Les poses de l'action, de `from` à `to`, chacune notée une fois quand elle change. */
export function posesOf(
  timeline: SceneTimeline,
  from: number,
  to: number,
  reduced = false,
): ShownPose[] {
  const shown: ShownPose[] = [];
  for (let now = from; now < to; now += 1) {
    const { frame, tier, red } = enemyPose(timeline, now, reduced);
    const last = shown[shown.length - 1];
    if (last?.frame !== frame || last.tier !== tier || last.red !== red) {
      shown.push({ frame, tier, red });
    }
  }
  return shown;
}

/** Une pose montrée par la scène avec la table de l'ennemi actif : sa source et son élévation. */
export interface AttackShownPose extends ShownPose {
  readonly poses: AttackKind | null;
  readonly lift: number;
}

/**
 * Les poses de l'action avec la table `motions` de l'ennemi actif (#139), de `from` à `to`,
 * chacune notée une fois quand elle change.
 */
export function attackPosesOf(
  timeline: SceneTimeline,
  motions: AttackMotions,
  from: number,
  to: number,
  reduced = false,
): AttackShownPose[] {
  const shown: AttackShownPose[] = [];
  for (let now = from; now < to; now += 1) {
    const { frame, tier, red, poses, lift } = enemyPose(timeline, now, reduced, motions);
    const last = shown[shown.length - 1];
    if (
      last?.frame !== frame ||
      last.tier !== tier ||
      last.red !== red ||
      last.poses !== poses ||
      last.lift !== lift
    ) {
      shown.push({ frame, tier, red, poses, lift });
    }
  }
  return shown;
}

/** Les poses au repos de 0 à 1 s : debout, étourdi depuis 0, ou tombé. */
export function restPoses(state: 'standing' | 'stunned' | 'fallen'): ShownPose[] {
  const enemy = {
    standing: state !== 'fallen',
    down: state === 'stunned',
    losingAction: false,
    rising: null,
    downSince: 0,
  };
  const shown: ShownPose[] = [];
  for (let now = 0; now < 1_000; now += 1) {
    const { frame } = restPose(enemy, 0, now);
    if (shown[shown.length - 1]?.frame !== frame) shown.push({ frame, tier: 0, red: false });
  }
  return shown;
}

/** `wanted` apparaît dans `shown`, dans l'ordre. */
export function inOrder(shown: readonly EnemyFrame[], wanted: readonly EnemyFrame[]): boolean {
  let next = 0;
  for (const frame of shown) if (frame === wanted[next]) next += 1;
  return next === wanted.length;
}
