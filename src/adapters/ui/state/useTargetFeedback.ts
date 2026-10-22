import { useCallback, useEffect, useRef, useState } from 'react';

import type { UpdateHabitResult } from '../../../application/useCases/updateHabit';
import type { HabitDay } from '../../../domain/checkIn/HabitDay';
import type { Day } from '../../../domain/day/Day';
import { Week } from '../../../domain/week/Week';
import { TARGET_BONUS_DELAY_MS } from '../components/CharacterBar';
import { TARGET_BURST_DURATION_MS } from '../components/TargetReachedBadge';
import {
  type TargetFeedback,
  targetFeedbackOf,
  type TargetOutcome,
} from '../format/targetFeedback';
import { useDependencies } from './Dependencies';
import { keyOf } from './habitDayKey';
import { useReducedMotion } from './useReducedMotion';

/** La case dont le badge (ou la puce) s'éclaire, le temps de l'éclat ; `id` change à chaque fois. */
export interface TargetFlash {
  readonly id: number;
  /** La case touchée (`keyOf` de son habitude et de son jour). */
  readonly key: string;
}

/** Un enregistrement qui peut franchir le seuil : ce qu'il dit de l'objectif et de l'expérience. */
export type TargetPlay = TargetOutcome & {
  /** L'expérience totale après l'enregistrement. */
  readonly xp: number;
  /** La variation de l'expérience, prime comprise. */
  readonly xpChange: number;
};

/**
 * L'éclat à montrer sur la case `habitDay`, si c'est sur elle que l'objectif vient d'être atteint :
 * son `id`, à passer à `TargetReachedBadge` ou `TargetBurst` ; sinon `undefined`.
 */
export function targetFlashOn(
  flash: TargetFlash | null,
  habitDay: Pick<HabitDay, 'habit' | 'day'>,
): number | undefined {
  return flash !== null && flash.key === keyOf(habitDay) ? flash.id : undefined;
}

/**
 * Le feedback « Objectif atteint » (F1, #26), partagé par les écrans (Vue Journée, Vue Semaine,
 * « Modifier l'habitude » ; plus tard le Détail du jour) : `play` reçoit un enregistrement et la case
 * touchée, et joue, s'il franchit le seuil de l'objectif de la semaine (`targetFeedbackOf`) :
 * - objectif atteint : l'éclat du badge sur la case (`flash`, pendant `TARGET_BURST_DURATION_MS`),
 *   puis, `TARGET_BONUS_DELAY_MS` après le « +X XP » du suivi (tout de suite quand le mouvement est
 *   réduit), le message F1 dans le toast de l'écran (`showToast`), sa seconde vibration (`Haptics`)
 *   et son annonce, lue par le toast ;
 * - retour sous l'objectif : le message discret, tout de suite, sans vibration.
 *
 * `play` renvoie vrai s'il a joué un feedback : il remplace alors le message de l'écran (une seule
 * annonce, un seul toast). La seconde pastille de la prime vient de `Experience`.
 */
export function useTargetFeedback({
  showToast,
}: {
  readonly showToast: (feedback: TargetFeedback) => void;
}): {
  readonly play: (
    played: TargetPlay,
    habitDay: Pick<HabitDay, 'habit' | 'day'>,
    correction?: boolean,
  ) => boolean;
  readonly flash: TargetFlash | null;
} {
  const { haptics } = useDependencies();
  const reducedMotion = useReducedMotion();
  const [flash, setFlash] = useState<TargetFlash | null>(null);
  const flashCount = useRef(0);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelPending = useCallback(() => {
    if (pending.current !== null) {
      clearTimeout(pending.current);
      pending.current = null;
    }
  }, []);

  useEffect(() => cancelPending, [cancelPending]);

  useEffect(() => {
    if (flash === null) {
      return;
    }
    const timer = setTimeout(
      () => setFlash(null),
      TARGET_BONUS_DELAY_MS + TARGET_BURST_DURATION_MS,
    );
    return () => clearTimeout(timer);
  }, [flash]);

  const play = useCallback(
    (played: TargetPlay, habitDay: Pick<HabitDay, 'habit' | 'day'>, correction = false) => {
      const feedback = targetFeedbackOf(played, habitDay.habit.name.value, {
        xp: played.xp,
        checkInXpChange: played.xpChange - played.targetBonusChange,
        correction,
      });
      cancelPending();
      if (feedback === null) {
        return false;
      }
      if (feedback.kind === 'lost') {
        showToast(feedback);
        return true;
      }
      flashCount.current += 1;
      setFlash({ id: flashCount.current, key: keyOf(habitDay) });
      const reached = () => {
        pending.current = null;
        haptics.success();
        showToast(feedback);
      };
      if (reducedMotion) {
        reached();
      } else {
        pending.current = setTimeout(reached, TARGET_BONUS_DELAY_MS);
      }
      return true;
    },
    [cancelPending, haptics, reducedMotion, showToast],
  );

  return { play, flash };
}

/**
 * Ce qu'une modification enregistrée (`updateHabit`) dit de l'objectif de la semaine en cours, pour
 * `play` : F1 après « Enregistrer » quand l'objectif, baissé le jour de création, est atteint (E7).
 */
export function updatedTargetPlay(
  updated: Pick<
    Extract<UpdateHabitResult, { readonly ok: true }>,
    | 'targetBonusChange'
    | 'targetReachedChange'
    | 'weeklyProgress'
    | 'weekSettings'
    | 'xp'
    | 'xpChange'
  >,
  today: Day,
): TargetPlay {
  return {
    targetBonusChange: updated.targetBonusChange,
    targetReachedChange: updated.targetReachedChange,
    weeklyProgress: updated.weeklyProgress,
    weekTarget: updated.weekSettings.weekTarget,
    week: Week.containing(today),
    closedWeek: false,
    xp: updated.xp,
    xpChange: updated.xpChange,
  };
}
