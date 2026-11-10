/**
 * Les libellés du menu des pouvoirs (`PowersMenu`) et de la carte « Pouvoirs équipés » du pied de
 * la tour (#270), tirés du glossaire et de la maquette validée 269 (sections 1, 2, 3, 4 et 7). Les
 * libellés repris de #236 (« 3 sur 3 : retire d'abord… », « Choisis encore n pouvoir(s) ») restent
 * dans `powerText`.
 */
import type { OathStanding } from '../../../domain/ascent/oaths';
import { EQUIPPED_POWER_SLOTS } from '../../../domain/ascent/powerTree';
import type { HeroKind } from '../../../domain/battle/combatants';
import { POWERS, kindledCost, type PowerKind } from '../../../domain/battle/powers';
import { HERO_NAMES } from './battleText';
import { heroOathLine } from './oathText';
import { POWER_EFFECTS, TREE_POWER_NAMES, powerType } from './powerText';

export const POWERS_MENU_TITLE = 'Pouvoirs équipés';
export const NEXT_ASCENT_SUBTITLE = 'Pour ta prochaine ascension';
export const ASCENT_SUBTITLE = 'Ascension en cours';
/** L'échec de l'enregistrement du choix à « Valider » (M7) : rien n'est perdu. */
export const POWERS_SAVE_ERROR =
  "Ton choix n'a pas pu être enregistré. Il est gardé ici : réessaie.";
/** Le bandeau de la première ouverture du menu (M12). */
export const FIRST_OPEN_BAND =
  "Nouveau : tes pouvoirs se préparent ici, avant chaque ascension. Ils sont gardés d'une fois sur l'autre.";
/** Le pied du menu pendant une ascension (M10). */
export const LOCKED_FOOT_NOTE = "Ils sont aussi dans l'Équipement de l'ascension.";
/** Le pied du menu quand les deux héros ont 3 pouvoirs ou moins (M4). */
export const OFFICE_FOOT_NOTE = "D'autres pouvoirs se débloquent au camp.";
export const NEW_TAG = 'nouveau';
export const OFFICE_TAG = 'Équipé';
export const FIXED_TAG = 'Fixé';
export const BASE_TAG = 'base';
/** Le lien de la carte : « Changer », ou « Voir » pendant une ascension (T1, T6). */
export const CHANGE_LINK = 'Changer';
export const SEE_LINK = 'Voir';
export const CARD_LOCKED_NOTE = "Fixés jusqu'à la fin de l'ascension.";
export const CHANGE_POWERS = 'Changer les pouvoirs';
export const CHOOSE_MY_POWERS = 'Choisir mes pouvoirs';
export const POWERS_LOADING = 'Chargement des pouvoirs';

/** Le nom court d'un héros, sur son onglet et dans le pied du menu. */
export const HERO_SHORT_NAMES: Readonly<Record<HeroKind, string>> = {
  sentinel: 'Sentinelle',
  wanderer: 'Errante',
};

/** « la Sentinelle », « l'Errante » : le héros dans une phrase. */
function heroIn(hero: HeroKind): string {
  const name = HERO_NAMES[hero];
  return name.charAt(0).toLowerCase() + name.slice(1);
}

const plural = (count: number, word: string) => `${word}${count > 1 ? 's' : ''}`;

/** Le retour du menu (M13) : vers le pied de la tour, ou vers le Choix du héros. */
export function backLabel(from: 'tower' | 'choice'): string {
  return from === 'choice' ? 'Retour au Choix du héros' : 'Retour au pied de la tour';
}

/** « L'Errante · dans l'ordre de l'arbre ». */
export function menuHeading(hero: HeroKind): string {
  return `${HERO_NAMES[hero]} · dans l'ordre de l'arbre`;
}

/** « 2 sur 3 » : le compte d'un héros, au menu et sur la carte. */
export function slotsText(count: number): string {
  return `${count} sur ${EQUIPPED_POWER_SLOTS}`;
}

/** « 2/3 » : le compte d'un onglet. */
export function tabCount(count: number): string {
  return `${count}/${EQUIPPED_POWER_SLOTS}`;
}

