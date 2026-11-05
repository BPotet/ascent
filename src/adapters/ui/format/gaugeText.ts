import type { FateGaugeReading } from '../../../application/useCases/fateGauge';
import { cursedElite } from '../../../domain/ascent/cursedEnemy';
import { fatiguePercent, favorRerolls, type FateGauge } from '../../../domain/ascent/fateGauge';
import type { IconName } from '../pixelArt/sprites/icons';
import { rerollCount } from './boonText';

// Les textes de la jauge (#93, #41), d'après la maquette `docs/mockups/205-jauge-faveur/` : le
// cadran au pied de la tour et son détail. Ton sans reproche : la jauge vient toujours d'hier et ne
// vaut que pour aujourd'hui.

const GAUGE_WORDS: Readonly<Record<FateGauge, string>> = {
  2: 'Faveur pleine',
  1: 'Faveur',
  0: 'Neutre',
  [-1]: 'Malédiction',
  [-2]: 'Malédiction forte',
};

const GAUGE_VALUES: Readonly<Record<FateGauge, string>> = {
  2: '+2',
  1: '+1',
  0: '0',
  [-1]: '−1',
  [-2]: '−2',
};

const SPOKEN_VALUES: Readonly<Record<FateGauge, string>> = {
  2: 'plus 2',
  1: 'plus 1',
  0: '0',
  [-1]: 'moins 1',
  [-2]: 'moins 2',
};

/** Le mot de la jauge : « Faveur pleine », « Malédiction forte »… */
export function gaugeWord(gauge: FateGauge): string {
  return GAUGE_WORDS[gauge];
}

/** La valeur de la jauge, signée : « +2 », « 0 », « −1 ». */
export function gaugeValue(gauge: FateGauge): string {
  return GAUGE_VALUES[gauge];
}

/** Le compte d'hier : faites sur attendues. */
interface Count {
  readonly done: number;
  readonly expected: number;
}

/** « Pas encore de compte » : aucune habitude n'était attendue hier, et la lecture a réussi. */
export function isFirstUse({
  expected,
  unreadable,
}: {
  readonly expected: number;
  readonly unreadable: boolean;
}): boolean {
  return expected === 0 && !unreadable;
}

/** D'où vient la jauge : toujours d'hier, sans reproche. */
export function gaugeReason({ done, expected }: Count): string {
  return expected === 0
    ? "Pas encore de compte : aucune habitude n'était attendue hier."
    : `D'après hier : ${done} habitude${done > 1 ? 's' : ''} sur ${expected}.`;
}

/** La part d'hier, au détail : « 3 sur 4, soit 75 %. » */
export function gaugeShare({ done, expected }: Count): string {
  return `${done} sur ${expected}, soit ${Math.round((done * 100) / expected)} %.`;
}

/** La jauge de la première utilisation : elle comptera dès demain. */
export const NOT_YET_LINE = "Elle comptera dès demain, d'après tes habitudes d'aujourd'hui.";
export const NOT_YET_PILL = 'Pas encore';

/** La lecture en échec (G7) : ce n'est pas une faute du joueur. */
export const UNREADABLE_TEXT =
  "Tes habitudes n'ont pas pu être lues. La jauge reste Neutre aujourd'hui, sans effet. L'ascension se lance quand même.";

/** La phrase rassurante d'une malédiction, dans un cadre à part, jamais en rouge. */
export const GAUGE_REASSURANCE = "D'après hier, seulement aujourd'hui. L'ascension reste gagnable.";

export const SEALED_PILL = 'Scellée';
export const SEALED_LINE = "Scellée au lancement de ta première ascension d'aujourd'hui.";
export const SEALED_TITLE = "Scellée pour aujourd'hui.";
export const SEALED_TEXT =
  "Tu as lancé une ascension aujourd'hui avec cette jauge. Corriger hier ne change plus que ton expérience.";

/** Le bandeau d'une correction d'hier qui change la jauge (G11) : vert quand elle monte. */
export function gaugeChangedText(gauge: FateGauge, rose: boolean): string {
  return rose
    ? `Jauge mise à jour d'après ta correction d'hier : ${gaugeWord(gauge)}.`
    : "La jauge a changé d'après ta correction d'hier.";
}

/** La teinte d'un effet : jamais seule, toujours avec son glyphe et son texte. */
export type GaugeTone = 'gold' | 'favor' | 'curse' | 'muted';

/**
 * Un effet de la jauge : une ligne typée de la liste, avec son glyphe. #209 (ennemis maudits), #42
 * (relances) et #206 (seconde chance) y ajoutent chacune la leur.
 */
export interface GaugeEffect {
  readonly glyph: IconName;
  readonly tone: GaugeTone;
  readonly text: string;
}

