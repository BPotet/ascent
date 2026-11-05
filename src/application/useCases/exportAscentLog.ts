import {
  buildAscentLogExport,
  exportFileName,
  parseAscentLog,
} from '../../domain/ascentLog/AscentLogExport';
import type { AscentLogStore } from '../ports/AscentLogStore';
import type { Clock } from '../ports/Clock';
import type { FileShare } from '../ports/FileShare';
import type { AscentLogRecorder } from './AscentLogRecorder';

export interface ExportAscentLogDependencies {
  readonly recorder: AscentLogRecorder;
  readonly store: AscentLogStore;
  readonly share: FileShare;
  readonly clock: Clock;
  readonly appVersion: string;
  readonly buildChannel: string;
}

/** L'issue d'un export : `empty` quand le journal est vide (le menu ne s'ouvre pas). */
export interface ExportOutcome {
  readonly result: 'shared' | 'empty';
  /** Le nombre de journaux illisibles laissés de côté. */
  readonly ignoredLogs: number;
}

/** La ligne d'état : le nombre de journaux gardés, et si l'ascension en cours en a un. */
export interface AscentLogStatus {
  readonly count: number;
  readonly inProgress: boolean;
}

/**
 * L'Export du journal (#196) : attend que le journal de l'ascension en cours soit écrit (jusqu'à
 * sa dernière sauvegarde), lit les journaux gardés et leurs combats (#197), et les envoie, en JSON
 * lisible, par le Menu de partage. Ne touche ni à l'ascension ni au journal. Rejette si le partage
 * échoue.
 */
export async function exportAscentLog(
  dependencies: ExportAscentLogDependencies,
): Promise<ExportOutcome> {
  const { recorder, store, share, clock, appVersion, buildChannel } = dependencies;
  await recorder.settled();
  const raws = await store.readAll();
  if (raws.length === 0) return { result: 'empty', ignoredLogs: 0 };
  // Les combats de chaque journal de version 2, écrits à part (#197).
  const stored = await Promise.all(
    raws.map(async (log) => {
      const parsed = parseAscentLog(log);
      const battles =
        parsed?.formatVersion === 2 && parsed.id !== null
          ? await store.readBattles(parsed.id, parsed.battles)
          : [];
      return { log, battles };
    }),
  );
  const today = clock.today();
  const built = buildAscentLogExport(stored, { appVersion, buildChannel, exportedOn: today });
  await share.share({
    name: exportFileName(today),
    mimeType: 'application/json',
    contents: JSON.stringify(built, null, 2),
  });
  return { result: 'shared', ignoredLogs: built.ignoredLogs };
}

/** La ligne d'état du bouton « Exporter le journal ». */
export async function getAscentLogStatus({
  recorder,
  store,
}: Pick<ExportAscentLogDependencies, 'recorder' | 'store'>): Promise<AscentLogStatus> {
  await recorder.settled();
  return { count: await store.count(), inProgress: recorder.inProgress() };
}

/** L'Export du journal tout assemblé, tel que l'interface le reçoit. */
export interface LogExport {
  status(): Promise<AscentLogStatus>;
  export(): Promise<ExportOutcome>;
}

export function ascentLogExport(dependencies: ExportAscentLogDependencies): LogExport {
  return {
    status: () => getAscentLogStatus(dependencies),
    export: () => exportAscentLog(dependencies),
  };
}