/** Le badge d'un onglet : son compte, à compléter ou non, ou le cadenas de l'ascension. */
export type TabBadge = { readonly count: number; readonly toComplete: boolean } | 'locked';

/** Le libellé lu d'un onglet : « L'Errante, 2 pouvoirs équipés sur 3, choix à compléter ». */
export function tabLabel(hero: HeroKind, badge: TabBadge): string {
  if (badge === 'locked') return `${HERO_NAMES[hero]}, en ascension`;
  const { count, toComplete } = badge;
  const equipped = `${count} ${plural(count, 'pouvoir')} ${plural(count, 'équipé')} sur ${EQUIPPED_POWER_SLOTS}`;
  return `${HERO_NAMES[hero]}, ${equipped}${toComplete ? ', choix à compléter' : ''}`;
}

/** Un pouvoir nouveau a pris une place libre (M8). */
export function autoEquippedBand(power: PowerKind): string {
  return `${TREE_POWER_NAMES[power]} s'est équipé tout seul : il restait une place.`;
}

/** Un pouvoir nouveau attend une place (M9). */
export function waitingBand(power: PowerKind): string {
  return `${TREE_POWER_NAMES[power]} est à toi, pas encore équipé : retire un pouvoir pour lui faire une place.`;
}

/** 3 pouvoirs ou moins : tous équipés d'office (M4). */
export function officeBand(owned: number): string {
  const head = owned > 1 ? `Tes ${owned} pouvoirs sont équipés` : 'Ton pouvoir est équipé';
  return `${head} d'office : rien à choisir. À partir de 4, tu choisis tes 3.`;
}

/** Le bandeau d'une ascension en cours (M10). */
export function lockedBand(hero: HeroKind): string {
  return `Ascension en cours. ${HERO_NAMES[hero]} garde ces pouvoirs jusqu'à sa fin. Tu pourras les changer pour la prochaine.`;
}

const choose = (missing: number) => `choisis encore ${missing} ${plural(missing, 'pouvoir')}`;

/** Le libellé lu de « Valider » qui attend des pouvoirs pour le héros de l'onglet (M3). */
export function missingLabel(hero: HeroKind, missing: number): string {
  return `Valider, indisponible : ${choose(missing)} pour ${heroIn(hero)}`;
}

/** « Valider » attend l'autre héros : « Sentinelle : choisis encore 1 ». */
export function otherMissingText(hero: HeroKind, missing: number): string {
  return `${HERO_SHORT_NAMES[hero]} : choisis encore ${missing}`;
}

/** L'état d'une ligne sans case : équipé d'office (M4), ou fixé pendant une ascension (M10). */
export type MenuRowState = 'office' | 'fixed' | 'aside';

const ROW_STATES: Readonly<Record<MenuRowState, string>> = {
  office: " Équipé d'office.",
  fixed: " Fixé jusqu'à la fin de l'ascension.",
  aside: ' Pas équipé.',
};

/** Le libellé lu d'une ligne : « Rafale, 2 Élan, Frappe. Une frappe en 4 coups. », et la suite. */
export function menuRowLabel(
  power: PowerKind,
  {
    kindled = false,
    oath,
    isNew = false,
    state,
  }: {
    readonly kindled?: boolean;
    readonly oath?: string;
    readonly isNew?: boolean;
    readonly state?: MenuRowState;
  },
): string {
  const name = TREE_POWER_NAMES[power];
  const { cost } = POWERS[power];
  const price = kindled ? `attisé, ${kindledCost(power)} Élan au lieu de ${cost}` : `${cost} Élan`;
  const head = `${name}, ${price}, ${powerType(power)}. ${POWER_EFFECTS[power].effect}`;
  return `${head}${oath === undefined ? '' : ` ${oath}`}${isNew ? ' Nouveau.' : ''}${state === undefined ? '' : ROW_STATES[state]}`;
}

