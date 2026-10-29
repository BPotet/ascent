import type { AttackKind } from '../../../../domain/battle/attacks';
import type { AttackMotions, EnemyFrame } from '../../pixelArt/sprites/battle/battleCharacters';
import type { SceneEnemy, SceneTimeline } from '../sceneTypes';

/** Une image dure 83 ms : 12 images par seconde, comptées depuis l'instant nominal (ADR 0008). */
export const FRAME_MS = 1_000 / 12;

/**
 * La pose d'un ennemi à une image : son image, son liseré, sa palette rouge, sa portée (la part du
 * chemin vers le héros, 0,85 au plus) et son tremblement, en dp. `poses` est le type de coup dont
 * l'image vient (ses poses d'un coup, #139), `null` pour l'animation complète ; `lift` est
 * l'élévation de l'image, en pixels d'art entiers.
 */
export interface EnemyPose {
  readonly frame: EnemyFrame;
  readonly tier: 0 | 1 | 2;
  readonly red: boolean;
  readonly reach: number;
  readonly jitter: number;
  readonly poses: AttackKind | null;
  readonly lift: number;
}

// Stryker disable all: poses de la maquette (`pxAct`, `actPose`), mutées seulement avec `mutation:ui`.
const ADVANCE = 0.3;
const BACK = 0.14;
const HIT = 0.85;
const FEINT_REACH = 0.74;
const RUSH_MS = 80;
const RECOVERY_MS = 170;
const RETURN_MS = 250;
const FEINT_RETURN_MS = 190;
/** Après un reflet, la pose reste pleine et immobile 70 ms : la ruée part. */
const GLINT_HOLD_MS = 70;
const SUPPORT_REACH = 0.12;
/** Avec « réduire les animations », l'ennemi ne parcourt qu'un quart du chemin. */
const REDUCED_MOTION = 0.25;
/** Sans poses d'un coup : la table d'un ennemi qui n'en a pas. */
const NO_MOTIONS: AttackMotions = {};
// Stryker restore all

