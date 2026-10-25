import type { TargetFeedback } from './targetFeedback';

/** Durée d'affichage d'un toast sans action, comme dans la maquette. */
export const TOAST_DURATION_MS = 2800;

/** Durée d'affichage d'un toast qui propose une action (« Réessayer »), comme dans la maquette. */
export const TOAST_WITH_ACTION_DURATION_MS = 5000;

/** Durée d'affichage du message « Objectif atteint » (F1), comme dans la maquette. */
export const TARGET_TOAST_DURATION_MS = 4000;

/**
 * La forme d'un toast : `default` (clair) ; `goal`, le message F1 « Objectif de la semaine atteint »
 * (fond sombre, liseré or, drapeau) ; `soft`, le message discret du retour sous l'objectif (#26).
 */
export type ToastVariant = 'default' | 'goal' | 'soft';

/** L'action proposée par un toast : un libellé court et ce qu'elle fait. */
export interface ToastAction {
  readonly label: string;
  readonly onPress: () => void;
}

/** Ce que montre un toast du feedback « Objectif atteint » : titre, détail, prime (#26). */
export interface ToastTarget {
  /** « Objectif de la semaine atteint ». */
  readonly title: string;
  /** « Courir 5 km 3/3 ». */
  readonly detail: string;
  /** « +15 XP prime », en or dans le message F1 ; vide sans prime. */
  readonly bonusText: string;
}

/**
 * Ce qu'un écran donne à `Toast` pour un feedback « Objectif atteint » (F1) ou un retour sous
 * l'objectif (#26) : sa forme, son texte et son annonce.
 */
export function targetToastOf({
  kind,
  message,
  title,
  detail,
  bonusText,
  announcement,
}: TargetFeedback): {
  readonly message: string;
  readonly variant: ToastVariant;
  readonly target: ToastTarget;
  readonly announcement: string;
} {
  return {
    message,
    variant: kind === 'reached' ? 'goal' : 'soft',
    target: { title, detail, bonusText },
    announcement,
  };
}

/** La durée d'un toast : plus longue avec une action, ou pour F1. */
export function toastDurationOf(withAction: boolean, variant: ToastVariant): number {
  if (withAction) {
    return TOAST_WITH_ACTION_DURATION_MS;
  }
  return variant === 'goal' ? TARGET_TOAST_DURATION_MS : TOAST_DURATION_MS;
}
