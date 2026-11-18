import type { EnemyKind } from '../../../domain/battle/combatants';
import type {
  BestiaryEntry,
  BestiaryTier,
  EntryCategory,
} from '../../../domain/discoveryBook/bestiary';
import { TIER_NAMES } from './ascentText';
import { ENEMY_NAMES, agreed } from './battleText';

/**
 * Les textes du carnet de découvertes (#282), tirés de la maquette
 * `docs/mockups/278-carnet-de-decouvertes/` et du glossaire : « ennemi » partout, jamais
 * « monstre ».
 */
export const BOOK_TITLE = 'Le carnet';
export const BOOK_BACK_LABEL = 'Retour au pied de la tour';
export const BESTIARY_TITLE = 'Bestiaire';
export const FIRST_USE_BAND =
  "Ton carnet commence aujourd'hui. Chaque ennemi que tu croises dans la tour s'y inscrit ; vaincs-le pour remplir sa page.";
export const BOOK_LOADING = 'Chargement du carnet';
export const BOOK_ERROR_TITLE = "Le carnet n'a pas pu s'ouvrir";
export const BOOK_ERROR_TEXT =
  "Tes découvertes sont gardées sur ce téléphone : rien n'est perdu. Réessaie dans un instant.";
export const BOOK_ERROR_ALERT =
  "Le carnet n'a pas pu s'ouvrir. Tes découvertes ne sont pas perdues.";
export const BOOK_RETRY = 'Réessayer';
export const NEW_TAG = 'nouveau';
export const UNKNOWN_NAME = '???';
export const TIER_COMPLETE = 'Toutes les pages du palier sont remplies.';
export const TIER_NEVER_SEEN = 'Aucun ennemi de ce palier n’a encore été vu.';

/** Le titre de chaque section d'un palier. */
export const SECTION_TITLES: Readonly<Record<EntryCategory, string>> = {
  enemy: 'Ennemis',
  elite: 'Élites',
  boss: 'Boss',
};

const plural = (count: number, word: string) => `${word}${count > 1 ? 's' : ''}`;

/** « Le carnet », avec le compteur du carnet : « Le carnet, 3 nouvelles pages » (T1 à T3). */
export function bookButtonLabel(newEntries: number): string {
  if (newEntries === 0) return BOOK_TITLE;
  return `${BOOK_TITLE}, ${newEntries} ${plural(newEntries, 'nouvelle')} ${plural(newEntries, 'page')}`;
}

/** Le sous-titre du carnet : le total des découvertes, « 14 découvertes sur 37 ». */
export function bookSubtitle(filled: number, total: number): string {
  return `${filled} ${plural(filled, 'découverte')} sur ${total}`;
}

/** Au-delà de ce nombre de noms, la ligne du carnet finit par « … et n autres » (D2). */
const LINE_NAMES = 3;

const others = (count: number) => `${count} ${plural(count, 'autre')}`;

/**
 * La ligne du carnet (B19, maquette D1 et D2) : « Nouvelle page : Embrasé », ou leur nombre puis
 * les noms, dans l'ordre des chutes ; au-delà de 3 noms, « … et n autres ». `names` est en or.
 */
export function bookLine(kinds: readonly EnemyKind[]): {
  readonly lead: string;
  readonly names: string;
} {
  const names = kinds.slice(0, LINE_NAMES).map((kind) => ENEMY_NAMES[kind]);
  const rest = kinds.length - names.length;
  return {
    lead: kinds.length === 1 ? 'Nouvelle page : ' : `${kinds.length} nouvelles pages : `,
    names: `${names.join(', ')}${rest > 0 ? ` … et ${others(rest)}` : ''}`,
  };
}

/** Une liste lue : « A, B et C ». */
function spoken(words: readonly string[]): string {
  return `${words.slice(0, -1).join(', ')} et ${words.at(-1)}`;
}

/** L'annonce polie de la ligne du carnet : « Carnet : 3 nouvelles pages, A, B et C. » */
export function bookLineAnnouncement(kinds: readonly EnemyKind[]): string {
  const names = kinds.slice(0, LINE_NAMES).map((kind) => ENEMY_NAMES[kind]);
  const rest = kinds.length - names.length;
  if (kinds.length === 1) return `Carnet : nouvelle page, ${names[0]}.`;
  const listed = rest > 0 ? `${names.join(', ')} et ${others(rest)}` : spoken(names);
  return `Carnet : ${kinds.length} nouvelles pages, ${listed}.`;
}

