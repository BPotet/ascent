import type { ToggleCheckInResult } from '../../../application/useCases/toggleCheckIn';
import type { Week } from '../../../domain/week/Week';
import { MONTH_NAMES } from './formatDay';
import { formatXp, formatXpChange } from './formatXp';

/**
 * Ce qu'un enregistrement dit de l'objectif de la semaine touchée, pour le feedback « Objectif
 * atteint » (F1) : les champs du résultat de `toggleCheckIn` (#26). `updateHabit` en donne une
 * partie, quand l'objectif baisse le jour de création (E7) : la semaine en cours.
 */
export type TargetOutcome = Pick<
  Extract<ToggleCheckInResult, { readonly ok: true }>,
  | 'targetBonusChange'
  | 'targetReachedChange'
  | 'weeklyProgress'
  | 'weekTarget'
  | 'week'
  | 'closedWeek'
>;

/** Le feedback d'un franchissement du seuil de l'objectif de la semaine (`targetFeedbackOf`). */
export interface TargetFeedback {
  /** `reached` : F1, l'objectif est atteint ; `lost` : le retour sous l'objectif, discret. */
  readonly kind: 'reached' | 'lost';
  /** Le titre du message en bas d'écran : « Objectif de la semaine atteint ». */
  readonly title: string;
  /** La suite du message, l'habitude et sa progression : « Courir 5 km 3/3 ». */
  readonly detail: string;
  /** La prime, à la fin du message : « +15 XP prime », « −15 XP prime » ; vide sans prime. */
  readonly bonusText: string;
  /** Le message entier, tel qu'il se lit : « Objectif de la semaine atteint · Courir 5 km 3/3 · … ». */
  readonly message: string;
  /** La seconde pastille de l'en-tête, la prime : +15 ou −15. */
  readonly bonusPill: number;
  /** Ce que le lecteur d'écran annonce, dans la zone polie. */
  readonly announcement: string;
  /** Vrai pour F1 : une seconde vibration de gain. Jamais pour une perte. */
  readonly vibrate: boolean;
}

/** Ce qu'il faut de plus pour l'annonce : le total et, pour une correction, son préfixe. */
export interface TargetAnnouncementContext {
  /** L'expérience totale après l'enregistrement. */
  readonly xp: number;
  /** La part du suivi dans la variation (−10 pour un retour sous l'objectif). */
  readonly checkInXpChange: number;
  /** Vrai pour une correction qui pose la marque « corrigé » : « Correction enregistrée, … ». */
  readonly correction: boolean;
}

/** « semaine du 5 octobre », « semaine du 1er décembre » : la semaine par son lundi. */
export function weekOfText({ start }: Week): string {
  const dayOfMonth = start.dayOfMonth === 1 ? '1er' : `${start.dayOfMonth}`;
  return `semaine du ${dayOfMonth} ${MONTH_NAMES[start.month - 1]}`;
}

/** Les points d'une variation en toutes lettres : « +15 points », « −10 points ». */
const points = (change: number) => formatXpChange(change).replace(/ XP$/u, ' points');

/**
 * Le feedback d'un enregistrement de `habitName` qui franchit le seuil de l'objectif de la semaine
 * (maquette, F1 et « Retour sous l'objectif » ; #26), ou `null` s'il ne le franchit pas (au-delà de
 * l'objectif, sous l'objectif, ou seule la prime réévaluée avec la difficulté) :
 * - objectif atteint cette semaine : « Objectif de la semaine atteint · Courir 5 km 3/3 · +15 XP
 *   prime », une seconde vibration ;
 * - objectif atteint d'une semaine close : « Objectif atteint · semaine du 5 octobre · … » ;
 * - retour sous l'objectif : « Objectif de la semaine plus atteint · Courir 5 km 2/3 · −15 XP prime »
 *   (« Objectif de la semaine du 5 octobre plus atteint » pour une semaine close), sans vibration.
 *
 * Le lecteur d'écran l'annonce : « Objectif de la semaine atteint pour Courir 5 km, 3 sur 3. +15
 * points d'expérience de prime. Total : 45 XP. », ou « Objectif de la semaine plus atteint pour
 * Courir 5 km. −10 points d'expérience, −15 points de prime. », précédé de « Correction enregistrée, »
 * pour une correction qui pose la marque « corrigé ».
 */
export function targetFeedbackOf(
  outcome: TargetOutcome,
  habitName: string,
  context: TargetAnnouncementContext,
): TargetFeedback | null {
  const { targetReachedChange, targetBonusChange, weeklyProgress, weekTarget, week, closedWeek } =
    outcome;
  if (targetReachedChange === null) {
    return null;
  }
  const weekOf = weekOfText(week);
  const progress = `${weeklyProgress}/${weekTarget ?? weeklyProgress}`;
  const detail = `${habitName} ${progress}`;
  // Sans part de prime (le plancher de 0 Xp l'a réduite à rien), le message n'en parle pas.
  const bonusText = targetBonusChange === 0 ? '' : `${formatXpChange(targetBonusChange)} prime`;
  const messageOf = (title: string) =>
    [title, detail, bonusText].filter((part) => part !== '').join(' · ');
  /** L'annonce, précédée de « Correction enregistrée, » pour une correction (en minuscule après). */
  const announced = (text: string) =>
    context.correction
      ? `Correction enregistrée, ${text.charAt(0).toLowerCase()}${text.slice(1)}`
      : text;
  if (targetReachedChange === 'reached') {
    const title = closedWeek ? `Objectif atteint · ${weekOf}` : 'Objectif de la semaine atteint';
    const subject = closedWeek ? `Objectif de la ${weekOf}` : 'Objectif de la semaine';
    return {
      kind: 'reached',
      title,
      detail,
      bonusText,
      message: messageOf(title),
      bonusPill: targetBonusChange,
      announcement: announced(
        `${subject} atteint pour ${habitName}, ${weeklyProgress} sur ${weekTarget}. ` +
          `${points(targetBonusChange)} d’expérience de prime. Total : ${formatXp(context.xp)}.`,
      ),
      vibrate: true,
    };
  }
  const title = closedWeek
    ? `Objectif de la ${weekOf} plus atteint`
    : 'Objectif de la semaine plus atteint';
  return {
    kind: 'lost',
    title,
    detail,
    bonusText,
    message: messageOf(title),
    bonusPill: targetBonusChange,
    announcement: announced(
      `${title} pour ${habitName}. ` +
        `${points(context.checkInXpChange)} d’expérience, ${points(targetBonusChange)} de prime.`,
    ),
    vibrate: false,
  };
}
