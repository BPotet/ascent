import type { HeroFrame } from '../../pixelArt/sprites/battle/battleCharacters';
import type { HeroPose } from '../sceneTypes';
import { FRAME_MS } from './enemyPose';

/**
 * L'image du héros à un instant : l'image, son liseré (la lame qui brille), la part de son pas de
 * côté (esquive), de son élan vers la cible (frappe) et de sa poussée sur place (coup de bouclier),
 * de 0 à 1.
 */
export interface HeroLook {
  readonly frame: HeroFrame;
  readonly tier: 0 | 1;
  readonly dodge: number;
  readonly lunge: number;
  readonly push: number;
}

/**
 * L'image du coup de bouclier (#128, avenant à l'ADR 0010 § 7) : la pose `bash` n'est pas encore
 * validée dans l'Atelier ; on montre `parry1`, déjà validée (bouclier levé devant elle, #140). Une
 * story du chemin B remplacera cette seule constante après la validation.
 */
export const BASH_FRAME: HeroFrame = 'parry1';
/** L'avance du coup de bouclier, en dp : elle reste à sa place (aller et retour). */
export const BASH_ADVANCE_DP = 4;

// Stryker disable all: poses de la maquette (`pxHeroFrame`), mutées seulement avec `mutation:ui`.
const PARRY_MS = 250;
const HIT_MS = 300;
const DODGE_MS = 300;
const STRIKE_MS = 320;
/** Le coup de bouclier dure la riposte (`COUNTER_MS`). */
const BASH_MS = 400;
/** La lame brille à 160 ms de l'impact de la frappe en rythme. */
const GLEAM_MS = 160;
// Stryker restore all

function look(frame: HeroFrame, tier: 0 | 1 = 0, dodge = 0, lunge = 0, push = 0): HeroLook {
  'worklet';
  return { frame, tier, dodge, lunge, push };
}

/**
 * L'image du héros (`heroFrame`, `pxHeroFrame` de la maquette) pour sa pose `pose`, prise à
 * `since` : parade en deux images (250 ms), touché (300 ms), déséquilibre qui vacille, esquive
 * (300 ms, aller et retour), arme levée pour la frappe en rythme (la lame brille près de l'impact),
 * frappe vers la cible (320 ms), coup de bouclier sur place (400 ms, `BASH_FRAME` tenue). Tombé, il
 * garde `hit1` (pose de défaite, à confirmer par l'UX).
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
  if (pose === 'bash' && elapsed < BASH_MS) {
    return look(BASH_FRAME, 0, 0, 0, Math.sin((Math.PI * elapsed) / BASH_MS));
  }
  return look(Math.floor(now / 250) % 2 === 1 ? 'idle1' : 'idle0');
}
