import type { CheckIn } from '../checkIn/CheckIn';
import { habitDayOf, type HabitDay } from '../checkIn/HabitDay';
import type { Day } from '../day/Day';
import type { Habit } from '../habit/Habit';

/**
 * Le genre d'un jour de la Vue Mois :
 * - `upcoming` : jour après aujourd'hui, « à venir », rien de modifiable ;
 * - `neutral` : jour neutre, sans habitude active (aujourd'hui ou jour clos) : aucune expérience,
 *   rien à corriger ;
 * - `tracked` : aujourd'hui ou jour clos avec au moins une habitude active, dont on affiche le
 *   compteur « faites / actives ».
 */
export type MonthDayKind = 'neutral' | 'upcoming' | 'tracked';

/**
 * Jour du mois (`MonthDay`), voir `docs/glossary.md` : un jour de la Vue Mois, avec l'état de
 * chaque habitude existante ce jour-là et le compteur « habitudes faites / habitudes actives » (R23).
 */
export interface MonthDay {
  readonly day: Day;
  readonly kind: MonthDayKind;
  /** Vrai si le jour est aujourd'hui, à mettre en évidence. */
  readonly isToday: boolean;
  /**
   * Les cases des habitudes actives ce jour-là (jour de création ≤ ce jour), dans l'ordre de
   * création. Elles se modifient avec `toggleCheckIn` quand elles sont `editable` (R9, R10).
   */
  readonly habits: readonly HabitDay[];
  /** Les cases des habitudes existantes créées après ce jour : « hors habitude », jamais modifiables. */
  readonly notStartedHabits: readonly HabitDay[];
  /** Le nombre d'habitudes actives « fait » ce jour-là. */
  readonly doneCount: number;
  /** Le nombre d'habitudes actives ce jour-là ; 0 pour un jour neutre. */
  readonly activeCount: number;
  /** Vrai si au moins une case du jour porte la marque « corrigé » (R13), affichée discrètement. */
  readonly corrected: boolean;
}

/**
 * Le jour `day` de la Vue Mois, à partir des habitudes existantes (ordre de création), des suivis
 * enregistrés (seuls ceux de `day` comptent) et d'aujourd'hui (R21, R23). Un jour après aujourd'hui
 * est « à venir », même sans habitude active ; sinon, un jour sans habitude active est neutre.
 */
export function monthDayOf(
  day: Day,
  habits: readonly Habit[],
  checkIns: readonly CheckIn[],
  today: Day,
): MonthDay {
  const habitDays = habits.map((habit) =>
    habitDayOf(
      habit,
      day,
      checkIns.find((each) => each.habitId === habit.id && each.day.equals(day)) ?? null,
      today,
    ),
  );
  const active = habitDays.filter(({ status }) => status !== 'notStarted');
  const kindOf = (): MonthDayKind => {
    if (day.isAfter(today)) {
      return 'upcoming';
    }
    return active.length === 0 ? 'neutral' : 'tracked';
  };
  return {
    day,
    kind: kindOf(),
    isToday: day.equals(today),
    habits: active,
    notStartedHabits: habitDays.filter(({ status }) => status === 'notStarted'),
    doneCount: active.filter(({ status }) => status === 'done').length,
    activeCount: active.length,
    corrected: active.some((habitDay) => habitDay.corrected),
  };
}
