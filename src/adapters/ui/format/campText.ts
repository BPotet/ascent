import { EMBER_HEART_CHANCE } from '../../../domain/ascent/boons';
import { unlockRarity, type UnlockState } from '../../../domain/ascent/camp';
import { ITEMS } from '../../../domain/ascent/items';
import type { Rarity } from '../../../domain/ascent/rarity';
import type { Tier } from '../../../domain/ascent/tiers';
import type { Unlock } from '../../../domain/ascent/unlocks';
import { itemEffectLine, itemName, shardText, slotName } from './ascentText';
import { boonCard } from './boonText';
import { rarityMarks, rarityName } from './rarityText';

/** Les textes du camp (#40), tirés de la maquette `docs/mockups/40-camp/` et du glossaire. */
export const CAMP_TITLE = 'Le camp';
export const FLAME_KEEPER_NAME = 'Le Gardien de la flamme';
export const CAMP_BACK_LABEL = 'Retour au pied de la tour';
export const UNLOCKS_HEADING = 'Déblocages';
export const UNLOCKED_STAMP = 'Déjà dans la tour';
export const NEXT_ASCENT_STAMP = 'Dès ta prochaine ascension';
export const ALL_UNLOCKED_BAND = 'Tous les déblocages du Gardien sont dans la tour.';
export const SHEET_ERROR = "Le déblocage n'a pas pu être enregistré. Tes Éclats sont intacts.";
export const RETRY = 'Réessayer';

/** Les phrases du Gardien de la flamme. */
export const KEEPER_LINES = {
  first:
    "Approche. Rapporte-moi des Éclats de la tour : je les change en ce qu'elle te donnera ensuite.",
  usual: 'Ce que tu prends ici, tu le trouveras là-haut.',
  after: "Ce qui brûle ici t'attend là-haut.",
  run: "Ton ascension n'est pas finie. Ce que tu prends ici t'attendra à la prochaine.",
  done: "Tout ce que j'avais brûle déjà dans la tour. Garde tes Éclats.",
} as const;

/**
 * La phrase du Gardien : tout débloqué, juste après un achat, la première visite (rien gagné ni
 * débloqué), pendant une ascension, ou d'habitude.
 */
export function keeperLine({
  firstVisit,
  allUnlocked,
  ascentInProgress,
  bought,
}: {
  readonly firstVisit: boolean;
  readonly allUnlocked: boolean;
  readonly ascentInProgress: boolean;
  readonly bought: boolean;
}): string {
  if (allUnlocked) return KEEPER_LINES.done;
  if (bought) return KEEPER_LINES.after;
  if (firstVisit) return KEEPER_LINES.first;
  return ascentInProgress ? KEEPER_LINES.run : KEEPER_LINES.usual;
}

/** La règle sous la phrase du Gardien : d'où viennent les Éclats à la première visite. */
export function keeperRule(firstVisit: boolean): string {
  return firstVisit
    ? 'Les Éclats se gagnent en battant une Élite (2) et un boss (8, 12, 18), et au Sommet (10). Tu les gardes, même si tu tombes.'
    : 'Un déblocage est pour toujours : il rejoint la tour dès ta prochaine ascension.';
}

/** « 62 Éclats disponibles », « 0 Éclat disponible ». */
export function availableShardsText(shards: number): string {
  return `${shardText(shards)} ${shards > 1 ? 'disponibles' : 'disponible'}`;
}

/** Ce que lit le lecteur d'écran sur le solde : « 62 Éclats disponibles : 82 gagnés, 20 dépensés ». */
export function purseLabel(available: number, total: number): string {
  return `${availableShardsText(available)} : ${total} gagnés, ${total - available} dépensés`;
}

/** Le bandeau bleu de l'ascension en cours (C7). */
export function runBand({ tier, floor }: { readonly tier: Tier; readonly floor: number }): string {
  return `Ascension en cours · Palier ${tier}, étage ${floor}. Ce que tu débloques maintenant n'entre pas dans cette ascension.`;
}

/** Une carte du catalogue : nom, type et rareté, effet, condition d'apparition. */
export interface UnlockCard {
  readonly name: string;
  /** « ◆ Arme · Commun ». */
  readonly tag: string;
  readonly effect: string;
  readonly note: string | null;
  readonly rarity: Rarity;
  /** Le mot lu : « arme », « accessoire », « bienfait ». */
  readonly kind: string;
}

