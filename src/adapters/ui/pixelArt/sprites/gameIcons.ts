import type { BlessingFamily } from '../../../../domain/ascent/blessings';
import type { BoonKind } from '../../../../domain/ascent/boons';
import type { ArtScale } from '../artPixel';
import { BLESSING_ICONS } from './atelier/data/blessingIcons';
import { BOON_ICONS } from './atelier/data/boonIcons';
import type { AssetImage } from './atelier/fullAnimation';

/**
 * Une icône de bienfait (`BoonIcon`) ou de bénédiction (`BlessingIcon`) : le nom de son sprite et
 * son image validée dans l'Atelier.
 */
export interface GameIcon {
  readonly sprite: string;
  readonly image: AssetImage;
}

/** L'icône du bienfait `kind`. */
export function boonIcon(kind: BoonKind): GameIcon {
  return { sprite: `boon-icon:${kind}`, image: BOON_ICONS[kind] };
}

/** L'icône de la famille de bénédiction `family`, la même pour ses trois raretés. */
export function blessingIcon(family: BlessingFamily): GameIcon {
  return { sprite: `blessing-icon:${family}`, image: BLESSING_ICONS[family] };
}

/** Les échelles d'une icône : 48 dp (24 × 24 à ×2, 16 × 16 à ×3) ou 96 dp (×4, ×6). */
export type IconScale = Extract<ArtScale, 2 | 3 | 4 | 6>;
const ICON_SCALES: readonly number[] = [2, 3, 4, 6] satisfies readonly IconScale[];

function isIconScale(scale: number): scale is IconScale {
  return ICON_SCALES.includes(scale);
}

/**
 * L'échelle d'une icône affichée sur `dp` dp : un pixel d'art entier, jamais rogné ni étiré. Une
 * icône qui n'est pas carrée, ou une taille qui ne donne pas une échelle d'icône, est refusée.
 */
export function iconScale(image: AssetImage, dp: number): IconScale {
  if (image.w !== image.h) {
    throw new Error(`The icon (${image.w} × ${image.h}) is not square`);
  }
  const scale = dp / image.w;
  if (!isIconScale(scale)) {
    throw new Error(`${dp} dp is not an icon scale for a ${image.w} × ${image.h} icon`);
  }
  return scale;
}
