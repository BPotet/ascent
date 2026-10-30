import type { Glint } from '../../../../domain/battle/glints';
import type { Point } from '../../pixelArt/sprites/Sprite';
import type { EffectKind } from '../../pixelArt/sprites/battle/battleEffects';
import type { SceneSpark, SceneTimeline } from '../sceneTypes';
import { FRAME_MS, sceneInstant } from './enemyPose';

// Stryker disable all: durées de la maquette (`paintFX`), mutées seulement avec `mutation:ui`.
const FLASH_MS = 160;
const FLASH_STEPS = 3;
const GLINT_MS = 90;
const GLINT_FRAME_MS = 30;
const SPARK_MS = 400;
const HURT_MS = 450;
const HURT_STEP_MS = 90;
/** Le Rempart (#128) : éclats sur 500 ms en 5 pas ; onde en 6 pas de 50 ms ; éclats d'impact en 3 pas. */
const SHARDS_MS = 500;
const SHARD_STEPS = 5;
const RIPOSTE_MS = 400;
const WAVE_STEP_MS = 50;
const WAVE_STEPS = 6;
const BURST_STEP_MS = 100;
const BURST_STEPS = 3;
/** En mouvement réduit, les amplitudes sont au quart ; les durées ne changent pas. */
const REDUCED_AMPLITUDE = 0.25;
/** Les 4 éclats de l'écu (maquette, `.shard`) : départ autour du centre de l'écu, puis écart, en dp. */
const SHARDS: readonly (readonly [number, number, number, number])[] = [
  [-11, -10, -14, -18],
  [15, -14, 16, -14],
  [-7, 20, -10, 16],
  [15, 16, 18, 14],
];
/** Les 4 éclats d'argent sur l'ennemi (maquette, `.burst`), en dp de son centre. */
const BURST: readonly (readonly [number, number])[] = [
  [0, -20],
  [20, 0],
  [0, 20],
  [-20, 0],
];
// Stryker restore all

/**
 * Le palier (0 à 2) de l'éclair d'impact sur le héros : 160 ms à chaque impact, même sans appui,
 * jamais à la fausse amorce. `null` sans éclair.
 */
export function impactFlash(timeline: SceneTimeline | null, now: number): number | null {
  'worklet';
  if (timeline === null || timeline.kind !== 'attack') return null;
  const t = sceneInstant(timeline, now);
  for (const impact of timeline.impacts) {
    const since = t - impact;
    if (since >= 0 && since < FLASH_MS) {
      return Math.min(FLASH_STEPS - 1, Math.floor((since * FLASH_STEPS) / FLASH_MS));
    }
  }
  return null;
}

/** Une image d'effet à dessiner, centrée sur son point (en pixels d'art du sprite de l'ennemi). */
export interface EffectSprite {
  readonly effect: EffectKind;
  readonly frame: number;
  readonly x: number;
  readonly y: number;
}

/**
 * Les reflets visibles (`glintSprites`) : chacun 90 ms, en 3 images de 30 ms (seule exception à la
 * cadence de 12 images par seconde, ADR 0008), à l'œil de l'ennemi, ou à ses deux griffes pour
 * une double frappe.
 */
export function glintSprites(
  glints: readonly Glint[],
  now: number,
  anchors: { readonly eye: Point | null; readonly tips: readonly Point[] },
): EffectSprite[] {
  'worklet';
  const sprites: EffectSprite[] = [];
  for (const glint of glints) {
    const since = now - glint.at;
    if (since < 0 || since >= GLINT_MS) continue;
    const frame = Math.min(2, Math.floor(since / GLINT_FRAME_MS));
    const effect: EffectKind =
      glint.kind === 'red' ? 'glintRed' : glint.kind === 'dull' ? 'glintDull' : 'glintWhite';
    const points =
      glint.kind === 'double' ? anchors.tips : anchors.eye === null ? [] : [anchors.eye];
    for (const [x, y] of points) sprites.push({ effect, frame, x, y });
  }
  return sprites;
}

