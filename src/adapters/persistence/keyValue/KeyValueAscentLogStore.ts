import type { AscentLogStore } from '../../../application/ports/AscentLogStore';
import type { KeyValueStore } from '../../../application/ports/KeyValueStore';
import type { AnyAscentLog, AscentLog } from '../../../domain/ascentLog/AscentLog';
import { keepLatest } from '../../../domain/ascentLog/AscentLogExport';

/** La clé de l'index des journaux d'ascension : les identifiants, du plus ancien au plus récent. */
export const ASCENT_LOG_INDEX_KEY = 'ascent.log.index';
const INDEX_VERSION = 1;

/** La clé d'un journal d'ascension. */
export const ascentLogKey = (id: number) => `ascent.log.${id}`;

interface Index {
  readonly formatVersion: typeof INDEX_VERSION;
  readonly nextId: number;
  readonly ids: readonly number[];
}

const EMPTY_INDEX: Index = { formatVersion: INDEX_VERSION, nextId: 1, ids: [] };

function parseIndex(raw: string | null): Index {
  if (raw === null) return EMPTY_INDEX;
  try {
    const index = JSON.parse(raw) as Partial<Index> | null;
    const ids = index?.ids;
    if (
      index?.formatVersion !== INDEX_VERSION ||
      typeof index.nextId !== 'number' ||
      !Array.isArray(ids) ||
      !ids.every((id) => typeof id === 'number')
    ) {
      return EMPTY_INDEX;
    }
    return { formatVersion: INDEX_VERSION, nextId: index.nextId, ids };
  } catch {
    return EMPTY_INDEX;
  }
}

/**
 * Les journaux d'ascension (#196, ADR 0014) dans le Stockage clé-valeur : un index
 * (`ascent.log.index`) et une clé par journal (`ascent.log.<id>`), en JSON compact. Pas de
 * migration. Un index illisible repart vide : ses anciennes clés restent, et sont écrasées au fil
 * des nouveaux journaux.
 */
export class KeyValueAscentLogStore implements AscentLogStore {
  constructor(private readonly keyValueStore: KeyValueStore) {}

  async start(log: AscentLog, kept: number): Promise<AscentLog> {
    const index = await this.index();
    const started = { ...log, id: index.nextId };
    // Le journal d'abord, puis l'index, puis les clés évincées.
    await this.keyValueStore.set(ascentLogKey(started.id), JSON.stringify(started));
    const { kept: ids, evicted } = keepLatest([...index.ids, started.id], kept);
    const next: Index = { formatVersion: INDEX_VERSION, nextId: started.id + 1, ids };
    await this.keyValueStore.set(ASCENT_LOG_INDEX_KEY, JSON.stringify(next));
    for (const id of evicted) await this.keyValueStore.remove(ascentLogKey(id));
    return started;
  }

  async save(log: AnyAscentLog): Promise<void> {
    if (log.id === null) return;
    await this.keyValueStore.set(ascentLogKey(log.id), JSON.stringify(log));
  }

  async latest(): Promise<string | null> {
    const id = (await this.index()).ids.at(-1);
    return id === undefined ? null : this.keyValueStore.get(ascentLogKey(id));
  }

  async readAll(): Promise<readonly string[]> {
    const { ids } = await this.index();
    const raws = await Promise.all(ids.map((id) => this.keyValueStore.get(ascentLogKey(id))));
    return raws.filter((raw): raw is string => raw !== null);
  }

  async count(): Promise<number> {
    return (await this.index()).ids.length;
  }

  private async index(): Promise<Index> {
    return parseIndex(await this.keyValueStore.get(ASCENT_LOG_INDEX_KEY));
  }
}