function clamp01(value: number): number {
  'worklet';
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function ease(value: number): number {
  'worklet';
  return 1 - (1 - value) * (1 - value);
}

/** L'image de l'avancée : `step0`, `step1`, `step2`, `step1`… */
function stepFrame(index: number): EnemyFrame {
  'worklet';
  const step = index % 4;
  return step === 0 ? 'step0' : step === 2 ? 'step2' : 'step1';
}

/**
 * L'instant où évaluer la scène : figé pendant l'arrêt sur image, sur la pose de sa fin, puisque
 * le domaine a déjà décalé les instants qui suivent.
 */
export function sceneInstant(timeline: SceneTimeline, now: number): number {
  'worklet';
  return now >= timeline.hitStopAt && now < timeline.hitStopUntil ? timeline.hitStopUntil : now;
}

function pose(
  frame: EnemyFrame,
  tier: 0 | 1 | 2,
  red: boolean,
  reach: number,
  jitter: number,
  motion: number,
): EnemyPose {
  'worklet';
  return { frame, tier, red, reach: reach * motion, jitter: jitter * motion, poses: null, lift: 0 };
}

/** L'image de l'ennemi actif à l'instant `now`, le haut de sa ruée en `hit`. */
function framePose(timeline: SceneTimeline, now: number, reduced: boolean, hit: number): EnemyPose {
  'worklet';
  const t = sceneInstant(timeline, now);
  const motion = reduced ? REDUCED_MOTION : 1;
  if (timeline.kind === 'support') {
    const q = clamp01((t - timeline.stepInAt) / Math.max(1, timeline.until - timeline.stepInAt));
    const middle = q > 0.25 && q < 0.75;
    return pose(
      middle ? 'ant1' : 'ant0',
      1,
      false,
      SUPPORT_REACH * Math.sin(Math.PI * q),
      0,
      motion,
    );
  }
  if (timeline.kind === 'stepIn' || t < timeline.windUpAt) {
    const progress = clamp01(
      (t - timeline.stepInAt) / Math.max(1, timeline.windUpAt - timeline.stepInAt),
    );
    const frame = stepFrame(Math.floor(Math.max(0, t - timeline.stepInAt) / FRAME_MS));
    return pose(frame, 1, false, ADVANCE * ease(progress), 0, motion);
  }
  const red = timeline.attack === 'perilous' || timeline.attack === 'delayedPerilous';
  const { impacts } = timeline;
  let j = -1;
  for (let n = 0; n < impacts.length; n += 1) {
    if (t < (impacts[n] ?? 0) + RECOVERY_MS) {
      j = n;
      break;
    }
  }
  if (j < 0) {
    const since = t - ((impacts[impacts.length - 1] ?? t) + RECOVERY_MS);
    const frame: EnemyFrame =
      since < FRAME_MS
        ? 'rec0'
        : since < 2 * FRAME_MS
          ? 'rec1'
          : since < RETURN_MS
            ? stepFrame(3 - (Math.floor(since / FRAME_MS) % 4))
            : 'idle0';
    return pose(frame, 1, red, ADVANCE * (1 - clamp01(since / RETURN_MS)), 0, motion);
  }
  const impact = impacts[j] ?? t;
  const rest = j < impacts.length - 1 ? ADVANCE - 0.06 : ADVANCE;
  if (t >= impact) {
    const recovery = clamp01((t - impact) / RECOVERY_MS);
    return pose('impact', 2, red, hit - (hit - rest) * ease(recovery), 0, motion);
  }
  if (t >= impact - RUSH_MS) {
    const rush = (t - (impact - RUSH_MS)) / RUSH_MS;
    return pose(
      'lunge',
      2,
      red,
      ADVANCE - BACK + (hit - (ADVANCE - BACK)) * rush * rush,
      0,
      motion,
    );
  }
  const segment = j === 0 ? timeline.windUpAt : (impacts[j - 1] ?? 0) + RECOVERY_MS;
  const span = Math.max(1, impact - RUSH_MS - segment);
  const n = Math.floor((t - segment) / FRAME_MS);
  const q = clamp01((n * FRAME_MS) / span);
  const progress = clamp01((t - segment) / span);
  let frame: EnemyFrame;
  let tier: 0 | 1 | 2;
  let jitter = 0;
  let reach: number;
  if (timeline.attack === 'double' && j === 1) {
    frame = n < 1 ? 'rec0' : 'ant2';
    tier = 1;
    reach = rest - (rest - (ADVANCE - BACK)) * ease(progress);
  } else if (timeline.attack === 'delayed' || timeline.attack === 'delayedPerilous') {
    if (q < 0.45) {
      frame = q < 0.15 ? 'ant0' : q < 0.3 ? 'ant1' : 'ant2';
      tier = q < 0.3 ? 0 : 1;
    } else {
      frame = n % 2 === 1 ? 'hes' : 'ant2';
      tier = 1;
    }
    reach = ADVANCE - BACK * ease(clamp01(progress / 0.45));
  } else {
    frame = q < 0.2 ? 'ant0' : q < 0.5 ? 'ant1' : 'ant2';
    tier = q < 0.2 ? 0 : q < 0.6 ? 1 : 2;
    reach = ADVANCE - BACK * ease(progress);
  }
  if (red) {
    tier = tier === 0 ? 1 : tier;
    if (q > 0.35 && !reduced) jitter = n % 2 === 1 ? 2 : -2;
  }
  if (timeline.feintAt !== null) {
    const fromFeint = t - timeline.feintAt;
    if (fromFeint >= -RUSH_MS && fromFeint < FEINT_RETURN_MS) {
      const rise =
        fromFeint < 0 ? (1 + fromFeint / RUSH_MS) ** 2 : 1 - ease(fromFeint / FEINT_RETURN_MS);
      reach = ADVANCE - BACK + (FEINT_REACH - (ADVANCE - BACK)) * rise;
      if (fromFeint < 0) {
        frame = 'feint0';
        tier = 2;
      } else {
        frame = fromFeint < FRAME_MS ? 'feint1' : fromFeint < 1.6 * FRAME_MS ? 'ant2' : 'ant1';
        tier = fromFeint < FRAME_MS ? 2 : 1;
      }
    }
  }
  for (const glint of timeline.glints) {
    const since = t - glint.at;
    if (since >= 0 && since < GLINT_HOLD_MS) {
      frame = 'ant2';
      jitter = 0;
      tier = glint.kind === 'dull' ? 1 : 2;
      break;
    }
  }
  return pose(frame, tier, red, reach, jitter, motion);
}

/**
 * La pose de l'ennemi actif (`enemyPose`, `pxAct` et `actPose` de la maquette) : l'avancée en
 * `step*` sans rouge (C2.8) ; l'anticipation propre à chaque coup, dont l'hésitation du coup
 * retardé ; la ruée, une seule image `lunge` sur [impact − 80, impact[ ; l'image `impact` à
 * l'impact ; la récupération en 170 ms, le retour en 250 ms. La fausse ruée s'arrête à 74 % de la
 * distance, sans image d'impact. Le rouge du coup imparable commence avec la préparation.
 *
 * Avec la table `motions` de l'ennemi actif (#139), l'image choisie, aux mêmes instants, vient des
 * poses d'un coup quand l'attaque en a pour elle : `poses` donne alors le type de coup, et `lift`
 * son élévation (le quart, arrondi au pixel d'art, en mouvement réduit). La portée du coup, quand
 * l'Atelier en donne une, remplace le haut de la ruée. Jamais pendant l'avancée, une Garde ou un
 * Relever : le type de coup n'y est pas connu.
 */
export function enemyPose(
  timeline: SceneTimeline,
  now: number,
  reduced: boolean,
  motions: AttackMotions = NO_MOTIONS,
): EnemyPose {
  'worklet';
  const own =
    timeline.kind === 'attack' && timeline.attack !== null ? motions[timeline.attack] : undefined;
  const shown = framePose(timeline, now, reduced, own?.reach ?? HIT);
  const lift = own?.lift[shown.frame];
  if (lift === undefined) return shown;
  const scaled = reduced ? Math.round(lift * REDUCED_MOTION) : lift;
  return { ...shown, poses: timeline.attack, lift: scaled };
}

/** La pose d'un ennemi qui n'agit pas : son image, ses étoiles (position 0 à 3) et leur saut. */
export interface RestPose {
  readonly frame: EnemyFrame;
  readonly stars: number | null;
  readonly hop: boolean;
}

/**
 * La pose d'un ennemi au repos (`restPose`) : il respire (`idle0`, `idle1` toutes les 250 ms, chacun
 * à son rythme) ; étourdi, il est à terre (`hurt` 200 ms à la chute, puis `down`) et ses étoiles
 * tournent (4 positions, toutes les 125 ms), en sautant de 2 px quand il perd son action ; il se
 * relève (`down`, `hurt`, puis `idle0`) ; tombé pour de bon, il reste `hurt`.
 */
export function restPose(
  enemy: Pick<SceneEnemy, 'standing' | 'down' | 'losingAction' | 'rising' | 'downSince'>,
  index: number,
  now: number,
): RestPose {
  'worklet';
  if (!enemy.standing) return { frame: 'hurt', stars: null, hop: false };
  if (enemy.rising !== null) {
    const since = now - enemy.rising.since;
    const frame: EnemyFrame = since < 133 ? 'down' : since < 266 ? 'hurt' : 'idle0';
    return { frame, stars: null, hop: false };
  }
  if (enemy.down) {
    const since = enemy.downSince === null ? Infinity : now - enemy.downSince;
    return {
      frame: since >= 0 && since < 200 ? 'hurt' : 'down',
      stars: Math.floor(now / 125) % 4,
      hop: enemy.losingAction,
    };
  }
  const breath = Math.floor((now + index * 130) / 250) % 2;
  return { frame: breath === 1 ? 'idle1' : 'idle0', stars: null, hop: false };
}
