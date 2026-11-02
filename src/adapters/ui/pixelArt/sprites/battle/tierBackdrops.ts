import type { Tier } from '../../../../../domain/ascent/tiers';
import type { AssetImage } from '../atelier/fullAnimation';
import { assetSprite } from '../atelier/fullAnimation';
import { BACKDROP_TIER_1 } from '../atelier/data/backdropTier1';
import { BACKDROP_TIER_2 } from '../atelier/data/backdropTier2';
import { BACKDROP_TIER_3 } from '../atelier/data/backdropTier3';
import { toPixelImage, type PixelImage } from '../Sprite';

/**
 * Le registre des fonds de palier (`TIER_BACKDROPS`, #176) : le fond de chaque palier, recopié de
 * l'Atelier (ADR 0010). Un palier sans fond ne compile pas.
 */
export const TIER_BACKDROPS = {
  1: BACKDROP_TIER_1,
  2: BACKDROP_TIER_2,
  3: BACKDROP_TIER_3,
} as const satisfies Record<Tier, AssetImage>;

/**
 * L'image du fond du palier `tier`, opaque partout, par la conversion des assets : une teinte absente
 * de la palette d'art est une erreur.
 */
export function backdropImage(tier: Tier): PixelImage {
  return toPixelImage(assetSprite(TIER_BACKDROPS[tier]));
}
