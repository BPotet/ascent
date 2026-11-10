/**
 * Les libellés des pouvoirs (#235) : noms (fiches `codex/<code>` de l'Atelier, version 1), noms de
 * touche, types, effets, voies, états des nœuds de l'arbre et raisons d'indisponibilité en combat,
 * tirés du glossaire et de la maquette validée 232 (sections 1, 3 et 7).
 */
import type { HeroKind } from '../../../domain/battle/combatants';
import type { PowerAvailability } from '../../../domain/battle/Battle';
import { POWERS, isPowerStrike, type PowerKind } from '../../../domain/battle/powers';
import {
  powerPath,
  powerPrice,
  powerRank,
  type PowerNodeState,
  type PowerPath,
} from '../../../domain/ascent/powerTree';

/** Les noms complets des 10 nœuds des arbres, « Coup de bouclier » compris. */
export const TREE_POWER_NAMES: Readonly<Record<PowerKind, string>> = {
  bulwark: 'Rempart',
  shieldBash: 'Coup de bouclier',
  crushingBlow: 'Fracas',
  retaliation: 'Représailles',
  holdFast: 'Tenir bon',
  shadowStep: "Pas de l'ombre",
  rend: 'Entaille',
  flurry: 'Rafale',
  mist: 'Brume',
  ambush: 'Frappe furtive',
};

/**
 * Le nom sur la touche de combat (`buttonName` du Codex), 14 caractères au plus : « Coup d'écu »
 * pour Coup de bouclier, sur la touche seulement (#236) ; partout ailleurs, `TREE_POWER_NAMES`.
 */
export const POWER_BUTTON_NAMES: Readonly<Record<PowerKind, string>> = {
  bulwark: 'Rempart',
  shieldBash: "Coup d'écu",
  crushingBlow: 'Fracas',
  retaliation: 'Représailles',
  holdFast: 'Tenir bon',
  shadowStep: "Pas de l'ombre",
  rend: 'Entaille',
  flurry: 'Rafale',
  mist: 'Brume',
  ambush: 'Frappe furtive',
};

/** L'effet court du toucher maintenu (`effectText` du Codex, recopié mot pour mot). */
export const POWER_TIPS: Readonly<Record<PowerKind, string>> = {
  bulwark:
    "Pouvoir de base, action, 1 Élan, à charge. Le prochain impact qui lui fait des dégâts, après sa réduction, ne lui en fait que 50 %, et elle riposte aussitôt : 50 % des PV et 25 % de la garde d'une contre-attaque ordinaire (aucune garde sur un étourdi). Esquives et parades parfaites ne l'usent pas.",
  retaliation:
    "Pouvoir instantané, 2 Élan, à charge. Sa prochaine contre-attaque retire 200 % des PV et 200 % de la garde d'une contre-attaque ordinaire. La Riposte du Rempart et une double frappe parée à moitié ne la consomment pas.",
  holdFast:
    "Action, 3 Élan, une fois par combat. Elle regagne 20 % de ses PV max (arrondi à l'entier inférieur, au moins 1, sans dépasser le maximum), éteint sa Brûlure et arrête son Saignement. Lançable même à PV max.",
  shadowStep:
    "Pouvoir de base, instantané, 3 Élan, à charge. Sa prochaine esquive complète (tous les impacts d'un coup esquivés) déclenche une contre-attaque ordinaire, comme si le coup l'avait traversée sans la trouver.",
  rend: 'Pouvoir instantané, 1 Élan. Chaque coup de sa prochaine frappe en rythme du combat (attaque ou frappe de pouvoir) retire 150 % de son Brise-garde ; consommée par cette frappe, jamais par une contre-attaque.',
  shieldBash:
    "Frappe de pouvoir, 2 Élan : une frappe en rythme d'un coup sur la cible, à 50 % de son Attaque en PV et 200 % de son Brise-garde. Compte comme son action, sans le +1 Élan d'une attaque.",
  crushingBlow:
    "Frappe de pouvoir, 3 Élan : une frappe en rythme d'un coup sur la cible, à 200 % de son Attaque en PV et 100 % de son Brise-garde. Compte comme son action, sans le +1 Élan d'une attaque.",
  flurry:
    "Frappe de pouvoir, 2 Élan : une frappe en rythme de 4 coups à 300 ms d'écart, chacun à 100 % de son Attaque en PV et 100 % de son Brise-garde. Si la cible tombe, les coups restants sont perdus. Compte comme son action, sans le +1 Élan d'une attaque.",
  ambush:
    "Frappe de pouvoir, 3 Élan : une frappe en rythme de 2 coups, chacun à 250 % de son Attaque en PV si la cible a encore sa case dans la frise après l'Errante (jugé au lancer), 100 % sinon, et 100 % de son Brise-garde. Compte comme son action, sans le +1 Élan d'une attaque.",
  mist: "Pouvoir instantané, 2 Élan, à charge. Le prochain impact qui lui fait des dégâts, après réduction, ne lui en fait que 50 %, sans riposte. Esquives et parades parfaites ne l'usent pas ; Brûlure et Saignement ne sont pas réduits.",
};

