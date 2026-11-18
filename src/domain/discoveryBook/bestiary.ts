/**
 * Le Bestiaire (`Bestiary`, #282) : la partie du carnet des ennemis, Élites et boss compris, par
 * palier. Son catalogue (`BESTIARY_CATALOG`, D3) vient des paliers de la tour (`TIERS`), sans donnée
 * recopiée : un ennemi ajouté au jeu y entre « ??? » (C1, C4), un ennemi retiré en sort (C5). Toutes
 * les lectures reçoivent le catalogue, pour éprouver C4 et C5 sur un catalogue fictif.
 */
import { TIERS, type Tier } from '../ascent/tiers';
import type { EnemyKind } from '../battle/combatants';
import type { BookContents, DiscoveryBook, EntryState } from './DiscoveryBook';

/** La catégorie d'une entrée, celle de sa fiche du Codex (B15). */
export type EntryCategory = 'enemy' | 'elite' | 'boss';

/** Les entrées d'un palier, par catégorie, dans l'ordre de `TIERS`. */
export interface BestiaryTierCatalog {
  readonly enemies: readonly EnemyKind[];
  readonly elites: readonly EnemyKind[];
  readonly bosses: readonly EnemyKind[];
}

/** Le catalogue du Bestiaire (`BestiaryCatalog`) : ses entrées, palier par palier. */
export type BestiaryCatalog = Readonly<Record<Tier, BestiaryTierCatalog>>;

const TIER_LIST: readonly Tier[] = [1, 2, 3];

/** Le catalogue du Bestiaire du jeu installé, tiré des paliers de la tour. */
export const BESTIARY_CATALOG: BestiaryCatalog = {
  1: catalogOf(1),
  2: catalogOf(2),
  3: catalogOf(3),
};

function catalogOf(tier: Tier): BestiaryTierCatalog {
  const { enemies, elites, bosses } = TIERS[tier];
  return { enemies: enemies.map(({ kind }) => kind), elites, bosses };
}

const SECTIONS: readonly [EntryCategory, keyof BestiaryTierCatalog][] = [
  ['enemy', 'enemies'],
  ['elite', 'elites'],
  ['boss', 'bosses'],
];

/** Les noms de code du catalogue, palier par palier, catégorie par catégorie. */
export function catalogKinds(catalog: BestiaryCatalog): EnemyKind[] {
  return TIER_LIST.flatMap((tier) => SECTIONS.flatMap(([, key]) => catalog[tier][key]));
}

/** Les entrées présentes dans le jeu installé, pour le compteur du carnet (B17). */
export function bookContents(catalog: BestiaryCatalog = BESTIARY_CATALOG): BookContents {
  return { bestiary: catalogKinds(catalog) };
}

/** Une entrée du Bestiaire (`BestiaryEntry`) telle que l'écran la montre. */
export interface BestiaryEntry {
  readonly kind: EnemyKind;
  readonly tier: Tier;
  readonly category: EntryCategory;
  readonly state: EntryState;
  readonly isNew: boolean;
}

/** Une section d'un palier (Ennemis, Élites, Boss) : ses entrées et ses pages remplies. */
export interface BestiarySection {
  readonly category: EntryCategory;
  readonly entries: readonly BestiaryEntry[];
  readonly filled: number;
  readonly total: number;
}

/**
 * Un palier du Bestiaire : ses sections, ses pages remplies (les entrées vaincues, C2), ses entrées
 * rencontrées (la barre hachurée), s'il a une entrée nouvelle (losange d'or) et s'il est complet.
 */
export interface BestiaryTier {
  readonly tier: Tier;
  readonly sections: readonly BestiarySection[];
  readonly filled: number;
  readonly encountered: number;
  readonly total: number;
  readonly isNew: boolean;
  readonly complete: boolean;
}

/**
 * La lecture du Bestiaire : ses paliers, ses pages remplies sur toutes ses entrées, et la première
 * utilisation (aucune page remplie : le bandeau, sans clé stockée).
 */
export interface Bestiary {
  readonly tiers: readonly BestiaryTier[];
  readonly filled: number;
  readonly total: number;
  readonly firstUse: boolean;
}

const count = (entries: readonly BestiaryEntry[], state: EntryState) =>
  entries.filter((entry) => entry.state === state).length;

function readTier(book: DiscoveryBook, tier: Tier, catalog: BestiaryTierCatalog): BestiaryTier {
  const sections = SECTIONS.map(([category, key]): BestiarySection => {
    const entries = catalog[key].map((kind): BestiaryEntry => {
      const record = book.enemies[kind];
      return {
        kind,
        tier,
        category,
        state: record?.state ?? 'unknown',
        isNew: record?.isNew === true,
      };
    });
    return { category, entries, filled: count(entries, 'defeated'), total: entries.length };
  });
  const entries = sections.flatMap((section) => section.entries);
  const filled = count(entries, 'defeated');
  return {
    tier,
    sections,
    filled,
    encountered: count(entries, 'encountered'),
    total: entries.length,
    isNew: entries.some((entry) => entry.isNew),
    complete: entries.length > 0 && filled === entries.length,
  };
}

/** Le Bestiaire du carnet `book`, d'après le catalogue du jeu installé (C1 à C5). */
export function bestiary(
  book: DiscoveryBook,
  catalog: BestiaryCatalog = BESTIARY_CATALOG,
): Bestiary {
  const tiers = TIER_LIST.map((tier) => readTier(book, tier, catalog[tier]));
  const filled = tiers.reduce((sum, tier) => sum + tier.filled, 0);
  return {
    tiers,
    filled,
    total: tiers.reduce((sum, tier) => sum + tier.total, 0),
    firstUse: filled === 0,
  };
}

/**
 * Le palier montré à l'ouverture du carnet (D8) : celui de l'ascension en cours, sinon celui du
 * dernier combat d'étage commencé, sinon le palier 1.
 */
export function openingTier(current: Tier | null, lastTier: Tier | null): Tier {
  return current ?? lastTier ?? 1;
}
