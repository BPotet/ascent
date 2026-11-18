import type { EnemyKind } from '../../../../domain/battle/combatants';
import { PORTRAITS } from './atelier/data/portraits';
import type { AssetImage } from './atelier/fullAnimation';
import { battleImage } from './battle/battleCharacters';

/**
 * La silhouette du carnet (`silhouette-<kind>`, #282, maquette 278 « Rencontré ») : le portrait
 * d'un ennemi rencontré dans le Bestiaire, et son image de combat sur sa page cachée (#283), dont chaque pixel opaque prend l'encre de la maquette, et son bord une
 * teinte plus claire, pour que la forme se lise. Deux teintes de la palette d'art, les plus
 * proches de la maquette (`#232945`, `#46527F`). Ne pas confondre avec la Silhouette provisoire.
 */
const INK = '#252B48';
const EDGE = '#47527A';

/** La silhouette de `image` : même taille, mêmes pixels opaques, l'encre et son bord. */
export function silhouetteOf(image: AssetImage): AssetImage {
  const opaque = (x: number, y: number) => {
    const pixel = image.rows[y]?.charAt(x) ?? '';
    return pixel !== '' && pixel !== '.';
  };
  const rows = image.rows.map((row, y) =>
    [...row]
      .map((pixel, x) => {
        if (pixel === '.') return '.';
        const edge = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dy]) => !opaque(x + dx!, y + dy!));
        return edge ? '1' : '0';
      })
      .join(''),
  );
  return { w: image.w, h: image.h, palette: [INK, EDGE], rows };
}

const cache = new Map<EnemyKind, AssetImage | null>();

/** La silhouette du carnet de l'ennemi `kind`, tirée de son portrait ; `null` sans portrait. */
export function bestiarySilhouette(kind: EnemyKind): AssetImage | null {
  if (!cache.has(kind)) {
    const portrait = PORTRAITS[kind];
    cache.set(kind, portrait === null ? null : silhouetteOf(portrait));
  }
  return cache.get(kind)!;
}

const battleCache = new Map<EnemyKind, AssetImage>();

/**
 * La silhouette du carnet de l'image de combat de `kind` (#283, D8) : celle de la page cachée, de la
 * pose de phase 1 pour un boss, quelle que soit la phase où il a été vu.
 */
export function battleSilhouette(kind: EnemyKind): AssetImage {
  if (!battleCache.has(kind)) battleCache.set(kind, silhouetteOf(battleImage(kind)));
  return battleCache.get(kind)!;
}