/** L'effet en une phrase, puis son complément (maquette 232 : nœud, fiche, Équipement). */
export const POWER_EFFECTS: Readonly<
  Record<PowerKind, { readonly effect: string; readonly more: string }>
> = {
  bulwark: {
    effect: 'Le prochain coup subi fait 50 % de dégâts en moins, et elle riposte.',
    more: "Actif jusqu'au premier impact qui lui fait des dégâts, ou la fin du combat.",
  },
  shieldBash: {
    effect: 'Une frappe : 50 % des PV, 200 % du Brise-garde.',
    more: "Une frappe en rythme, à la place d'« Attaquer ».",
  },
  crushingBlow: {
    effect: 'Une frappe : 200 % des PV.',
    more: "Une frappe en rythme, à la place d'« Attaquer ».",
  },
  retaliation: {
    effect: 'Ta prochaine contre-attaque fait 200 % de ses dégâts et de son Brise-garde.',
    more: "Actif jusqu'à cette contre-attaque ou la fin du combat. La Riposte du Rempart ne l'use pas.",
  },
  holdFast: {
    effect: 'Rend 20 % des PV max, éteint la Brûlure et arrête le Saignement.',
    more: 'Une fois par combat.',
  },
  shadowStep: {
    effect: 'Ta prochaine esquive complète déclenche une contre-attaque.',
    more: "Actif jusqu'à cette esquive ou la fin du combat.",
  },
  rend: {
    effect: 'Ta prochaine frappe retire 150 % de son Brise-garde.',
    more: 'Seulement la frappe en rythme, pas les contre-attaques.',
  },
  flurry: {
    effect: 'Une frappe en 4 coups.',
    more: "Une frappe en rythme, à la place d'« Attaquer ».",
  },
  mist: {
    effect: 'Le prochain impact qui te fait des dégâts est réduit de 50 %.',
    more: "Actif jusqu'à cet impact ou la fin du combat. Ni la Brûlure ni le Saignement.",
  },
  ambush: {
    effect: "Une frappe en 2 coups ; 250 % si la cible n'a pas encore agi dans la manche.",
    more: "Une frappe en rythme, à la place d'« Attaquer ».",
  },
};

export const PATH_NAMES: Readonly<Record<PowerPath, string>> = {
  shield: 'Bouclier',
  watch: 'Veille',
  blades: 'Lames',
  shadow: 'Ombre',
};

const HERO_OF: Readonly<Record<HeroKind, { readonly name: string; readonly of: string }>> = {
  sentinel: { name: 'La Sentinelle', of: 'de la Sentinelle' },
  wanderer: { name: "L'Errante", of: "de l'Errante" },
};

/** Le coût en Élan d'un nœud. */
export function powerCost(code: PowerKind): number {
  return POWERS[code].cost;
}

/** Le type d'un pouvoir : « Action », « Instantané » ou « Frappe » (frappe de pouvoir, #236). */
export function powerType(code: PowerKind): 'Action' | 'Instantané' | 'Frappe' {
  if (isPowerStrike(code)) return 'Frappe';
  return POWERS[code].instant ? 'Instantané' : 'Action';
}

/** Un pouvoir à charge reste actif jusqu'à son emploi (« Reste actif »). */
export function staysActive(code: PowerKind): boolean {
  return POWERS[code].charge;
}

/** « 2 Élan · Instantané » : le coût et le type d'un nœud. */
export function powerTypeLine(code: PowerKind): string {
  return `${powerCost(code)} Élan · ${powerType(code)}`;
}

const heroOf = (code: PowerKind): HeroKind => POWERS[code].hero;

/** « La Sentinelle · Voie Veille · Rang 2 », ou « … · Pouvoir de base ». */
export function powerPlace(code: PowerKind): string {
  const hero = HERO_OF[heroOf(code)].name;
  const path = powerPath(code);
  if (path === null) return `${hero} · Pouvoir de base`;
  return `${hero} · Voie ${PATH_NAMES[path]} · Rang ${powerRank(code)}`;
}

/**
 * La fiche d'un pouvoir de base (PW6) : « Pouvoir de base de la Sentinelle : toujours à toi.
 * Équipé. » ; laissé de côté (#236), sans « Équipé ».
 */
