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
