import { BURN_EFFECT } from '../../pixelArt/sprites/atelier/data/burn';
import type { SceneBurn } from '../sceneTypes';

// Stryker disable all: durées de la maquette (planche de la Brûlure), mutées seulement avec `mutation:ui`.
/** Une flamme boucle sur ses 3 images à 150 ms, chaque flamme 50 ms derrière la précédente. */
const FLAME_FRAME_MS = 150;
const FLAME_STAGGER_MS = 50;
/** À une prise, après l'éclat de braise, les nouvelles flammes s'allument une à une, à 80 ms d'écart. */
const LIGHT_STAGGER_MS = 80;
/** Au crépitement, les flammes grandissent : leur 2e image est tenue 300 ms (maquette B5). */
const GROW_MS = 300;
const GROWN_FRAME = 1;
/** L'éclat de braise : 2 images de 100 ms. */
const HIT_FRAME_MS = 100;
const HIT_FRAMES = 2;
/** La fumée : 3 images de 120 ms ; en mouvement réduit, la petite fumée seule, 250 ms. */
const OUT_FRAME_MS = 120;
const OUT_FRAMES = 3;
const OUT_REDUCED_MS = 250;
// Stryker restore all

const { slots: SLOTS, w: FLAME_W, h: FLAME_H } = BURN_EFFECT.effects.burn;

/** Une image de la Brûlure, centrée sur `(x, y)`, en pixels d'art de la case du héros. */
export interface BurnSprite {
  readonly effect: 'burn' | 'burnOut';
  readonly frame: number;
  readonly x: number;
  readonly y: number;
}

/** Le centre d'une flamme posée à la place `slot` de l'effet (son coin haut gauche). */
function at(slot: number, effect: BurnSprite['effect'], frame: number): BurnSprite {
  'worklet';
  const [left, top] = SLOTS[slot]!;
  return { effect, frame, x: left + FLAME_W / 2 + 0.5, y: top + FLAME_H / 2 };
}

/**
 * Les flammes et la fumée de la Brûlure à l'instant `now` (#171) : une flamme par charge, la 1re
 * charge à la 1re place ; une flamme nouvelle n'apparaît qu'à son tour, après l'éclat de braise ;
 * au crépitement, les flammes grandissent ; une flamme éteinte brûle jusqu'à sa fumée, puis part en
 * fumée grise. En mouvement réduit, les flammes restent sur leur 1re image, sans agrandissement, et
 * l'extinction passe directement à la petite fumée.
 */
export function burnFlames(
  burn: SceneBurn | null,
  now: number,
  reducedMotion: boolean,
): BurnSprite[] {
  'worklet';
  if (burn === null) return [];
  const { stacks, lit, ticked, out } = burn;
  const grown = ticked !== null && now >= ticked && now < ticked + GROW_MS;
  const sprites: BurnSprite[] = [];
  // Une flamme éteinte brûle encore jusqu'à sa fumée ; une place rallumée depuis n'en fume pas.
  const smoking = out === null ? [] : out.slots.filter((slot) => slot >= stacks);
  const waiting = out !== null && now < out.at;
  for (let slot = 0; slot < SLOTS.length; slot += 1) {
    if (slot >= stacks && !(waiting && smoking.includes(slot))) continue;
    if (
      lit !== null &&
      slot >= lit.from &&
      now < lit.at + HIT_FRAMES * HIT_FRAME_MS + (slot - lit.from) * LIGHT_STAGGER_MS
    ) {
      continue;
    }
    const step = Math.floor((now - slot * FLAME_STAGGER_MS) / FLAME_FRAME_MS);
    const looped = grown ? GROWN_FRAME : ((step % 3) + 3) % 3;
    sprites.push(at(slot, 'burn', reducedMotion ? 0 : looped));
  }
  if (out === null || now < out.at) return sprites;
  const since = now - out.at;
  const frame = reducedMotion
    ? since < OUT_REDUCED_MS
      ? OUT_FRAMES - 1
      : null
    : since < OUT_FRAMES * OUT_FRAME_MS
      ? Math.floor(since / OUT_FRAME_MS)
      : null;
  if (frame === null) return sprites;
  return [...sprites, ...smoking.map((slot) => at(slot, 'burnOut', frame))];
}

/** L'image (0, 1) de l'éclat de braise d'une prise, même à 5 charges ; `null` sans éclat. */
export function burnHitFrame(lit: SceneBurn['lit'], now: number): number | null {
  'worklet';
  if (lit === null || now < lit.at) return null;
  const frame = Math.floor((now - lit.at) / HIT_FRAME_MS);
  return frame < HIT_FRAMES ? frame : null;
}