export function basePowerBand(code: PowerKind, equipped = true): string {
  return `Pouvoir de base ${HERO_OF[heroOf(code)].of} : toujours à toi.${equipped ? ' Équipé.' : ''}`;
}

/** La fiche d'un pouvoir débloqué : équipé à la prochaine ascension, ou à choisir (#236, F5). */
export function unlockedBand(equipped: boolean): string {
  return equipped
    ? 'Débloqué. Équipé à ta prochaine ascension.'
    : 'Débloqué. Pas équipé : choisis-le au Choix du héros.';
}

export function shardsText(shards: number): string {
  return `${shards} ${shards > 1 ? 'Éclats' : 'Éclat'}`;
}

/** L'état d'un nœud, en mot (jamais par la seule couleur). */
export function nodeStateText(state: PowerNodeState, code: PowerKind, equipped = true): string {
  switch (state.kind) {
    case 'base':
      return 'Pouvoir de base';
    case 'unlocked':
      return equipped ? 'Équipé' : 'Débloqué';
    case 'nextAscent':
      return 'Dès ta prochaine ascension';
    case 'locked':
      return `Après ${TREE_POWER_NAMES[state.after]}`;
    case 'affordable':
      return `${powerPrice(code)} Éclats`;
    case 'missing':
      return `Il manque ${shardsText(state.missing)}`;
  }
}

/** Le libellé lu d'un nœud (section 7) ; les traits de l'arbre ne sont pas lus. */
export function nodeLabel(code: PowerKind, state: PowerNodeState, equipped = true): string {
  const head = `${TREE_POWER_NAMES[code]}, ${powerCost(code)} Élan, ${powerType(code)}`;
  switch (state.kind) {
    case 'base':
      return `${head}, pouvoir de base, ${equipped ? 'équipé' : 'pas équipé'}`;
    case 'unlocked':
      return `${head}, débloqué, ${equipped ? 'équipé' : 'pas équipé'}`;
    case 'nextAscent':
      return `${head}, débloqué, équipé dès ta prochaine ascension`;
    case 'locked':
      return `${head}, verrouillé : débloque d'abord ${TREE_POWER_NAMES[state.after]}`;
    case 'affordable':
      return `${head}, à débloquer pour ${powerPrice(code)} Éclats`;
    case 'missing':
      return `${head}, ${powerPrice(code)} Éclats, il manque ${shardsText(state.missing)}`;
  }
}

/** Le bandeau d'un pouvoir débloqué sans place libre (#236, D2). */
export function noFreeSlotBand(power: PowerKind): string {
  return `${TREE_POWER_NAMES[power]} débloqué. Tes 3 places sont prises : choisis tes pouvoirs au Choix du héros.`;
}

/**
 * L'annonce polie d'un déblocage (D1) ; sans place libre, le bandeau de D2 (#236).
 */
export function unlockAnnouncement(power: PowerKind, available: number, equipped = true): string {
  const head = equipped
    ? `${TREE_POWER_NAMES[power]} débloqué. Équipé dès ta prochaine ascension.`
    : noFreeSlotBand(power);
  return `${head} ${shardsText(available)} ${available > 1 ? 'disponibles' : 'disponible'}.`;
}

/** Le libellé lu d'une carte d'arbre au Camp (C1). */
export function powerTreeCardLabel(hero: HeroKind, unlocked: number): string {
  const plural = unlocked > 1;
  return `Arbre de pouvoirs ${HERO_OF[hero].of}, ${unlocked} ${plural ? 'pouvoirs' : 'pouvoir'} sur 5 ${plural ? 'débloqués' : 'débloqué'}`;
}

/** La disponibilité d'une touche de pouvoir, telle que l'interface la montre. */
export type PowerKeyAvailability = Exclude<PowerAvailability['kind'], 'notEquipped'>;

export interface PowerKeyText {
  readonly power: PowerKind;
  readonly cost: number;
  readonly availability: PowerKeyAvailability;
  readonly missing: number;
  readonly instant?: true;
  /** Un pouvoir attisé (#237), à `cost` au lieu de `baseCost`. */
  readonly kindled?: true;
  readonly baseCost?: number;
}

/**
 * L'état d'une ligne de la liste des pouvoirs, en mot, sur une ligne (#271) : « Prêt », « Il manque
 * 1 Élan », « Actif », « Instantané déjà lancé » ou « Utilisé ce combat ».
 */
export function powerStateText({
  availability,
  missing,
}: Pick<PowerKeyText, 'availability' | 'missing'>): string {
  switch (availability) {
    case 'available':
      return 'Prêt';
    case 'missing':
      return `Il manque ${missing} Élan`;
    case 'active':
      return 'Actif';
    case 'instantUsed':
      return 'Instantané déjà lancé';
    case 'usedThisBattle':
      return 'Utilisé ce combat';
  }
}

