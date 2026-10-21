import type { Day } from '../day/Day';
import type { Difficulty } from './Difficulty';
import type { HabitId } from './Habit';

/**
 * Changement de réglages (`SettingsChange`), voir `docs/glossary.md` et l'ADR 0003 : un changement
 * daté des réglages d'une habitude, enregistré à sa création puis à chaque modification de ses
 * réglages. Il est daté du jour de sa saisie (`changedOn`, lu sur l'horloge) et porte **tous** les
 * réglages de l'habitude après le changement (un instantané) ; le même jour, l'ordre de saisie
 * (`sequence`, croissant) les départage. Leur historique détermine les réglages de la semaine
 * (`weekSettingsOf`) ; il est effacé avec l'habitude.
 *
 * Un réglage introduit plus tard (ex. l'objectif hebdomadaire, #24) est vide (`null`) dans les
 * changements antérieurs à son introduction : vide veut dire « ce réglage n'existait pas encore »,
 * jamais une valeur par défaut.
 */
export interface SettingsChange {
  readonly habitId: HabitId;
  readonly changedOn: Day;
  /** L'ordre de saisie, attribué au stockage : plus grand que celui de tout changement précédent. */
  readonly sequence: number;
  readonly difficulty: Difficulty;
}

/** Les réglages que porte un changement de réglages (son instantané), sans sa date ni son ordre. */
export type SettingsChangeValues = Omit<SettingsChange, 'habitId' | 'changedOn' | 'sequence'>;

/** L'ordre de l'historique : par jour, puis, le même jour, par ordre de saisie (R15). */
export function compareSettingsChanges(a: SettingsChange, b: SettingsChange): number {
  return a.changedOn.compareTo(b.changedOn) || a.sequence - b.sequence;
}