/** Les relances qui restent sur celles données : « 1 relance sur 2 » (#42). */
function rerollsLeftText(gauge: FateGauge, rerolls: number): string {
  return `${rerollCount(rerolls)} sur ${favorRerolls(gauge)}`;
}

/**
 * Ce qui reste de la faveur de l'ascension en cours (#42, G9) : ses relances, grises quand elles ont
 * toutes servi. Rien sans faveur. #206 y ajoutera la seconde chance.
 */
export function ascentFavorEffects({
  gauge,
  rerolls,
}: {
  readonly gauge: FateGauge;
  readonly rerolls: number;
}): GaugeEffect[] {
  if (gauge <= 0) return [];
  return [
    {
      glyph: 'reroll',
      tone: rerolls > 0 ? 'favor' : 'muted',
      text: rerollsLeftText(gauge, rerolls),
    },
  ];
}

/**
 * Les effets de la jauge : les bénédictions de départ, puis ceux du niveau (objets plus fréquents,
 * Rares plus ou moins fréquents, fatigue, ennemis maudits). Rien à la première utilisation ; « Aucun effet
 * aujourd'hui » en lecture en échec. Jamais de coffre (épique #208). Sans `expected`, c'est la jauge
 * d'une ascension en cours, toujours comptée.
 */
export function gaugeEffects({
  gauge,
  blessings,
  expected = 1,
  unreadable = false,
}: {
  readonly gauge: FateGauge;
  readonly blessings: readonly unknown[];
  readonly expected?: number;
  readonly unreadable?: boolean;
}): GaugeEffect[] {
  if (isFirstUse({ expected, unreadable })) return [];
  const count = blessings.length;
  const effects: GaugeEffect[] = [];
  if (count > 0) {
    effects.push({
      glyph: 'bless',
      tone: 'gold',
      text: `${count} bénédiction${count > 1 ? 's' : ''} de départ`,
    });
  }
  if (gauge > 0) {
    effects.push(
      { glyph: 'loot', tone: 'favor', text: 'Objets plus fréquents' },
      { glyph: 'rare', tone: 'favor', text: 'Objets Rares plus fréquents' },
      // Les relances (#42), données au lancement.
      { glyph: 'reroll', tone: 'favor', text: rerollCount(favorRerolls(gauge)) },
    );
  } else if (gauge < 0) {
    effects.push(
      { glyph: 'fatigue', tone: 'curse', text: `Fatigue : PV max −${fatiguePercent(gauge)} %` },
      { glyph: 'rare', tone: 'curse', text: 'Objets Rares moins fréquents' },
      // Les ennemis maudits (#209) : l'Élite aussi sous la malédiction forte.
      {
        glyph: 'skull',
        tone: 'curse',
        text: cursedElite(gauge) ? 'Ennemis et Élite maudits' : '1 ennemi maudit par combat',
      },
    );
  } else {
    effects.push({
      glyph: 'dash8',
      tone: 'muted',
      text: count > 0 ? "Aucun autre effet aujourd'hui" : "Aucun effet aujourd'hui",
    });
  }
  return effects;
}

/** Les cinq niveaux de la jauge et leurs seuils, de +2 à −2. */
export const GAUGE_LEVELS: readonly { readonly gauge: FateGauge; readonly threshold: string }[] = [
  { gauge: 2, threshold: 'toutes faites' },
  { gauge: 1, threshold: '75 % ou plus' },
  { gauge: 0, threshold: '50 % ou plus, ou aucune attendue' },
  { gauge: -1, threshold: '25 % ou plus' },
  { gauge: -2, threshold: 'moins de 25 %' },
];

/** La marque du niveau du jour, au mot : « Aujourd'hui », ou « Pas encore » sans compte. */
export function levelTag(reading: Pick<FateGaugeReading, 'expected' | 'unreadable'>): string {
  return isFirstUse(reading) ? NOT_YET_PILL : "Aujourd'hui";
}
export const ASCENT_LEVEL_TAG = 'Cette ascension';

/** Les garde-fous du détail : toujours les mêmes quatre phrases. */
export const GAUGE_SAFEGUARDS: readonly { readonly glyph: IconName; readonly text: string }[] = [
  {
    glyph: 'clock',
    text: "Seul hier compte, tel qu'à la clôture. Corriger un jour plus ancien ne la change pas.",
  },
  {
    glyph: 'check8',
    text: "Elle ne vaut que pour aujourd'hui. Demain, elle repart d'aujourd'hui.",
  },
  { glyph: 'check8', text: "L'ascension se lance toujours, et reste gagnable." },
  {
    glyph: 'shard8',
    text: "Jamais d'effet sur tes Éclats, tes déblocages, leurs prix ni le camp.",
  },
];

