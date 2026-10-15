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
import type { ToggleCheckInResult } from '../../../application/useCases/toggleCheckIn';
import type { UnitOfWork } from '../../../application/ports/UnitOfWork';
import type { HabitDay } from '../../../domain/checkIn/HabitDay';
import { xpAnnouncement } from '../format/formatXp';
import { keyOf } from './habitDayKey';
import { useTrackingChanges } from './TrackingRevision';

/** Un tap enregistré, tel que `toggleCheckIn` le renvoie. */
export type ToggledCheckIn = Extract<ToggleCheckInResult, { readonly ok: true }>;

/**
 * Durée du feedback d'un changement d'expérience : la pastille « +10 XP » de l'en-tête reste
 * visible ce temps-là (maquette, « Formes et mouvement »).
 */
export const XP_CHANGE_DURATION_MS = 1400;

/** Un changement d'expérience à montrer : « +10 XP » ou « −10 XP », sur la case touchée. */
export interface XpChange {
  /** Change à chaque changement, pour rejouer le feedback même s'il se répète. */
  readonly id: number;
  /** La variation : +10 ou −10. */
  readonly amount: number;
  /** La case touchée (`keyOf` de son habitude et de son jour), d'où « +10 XP » s'envole. */
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
  /** Montre l'expérience après un tap enregistré, avec son feedback. */
  readonly checkInToggled: (toggled: ToggledCheckIn) => void;
}

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
 * touchée : d'elle s'envole « +10 XP ».
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
 * - le changement est exposé pendant `XP_CHANGE_DURATION_MS`, pour le feedback « +10 XP » ;
 * - le lecteur d'écran l'annonce : « +10 points d'expérience. Total : 40 XP. », précédé de
 *   « Correction enregistrée, » pour une correction qui pose la marque « corrigé » ;
 * - un gain fait vibrer légèrement le téléphone (`Haptics`), jamais une perte.
 */
export function ExperienceProvider({
  unitOfWork,
  haptics,
  children,
}: {
  readonly unitOfWork: UnitOfWork;
  readonly haptics: Haptics | undefined;
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

  const checkInToggled = useCallback(
    (toggled: ToggledCheckIn) => {
      latest.current += 1;
      setXp(toggled.xp);
      if (toggled.xpChange === 0) {
        return;
      }
      changeCount.current += 1;
      setChange({
        id: changeCount.current,
        amount: toggled.xpChange,
        key: keyOf(toggled.habitDay),
      });
      if (toggled.xpChange > 0) {
        haptics?.success();
      }
      AccessibilityInfo.announceForAccessibility(
        xpAnnouncement({
          xpChange: toggled.xpChange,
          xp: toggled.xp,
          correction: toggled.isCorrection && toggled.habitDay.corrected,
        }),
      );
    },
    [haptics],
  );

  useEffect(() => {
    if (change === null) {
      return;
    }
    const timer = setTimeout(() => setChange(null), XP_CHANGE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [change]);

  const value = useMemo(
    () => ({ xp, change, reload, checkInToggled }),
    [xp, change, reload, checkInToggled],
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
