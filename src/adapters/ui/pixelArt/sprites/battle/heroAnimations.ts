import type { HeroKind } from '../../../../../domain/battle/combatants';
import type { Point } from '../Sprite';
import { CRUSHING_BLOW_POSES } from '../atelier/data/crushingBlow';
import { SENTINEL_ANIMATION } from '../atelier/data/sentinel';
import { WANDERER_ANIMATION } from '../atelier/data/wanderer';
import type { FullAnimation } from '../atelier/fullAnimation';

/**
 * La Sentinelle et les poses de Fracas (#236), recopiées de `assets/powerCrushingBlow` sur sa case
 * et sa palette (ADR 0010, avenant #236).
 */
const SENTINEL_WITH_CRUSH: FullAnimation = {
  ...SENTINEL_ANIMATION,
  frames: { ...SENTINEL_ANIMATION.frames, ...CRUSHING_BLOW_POSES.frames },
  anchors: { ...SENTINEL_ANIMATION.anchors, ...CRUSHING_BLOW_POSES.anchors },
};

/**
 * Les héroïnes et leur animation complète validée dans l'Atelier (#140, ADR 0010 § 7) : une entrée
 * par héros, chacune de dos, sans poses rouges.
 */
export const HERO_ANIMATIONS = {
  sentinel: SENTINEL_WITH_CRUSH,
  wanderer: WANDERER_ANIMATION,
} satisfies Readonly<Record<HeroKind, FullAnimation>>;

/** La case du héros dans la scène, en pixels d'art : celle du héros d'avant #140. */
export const HERO_CELL: Point = [36, 44];

/** Un personnage du combat est-il une héroïne ? */
export function isHero(character: string): character is HeroKind {
  return Object.hasOwn(HERO_ANIMATIONS, character);
}
