import type { Day } from '../day/Day';
import { Week } from '../week/Week';
import type { HabitSettings, SettingsChange } from './SettingsChange';
import { DEFAULT_WEEKLY_TARGET } from './WeeklyTarget';
import { weekSettingsOf } from './WeekSettings';

/**
 * Changement d'introduction (`introductionChange`), voir `docs/glossary.md` et l'ADR 0003, §4 : les
 * réglages du changement que l'application ajoute à une habitude existante à la mise à jour qui
 * introduit l'objectif hebdomadaire, daté de `today` (R16). Il recopie la difficulté **de la semaine
 * en cours**, et non celle du dernier changement : un changement daté dans le futur (horloge fausse)
 * changerait sinon la difficulté, donc l'expérience, de la semaine en cours. Il porte l'objectif 7.
 *
 * `null` si le dernier changement **dans l'ordre de saisie** porte déjà un objectif : l'introduction
 * est faite. C'est ce qui la rend idempotente, même quand un changement saisi avant est daté plus
 * tard (recul d'horloge).
 */
export function introductionChangeOf(
  changes: readonly SettingsChange[],
  createdOn: Day,
  today: Day,
): HabitSettings | null {
  const lastEntered = changes.reduce<SettingsChange | undefined>(
    (last, change) => (last === undefined || change.sequence > last.sequence ? change : last),
    undefined,
  );
  if (lastEntered !== undefined && lastEntered.weeklyTarget !== null) {
    return null;
  }
  return {
    difficulty: weekSettingsOf(changes, Week.containing(today), createdOn).difficulty,
    weeklyTarget: DEFAULT_WEEKLY_TARGET,
  };
}

/**
 * Vrai si l'habitude existait avant la mise à jour qui introduit l'objectif hebdomadaire : au moins
 * un de ses changements n'a pas d'objectif. Sert à la Carte de nouveauté.
 */
export function predatesWeeklyTarget(changes: readonly SettingsChange[]): boolean {
  return changes.some(({ weeklyTarget }) => weeklyTarget === null);
}
