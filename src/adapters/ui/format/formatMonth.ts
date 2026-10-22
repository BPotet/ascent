import type { Month } from '../../../domain/month/Month';
import type { MonthDay } from '../../../domain/month/MonthDay';
import { capitalize, formatDayAndMonth, MONTH_NAMES } from './formatDay';
import { doneOutOfExpected, GOALS_REACHED } from './formatExpected';

/** Ce qu'il faut savoir du mois affiché pour le nommer. */
interface ShownMonth {
  /** Vrai si c'est le mois en cours. */
  readonly isCurrentMonth: boolean;
  /** Vrai si le mois d'avant est consultable ; sinon, c'est le début de l'historique. */
  readonly canGoPrevious: boolean;
}

/** Le titre d'un mois dans la Vue Mois : « Octobre 2026 ». */
export function monthTitle(month: Month): string {
  return `${capitalize(MONTH_NAMES[month.month - 1] ?? '')} ${month.year}`;
}

/**
 * Le repère sous le titre (maquette, E6) : « Ce mois-ci » pour le mois en cours, « Début de
 * l'historique » pour le premier mois consultable, rien entre les deux.
 */
export function monthSubtitle({ isCurrentMonth, canGoPrevious }: ShownMonth): string {
  if (isCurrentMonth) {
    return 'Ce mois-ci';
  }
  return canGoPrevious ? '' : 'Début de l’historique';
}

/** Le mois pour le lecteur d'écran : « Octobre 2026, ce mois-ci ». */
export function monthLabel(month: Month, shown: ShownMonth): string {
  const subtitle = monthSubtitle(shown);
  return subtitle === '' ? monthTitle(month) : `${monthTitle(month)}, ${subtitle.toLowerCase()}`;
}

const GOALS_REACHED_SAID = GOALS_REACHED.toLowerCase();

/**
 * Un jour de la Vue Mois pour le lecteur d'écran (maquette, « Lecteur d'écran ») : « mardi
 * 13 octobre, 3 habitudes faites sur 4 attendues », « samedi 24 octobre, objectifs de la semaine
 * atteints, aucune habitude attendue », « dimanche 20 septembre, aucune habitude active », « jeudi
 * 15 octobre, à venir ». Aujourd'hui et la marque « corrigé » sont dits aussi.
 */
export function monthDayLabel({
  day,
  kind,
  isToday,
  corrected,
  doneCount,
  expectedCount,
}: Pick<
  MonthDay,
  'day' | 'kind' | 'isToday' | 'corrected' | 'doneCount' | 'expectedCount'
>): string {
  const parts = [formatDayAndMonth(day)];
  if (isToday) {
    parts.push('aujourd’hui');
  }
  switch (kind) {
    case 'upcoming':
      parts.push('à venir');
      break;
    case 'neutral':
      parts.push('aucune habitude active');
      break;
    case 'tracked':
      parts.push(
        expectedCount === 0
          ? `${GOALS_REACHED_SAID}, aucune habitude attendue`
          : doneOutOfExpected(doneCount, expectedCount),
      );
      break;
  }
  if (corrected) {
    parts.push('corrigé');
  }
  return parts.join(', ');
}

/**
 * La ligne sous le titre du détail du jour (maquette, E6) : « Aujourd'hui · 1/2 faites » ou
 * « Jour clos · tu peux corriger un oubli · 2/2 faites », sur les habitudes attendues (#25) ; sans
 * habitude attendue, « … · objectifs de la semaine atteints ».
 */
export function dayDetailSummary({
  isToday,
  doneCount,
  expectedCount,
}: Pick<MonthDay, 'isToday' | 'doneCount' | 'expectedCount'>): string {
  const when = isToday ? 'Aujourd’hui' : 'Jour clos · tu peux corriger un oubli';
  const count = expectedCount === 0 ? GOALS_REACHED_SAID : `${doneCount}/${expectedCount} faites`;
  return `${when} · ${count}`;
}

/** Les habitudes créées après le jour ouvert : « « Lire » : créée plus tard, hors habitude ce jour-là. » */
export function notStartedHint(names: readonly string[]): string {
  const created = names.length > 1 ? 'créées' : 'créée';
  return `${names.map((name) => `« ${name} »`).join(', ')} : ${created} plus tard, hors habitude ce jour-là.`;
}
