// Stryker disable all
/*
 * Recopié tel quel de l'Atelier de l'ascension (ADR 0010, avenant #227), données validées par le
 * propriétaire le 06/11/2026, relues le 06/11/2026 en lecture seule et recopiées par script, sha256
 * du JSON compact de `data`, clés triées, vérifiée avant écriture, clé `proposals[chosen]`
 * (`chosen: 0`, statut `validé`), clés `w`, `h`, `palette` et `rows` seulement ; le test
 * `chest.data.test.ts` les compare pixel pour pixel à `ART.chest.A` et `ART.chestOpen.A` de la
 * maquette validée `docs/mockups/208-coffres-cles/index.html`. Aucune fiche Codex.
 * - `CHEST_IMAGE` : `assets/chest` version 1, sha256 45a305cd5373385d286fc327769de31518233f3579e863fe48a0e64277b02f16 ;
 *   « Coffre de chêne », coffre fermé, 32 × 24.
 * - `CHEST_OPEN_IMAGE` : `assets/chestOpen` version 1, sha256 97059551fcd9ec445458273648fa2bfef4d6d427abb26df49d0a5dfb6b5d1549 ;
 *   « Coffre de chêne », coffre ouvert, 32 × 24.
 * Ne pas retoucher à la main : toute retouche passe par l'Atelier.
 */
import type { AssetImage } from '../fullAnimation';

/** Le Coffre (`Chest`, #227), fermé : chêne et ferrures, sans rouge ni losange. */
export const CHEST_IMAGE: AssetImage = {
  w: 32,
  h: 24,
  palette: [
    '#06070c',
    '#3b2a1c',
    '#6b4a2a',
    '#9a6a3a',
    '#d0a066',
    '#646b80',
    '#8c93a8',
    '#d9dce6',
    '#f2d49b',
    '#b98e5a',
    '#241b19',
    '#fff3d6',
  ],
  rows: [
    '................................',
    '................................',
    '................................',
    '......00000000000000000000......',
    '....006544444444444444446500....',
    '...03365333333333333333365330...',
    '..0333653333333333333333653330..',
    '..0222652222222222222222652220..',
    '..01116511111bbbbb911111651110..',
    '..0222652222288888922222652220..',
    '..0111651111188008911111651110..',
    '..0333653333388008933333653330..',
    '..0222652222288088922222652220..',
    '..0222682222288888922222682220..',
    '..0111651111199999911111651110..',
    '..0222652222222222222222652220..',
    '..0222652222222222222222652220..',
    '..0111651111111111111111651110..',
    '..0222682222222222222222682220..',
    '..0222652222222222222222652220..',
    '..0111651111111111111111651110..',
    '...00000000000000000000000000...',
    '....000000000000000000000000....',
    '................................',
  ],
};

/** Le Coffre (`Chest`, #227), ouvert. */
export const CHEST_OPEN_IMAGE: AssetImage = {
  w: 32,
  h: 24,
  palette: [
    '#06070c',
    '#3b2a1c',
    '#6b4a2a',
    '#9a6a3a',
    '#d0a066',
    '#646b80',
    '#8c93a8',
    '#d9dce6',
    '#f2d49b',
    '#b98e5a',
    '#241b19',
    '#fff3d6',
  ],
  rows: [
    '........0.0b0.080..0b0.0........',
    '....0000b000000b8000000b0000....',
    '...02255222222222222222255220...',
    '...01a55aaaaaaaaaaaaaaaa55a10...',
    '...01a55aaaaaaaaaaaaaaaa55a10...',
    '...01a55aaaaaaaaaaaaaaaa55a10...',
    '...01a55aaaaaaaaaaaaaaaa55a10...',
    '...01155111111111111111155110...',
    '..0222222222222222222222222220..',
    '..0aa888bbbbbbbbbbbbbbbb888aa0..',
    '..0aa8888888888888888888888aa0..',
    '..0aaaaaaaaaaaaaaaaaaaaaaaaaa0..',
    '..0222652222288008822222652220..',
    '..0222682222288008822222682220..',
    '..0111651111199999911111651110..',
    '..0222652222222222222222652220..',
    '..0222652222222222222222652220..',
    '..0111651111111111111111651110..',
    '..0222682222222222222222682220..',
    '..0222652222222222222222652220..',
    '..0111651111111111111111651110..',
    '...00000000000000000000000000...',
    '....000000000000000000000000....',
    '................................',
  ],
};
