import type { ItemKind } from '../../domain/ascent/items';
import type { Tier } from '../../domain/ascent/tiers';
import type { Battle } from '../../domain/battle/Battle';
import type { BattleEvent } from '../../domain/battle/BattleEvent';
import { battleDiscoveries } from '../../domain/discoveryBook/battleDiscoveries';
import {
  BESTIARY_CATALOG,
  bestiary,
  catalogKinds,
  type Bestiary,
  type BestiaryCatalog,
} from '../../domain/discoveryBook/bestiary';
import {
  ITEM_CATALOG,
  bookItems,
  type BookItems,
  type ItemCatalog,
} from '../../domain/discoveryBook/bookItems';
import {
  EMPTY_DISCOVERY_BOOK,
  clearNewMarks,
  mergeBooks,
  newEntryCount,
  noteTier,
  parseDiscoveryBook,
  recordDiscoveries,
  recordItemDiscoveries,
  serializeDiscoveryBook,
  type DiscoveryBook,
  type Discovery,
} from '../../domain/discoveryBook/DiscoveryBook';
import type { KeyValueStore } from '../ports/KeyValueStore';

/** La clé du carnet de découvertes (#282, ADR 0030) : jamais effacée par l'application. */
export const DISCOVERY_BOOK_KEY = 'discoveryBook';
/** La copie d'un carnet illisible, gardée avant que le carnet reparte vide. */
export const UNREADABLE_DISCOVERY_BOOK_KEY = 'discoveryBook.unreadable';

/**
 * Le carnet affiché : en lecture, en échec de lecture (B8), ou lu, avec son Bestiaire, ses Objets
 * (#284), le palier du dernier combat d'étage commencé et le compteur du carnet.
 */
export type DiscoveryBookView =
  | { readonly status: 'loading' }
  | { readonly status: 'failed' }
  | {
      readonly status: 'ready';
      readonly bestiary: Bestiary;
      readonly items: BookItems;
      readonly lastTier: Tier | null;
      readonly newEntries: number;
    };

/**
 * Les ports de la session du carnet ; `catalog` (le Bestiaire) et `itemCatalog` (les Objets, #284)
 * sont ceux du jeu installé, sauf en test (C4, C5).
 */
export interface DiscoveryBookSessionDependencies {
  readonly keyValueStore: KeyValueStore;
  readonly catalog?: BestiaryCatalog;
  readonly itemCatalog?: ItemCatalog;
}

type Listener = (view: DiscoveryBookView) => void;

const LOADING: DiscoveryBookView = { status: 'loading' };
const FAILED: DiscoveryBookView = { status: 'failed' };

/**
 * La session du carnet (`DiscoveryBookSession`, #282, ADR 0030) : elle lit le carnet à la première
 * demande, enregistre en mémoire les découvertes de chaque mise à jour d'un combat d'étage, et ne
 * l'écrit qu'à `flush` (appelé par la sauvegarde de l'ascension, juste avant elle) ou à la sortie du
 * carnet (`leave`), qui efface les marques « nouveau ». Ses écritures passent l'une après l'autre,
 * la dernière gagne.
 *
 * Elle n'écrase jamais un carnet qu'elle n'a pas pu lire (D7) : tant que la lecture n'a pas réussi,
 * les découvertes attendent dans un carnet en mémoire, sans aucune écriture, et sont fusionnées à
 * la première lecture réussie. Une valeur illisible est d'abord gardée à part, puis le carnet repart
 * vide ; si elle n'a pas pu être gardée, le carnet ne vit qu'en mémoire et n'est jamais écrit (D5).
 */
export class DiscoveryBookSession {
  /** Le carnet lu, `null` tant que la lecture n'a pas réussi. */
  private book: DiscoveryBook | null = null;
  /** Les découvertes faites avant la première lecture réussie. */
  private pending: DiscoveryBook = EMPTY_DISCOVERY_BOOK;
  /** Le dernier carnet écrit, ou mis dans la file d'écriture. */
  private written: DiscoveryBook | null = null;
  private writable = true;
  private reading: Promise<void> | null = null;
  private failed = false;
  private writing: Promise<void> = Promise.resolve();
  private readonly listeners = new Set<Listener>();
  private readonly catalog: BestiaryCatalog;
  private readonly itemCatalog: ItemCatalog;
  private view: { readonly book: DiscoveryBook; readonly view: DiscoveryBookView } | null = null;

  constructor(private readonly dependencies: DiscoveryBookSessionDependencies) {
    this.catalog = dependencies.catalog ?? BESTIARY_CATALOG;
    this.itemCatalog = dependencies.itemCatalog ?? ITEM_CATALOG;
  }

  /**
   * Lit le carnet, une seule fois ; après un échec, une nouvelle demande relit (« Réessayer »).
   * Ne rejette jamais.
   */
  load(): Promise<void> {
    if (this.book !== null) return Promise.resolve();
    if (this.reading === null) {
      const retry = this.failed;
      this.failed = false;
      if (retry) this.publish();
      this.reading = this.read();
    }
    return this.reading;
  }

