/**
 * Le carnet de découvertes (`DiscoveryBook`, #282, ADR 0030) : une entrée par nom de code, jamais
 * par individu. Le Bestiaire retient l'état de chaque ennemi rencontré ou vaincu ; **inconnu** n'est
 * jamais enregistré, c'est l'absence d'entrée (un ennemi ajouté au jeu arrive donc « ??? », sans
 * « nouveau », C4). Les Objets (#284) ont leur place dès la version 1, vide.
 *
 * Le carnet est monotone (G1) : un état ne descend jamais ; enregistrer deux fois la même découverte
 * revient à l'enregistrer une fois (G3). Une entrée dont l'état monte est marquée « nouveau » (B16),
 * une seule marque, jusqu'à la sortie du carnet. Il ne donne aucune récompense (G5) et ne lit rien
 * du héros, de la jauge ni des habitudes (G4).
 */
import type { ItemKind } from '../ascent/items';
import type { Tier } from '../ascent/tiers';
import type { EnemyKind } from '../battle/combatants';

/** L'état enregistré d'une entrée du Bestiaire : rencontré, puis vaincu. */
export type BestiaryState = 'encountered' | 'defeated';

/** L'état d'une entrée du Bestiaire, inconnu compris (B1 à B15). */
export type EntryState = 'unknown' | BestiaryState;

/** Une entrée du Bestiaire enregistrée ; #283 y ajoutera `pageSeen?: true`, sans changer de version. */
export interface BestiaryRecord {
  readonly state: BestiaryState;
  readonly isNew?: true;
}

/** Une entrée des Objets enregistrée (#284) : un objet découvert. */
export interface ItemRecord {
  readonly state: 'discovered';
  readonly isNew?: true;
}

/**
 * Le carnet : le palier du dernier combat d'étage commencé (D8), puis les entrées par nom de code.
 * Les clés sont des `string` : le nom de code d'un ennemi retiré du jeu est gardé (C5).
 */
export interface DiscoveryBook {
  readonly lastTier: Tier | null;
  readonly enemies: Readonly<Record<string, BestiaryRecord>>;
  readonly items: Readonly<Record<string, ItemRecord>>;
}

/** Une découverte (`Discovery`) : une entrée du Bestiaire qui atteint un état. */
export interface Discovery {
  readonly kind: EnemyKind;
  readonly state: BestiaryState;
}

/**
 * Les entrées présentes dans le jeu installé, par famille : les noms de code du Bestiaire et, avec
 * #284, ceux des Objets. Seules ces entrées comptent (C1, C5).
 */
export interface BookContents {
  readonly bestiary: readonly string[];
  readonly items?: readonly string[];
}

/** Le carnet vide : le carnet démarre ainsi à la mise à jour (décision du 12/11/2026). */
export const EMPTY_DISCOVERY_BOOK: DiscoveryBook = { lastTier: null, enemies: {}, items: {} };

/** Le rang de chaque état : inconnu < rencontré < vaincu ; un objet découvert n'a qu'un état. */
const RANK: Readonly<Record<EntryState | ItemRecord['state'], number>> = {
  unknown: 0,
  encountered: 1,
  defeated: 2,
  discovered: 1,
};

/**
 * Enregistre `discoveries`, dans leur ordre : une entrée ne monte que si son rang monte (G1), et
 * chaque montée la marque « nouveau » (une seule marque, B16). Les montées (`rises`) sont rendues
 * dans l'ordre ; quand rien ne monte, le même carnet est rendu (rien à écrire).
 */
export function recordDiscoveries(
  book: DiscoveryBook,
  discoveries: readonly Discovery[],
): { readonly book: DiscoveryBook; readonly rises: readonly Discovery[] } {
  const enemies: Record<string, BestiaryRecord> = { ...book.enemies };
  const rises: Discovery[] = [];
  for (const discovery of discoveries) {
    const current = enemies[discovery.kind]?.state ?? 'unknown';
    if (RANK[discovery.state] <= RANK[current]) continue;
    enemies[discovery.kind] = { state: discovery.state, isNew: true };
    rises.push(discovery);
  }
  return { book: rises.length === 0 ? book : { ...book, enemies }, rises };
}

/** Le palier du combat d'étage qui commence (D8) ; le même carnet s'il ne change pas. */
export function noteTier(book: DiscoveryBook, tier: Tier): DiscoveryBook {
  return book.lastTier === tier ? book : { ...book, lastTier: tier };
}

/**
 * Le plus haut des deux enregistrements, avec sa marque ; à état égal, l'enregistrement stocké
 * (`stored`) : une entrée ne prend « nouveau » que si son état monte par rapport à lui (#293).
 */
function higher<Entry extends BestiaryRecord | ItemRecord>(
  stored: Entry | undefined,
  newer: Entry | undefined,
): Entry {
  if (stored === undefined) return newer!;
  if (newer === undefined) return stored;
  return RANK[newer.state] > RANK[stored.state] ? newer : stored;
}

function mergeRecords<Entry extends BestiaryRecord | ItemRecord>(
  stored: Readonly<Record<string, Entry>>,
  newer: Readonly<Record<string, Entry>>,
): Record<string, Entry> {
  const keys = new Set([...Object.keys(stored), ...Object.keys(newer)]);
  return Object.fromEntries([...keys].map((key) => [key, higher(stored[key], newer[key])]));
}