/** L'image (0 à 4) de l'étincelle d'une parade, 83 ms chacune ; `null` hors de ses 400 ms. */
export function sparkFrame(spark: SceneSpark | null, now: number): number | null {
  'worklet';
  if (spark === null) return null;
  const since = now - spark.at;
  if (since < 0 || since >= SPARK_MS) return null;
  return Math.min(4, Math.floor(since / FRAME_MS));
}

/** Le palier (0 à 4) de la vignette rouge d'un coup reçu, sur 450 ms ; `null` sans vignette. */
export function hurtLevel(hurtAt: number | null, now: number): number | null {
  'worklet';
  if (hurtAt === null) return null;
  const since = now - hurtAt;
  if (since < 0 || since >= HURT_MS) return null;
  return Math.min(4, Math.floor(since / HURT_STEP_MS));
}

function amplitude(reducedMotion: boolean): number {
  'worklet';
  return reducedMotion ? REDUCED_AMPLITUDE : 1;
}

/**
 * L'écu du Rempart devant le héros (#128, provisoire tant que l'Atelier ne l'a pas validé) : `0`
 * entier et fixe, sans pulsation, tant que le Rempart est actif ; `1` fendu pendant une image
 * (83 ms) quand il s'use ; `null` ensuite (il éclate) ou sans Rempart.
 */
export function bulwarkShield(active: boolean, wornAt: number | null, now: number): 0 | 1 | null {
  'worklet';
  if (wornAt !== null && now < wornAt + FRAME_MS) return now < wornAt ? 0 : 1;
  return active ? 0 : null;
}

/**
 * Les 4 éclats d'argent de l'écu qui éclate (#128) : après la fente, ils s'écartent pendant 500 ms
 * en 5 pas. Leurs places en dp, depuis le centre de l'écu ; aucune hors de ce temps.
 */
export function bulwarkShards(
  wornAt: number | null,
  now: number,
  reducedMotion: boolean,
): (readonly [number, number])[] {
  'worklet';
  if (wornAt === null) return [];
  const since = now - wornAt - FRAME_MS;
  if (since < 0 || since >= SHARDS_MS) return [];
  const spread =
    (amplitude(reducedMotion) * (Math.floor((since * SHARD_STEPS) / SHARDS_MS) + 1)) / SHARD_STEPS;
  return SHARDS.map(([x, y, dx, dy]) => [Math.round(x + dx * spread), Math.round(y + dy * spread)]);
}

/**
 * La part de l'onde d'argent dessinée, de l'écu à l'ennemi (#128) : 6 pas de 50 ms, puis entière
 * jusqu'à la fin de la riposte. En mouvement réduit, elle part déjà aux trois quarts.
 */
export function riposteWave(
  riposte: { readonly at: number } | null,
  now: number,
  reducedMotion: boolean,
): number | null {
  'worklet';
  if (riposte === null) return null;
  const since = now - riposte.at;
  if (since < 0 || since >= RIPOSTE_MS) return null;
  const start = 1 - amplitude(reducedMotion);
  const step = Math.min(WAVE_STEPS, Math.floor(since / WAVE_STEP_MS) + 1);
  return start + ((1 - start) * step) / WAVE_STEPS;
}

/**
 * Les 4 éclats d'argent sur l'ennemi touché par la riposte (#128) : ils s'ouvrent en 3 pas de
 * 100 ms et restent jusqu'à la fin de la riposte. Leurs places en dp, depuis son centre.
 */
export function riposteBurst(
  riposte: { readonly at: number } | null,
  now: number,
  reducedMotion: boolean,
): (readonly [number, number])[] {
  'worklet';
  if (riposte === null) return [];
  const since = now - riposte.at;
  if (since < 0 || since >= RIPOSTE_MS) return [];
  const start = 1 - 0.6 * amplitude(reducedMotion);
  const step = Math.min(BURST_STEPS, Math.floor(since / BURST_STEP_MS) + 1);
  const scale = start + ((1 - start) * step) / BURST_STEPS;
  return BURST.map(([x, y]) => [Math.round(x * scale), Math.round(y * scale)]);
}