/** Les titres des parties du détail. */
export const DETAIL_HEADINGS = {
  yesterday: "Hier, compté tel qu'à la clôture",
  levels: 'Les cinq niveaux',
  today: "Ce qu'elle change aujourd'hui",
  ascent: "Ce qu'elle change dans cette ascension",
  never: "Ce qu'elle ne touche jamais",
} as const;

export const DAY_GAUGE_TITLE = 'Jauge du jour';
export const ASCENT_GAUGE_TITLE = "Jauge de l'ascension";
export const DETAIL_LINK = 'Détail';
export const OPEN_DETAIL = 'Ouvrir le détail de la jauge.';
export const CLOSE_DETAIL = 'Fermer le détail de la jauge';
export const ASCENT_KEEPS_GAUGE = "Lancée avec cette jauge : l'ascension la garde jusqu'à sa fin.";
export const FIRST_USE_DETAIL =
  "Aucune habitude n'était attendue hier. Dès demain, la jauge comptera tes habitudes d'aujourd'hui : faites-en une, elle penchera du bon côté.";
export const FIRST_USE_EFFECTS =
  "Rien aujourd'hui. Chaque habitude faite aujourd'hui te donnera une bénédiction de départ demain.";
export const AT_CLOSING_MARK = 'attendue à la clôture';
export const GAUGE_LOADING = 'Lecture de la jauge';

/** La jauge du jour pendant une ascension : elle attend la prochaine. */
export function nextAscentLine(gauge: FateGauge): string {
  return `Jauge du jour : ${gaugeWord(gauge)}. Elle comptera pour ta prochaine ascension.`;
}

/** L'état d'une habitude d'hier au détail : « faite » ou « manquée ». */
export function habitStatus(done: boolean): string {
  return done ? 'faite' : 'manquée';
}

/** Une habitude d'hier, lue : « Courir, attendue à la clôture, manquée ». */
export function habitLabel(habit: FateGaugeReading['habits'][number]): string {
  return [
    habit.name,
    ...(habit.atClosingOnly ? [AT_CLOSING_MARK] : []),
    habitStatus(habit.done),
  ].join(', ');
}

/** Pourquoi la jauge diffère du Rappel d'hier (D4), sans reproche. */
export function closingNote(names: readonly string[]): string {
  const quoted = names.map((name) => `« ${name} »`);
  const listed =
    quoted.length > 1 ? `${quoted.slice(0, -1).join(', ')} et ${quoted.at(-1)}` : quoted.join('');
  const verb = names.length > 1 ? 'étaient encore attendues' : 'était encore attendue';
  return `Une correction d'un jour plus ancien a changé le Rappel d'hier, pas la jauge : hier est compté tel qu'à la clôture, quand ${listed} ${verb}.`;
}

/** Un effet dans une phrase : « fatigue : PV max moins 10 % ». */
function spokenEffect({ text }: GaugeEffect): string {
  return (text.charAt(0).toLowerCase() + text.slice(1)).replace('−', 'moins ');
}

/**
 * L'annonce du lecteur d'écran (jamais la couleur seule) : le mot d'abord, la valeur ensuite, puis le
 * compte d'hier et les effets ; la phrase rassurante d'une malédiction, et le scellement.
 */
export function gaugeAnnouncement(reading: FateGaugeReading): string {
  const { gauge, sealed, unreadable } = reading;
  if (isFirstUse(reading)) {
    return `${DAY_GAUGE_TITLE} : ${gaugeWord(gauge)}, pas encore de compte. ${NOT_YET_LINE}`;
  }
  return [
    `${DAY_GAUGE_TITLE} : ${gaugeWord(gauge)}, ${SPOKEN_VALUES[gauge]}.`,
    unreadable ? UNREADABLE_TEXT : gaugeReason(reading),
    `Effets : ${gaugeEffects(reading).map(spokenEffect).join(', ')}.`,
    ...(gauge < 0 ? [GAUGE_REASSURANCE] : []),
    ...(sealed ? [SEALED_LINE] : []),
  ].join(' ');
}

/**
 * L'annonce de la jauge de l'ascension en cours : son mot, sa valeur, qu'elle la garde, et les
 * relances qui restent en faveur (#42).
 */
export function ascentGaugeAnnouncement(gauge: FateGauge, rerolls: number): string {
  return [
    `${ASCENT_GAUGE_TITLE} : ${gaugeWord(gauge)}, ${SPOKEN_VALUES[gauge]}. ${ASCENT_KEEPS_GAUGE}`,
    ...(gauge > 0 ? [`Il reste ${rerollsLeftText(gauge, rerolls)}.`] : []),
  ].join(' ');
}
