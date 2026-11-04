import type { AscentLogStore } from '../../../application/ports/AscentLogStore';
import type { KeyValueStore } from '../../../application/ports/KeyValueStore';
import type { AnyAscentLog, AscentLog } from '../../../domain/ascentLog/AscentLog';
import { keepLatest, parseAscentLog } from '../../../domain/ascentLog/AscentLogExport';
import type { BattleLog, FloorPlace } from '../../../domain/ascentLog/BattleLog';

/** La clé de l'index des journaux d'ascension : les identifiants, du plus ancien au plus récent. */
export const ASCENT_LOG_INDEX_KEY = 'ascent.log.index';
const INDEX_VERSION = 1;

/** La clé d'un journal d'ascension. */
export const ascentLogKey = (id: number) => `ascent.log.${id}`;

/** La clé d'un combat d'un journal d'ascension (#197) : son palier et son étage. */
export const battleLogKey = (id: number, { tier, floor }: FloorPlace) =>
  `ascent.log.${id}.battle.${tier}-${floor}`;

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
 * (`ascent.log.index`), une clé par journal (`ascent.log.<id>`) et une clé par combat
 * (`ascent.log.<id>.battle.<palier>-<étage>`, #197, ADR 0016), en JSON compact. Pas de migration.
 * Un index illisible repart vide : ses anciennes clés restent, et sont écrasées au fil des nouveaux
 * journaux. Un journal évincé illisible est effacé sans ses combats, qui restent orphelins.
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
    for (const id of evicted) await this.evict(id);
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

  async saveBattle(logId: number, battle: BattleLog): Promise<void> {
    await this.keyValueStore.set(battleLogKey(logId, battle), JSON.stringify(battle));
  }

  async readBattles(logId: number, places: readonly FloorPlace[]): Promise<readonly string[]> {
    const raws = await Promise.all(
      places.map((place) => this.keyValueStore.get(battleLogKey(logId, place))),
    );
    return raws.filter((raw): raw is string => raw !== null);
  }

  /** Efface les combats du journal `id` (listés par lui), puis le journal. */
  private async evict(id: number): Promise<void> {
    const raw = await this.keyValueStore.get(ascentLogKey(id));
    const log = raw === null ? null : parseAscentLog(raw);
    const places = log?.formatVersion === 2 ? log.battles : [];
    for (const place of places) await this.keyValueStore.remove(battleLogKey(id, place));
    await this.keyValueStore.remove(ascentLogKey(id));
  }

  private async index(): Promise<Index> {
    return parseIndex(await this.keyValueStore.get(ASCENT_LOG_INDEX_KEY));
  }
}
