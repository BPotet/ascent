import type { TrackRow } from '../state/trackTransition';

/**
 * L'ombre d'une case de la Frise d'action : l'opacité de son voile d'encre (1 − luminosité, jamais
 * une opacité de la case : ADR 0010, avenant #155) et la saturation de son portrait (1 : intacte).
 */
export interface TrackShade {
  readonly veil: number;
  readonly saturation: number;
}

const FULL: TrackShade = { veil: 0, saturation: 1 };
/**
 * L'aperçu de la phase du héros : luminosité 62 % et saturation 70 % (maquette v2 de #174,
 * `.fp.next{filter:brightness(.62) saturate(.7)}`).
 */
const HERO_PREVIEW: TrackShade = { veil: 0.38, saturation: 0.7 };
/** Phase ennemie (#188, maquette v2 de #174, `.frise.dimf`) : la manche, sauf celui qui agit. */
const ENEMY_ROUND: TrackShade = { veil: 0.55, saturation: 0.6 };
/** Phase ennemie : l'aperçu de la manche suivante. */
const ENEMY_PREVIEW: TrackShade = { veil: 0.68, saturation: 0.5 };

/**
 * L'ombre d'une case de la rangée `row` (#188) : celui qui agit (`acting`, dans la manche en cours)
 * reste en pleine lumière ; en phase ennemie (`enemyPhase`), tout le reste pâlit.
 */
export function trackShade(row: TrackRow, acting: boolean, enemyPhase: boolean): TrackShade {
  if (row === 'next') return enemyPhase ? ENEMY_PREVIEW : HERO_PREVIEW;
  return acting || !enemyPhase ? FULL : ENEMY_ROUND;
}
