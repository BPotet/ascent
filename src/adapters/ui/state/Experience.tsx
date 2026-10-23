import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AccessibilityInfo } from 'react-native';

import type { Haptics } from '../../../application/ports/Haptics';
import { getCharacter } from '../../../application/useCases/getCharacter';
import type { DeleteHabitResult } from '../../../application/useCases/deleteHabit';
import type { ToggleCheckInResult } from '../../../application/useCases/toggleCheckIn';
import type { UpdateHabitResult } from '../../../application/useCases/updateHabit';
import type { UnitOfWork } from '../../../application/ports/UnitOfWork';
import type { HabitDay } from '../../../domain/checkIn/HabitDay';
import { xpAnnouncement } from '../format/formatXp';
import { keyOf } from './habitDayKey';
import { useTrackingChanges } from './TrackingRevision';

/** Un tap enregistré, tel que `toggleCheckIn` le renvoie. */
export type ToggledCheckIn = Extract<ToggleCheckInResult, { readonly ok: true }>;

/**
 * Durée du feedback d'un changement d'expérience : la pastille « +20 XP » de l'en-tête reste
 * visible ce temps-là (maquette, « Formes et mouvement »).
 */
export const XP_CHANGE_DURATION_MS = 1400;

/** Un changement d'expérience à montrer : « +20 XP » ou « −20 XP », sur la case touchée. */
export interface XpChange {
  /** Change à chaque changement, pour rejouer le feedback même s'il se répète. */
  readonly id: number;
  /** La variation, renvoyée par le cas d'usage : +20 ou −20 pour un suivi en Difficile. */
  readonly amount: number;
  /**
   * La part de `amount` qui vient de la prime d'objectif (#26), montrée dans une seconde pastille
   * « +15 XP prime » ; 0 sans prime, ou quand l'écran ne la sépare pas (Détail du jour).
   */
  readonly bonus: number;
  /** La case touchée (`keyOf` de son habitude et de son jour), d'où « +20 XP » s'envole. */
  readonly key: string;
}

/** L'expérience du personnage telle que l'interface l'affiche. */
export interface Experience {
  /** L'expérience totale enregistrée ; `null` tant qu'elle n'a pas pu être lue. */
  readonly xp: number | null;
  /** Le dernier changement, pendant `XP_CHANGE_DURATION_MS` ; `null` sinon. */
  readonly change: XpChange | null;
  /** Relit l'expérience enregistrée. */
  readonly reload: () => Promise<void>;
  /**
   * Montre l'expérience après un tap enregistré, avec son feedback. Avec `splitBonus`, la prime
   * d'objectif est montrée dans une seconde pastille, et l'annonce d'un franchissement du seuil est
   * laissée au feedback « Objectif atteint » (`useTargetFeedback`).
   */
  readonly checkInToggled: (toggled: ToggledCheckIn, splitBonus?: boolean) => void;
  /** Montre l'expérience après la suppression d'une habitude, avec son feedback. */
  readonly habitDeleted: (deleted: DeletedHabit) => void;
  /** Montre l'expérience après la modification d'une habitude, avec son feedback. */
  readonly habitUpdated: (updated: UpdatedHabit) => void;
}

/** Une habitude supprimée, telle que `deleteHabit` le renvoie. */
export type DeletedHabit = Pick<
  Extract<DeleteHabitResult, { readonly ok: true }>,
  'xp' | 'xpRemoved'
>;

/** Une habitude modifiée, telle que `updateHabit` le renvoie. */
export type UpdatedHabit = Pick<
  Extract<UpdateHabitResult, { readonly ok: true }>,
  'xp' | 'xpChange' | 'targetBonusChange' | 'targetReachedChange'
>;

/**
 * La case d'où s'envole le changement d'une suppression ou d'une modification : aucune, il ne
 * s'affiche qu'en en-tête.
 */
const NO_CASE = '';

const ExperienceContext = createContext<Experience | null>(null);

/**
 * Lit l'expérience enregistrée et la passe à `show`, sauf si une valeur plus récente est arrivée
 * entre-temps (`latest` a changé depuis `reading`). En cas d'échec, l'en-tête garde la dernière
 * valeur lue ; la prochaine lecture réessaiera.
 */
function readXp(
  unitOfWork: UnitOfWork,
  reading: number,
  latest: { readonly current: number },
  show: (xp: number) => void,
): Promise<void> {
  return getCharacter({ unitOfWork }).then(
    ({ xp }) => {
      if (reading === latest.current) {
        show(xp);
      }
    },
    () => undefined,
  );
}

/**
 * Le changement d'expérience à montrer sur la case `habitDay`, si c'est elle qui vient d'être
 * touchée : d'elle s'envole « +20 XP ».
 */
export function xpChangeOn(
  change: XpChange | null,
  habitDay: Pick<HabitDay, 'habit' | 'day'>,
): XpChange | undefined {
  return change !== null && change.key === keyOf(habitDay) ? change : undefined;
}

