/**
 * L'Équipement (`Loadout`, #159, voir `docs/glossary.md`) : ce que le joueur possède dans
 * l'ascension en cours, ses bénédictions de départ d'abord (elles viennent des habitudes d'hier),
 * puis ses bienfaits dans l'ordre où ils ont été gagnés. C'est le seul endroit qui dit ce qu'il
 * contient ; les objets équipés y entreront plus tard.
 */
import type { Ascent } from './Ascent';
import type { StartingBlessing } from './blessings';
import type { BoonKind } from './boons';
import { favorRerolls } from './fateGauge';

/** La faveur de l'ascension (#42) : sa jauge, et ses relances qui restent sur celles données. */
export interface LoadoutFavor {
  readonly gauge: 1 | 2;
  readonly rerollsLeft: number;
  readonly rerollsGranted: number;
}

export interface Loadout {
  readonly blessings: readonly StartingBlessing[];
  readonly boons: readonly BoonKind[];
  /** Seulement pour une ascension lancée en faveur (#42). */
  readonly favor?: LoadoutFavor;
}

/** L'Équipement de l'ascension, sans copie ni tri. */
export function loadoutOf(ascent: Ascent): Loadout {
  const { gauge } = ascent;
  return {
    blessings: ascent.blessings,
    boons: ascent.hero.boons,
    ...(gauge > 0 && {
      favor: {
        gauge: gauge as LoadoutFavor['gauge'],
        rerollsLeft: ascent.rerolls,
        rerollsGranted: favorRerolls(gauge),
      },
    }),
  };
}

/** Le nombre de bénédictions de départ et de bienfaits de l'Équipement. */
export function loadoutSize(loadout: Loadout): number {
  return loadout.blessings.length + loadout.boons.length;
}
