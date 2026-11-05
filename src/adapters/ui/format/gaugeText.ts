import { fatiguePercent, type FateGauge } from '../../../domain/ascent/fateGauge';

// Les textes de la jauge (#41, maquette `docs/mockups/205-jauge-faveur/`), venus de `ascentText.ts`.

const GAUGE_WORDS: Readonly<Record<FateGauge, string>> = {
  2: 'Faveur pleine',
  1: 'Faveur',
  0: 'Neutre',
  [-1]: 'Malédiction',
  [-2]: 'Malédiction forte',
};

export function gaugeWord(gauge: FateGauge): string {
  return GAUGE_WORDS[gauge];
}

/** D'où vient la jauge : toujours d'hier, sans reproche. */
export function gaugeReason({
  done,
  expected,
}: {
  readonly done: number;
  readonly expected: number;
}) {
  return expected === 0
    ? "Aucune habitude hier : pas d'effet aujourd'hui."
    : `D'après hier : ${done} habitudes sur ${expected}.`;
}

/** Les effets de la jauge : bénédictions, objets plus fréquents ou fatigue. */
export function gaugeEffects({
  gauge,
  blessings,
}: {
  readonly gauge: FateGauge;
  readonly blessings: readonly unknown[];
}): string[] {
  const count = blessings.length;
  return [
    ...(count > 0 ? [`${count} bénédiction${count > 1 ? 's' : ''} de départ`] : []),
    ...(gauge > 0 ? ['Objets plus fréquents'] : []),
    ...(gauge < 0
      ? [
          `Fatigue : PV max −${fatiguePercent(gauge)} %`,
          "D'après hier, seulement aujourd'hui. L'ascension reste gagnable.",
        ]
      : []),
  ];
}