/**
 * L'expérience du personnage, partagée par les en-têtes de toutes les vues (R24). Fournie par
 * `DependenciesProvider`. Lue au démarrage, puis relue chaque fois qu'une vue enregistre un
 * changement (`TrackingRevision`).
 *
 * Après un tap enregistré, l'expérience suit ce que `toggleCheckIn` renvoie : l'interface ne
 * calcule rien. S'il y a eu un vrai changement d'expérience (`xpChange` différent de 0) :
 * - le changement est exposé pendant `XP_CHANGE_DURATION_MS`, pour le feedback « +20 XP » ;
 * - le lecteur d'écran l'annonce : « +20 points d'expérience. Total : 50 XP. », précédé de
 *   « Correction enregistrée, » pour une correction qui pose la marque « corrigé » ;
 * - un gain fait vibrer légèrement le téléphone (`Haptics`), jamais une perte.
 *
 * Après la suppression d'une habitude, l'expérience suit ce que `deleteHabit` renvoie ; l'expérience
 * retirée (−20 XP), s'il y en a, est montrée dans l'en-tête et annoncée de la même façon.
 *
 * Après la modification d'une habitude, l'expérience suit ce que `updateHabit` renvoie : un
 * changement de difficulté réévalue la semaine en cours (R12), prime d'objectif comprise. La
 * variation, s'il y en a, est montrée dans l'en-tête, la prime dans sa seconde pastille, et
 * annoncée ; un gain fait vibrer, jamais une baisse. Quand l'objectif est atteint (baissé le jour de
 * création), l'annonce est celle du feedback « Objectif atteint » (`useTargetFeedback`).
 *
 * Prime d'objectif (#26) : quand l'écran sépare la prime (`splitBonus`, Vue Journée et Vue
 * Semaine), `change.bonus` porte la part de la prime, montrée dans une seconde pastille ; seule la
 * part du suivi fait vibrer ici, la seconde vibration de F1 vient de `useTargetFeedback`, qui
 * annonce aussi le franchissement du seuil.
 */
export function ExperienceProvider({
  unitOfWork,
  haptics,
  children,
}: {
  readonly unitOfWork: UnitOfWork;
  readonly haptics: Haptics;
  readonly children: ReactNode;
}) {
  const [xp, setXp] = useState<number | null>(null);
  const [change, setChange] = useState<XpChange | null>(null);
  /** Augmente à chaque lecture et à chaque tap : seule la valeur la plus récente s'affiche. */
  const latest = useRef(0);
  const changeCount = useRef(0);

  /** Lit l'expérience enregistrée et l'affiche, si rien de plus récent n'est arrivé entre-temps. */
  const reload = useCallback(() => {
    latest.current += 1;
    return readXp(unitOfWork, latest.current, latest, setXp);
  }, [unitOfWork]);

  useTrackingChanges(() => void reload());

  useEffect(() => {
    latest.current += 1;
    void readXp(unitOfWork, latest.current, latest, setXp);
  }, [unitOfWork]);

  /**
   * Montre `total` et, s'il y en a, la variation `amount` (dont `bonus` de prime) sur la case `key`
   * ou dans l'en-tête seul : la part du suivi, si c'est un gain, fait vibrer ; l'annonce
   * (`announcement`) est lue, sauf si le feedback « Objectif atteint » la remplace (`null`).
   */
  const show = useCallback(
    (total: number, { amount, bonus, key }: Omit<XpChange, 'id'>, announcement: string | null) => {
      latest.current += 1;
      setXp(total);
      if (amount === 0) {
        return;
      }
      changeCount.current += 1;
      setChange({ id: changeCount.current, amount, bonus, key });
      if (amount - bonus > 0) {
        haptics.success();
      }
      if (announcement !== null) {
        AccessibilityInfo.announceForAccessibility(announcement);
      }
    },
    [haptics],
  );

  const checkInToggled = useCallback(
    (toggled: ToggledCheckIn, splitBonus = false) => {
      const bonus = splitBonus ? toggled.targetBonusChange : 0;
      const announced = !splitBonus || toggled.targetReachedChange === null;
      show(
        toggled.xp,
        { amount: toggled.xpChange, bonus, key: keyOf(toggled.habitDay) },
        announced
          ? xpAnnouncement({
              xpChange: toggled.xpChange,
              xp: toggled.xp,
              correction: toggled.isCorrection && toggled.habitDay.corrected,
            })
          : null,
      );
    },
    [show],
  );

  const habitDeleted = useCallback(
    ({ xp: total, xpRemoved }: DeletedHabit) =>
      show(
        total,
        { amount: -xpRemoved, bonus: 0, key: NO_CASE },
        xpAnnouncement({ xpChange: -xpRemoved, xp: total, correction: false }),
      ),
    [show],
  );

  const habitUpdated = useCallback(
    ({ xp: total, xpChange, targetBonusChange, targetReachedChange }: UpdatedHabit) =>
      show(
        total,
        { amount: xpChange, bonus: targetBonusChange, key: NO_CASE },
        targetReachedChange === 'reached'
          ? null
          : xpAnnouncement({ xpChange, xp: total, correction: false }),
      ),
    [show],
  );

  useEffect(() => {
    if (change === null) {
      return;
    }
    const timer = setTimeout(() => setChange(null), XP_CHANGE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [change]);

  const value = useMemo(
    () => ({ xp, change, reload, checkInToggled, habitDeleted, habitUpdated }),
    [xp, change, reload, checkInToggled, habitDeleted, habitUpdated],
  );
  return <ExperienceContext.Provider value={value}>{children}</ExperienceContext.Provider>;
}

export function useExperience(): Experience {
  const experience = useContext(ExperienceContext);
  if (experience === null) {
    throw new Error('useExperience must be used inside an ExperienceProvider');
  }
  return experience;
}
