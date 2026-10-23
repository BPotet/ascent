import {
  targetBonusShareOf,
  type TargetReachedChange,
  weekXpChangeOf,
  type WeekXpChange,
} from '../../domain/character/HabitXp';
import {
  type CheckIn,
  NotStartedDayError,
  toggleCheckIn as toggle,
  UpcomingDayError,
} from '../../domain/checkIn/CheckIn';
import { habitDayOf, type HabitDay } from '../../domain/checkIn/HabitDay';
import type { Day } from '../../domain/day/Day';
import type { Habit, HabitId } from '../../domain/habit/Habit';
import { isTargetReached, weeklyProgressOf } from '../../domain/habit/WeeklyProgress';
import { weekSettingsOf } from '../../domain/habit/WeekSettings';
import { Week } from '../../domain/week/Week';
import type { Repositories } from '../ports/UnitOfWork';
import type { UseCaseDependencies } from './UseCaseDependencies';

/**
 * Motif du refus d'un tap, sans rien écrire :
 * - `notStarted` : jour avant le jour de création, « hors habitude » (R12) ;
 * - `upcoming` : jour après aujourd'hui, « à venir », même s'il porte un « fait » (R7) ;
 * - `unknownHabit` : l'habitude n'existe plus.
 */
export type ToggleCheckInRefusal = 'notStarted' | 'upcoming' | 'unknownHabit';

export type ToggleCheckInResult =
  | {
      readonly ok: true;
      /** La case après le tap, telle qu'elle est enregistrée. */
      readonly habitDay: HabitDay;
      /** Vrai si le jour était clos : c'est une correction (R10). */
      readonly isCorrection: boolean;
      /**
       * La variation de l'expérience du personnage, au barème de la difficulté de la semaine du jour
       * touché (R1, R14) : positive si la case est passée à « fait » (ex. +20 en Difficile),
       * négative si elle est revenue en arrière, 0 quand le plancher de 0 Xp l'en empêche. Pas de
       * feedback d'expérience à afficher quand elle vaut 0.
       */
      readonly xpChange: number;
      /** L'expérience totale du personnage après le tap, telle qu'elle est enregistrée. */
      readonly xp: number;
      /**
       * La part de `xpChange` qui vient de la prime d'objectif (#26) : +15 quand le tap atteint
       * l'objectif de la semaine, −15 quand il le fait perdre, 0 sinon. `xpChange −
       * targetBonusChange` est la part du suivi ; quand le plancher de 0 Xp joue, la part de la
       * prime est réduite d'abord.
       */
      readonly targetBonusChange: number;
      /**
       * Le franchissement du seuil de l'objectif de la semaine du jour touché : `reached` (F1),
       * `lost` (retour sous l'objectif), `null` sinon.
       */
      readonly targetReachedChange: TargetReachedChange;
      /**
       * La progression de la semaine du jour touché après le tap, jusqu'à aujourd'hui (« Courir
       * 5 km 3/3 »).
       */
      readonly weeklyProgress: number;
      /** L'objectif de la semaine du jour touché ; `null` sans objectif (avant la mise à jour). */
      readonly weekTarget: number | null;
      /** Objectif atteint pour la semaine du jour touché, après le tap. */
      readonly targetReached: boolean;
      /** La semaine du jour touché (« semaine du 5 octobre »). */
      readonly week: Week;
      /** Vrai si la semaine du jour touché est avant la semaine en cours : une semaine close. */
      readonly closedWeek: boolean;
    }
  | { readonly ok: false; readonly reason: ToggleCheckInRefusal };

/** Ce qu'un tap change à la semaine du jour touché : l'expérience et la progression. */
interface WeekToggle {
  readonly change: WeekXpChange;
  readonly weeklyProgress: number;
  readonly weekTarget: number | null;
}

/**
 * L'effet d'un tap sur une case de `habit` qui remplace `current` par `next`, sur la semaine du jour
 * touché, avec les réglages de **cette** semaine (R1, R14 ; R8 à R11 de #26) : la variation de
 * `weekXpOf`, décomposée en part du suivi et part de la prime (`weekXpChangeOf`), et la progression
 * de la semaine après le tap, jusqu'à `today`. Les suivis de la semaine sont lus une seule fois.
 * `habit` est celle que le cas d'usage a déjà lue : son jour de création sert aux réglages de la
 * semaine, sans lecture de plus.
 */
