/**
 * Les libellés du Serment (`Oath`) et du pouvoir attisé (`KindledPower`, #237), tirés du glossaire et
 * de la maquette validée 232 (S1 à S14). Le nom d'un pouvoir vient de `powerText.ts`.
 */
import type { OathStanding } from '../../../domain/ascent/oaths';
import { POWERS, kindledCost, type PowerKind } from '../../../domain/battle/powers';
import { TREE_POWER_NAMES } from './powerText';

export const OATH_HEADING = 'Serment';
export const SWEAR_OATH = 'Prêter serment';
export const CHANGE_HABIT = "Changer d'habitude";
export const OATH_BROKEN = 'Serment rompu';
export const KINDLED = 'Attisé';
export const OATH_LOW_COST = 'Le Serment se prête sur un pouvoir de 2 Élan ou plus.';
export const OATH_FROM_TOMORROW =
  "Le Serment compte dès demain. Tu pourras changer d'habitude au camp.";
export const OATH_FAILED = "Le Serment n'a pas pu être enregistré. Réessaie.";
export const NO_HABIT =
  "Tu n'as pas encore d'habitude. Crée-en une dans l'onglet Journée, puis reviens prêter serment.";
export const GO_TO_DAY = 'Aller à la Journée';
export const HABITS_UNREADABLE = "Tes habitudes n'ont pas pu être lues.";
export const SWEAR_OFF_LABEL = 'Prêter serment, indisponible : choisis une habitude';

const nameOf = (power: PowerKind) => TREE_POWER_NAMES[power];
const cost = (power: PowerKind) => POWERS[power].cost;

/** « 1 Élan au lieu de 2 ». */
function insteadOf(power: PowerKind): string {
  return `${kindledCost(power)} Élan au lieu de ${cost(power)}`;
}

/** Le cadre « Serment » d'un pouvoir sans Serment (S1). */
export function oathInvite(power: PowerKind): string {
  return `Lie une habitude à ce pouvoir. Si tu l'as faite la veille, il est attisé : ${insteadOf(power)}, pour toute l'ascension.`;
}

export function swearLabel(power: PowerKind): string {
  return `Prêter serment : lier une habitude à ${nameOf(power)}`;
}

/** L'état du Serment dans la fiche (S4, S5) ; `null` tant qu'hier n'est pas lu. */
export function oathStandingText(
  power: PowerKind,
  habit: string,
  standing: Exclude<OathStanding, 'broken'> | null,
): string | null {
  const name = nameOf(power);
  switch (standing) {
    case 'fresh':
      return `Le Serment compte dès demain : fais « ${habit} » aujourd'hui, et ${name} sera attisé à ta prochaine ascension demain.`;
    case 'kept':
      return `Faite hier : ${name} est attisé (${kindledCost(power)} Élan) pour toute ascension lancée aujourd'hui.`;
    case 'missed':
      return `Pas faite hier : ${name} coûte ${cost(power)} Élan aujourd'hui. Fais-la aujourd'hui pour qu'il soit attisé demain.`;
    case null:
      return null;
  }
}

/** Le Serment rompu (S14) : le nom de l'habitude supprimée n'est plus connu. */
export function oathBrokenText(power: PowerKind): string {
  return `Son habitude a été supprimée. ${nameOf(power)} coûte ${cost(power)} Élan.`;
}

/** « 2 → 1 Élan ». */
export function kindledCostText(power: PowerKind): string {
  return `${cost(power)} → ${kindledCost(power)} Élan`;
}

/** « Représailles, attisé, 1 Élan au lieu de 2 ». */
export function kindledLabel(power: PowerKind): string {
  return `${nameOf(power)}, attisé, ${insteadOf(power)}`;
}

/** L'annonce polie du Serment prêté (S4). */
export function swornAnnouncement(power: PowerKind, habit: string): string {
  return `Serment prêté : ${habit}. ${nameOf(power)} sera attisé demain si tu la fais aujourd'hui.`;
}

/** Le Serment lu par le lecteur d'écran : « Serment : Courir 20 minutes ». */
export function oathLabel(habit: string): string {
  return `Serment : ${habit}`;
}

/** L'introduction du choix de l'habitude (S2). */
export function pickerIntro(power: PowerKind): string {
  return `Choisis l'habitude qui attisera ${nameOf(power)} : faite la veille, il coûte ${insteadOf(power)}, pour toute l'ascension.`;
}

/** L'introduction du choix sans habitude (S3). */
export function pickerEmptyIntro(power: PowerKind): string {
  return `Lie une habitude à ${nameOf(power)}. Si tu l'as faite la veille, il est attisé : ${insteadOf(power)}, pour toute l'ascension.`;
}

/** Une habitude qui tient le Serment d'un autre pouvoir (S2). */
export function boundElsewhere(power: PowerKind): string {
  return `Déjà liée à ${nameOf(power)}`;
}

export function swearOnLabel(habit: string): string {
  return `Prêter serment sur « ${habit} »`;
}

/** La ligne d'une habitude qui tient un Serment, dans la Vue Journée (S13). */
export function habitOathBadge(power: PowerKind): string {
  return `Serment · ${nameOf(power)}`;
}

/** La ligne de la fenêtre de suppression d'une habitude qui tient un Serment (S13). */
export function deleteOathLine(power: PowerKind): string {
  const name = nameOf(power);
  return `Elle tient le Serment de ${name} : il sera rompu, et ${name} coûtera ${cost(power)} Élan.`;
}