  current(): DiscoveryBookView {
    const { book } = this;
    if (book === null) return this.failed ? FAILED : LOADING;
    if (this.view?.book !== book) {
      this.view = {
        book,
        view: {
          status: 'ready',
          bestiary: bestiary(book, this.catalog),
          items: bookItems(book, this.itemCatalog),
          lastTier: book.lastTier,
          // Le compteur du carnet compte les deux familles (B17).
          newEntries: newEntryCount(book, {
            bestiary: catalogKinds(this.catalog),
            items: this.itemCatalog.map(({ kind }) => kind),
          }),
        },
      };
    }
    return this.view.view;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Enregistre en mémoire les découvertes d'une mise à jour du combat d'étage (`before`, le combat
   * d'avant, `null` à un combat neuf), sans rien écrire, et rend les montées. Avant la première
   * lecture réussie, elles attendent, et aucune montée n'est rendue : on ne sait pas encore si
   * l'entrée était déjà là.
   */
  record(
    before: Battle | null,
    after: Battle,
    events: readonly BattleEvent[],
  ): readonly Discovery[] {
    const discoveries = battleDiscoveries(before, after, events);
    if (this.book === null) {
      this.pending = recordDiscoveries(this.pending, discoveries).book;
      this.startReading();
      return [];
    }
    const { book, rises } = recordDiscoveries(this.book, discoveries);
    this.change(book);
    return rises;
  }

  /**
   * Enregistre en mémoire les objets découverts (#284, D3), sans rien écrire, et rend les montées.
   * Avant la première lecture réussie, ils attendent, et aucune montée n'est rendue.
   */
  recordItems(items: readonly ItemKind[]): readonly ItemKind[] {
    if (this.book === null) {
      this.pending = recordItemDiscoveries(this.pending, items).book;
      this.startReading();
      return [];
    }
    const { book, rises } = recordItemDiscoveries(this.book, items);
    this.change(book);
    return rises;
  }

  /** Le palier du combat d'étage qui commence (D8). */
  noteTier(tier: Tier): void {
    if (this.book === null) {
      this.pending = noteTier(this.pending, tier);
      this.startReading();
      return;
    }
    this.change(noteTier(this.book, tier));
  }

  /**
   * Écrit le carnet s'il a changé depuis sa dernière écriture, après les écritures en attente. Tant
   * que la lecture n'a pas réussi, ou si le carnet ne peut pas être écrit, se résout aussitôt sans
   * rien écrire. Ne rejette jamais : un échec sera réessayé à la suivante.
   */
  flush(): Promise<void> {
    const { book } = this;
    if (book === null || !this.writable || book === this.written) return Promise.resolve();
    this.written = book;
    const { keyValueStore } = this.dependencies;
    this.writing = this.writing
      .then(() => keyValueStore.set(DISCOVERY_BOOK_KEY, serializeDiscoveryBook(book)))
      .catch(() => {
        if (this.written === book) this.written = null;
      });
    return this.writing;
  }

  /** La sortie du carnet (B16) : toutes les marques « nouveau » s'effacent, et le carnet s'écrit. */
  leave(): Promise<void> {
    if (this.book === null) return Promise.resolve();
    this.change(clearNewMarks(this.book));
    return this.flush();
  }

  /** Le compteur du carnet (B17) : 0 tant que le carnet n'est pas lu. */
  newEntryCount(): number {
    const view = this.current();
    return view.status === 'ready' ? view.newEntries : 0;
  }

  private startReading(): void {
    if (this.reading === null && !this.failed) void this.load();
  }

  private async read(): Promise<void> {
    const { keyValueStore } = this.dependencies;
    let raw: string | null;
    try {
      raw = await keyValueStore.get(DISCOVERY_BOOK_KEY);
    } catch {
      this.reading = null;
      this.failed = true;
      this.publish();
      return;
    }
    const { book, unreadable } = parseDiscoveryBook(raw);
    // Une valeur illisible est d'abord gardée à part ; seulement alors le carnet repart vide.
    if (unreadable && raw !== null) {
      const kept = await keyValueStore.set(UNREADABLE_DISCOVERY_BOOK_KEY, raw).then(
        () => true,
        () => false,
      );
      this.writable = kept;
    } else {
      this.written = book;
    }
    // Sans découverte nouvelle en attente, le carnet lu reste tel quel : rien à écrire.
    const merged = mergeBooks(book, this.pending);
    this.book = serializeDiscoveryBook(merged) === serializeDiscoveryBook(book) ? book : merged;
    this.pending = EMPTY_DISCOVERY_BOOK;
    this.publish();
    await this.flush();
  }

  private change(book: DiscoveryBook): void {
    if (book === this.book) return;
    this.book = book;
    this.publish();
  }

  private publish(): void {
    const view = this.current();
    for (const listener of [...this.listeners]) listener(view);
  }
}
