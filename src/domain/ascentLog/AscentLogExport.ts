/**
 * L'Export du journal (`AscentLogExport`, #196, ADR 0014) : le fichier JSON qui réunit les journaux
 * d'ascension gardés, du plus ancien au plus récent, avec la version du format et la version de
 * l'app. Un journal abîmé ou d'une version du format inconnue est laissé de côté et compté.
 */
import type { Day } from '../day/Day';
import { ASCENT_LOG_FORMAT_VERSION, type AscentLog } from './AscentLog';

/** Les 20 derniers journaux sont gardés, celui de l'ascension en cours compris. */
export const ASCENT_LOG_KEPT = 20;

export interface AscentLogExport {
  readonly formatVersion: typeof ASCENT_LOG_FORMAT_VERSION;
  readonly appVersion: string;
  readonly buildChannel: string;
  /** Le jour de l'export, `AAAA-MM-JJ`. */
  readonly exportedOn: string;
  readonly ascentCount: number;
  /** Le nombre de journaux illisibles laissés de côté. */
  readonly ignoredLogs: number;
  readonly ascents: readonly AscentLog[];
}

const STATUSES: ReadonlySet<unknown> = new Set(['inProgress', 'ended']);

/** Le journal écrit en `raw`, ou `null` s'il est abîmé ou d'une version du format inconnue. */
export function parseAscentLog(raw: string): AscentLog | null {
  try {
    const log = JSON.parse(raw) as Partial<AscentLog> | null;
    if (
      log?.formatVersion !== ASCENT_LOG_FORMAT_VERSION ||
      typeof log.ascentSeed !== 'number' ||
      !Array.isArray(log.floors) ||
      !STATUSES.has(log.status)
    ) {
      return null;
    }
    return log as AscentLog;
  } catch {
    return null;
  }
}

/** L'export des journaux bruts `raws`, du plus ancien au plus récent. */
export function buildAscentLogExport(
  raws: readonly string[],
  options: { readonly appVersion: string; readonly buildChannel: string; readonly exportedOn: Day },
): AscentLogExport {
  const ascents = raws.map(parseAscentLog).filter((log): log is AscentLog => log !== null);
  return {
    formatVersion: ASCENT_LOG_FORMAT_VERSION,
    appVersion: options.appVersion,
    buildChannel: options.buildChannel,
    exportedOn: options.exportedOn.toIsoString(),
    ascentCount: ascents.length,
    ignoredLogs: raws.length - ascents.length,
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
