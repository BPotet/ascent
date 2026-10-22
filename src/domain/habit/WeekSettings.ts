import type { Day } from '../day/Day';
import type { Week } from '../week/Week';
import { DEFAULT_DIFFICULTY, type Difficulty } from './Difficulty';
import { compareSettingsChanges, type SettingsChange } from './SettingsChange';

/**
 * Réglages de la semaine (`WeekSettings`), voir `docs/glossary.md` et l'ADR 0003 : les réglages d'une
 * habitude qui valent pour une semaine donnée, déduits de l'historique daté de ses changements de
 * réglages. Pour l'instant, la difficulté ; l'objectif hebdomadaire s'y ajoutera avec #24.
 */
export interface WeekSettings {
  readonly difficulty: Difficulty;
}

/**
 * Les réglages de `week` d'après `changes`, les changements de réglages d'**une** habitude, dans
 * n'importe quel ordre (R12, R15) :
 * - la difficulté est celle du dernier changement daté au plus tard du dimanche de la semaine, dans
 *   l'ordre (jour, ordre de saisie) : un changement vaut pour toute sa semaine et les suivantes ;
 * - sans changement daté au plus tard de ce dimanche (jour de création postérieur, après un recul de
 *   l'horloge), c'est le premier changement qui s'applique ;
 * - sans aucun changement, la difficulté est Moyenne (R2), comme pour une habitude créée avant la
 *   difficulté.
 *
 * Fonction pure des changements de l'habitude, de la semaine et du jour de création de l'habitude
 * (`createdOn`, un fait de l'habitude), sans « aujourd'hui » : une semaine close n'est changée ni par
 * un changement ultérieur, ni par l'horloge.
 */
export function weekSettingsOf(
  changes: readonly SettingsChange[],
  week: Week,
  createdOn: Day,
): WeekSettings {
  const history = [...changes].sort(compareSettingsChanges);
  const [first] = history;
  if (first === undefined) {
    return { difficulty: DEFAULT_DIFFICULTY };
  }
  const inForce = history.filter(({ changedOn }) => !changedOn.isAfter(week.end)).at(-1) ?? first;
  return { difficulty: inForce.difficulty };
}
