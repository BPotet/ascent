// Stryker disable all
/*
 * Recopié tel quel de l'Atelier de l'ascension, export du 29/10/2026, par script (ADR 0010) :
 * `nouvelleArmure`, nom de code `blackKnightArmor`, clé `proposals[chosen]` (`chosen` = 2).
 * Ne pas retoucher à la main : toute retouche passe par l'Atelier.
 */
import type { AssetImage } from '../fullAnimation';

export const BLACK_KNIGHT_ARMOR_IMAGE = {
  w: 24,
  h: 24,
  palette: [
    '#06070c',
    '#fff3d6',
    '#d9dce6',
    '#8c93a8',
    '#3e4870',
    '#2a3150',
    '#f2d49b',
    '#b98e5a',
    '#5b4636',
    '#b32e3c',
    '#8a1e2a',
    '#4a3660',
    '#949b7e',
    '#c9c2b0',
    '#6b5a7a',
  ],
  rows: [
    '........................',
    '....000....000..........',
    '...055400.04320.........',
    '..05555470743020........',
    '.0555555464333030.......',
    '0a5555555443333030......',
    '0a77555554433330770.....',
    '0a9a55ebbbe3330290......',
    '0aaa5555b433303390......',
    '0aaa0555b433033290......',
    '0aa00555b43303330a0.....',
    '0aa005555430c0300000.0..',
    '0a0.08888870cc0054320d0.',
    '0a0.055545440c755432210.',
    'aa0.05554540755554432270',
    'a0..05554540555544332230',
    'a0...0554540500000000030',
    '0.....000000555544433230',
    '...........0555404303320',
    '............05554443330.',
    '.............055443330..',
    '..............0000000...',
    '........................',
    '........................',
  ],
} satisfies AssetImage;