/** La ligne du Serment d'un pouvoir au menu : en braise s'il attise, en bleu, ou neutre. */
export interface MenuOathLine {
  readonly tone: 'kindled' | 'oath' | 'muted';
  readonly text: string;
}

/**
 * La ligne du Serment d'une ligne du menu (M5, M6) : coché et tenu hier, il est attisé ; décoché,
 * il ne l'est pas, et la ligne le dit en bleu ; pas tenu hier, ou prêté aujourd'hui, ce qu'il faut
 * faire pour demain.
 */
export function menuOathLine(
  power: PowerKind,
  habit: string,
  standing: Exclude<OathStanding, 'broken'>,
  checked: boolean,
): MenuOathLine {
  switch (standing) {
    case 'kept':
      return checked
        ? { tone: 'kindled', text: heroOathLine(power, habit, 'kept')!.text }
        : {
            tone: 'oath',
            text: `Serment tenu hier : équipé, il sera attisé (${kindledCost(power)} Élan).`,
          };
    case 'missed':
      return {
        tone: 'muted',
        text: `Serment : « ${habit} » pas faite hier. Fais-la aujourd'hui, il sera attisé demain.`,
      };
    case 'fresh':
      return {
        tone: 'muted',
        text: `Serment : il compte dès demain. Fais « ${habit} » aujourd'hui, il sera attisé demain.`,
      };
  }
}

/** L'annonce du nouveau choix d'un héros (T5) : « 3 pouvoirs équipés pour l'Errante : … ». */
export function equippedAnnouncement(hero: HeroKind, powers: readonly PowerKind[]): string {
  const count = powers.length > 1 ? `${powers.length} pouvoirs équipés` : 'Un pouvoir équipé';
  const names = powers.map((power) => TREE_POWER_NAMES[power]).join(', ');
  return `${count} pour ${heroIn(hero)} : ${names}.`;
}

/** Le lien discret du Choix du héros (H2). */
export function changePowersLinkLabel(hero: HeroKind): string {
  return `${CHANGE_POWERS} de ${heroIn(hero)} : ouvre le menu des pouvoirs`;
}

/** Le bouton du bandeau de l'arbre (D1). */
export function choosePowersLabel(hero: HeroKind): string {
  return `${CHOOSE_MY_POWERS} : ouvre le menu des pouvoirs de ${heroIn(hero)}`;
}

/** La note d'un pouvoir en attente sur la carte (T4). */
export function waitingNote(power: PowerKind): string {
  return `${TREE_POWER_NAMES[power]} attend une place.`;
}

/** Une ligne de la carte : un héros, ses pouvoirs équipés et ceux qui sont attisés. */
export interface CardLabelRow {
  readonly hero: HeroKind;
  readonly powers: readonly PowerKind[];
  readonly kindled: readonly PowerKind[];
}

/**
 * Le libellé lu de la carte « Pouvoirs équipés » (section 7) : « Pouvoirs équipés. La Sentinelle :
 * Rempart, Représailles, attisé, Tenir bon. … Changer les pouvoirs ».
 */
export function cardLabel({
  rows,
  waiting,
  locked,
}: {
  readonly rows: readonly CardLabelRow[];
  readonly waiting: readonly PowerKind[];
  readonly locked: boolean;
}): string {
  const heroes = rows.map(({ hero, powers, kindled }) => {
    const names = powers.map(
      (power) => `${TREE_POWER_NAMES[power]}${kindled.includes(power) ? ', attisé' : ''}`,
    );
    const free = EQUIPPED_POWER_SLOTS - powers.length;
    const slots = free > 0 ? [`${free} ${plural(free, 'place')} ${plural(free, 'libre')}`] : [];
    return ` ${HERO_NAMES[hero]} : ${[...names, ...slots].join(', ')}.`;
  });
  const notes = waiting.map((power) => ` Nouveau : ${waitingNote(power)}`);
  const tail = locked ? ` ${CARD_LOCKED_NOTE} Voir les pouvoirs` : ` ${CHANGE_POWERS}`;
  return `${POWERS_MENU_TITLE}.${heroes.join('')}${notes.join('')}${tail}`;
}
