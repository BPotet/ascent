import type { HeroFrame } from '../../pixelArt/sprites/battle/battleCharacters';
import type { HeroPose } from '../sceneTypes';
import { FRAME_MS } from './enemyPose';

/**
 * L'image du héros à un instant : l'image, son liseré (la lame qui brille), la part de son pas de
 * côté (esquive) et de son élan vers la cible (frappe), de 0 à 1.
 */
export interface HeroLook {
  readonly frame: HeroFrame;
  readonly tier: 0 | 1;
  readonly dodge: number;
  readonly lunge: number;
}

// Stryker disable all: poses de la maquette (`pxHeroFrame`), mutées seulement avec `mutation:ui`.
const PARRY_MS = 250;
const HIT_MS = 300;
const DODGE_MS = 300;
const STRIKE_MS = 320;
/** La lame brille à 160 ms de l'impact de la frappe en rythme. */
const GLEAM_MS = 160;
// Stryker restore all

function look(frame: HeroFrame, tier: 0 | 1 = 0, dodge = 0, lunge = 0): HeroLook {
  'worklet';
  return { frame, tier, dodge, lunge };
}

/**
 * L'image du héros (`heroFrame`, `pxHeroFrame` de la maquette) pour sa pose `pose`, prise à
 * `since` : parade en deux images (250 ms), touché (300 ms), déséquilibre qui vacille, esquive
 * (300 ms, aller et retour), arme levée pour la frappe en rythme (la lame brille près de l'impact),
 * frappe vers la cible (320 ms). Tombé, il garde `hit1` (pose de défaite, à confirmer par l'UX).
 */
export function heroFrame(
  pose: HeroPose,
  since: number,
  now: number,
  strikeImpactAt: number | null,
): HeroLook {
  'worklet';
  const elapsed = now - since;
  if (pose === 'fallen') return look('hit1');
  if ((pose === 'parry' || pose === 'counter') && elapsed < PARRY_MS) {
    return look(elapsed < FRAME_MS ? 'parry0' : 'parry1');
  }
  if (pose === 'hit' && elapsed < HIT_MS) return look(elapsed < FRAME_MS ? 'hit0' : 'hit1');
  if (pose === 'off') return look(Math.floor(elapsed / FRAME_MS) % 2 === 1 ? 'off1' : 'off0');
  if (pose === 'dodge' && elapsed < DODGE_MS) {
    const out = elapsed < FRAME_MS || elapsed > 3 * FRAME_MS;
    return look(out ? 'dodge0' : 'dodge1', 0, Math.sin((Math.PI * elapsed) / DODGE_MS));
  }
  if (pose === 'raise') {
    const gleam = strikeImpactAt !== null && Math.abs(now - strikeImpactAt) <= GLEAM_MS;
    return gleam ? look('raiseG', 1) : look('raise');
  }
  if (pose === 'strike' && elapsed < STRIKE_MS) {
    return look(
      elapsed < FRAME_MS ? 'atk0' : 'atk1',
      0,
      0,
      Math.sin((Math.PI * elapsed) / STRIKE_MS),
    );
  }
  return look(Math.floor(now / 250) % 2 === 1 ? 'idle1' : 'idle0');
}