/** Le nom avec son article : « l'Épieu de chasse », « la Clochette du guet ». */
const WITH_ARTICLE: Readonly<Record<Unlock, string>> = {
  huntingSpear: "l'Épieu de chasse",
  watchBell: 'la Clochette du guet',
  emberHeart: 'le Cœur de braise',
  flamberge: 'la Flamberge',
};

const NOTES: Readonly<Record<Unlock, string | null>> = {
  huntingSpear: null,
  watchBell: null,
  emberHeart: `Bienfait. Proposé après une Élite (${EMBER_HEART_CHANCE} %), une fois par ascension.`,
  flamberge: 'Seulement sur une Élite.',
};

export function unlockCard(unlock: Unlock): UnlockCard {
  const rarity = unlockRarity(unlock);
  const note = NOTES[unlock];
  if (unlock === 'emberHeart') {
    const boon = boonCard(unlock);
    return { name: boon.name, tag: boon.tag, effect: boon.effect, note, rarity, kind: 'bienfait' };
  }
  const slot = slotName(ITEMS[unlock].slot);
  return {
    name: itemName(unlock),
    tag: `${rarityMarks(rarity)} ${slot} · ${rarityName(rarity)}`,
    effect: itemEffectLine(unlock),
    note,
    rarity,
    kind: slot.toLowerCase(),
  };
}

/** « Il manque 18 Éclats ». */
export function missingText(missing: number): string {
  return `Il manque ${shardText(missing)}`;
}

function stateText(state: UnlockState, price: number): string {
  switch (state.kind) {
    case 'unlocked':
      return `${UNLOCKED_STAMP}.`;
    case 'nextAscent':
      return `${NEXT_ASCENT_STAMP}.`;
    case 'affordable':
      return `${shardText(price)}.`;
    case 'missing':
      return `${missingText(state.missing)}.`;
  }
}

/** Une carte lue d'un trait : nom, type, rareté, effet, condition, puis état. */
export function cardLabel(card: UnlockCard, state: UnlockState, price: number): string {
  const effect = card.effect.replaceAll(' · ', ', ');
  const sentence = /[.!?]$/.test(effect) ? effect : `${effect}.`;
  const parts = [
    `${card.name}, ${card.kind}, ${rarityName(card.rarity)}.`,
    sentence,
    ...(card.note === null ? [] : [card.note]),
    stateText(state, price),
  ];
  return parts.join(' ');
}

/** Le libellé lu du bouton « Débloquer · 40 ». */
export function buyLabel(card: UnlockCard, price: number): string {
  return `Débloquer ${card.name}, ${shardText(price)}`;
}

/** Le libellé lu d'un bouton éteint : il garde le prix et dit pourquoi. */
export function missingLabel(card: UnlockCard, price: number, missing: number): string {
  return `${card.name}, ${shardText(price)}, il manque ${shardText(missing)}.`;
}

/** Le titre de la feuille de confirmation : « Débloquer la Clochette du guet ? ». */
export function sheetTitle(unlock: Unlock): string {
  return `Débloquer ${WITH_ARTICLE[unlock]} ?`;
}

/** Le bouton d'or de la feuille : « Débloquer pour 40 Éclats ». */
export function confirmText(price: number): string {
  return `Débloquer pour ${shardText(price)}`;
}

/** Quand le déblocage entre dans la tour, sous le prix. */
export function sheetLine(ascentInProgress: boolean): string {
  return ascentInProgress
    ? "Dès ta prochaine ascension. L'ascension en cours ne change pas."
    : 'Il rejoint la tour dès ta prochaine ascension, pour toujours.';
}

const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Le message de l'achat, 4 s : « La Clochette du guet est dans la tour. ». */
export function unlockedToast(unlock: Unlock, nextAscent: boolean): string {
  const name = capitalized(WITH_ARTICLE[unlock]);
  return nextAscent ? `${name} t'attend à ta prochaine ascension.` : `${name} est dans la tour.`;
}

/** L'annonce polie de l'achat. */
export function unlockedAnnouncement(
  unlock: Unlock,
  available: number,
  nextAscent: boolean,
): string {
  const name = unlockCard(unlock).name;
  const next = nextAscent ? ` ${NEXT_ASCENT_STAMP}.` : '';
  return `Déblocage réussi : ${name}.${next} ${availableShardsText(available)}.`;
}