async function weekToggleOf(
  { checkIns, settingsChanges }: Repositories,
  habit: Habit,
  current: CheckIn | null,
  next: CheckIn,
  today: Day,
): Promise<WeekToggle> {
  const week = Week.containing(next.day);
  const settings = weekSettingsOf(
    await settingsChanges.listByHabit(habit.id),
    week,
    habit.createdOn,
  );
  const others = (await checkIns.listBetween(week.start, week.end)).filter(
    ({ habitId, day }) => habitId === habit.id && !day.equals(next.day),
  );
  const before = others.filter(({ done }) => done).length + Number(current?.done ?? false);
  const after = before - Number(current?.done ?? false) + Number(next.done);
  return {
    change: weekXpChangeOf(before, after, settings, settings),
    weeklyProgress: weeklyProgressOf([...others, next], week, today),
    weekTarget: settings.weekTarget,
  };
}

/**
 * Cas d'usage : un tap sur la case de l'habitude `habitId` le jour `day`, le jour **de la case
 * affichée** (pas forcément aujourd'hui). Aujourd'hui : « fait » ↔ « à faire » (R9). Jour clos,
 * y compris juste après minuit : correction, avec la marque « corrigé » (R10, R13).
 *
 * Aujourd'hui est lu, et le suivi enregistré relu, dans l'unité de travail : les taps sont
 * sérialisés et chacun inverse l'état enregistré, pas l'état affiché (trois taps donnent « fait »).
 * L'expérience du personnage change dans la même unité de travail que le suivi, sur ce vrai
 * changement d'état, correction comprise (R11, R14), au barème de la difficulté de la semaine du jour
 * touché, même close (R1, R14 de #22), prime d'objectif comprise : elle est accordée quand le tap
 * atteint l'objectif de la semaine du jour touché, retirée en entier quand il repasse dessous, avec
 * les réglages de cette semaine, close ou non (R8 à R11, R14 de #26). Un refus ne change rien,
 * l'expérience non plus.
 * Un refus de règle est un résultat ; une panne de stockage est une exception, et rien ne change :
 * ni le suivi, ni l'expérience.
 */
export function toggleCheckIn(
  { clock, unitOfWork }: UseCaseDependencies,
  habitId: HabitId,
  day: Day,
): Promise<ToggleCheckInResult> {
  return unitOfWork.run(async (repositories) => {
    const { habits, checkIns, character } = repositories;
    const today = clock.today();
    const habit = await habits.findById(habitId);
    if (habit === null) {
      return { ok: false, reason: 'unknownHabit' };
    }
    let current: CheckIn | null;
    let toggled: ReturnType<typeof toggle>;
    try {
      current = await checkIns.find(habitId, day);
      toggled = toggle(habit, day, current, today);
    } catch (error) {
      if (error instanceof NotStartedDayError) {
        return { ok: false, reason: 'notStarted' };
      }
      if (error instanceof UpcomingDayError) {
        return { ok: false, reason: 'upcoming' };
      }
      throw error;
    }
    const { change, weeklyProgress, weekTarget } = await weekToggleOf(
      repositories,
      habit,
      current,
      toggled.checkIn,
      today,
    );
    const before = await character.get();
    const after = before.applyXpChange(change.checkInXp + change.targetBonus);
    await checkIns.save(toggled.checkIn);
    await character.save(after);
    const xpChange = before.xpChangeTo(after);
    const week = Week.containing(day);
    return {
      ok: true,
      habitDay: habitDayOf(habit, day, toggled.checkIn, today),
      isCorrection: toggled.isCorrection,
      xpChange,
      xp: after.xp,
      targetBonusChange: targetBonusShareOf(change, xpChange),
      targetReachedChange: change.targetReachedChange,
      weeklyProgress,
      weekTarget,
      targetReached: isTargetReached(weeklyProgress, weekTarget),
      week,
      closedWeek: week.isBefore(Week.containing(today)),
    };
  });
}
