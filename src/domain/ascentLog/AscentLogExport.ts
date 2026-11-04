/**
 * L'Export du journal (`AscentLogExport`, #196, ADR 0014) : le fichier JSON qui réunit les journaux
 * d'ascension gardés, du plus ancien au plus récent, avec la version du format et la version de
 * l'app. Un journal abîmé ou d'une version du format inconnue est laissé de côté et compté.
 *
 * Version 2 du format (#197, ADR 0016) : chaque journal de version 2 porte ses combats complets ;
 * un journal de version 1 reste tel quel, sans combats. Un combat illisible est laissé de côté et
 * compté.
 */
import type { Day } from '../day/Day';
import {
  ASCENT_LOG_FORMAT_VERSION,
  type AnyAscentLog,
  type AscentLog,
  type AscentLogV1,
} from './AscentLog';
import { BATTLE_LOG_FORMAT_VERSION, type BattleLog } from './BattleLog';

/** Les 20 derniers journaux sont gardés, celui de l'ascension en cours compris. */
export const ASCENT_LOG_KEPT = 20;

/** Un journal de version 2 dans l'export : ses combats complets, par palier puis étage. */
export interface ExportedAscentLog extends Omit<AscentLog, 'battles'> {
  readonly battles: readonly BattleLog[];
}

export interface AscentLogExport {
  readonly formatVersion: typeof ASCENT_LOG_FORMAT_VERSION;
  readonly appVersion: string;
  readonly buildChannel: string;
  /** Le jour de l'export, `AAAA-MM-JJ`. */
  readonly exportedOn: string;
  readonly ascentCount: number;
  /** Le nombre de journaux illisibles laissés de côté. */
  readonly ignoredLogs: number;
  /** Le nombre de combats illisibles laissés de côté. */
  readonly ignoredBattles: number;
  /** Les journaux de version 1 restent tels quels, marqués de leur version du format. */
  readonly ascents: readonly (AscentLogV1 | ExportedAscentLog)[];
}

/** Un journal tel qu'il est stocké, brut, avec ses combats bruts. */
export interface StoredAscentLog {
  readonly log: string;
  readonly battles: readonly string[];
}

const STATUSES: ReadonlySet<unknown> = new Set(['inProgress', 'ended']);
const BATTLE_STATUSES: ReadonlySet<unknown> = new Set(['inProgress', 'won', 'lost']);

function readable(log: Partial<AscentLog> | Partial<AscentLogV1> | null): boolean {
  if (log?.formatVersion === ASCENT_LOG_FORMAT_VERSION) {
    if (!Array.isArray(log.battles)) return false;
  } else if (log?.formatVersion !== 1) {
    return false;
  }
  return (
    typeof log.ascentSeed === 'number' && Array.isArray(log.floors) && STATUSES.has(log.status)
  );
}

/**
 * Le journal écrit en `raw`, de version 1 ou 2, ou `null` s'il est abîmé ou d'une version du format
 * inconnue.
 */
export function parseAscentLog(raw: string): AnyAscentLog | null {
  try {
    const log = JSON.parse(raw) as Partial<AscentLog> | Partial<AscentLogV1> | null;
    return readable(log) ? (log as AnyAscentLog) : null;
  } catch {
    return null;
  }
}

/** Le combat écrit en `raw`, ou `null` s'il est abîmé ou d'une version du format inconnue. */
export function parseBattleLog(raw: string): BattleLog | null {
  try {
    const battle = JSON.parse(raw) as Partial<BattleLog> | null;
    if (
      battle?.formatVersion !== BATTLE_LOG_FORMAT_VERSION ||
      typeof battle.tier !== 'number' ||
      typeof battle.floor !== 'number' ||
      !Array.isArray(battle.rounds) ||
      !BATTLE_STATUSES.has(battle.status)
    ) {
      return null;
    }
    return battle as BattleLog;
  } catch {
    return null;
  }
}

const byPlace = (left: BattleLog, right: BattleLog) =>
  left.tier - right.tier || left.floor - right.floor;

/** L'export des journaux `stored`, du plus ancien au plus récent. */
export function buildAscentLogExport(
  stored: readonly StoredAscentLog[],
  options: { readonly appVersion: string; readonly buildChannel: string; readonly exportedOn: Day },
): AscentLogExport {
  let ignoredBattles = 0;
  const ascents: (AscentLogV1 | ExportedAscentLog)[] = [];
  for (const each of stored) {
    const log = parseAscentLog(each.log);
    if (log === null) continue;
    if (log.formatVersion === 1) {
      ascents.push(log);
      continue;
    }
    const battles = each.battles
      .map(parseBattleLog)
      .filter((battle): battle is BattleLog => battle !== null);
    ignoredBattles += each.battles.length - battles.length;
    ascents.push({ ...log, battles: battles.sort(byPlace) });
  }
  return {
    formatVersion: ASCENT_LOG_FORMAT_VERSION,
    appVersion: options.appVersion,
    buildChannel: options.buildChannel,
    exportedOn: options.exportedOn.toIsoString(),
    ascentCount: ascents.length,
    ignoredLogs: stored.length - ascents.length,
    ignoredBattles,
    ascents,
  };
}

/** Les `kept` derniers identifiants (du plus ancien au plus récent), et ceux à effacer. */
export function keepLatest(
  ids: readonly number[],
  kept: number,
): { readonly kept: number[]; readonly evicted: number[] } {
  const cut = Math.max(0, ids.length - kept);
  return { kept: ids.slice(cut), evicted: ids.slice(0, cut) };
}

/** Le nom du fichier de l'export : `ascent-journal-AAAA-MM-JJ.json`. */
export function exportFileName(day: Day): string {
  return `ascent-journal-${day.toIsoString()}.json`;
}
