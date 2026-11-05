// Stryker disable all
/*
 * Recopié tel quel de l'Atelier de l'ascension, document version 1 du 30/10/2026, par script
 * (ADR 0010) : `assets/bulwarkShield`, nom de code `bulwarkShield`, les deux propositions
 * validées : `proposals[0]` « entier » et `proposals[1]` « fendu ».
 * Ne pas retoucher à la main : toute retouche passe par l'Atelier.
 */
import type { AssetImage } from '../fullAnimation';

/** L'écu du Rempart (`BulwarkShield`), entier (`whole`) et fendu (`cracked`), 12 × 15. */
export const BULWARK_SHIELD = {
  whole: {
    w: 12,
    h: 15,
    palette: ['#06070c', '#d9dce6', '#8c93a8', '#b4b9c8', '#646b80', '#fff3d6'],
    rows: [
      '000000000000',
      '055111111110',
      '051111233320',
      '011111233320',
      '011111233320',
      '011111233320',
      '011111233320',
      '011111233320',
      '.0111123320.',
      '..01112320..',
      '..01112320..',
      '...011220...',
      '....0120....',
      '.....00.....',
      '............',
    ],
  },
  cracked: {
    w: 12,
    h: 15,
    palette: ['#06070c', '#d9dce6', '#8c93a8', '#b4b9c8', '#646b80', '#fff3d6'],
    rows: [
      '0000000.....',
      '055111000000',
      '051110.03330',
      '011110022220',
      '011111022220',
      '011111202220',
      '011111200220',
      '0111110.0220',
      '.01111002220',
      '..0110.0220.',
      '..01100220..',
      '...0110220..',
      '....01000...',
      '.....000....',
      '............',
    ],
  },
} satisfies Readonly<Record<'whole' | 'cracked', AssetImage>>;
