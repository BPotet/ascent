/**
 * L'Équipement (`Loadout`, #159, voir `docs/glossary.md`) : ce que le joueur possède dans
 * l'ascension en cours, ses bénédictions de départ d'abord (elles viennent des habitudes d'hier),
 * puis ses bienfaits dans l'ordre où ils ont été gagnés. C'est le seul endroit qui dit ce qu'il
 * contient ; les objets équipés y entreront plus tard.
 */
import type { PowerKind } from '../battle/powers';
import type { Ascent } from './Ascent';
import type { StartingBlessing } from './blessings';
import type { BoonKind } from './boons';
import { favorRerolls, favorSecondChance } from './fateGauge';
import type { KindledPower } from './kindled';

/** Les Réserves de l'ascension (#226) : l'Or et les clés qui restent. */
export interface LoadoutReserves {
  readonly gold: number;
  readonly keys: number;
}

/**
 * La faveur de l'ascension (#42) : sa jauge, ses relances qui restent sur celles données, et sa
 * seconde chance à +2 (#206).
 */
export interface LoadoutFavor {
  readonly gauge: 1 | 2;
  readonly rerollsLeft: number;
  readonly rerollsGranted: number;
  /** Seulement à +2 (#206) : prête, ou utilisée. */
  readonly secondChance?: 'ready' | 'used';
}

export interface Loadout {
  readonly blessings: readonly StartingBlessing[];
  readonly boons: readonly BoonKind[];
  /** Seulement pour une ascension lancée en faveur (#42). */
  readonly favor?: LoadoutFavor;
  /** Les Réserves (#226), toujours remplies par `loadoutOf`. */
  readonly reserves?: LoadoutReserves;
  /** Les pouvoirs équipés (#235), dans l'ordre des touches, toujours remplis par `loadoutOf`. */
  readonly powers?: readonly PowerKind[];
  /** Les pouvoirs attisés (#237), avec l'habitude de leur Serment, toujours remplis par `loadoutOf`. */
  readonly kindled?: readonly KindledPower[];
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
        ...(favorSecondChance(gauge) && {
          secondChance: ascent.secondChance ? ('ready' as const) : ('used' as const),
        }),
      },
    }),
    reserves: { gold: ascent.gold, keys: ascent.keys },
    powers: ascent.powers,
    kindled: ascent.kindled,
  };
}

/** Le nombre de bénédictions de départ et de bienfaits de l'Équipement. */
export function loadoutSize(loadout: Loadout): number {
  return loadout.blessings.length + loadout.boons.length;
}