/**
 * La fusion d'un carnet stocké et d'un carnet plus récent (D7) : le plus haut état de chaque entrée,
 * avec la marque de l'enregistrement qui le tient ; à état égal, celui du carnet stocké, donc une
 * entrée ne prend « nouveau » que si son état monte (#293). Le dernier palier est celui du plus
 * récent, s'il en a un.
 */
export function mergeBooks(stored: DiscoveryBook, newer: DiscoveryBook): DiscoveryBook {
  return {
    lastTier: newer.lastTier ?? stored.lastTier,
    enemies: mergeRecords(stored.enemies, newer.enemies),
    items: mergeRecords(stored.items, newer.items),
  };
}

function withoutMarks<Entry extends BestiaryRecord | ItemRecord>(
  records: Readonly<Record<string, Entry>>,
): Readonly<Record<string, Entry>> {
  if (!Object.values(records).some((record) => record.isNew === true)) return records;
  return Object.fromEntries(
    Object.entries(records).map(([key, { isNew: _, ...record }]) => [key, record as Entry]),
  );
}

/**
 * La sortie du carnet (B16) : toutes les marques « nouveau » s'effacent, Bestiaire et Objets ; le
 * même carnet quand aucune n'y est.
 */
export function clearNewMarks(book: DiscoveryBook): DiscoveryBook {
  const enemies = withoutMarks(book.enemies);
  const items = withoutMarks(book.items);
  return enemies === book.enemies && items === book.items ? book : { ...book, enemies, items };
}

/**
 * Le compteur du carnet (`newEntryCount`, B17) : les entrées marquées « nouveau » présentes dans le
 * jeu installé (`contents`), Bestiaire et Objets réunis. Une entrée retirée du jeu ne compte pas.
 */
export function newEntryCount(book: DiscoveryBook, contents: BookContents): number {
  const marked = (
    records: Readonly<Record<string, BestiaryRecord | ItemRecord>>,
    keys: readonly string[],
  ) => keys.filter((key) => records[key]?.isNew === true).length;
  return marked(book.enemies, contents.bestiary) + marked(book.items, contents.items ?? []);
}

/** La version du format stocké du carnet (clé `discoveryBook`, D5). */
export const DISCOVERY_BOOK_VERSION = 1;

/** Le carnet tel qu'il est stocké, en JSON. */
export function serializeDiscoveryBook(book: DiscoveryBook): string {
  return JSON.stringify({ version: DISCOVERY_BOOK_VERSION, ...book });
}

const isObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Les enregistrements lus de `value`, ou `null` si l'un d'eux est illisible. */
function readRecords<Entry extends BestiaryRecord | ItemRecord>(
  value: unknown,
  states: readonly string[],
): Record<string, Entry> | null {
  if (!isObject(value)) return null;
  const records: Record<string, Entry> = {};
  for (const [key, record] of Object.entries(value)) {
    if (!isObject(record) || !states.includes(record.state as string)) return null;
    if (record.isNew !== undefined && record.isNew !== true) return null;
    records[key] = {
      state: record.state,
      ...(record.isNew === true && { isNew: true }),
    } as Entry;
  }
  return records;
}

/**
 * Le carnet stocké : rien de stocké est le carnet vide ; une valeur illisible (JSON invalide, version
 * ou palier inconnu, état inconnu) le dit, et le carnet repart vide (D5). Un nom de code inconnu du
 * jeu est gardé (C5) ; un carnet sans Objets se lit sans objet.
 */
export function parseDiscoveryBook(raw: string | null): {
  readonly book: DiscoveryBook;
  readonly unreadable: boolean;
} {
  if (raw === null) return { book: EMPTY_DISCOVERY_BOOK, unreadable: false };
  const unreadable = { book: EMPTY_DISCOVERY_BOOK, unreadable: true };
  let stored: unknown;
  try {
    stored = JSON.parse(raw);
  } catch {
    return unreadable;
  }
  if (!isObject(stored) || stored.version !== DISCOVERY_BOOK_VERSION) return unreadable;
  const lastTier = stored.lastTier ?? null;
  if (lastTier !== null && lastTier !== 1 && lastTier !== 2 && lastTier !== 3) return unreadable;
  const enemies = readRecords<BestiaryRecord>(stored.enemies, ['encountered', 'defeated']);
  const items = readRecords<ItemRecord>(stored.items ?? {}, ['discovered']);
  if (enemies === null || items === null) return unreadable;
  return { book: { lastTier, enemies, items }, unreadable: false };
}

/**
 * Enregistre les objets découverts (`items`, #284, D2), dans leur ordre, avec les règles de
 * `recordDiscoveries` : une entrée ne monte que d'inconnu à découvert (G1), chaque montée la marque
 * « nouveau » (une seule marque, B16). Les montées sont rendues dans l'ordre ; quand rien ne monte,
 * le même carnet est rendu (rien à écrire). Un objet ne produit pas de `Discovery`.
 */
export function recordItemDiscoveries(
  book: DiscoveryBook,
  items: readonly ItemKind[],
): { readonly book: DiscoveryBook; readonly rises: readonly ItemKind[] } {
  const records: Record<string, ItemRecord> = { ...book.items };
  const rises: ItemKind[] = [];
  for (const item of items) {
    if (records[item] !== undefined) continue;
    records[item] = { state: 'discovered', isNew: true };
    rises.push(item);
  }
  return { book: rises.length === 0 ? book : { ...book, items: records }, rises };
}