/** Le compte de la touche « Pouvoirs » (#271) : « 3 prêts sur 3 », « 1 prêt sur 3 ». */
export function readyCountText(ready: number, total: number): string {
  return `${ready} ${ready > 1 ? 'prêts' : 'prêt'} sur ${total}`;
}

/**
 * Le libellé lu de la touche « Pouvoirs » (#271, KB1) : « Pouvoirs, 3 prêts sur 3, menu ». « replié »
 * et « bouton » viennent de son état (`expanded`) et de son rôle.
 */
export function powersKeyLabel(ready: number, total: number): string {
  return `Pouvoirs, ${readyCountText(ready, total)}, menu`;
}

/** La raison d'une touche indisponible, sur une ou deux lignes ; rien pour une touche disponible. */
export function powerKeyReason({
  availability,
  missing,
}: Pick<PowerKeyText, 'availability' | 'missing'>): readonly string[] {
  switch (availability) {
    case 'missing':
      return ['Il manque', `${missing} Élan`];
    case 'active':
      return ['Actif'];
    case 'instantUsed':
      return ['Instantané', 'déjà lancé'];
    case 'usedThisBattle':
      return ['Utilisé', 'ce combat'];
    case 'available':
      return [];
  }
}

const UNAVAILABLE_READ: Readonly<Record<PowerKeyAvailability, (missing: number) => string>> = {
  available: () => '',
  active: () => ', actif',
  missing: (missing) => `, indisponible : il manque ${missing} Élan`,
  instantUsed: () => ', indisponible : un pouvoir instantané a déjà été lancé dans cette phase',
  usedThisBattle: () => ', indisponible : déjà utilisé dans ce combat',
};

/** Le libellé lu d'une touche de pouvoir (section 7) ; l'effet est dans l'indice. */
export function powerKeyLabel({
  power,
  cost,
  availability,
  missing,
  instant,
  kindled,
  baseCost,
}: PowerKeyText): string {
  const price = kindled ? `attisé, ${cost} Élan au lieu de ${baseCost}` : `${cost} Élan`;
  const head = `Pouvoir : ${TREE_POWER_NAMES[power]}, ${price}${instant ? ', instantané' : ''}`;
  return head + UNAVAILABLE_READ[availability](missing);
}

/** Sous « Frapper », une frappe de pouvoir (#236, K13) : « Rafale · 4 coups », ou son nom seul. */
export function strikePowerLine(power: PowerKind, hits: number): string {
  return hits > 1 ? `${TREE_POWER_NAMES[power]} · ${hits} coups` : TREE_POWER_NAMES[power];
}

/** Le libellé lu de « Frapper » : seul pour « Attaquer », avec la frappe de pouvoir et le coup sinon. */
export function strikeKeyLabel(power: PowerKind | undefined, hits: number, hit: number): string {
  if (power === undefined) return 'Frapper';
  const name = TREE_POWER_NAMES[power];
  return hits > 1 ? `Frapper, ${name}, coup ${hit} sur ${hits}` : `Frapper, ${name}`;
}

/** Le panneau des pouvoirs équipés (#236, H4) : « L'Errante · dans l'ordre de l'arbre ». */
export function panelHeading(hero: HeroKind): string {
  return `${HERO_OF[hero].name} · dans l'ordre de l'arbre`;
}

/** Plein, un 4e pouvoir est refusé (#236, H5). */
export function fullSlotsBand(power: PowerKind): string {
  return `3 sur 3 : retire d'abord un pouvoir pour équiper ${TREE_POWER_NAMES[power]}.`;
}

/** « Valider » attend les places qui restent (#236, H6). */
export function missingChoiceText(missing: number): string {
  return `Choisis encore ${missing} pouvoir${missing > 1 ? 's' : ''}`;
}

/** « Changer les pouvoirs » et le nombre de pouvoirs à soi (#236, H3). */
export function changePowersLabel(owned: number): string {
  return `Changer les pouvoirs, ${owned} débloqués`;
}

/** L'annonce du nouveau choix (#236, H7) : « 3 pouvoirs équipés : Entaille, Rafale, Brume. » */
export function equippedAnnouncement(powers: readonly PowerKind[]): string {
  const count = `${powers.length} ${powers.length > 1 ? 'pouvoirs équipés' : 'pouvoir équipé'}`;
  return `${count} : ${powers.map((power) => TREE_POWER_NAMES[power]).join(', ')}.`;
}

/** L'échec de l'enregistrement du choix au lancement (#236) : rien n'est perdu. */
export const LAUNCH_ERROR =
  "Tes pouvoirs n'ont pas pu être enregistrés. Ton choix est gardé : réessaie.";
