import type { HeroKind } from '../../../../../domain/battle/combatants';
import type { Point } from '../Sprite';
import { SENTINEL_ANIMATION } from '../atelier/data/sentinel';
import { WANDERER_ANIMATION } from '../atelier/data/wanderer';
import type { FullAnimation } from '../atelier/fullAnimation';

/**
 * Les héroïnes et leur animation complète validée dans l'Atelier (#140, ADR 0010 § 7) : une entrée
 * par héros, chacune de dos, sans poses rouges.
 */
export const HERO_ANIMATIONS = {
  sentinel: SENTINEL_ANIMATION,
  wanderer: WANDERER_ANIMATION,
} satisfies Readonly<Record<HeroKind, FullAnimation>>;

/** La case du héros dans la scène, en pixels d'art : celle du héros d'avant #140. */
export const HERO_CELL: Point = [36, 44];

/** Un personnage du combat est-il une héroïne ? */
export function isHero(character: string): character is HeroKind {
  return Object.hasOwn(HERO_ANIMATIONS, character);
}