/** L'état d'une entrée en un mot : « Vaincue », « Rencontré », « Jamais vu ». */
export function entryStatus(entry: BestiaryEntry): string {
  if (entry.state === 'unknown') return 'Jamais vu';
  const word = agreed(entry.kind, entry.state === 'defeated' ? 'vaincu' : 'rencontré');
  return word.charAt(0).toUpperCase() + word.slice(1);
}

const CATEGORY_NAMES: Readonly<Record<EntryCategory, string>> = {
  enemy: 'Ennemi',
  elite: 'Élite',
  boss: 'Boss',
};

/**
 * La lecture d'une entrée (maquette, « Lecteur d'écran ») : « Goule, vaincue », « Mère-ronce,
 * Élite, rencontrée, pas encore vaincue », « Élite inconnue, Palier 2 » ; « nouveau » à la fin.
 */
export function entryLabel(entry: BestiaryEntry): string {
  const category = CATEGORY_NAMES[entry.category];
  if (entry.state === 'unknown') {
    return `${category} ${entry.category === 'elite' ? 'inconnue' : 'inconnu'}, Palier ${entry.tier}`;
  }
  const words = [ENEMY_NAMES[entry.kind]];
  if (entry.category !== 'enemy') words.push(category);
  const defeated = agreed(entry.kind, 'vaincu');
  words.push(
    entry.state === 'defeated'
      ? defeated
      : `${agreed(entry.kind, 'rencontré')}, pas encore ${defeated}`,
  );
  if (entry.isNew) words.push(NEW_TAG);
  return words.join(', ');
}

/** La lecture d'une entrée qui ouvre sa page (#283) : « Embrasé, vaincu, nouveau. Ouvrir sa page ». */
export function openEntryLabel(entry: BestiaryEntry): string {
  return `${entryLabel(entry)}. Ouvrir sa page`;
}

/** Le nom d'un palier dans une phrase : « les Catacombes ». */
function tierInSentence(tier: BestiaryTier['tier']): string {
  const name = TIER_NAMES[tier];
  return name.charAt(0).toLowerCase() + name.slice(1);
}

const pages = (filled: number) =>
  `${filled} ${plural(filled, 'page')} ${plural(filled, 'remplie')}`;

/** La lecture d'une puce de palier : « Palier 2, les Jardins de cendre, 5 pages remplies sur 12, nouveau ». */
export function tierChipLabel(tier: BestiaryTier): string {
  const words = [
    `Palier ${tier.tier}`,
    tierInSentence(tier.tier),
    `${pages(tier.filled)} sur ${tier.total}`,
  ];
  if (tier.isNew) words.push(NEW_TAG);
  if (tier.complete) words.push('complet');
  return words.join(', ');
}

/**
 * La ligne sous le cadre d'un palier : complet, jamais vu, ou ce qui reste : « 2 rencontrés, pas
 * encore vaincus · 1 jamais vu ».
 */
export function tierSummary(tier: BestiaryTier): string {
  if (tier.complete) return TIER_COMPLETE;
  if (tier.filled === 0 && tier.encountered === 0) return TIER_NEVER_SEEN;
  const unknown = tier.total - tier.filled - tier.encountered;
  const parts: string[] = [];
  if (tier.encountered > 0) {
    const met = tier.encountered;
    parts.push(`${met} ${plural(met, 'rencontré')}, pas encore ${plural(met, 'vaincu')}`);
  }
  if (unknown > 0) parts.push(`${unknown} jamais ${plural(unknown, 'vu')}`);
  return parts.join(' · ');
}

/** La lecture du cadre d'un palier : son nom, ses pages remplies, puis sa ligne. */
export function tierSummaryLabel(tier: BestiaryTier): string {
  return `${TIER_NAMES[tier.tier]} : ${pages(tier.filled)} sur ${tier.total}. ${tierSummary(tier)}`;
}
