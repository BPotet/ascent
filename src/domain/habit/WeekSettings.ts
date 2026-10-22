import type { Day } from '../day/Day';
import type { Week } from '../week/Week';
import { DEFAULT_DIFFICULTY, type Difficulty } from './Difficulty';
import { compareSettingsChanges, type SettingsChange } from './SettingsChange';
import type { WeeklyTarget } from './WeeklyTarget';

/**
 * Réglages de la semaine (`WeekSettings`), voir `docs/glossary.md` et l'ADR 0003 : les réglages d'une
 * habitude qui valent pour une semaine donnée, déduits de l'historique daté de ses changements de
 * réglages : la difficulté, l'objectif hebdomadaire et l'objectif de la semaine.
 */
export interface WeekSettings {
  readonly difficulty: Difficulty;
  /**
   * L'objectif hebdomadaire en vigueur pour la semaine (R13, R15, R16), ou `null` : la semaine n'a
   * pas d'objectif (semaine close avant la mise à jour, R17).
   */
  readonly weeklyTarget: WeeklyTarget | null;
  /**
   * Objectif de la semaine (`weekTarget`) : l'objectif hebdomadaire, réduit en semaine de création au
   * nombre de jours actifs de la semaine (R6) ; `null` sans objectif hebdomadaire, ou pour une
   * semaine sans aucun jour actif.
   */
  readonly weekTarget: number | null;
}

type TargetChange = SettingsChange & { readonly weeklyTarget: WeeklyTarget };

const DAYS_IN_WEEK = 7;

/**
 * La difficulté de `week` (R12, R15) : celle du dernier changement daté au plus tard du dimanche de
 * la semaine, dans l'ordre (jour, ordre de saisie) ; sans changement daté au plus tard de ce dimanche
 * (après un recul de l'horloge), celle du premier changement ; sans aucun changement, Moyenne (R2).
 */
function difficultyOf(history: readonly SettingsChange[], week: Week): Difficulty {
  const [first] = history;
  if (first === undefined) {
    return DEFAULT_DIFFICULTY;
  }
  const inForce = history.filter(({ changedOn }) => !changedOn.isAfter(week.end)).at(-1) ?? first;
  return inForce.difficulty;
}

/**
 * L'objectif hebdomadaire de `week` (ADR 0003, §4), d'après `history` triée par jour puis par ordre
 * de saisie :
 * 1. celui du dernier changement **qui porte un objectif** daté avant le lundi de la semaine : un
 *    changement fait pendant la semaine attend le lundi suivant (R13), le dernier l'emporte (R15) ;
 * 2. sinon, si le premier changement qui porte un objectif est daté dans la semaine, il s'applique
 *    dès sa propre semaine :
 *    - (a) daté du jour de création, c'est l'objectif du dernier changement de ce jour qui en porte
 *      un, dans l'ordre de saisie (exception du jour de création, R13), y compris pour une habitude
 *      créée le jour même de la mise à jour ;
 *    - (b) sinon, c'est le changement d'introduction d'une habitude créée avant la mise à jour : son
 *      objectif seul (7, R16). Le jour de la mise à jour ne devient pas un jour de création ;
 * 3. sinon, `null` : la semaine n'a pas d'objectif (R17).
 */
function weeklyTargetOf(
  history: readonly SettingsChange[],
  week: Week,
  createdOn: Day,
): WeeklyTarget | null {
  const withTarget = history.filter(
    (change): change is TargetChange => change.weeklyTarget !== null,
  );
  const previous = withTarget.filter(({ changedOn }) => changedOn.isBefore(week.start)).at(-1);
  if (previous !== undefined) {
    return previous.weeklyTarget;
  }
  const [first] = withTarget;
  if (first === undefined || !week.contains(first.changedOn)) {
    return null;
  }
  if (!first.changedOn.equals(createdOn)) {
    return first.weeklyTarget;
  }
  return withTarget.reduce(
    (target, { changedOn, weeklyTarget }) => (changedOn.equals(createdOn) ? weeklyTarget : target),
    first.weeklyTarget,
  );
}

/** Le nombre de jours de `week` à partir du jour de création : 7, moins en semaine de création. */
function activeDaysOf(week: Week, createdOn: Day): number {
  if (createdOn.isAfter(week.end)) {
    return 0;
  }
  if (createdOn.isBefore(week.start)) {
    return DAYS_IN_WEEK;
  }
  return DAYS_IN_WEEK + 1 - createdOn.dayOfWeek;
}

/**
 * L'objectif de la semaine (R6) : `weeklyTarget`, réduit au nombre de jours de `week` à partir du jour
 * de création ; `null` sans objectif hebdomadaire ou sans aucun jour actif dans la semaine (après un
 * recul de l'horloge).
 */
function weekTargetOf(
  weeklyTarget: WeeklyTarget | null,
  week: Week,
  createdOn: Day,
): number | null {
  const activeDays = activeDaysOf(week, createdOn);
  if (weeklyTarget === null || activeDays === 0) {
    return null;
  }
  return Math.min(weeklyTarget, activeDays);
}

/**
 * Les réglages de `week` d'après `changes`, les changements de réglages d'**une** habitude, dans
 * n'importe quel ordre, et `createdOn`, son jour de création (R6, R12, R13, R15, R16, R17) : voir
 * `difficultyOf`, `weeklyTargetOf` et `weekTargetOf`.
 *
 * Le jour de création est un paramètre, pas le premier changement : un recul d'horloge peut dater un
 * changement avant la création. Fonction pure des changements de l'habitude, de la semaine et du jour
 * de création, sans « aujourd'hui » : une semaine close n'est changée ni par un changement ultérieur,
 * ni par l'horloge.
 */
export function weekSettingsOf(
  changes: readonly SettingsChange[],
  week: Week,
  createdOn: Day,
): WeekSettings {
  const history = [...changes].sort(compareSettingsChanges);
  const weeklyTarget = weeklyTargetOf(history, week, createdOn);
  return {
    difficulty: difficultyOf(history, week),
    weeklyTarget,
    weekTarget: weekTargetOf(weeklyTarget, week, createdOn),
  };
}

/**
 * Vrai si un changement d'objectif hebdomadaire enregistré `today` s'applique à la semaine en cours :
 * seulement le jour de création de l'habitude (exception de R13), quel que soit ce jour, celui de la
 * mise à jour compris. Sinon, il s'applique à partir du lundi suivant. C'est ce qui décide du message
 * de « Modifier l'habitude » (« Nouvel objectif à partir de lundi prochain »).
 */
export function weeklyTargetChangeAppliesThisWeek(createdOn: Day, today: Day): boolean {
  return today.equals(createdOn);
}
