// Stryker disable all
/*
 * Recopié tel quel de l'Atelier de l'ascension (ADR 0010, avenant #226), données validées par le
 * propriétaire le 06/11/2026, relues le 06/11/2026 en lecture seule et recopiées par script, sha256
 * du JSON compact de `data`, clés triées, vérifiée avant écriture, clé `proposals[chosen]`
 * (statut `validé`), clés `w`, `h`, `palette` et `rows` seulement ; le test
 * `sealedChest.data.test.ts` les compare pixel pour pixel à la maquette validée
 * `docs/mockups/208-coffres-cles/index.html`.
 * - `KEY_IMAGE` : `assets/key` version 1, sha256 bafbb06879b322a3378440abfa4438001a0b08e5c3d0561fc1aa07f368c6449d ;
 *   « Clé d'or » (`chosen: 0`), la clé, 16 × 16 (`ART.key.A`).
 * Ne pas retoucher à la main : toute retouche passe par l'Atelier.
 */
import type { AssetImage } from '../fullAnimation';

/** La clé (`Key`, #226) : en-tête, coffre scellé, Réserves et entrée dans la tour. */
export const KEY_IMAGE: AssetImage = {
  w: 16,
  h: 16,
  palette: ['#06070c', '#fff3d6', '#f2d49b', '#b98e5a'],
  rows: [
    '................',
    '...000..........',
    '..02220.........',
    '.0211020........',
    '.0210.020.......',
    '.020..020.......',
    '.02200320.......',
    '..02222230......',
    '...00000230.....',
    '........0230....',
    '.........0230...',
    '..........0230..',
    '.........020230.',
    '........02300230',
    '.........000200.',
    '..........020...',
  ],
};
