import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import type { AscentLogStatus, LogExport } from '../../../application/useCases/exportAscentLog';
import { ignoredLogsLine } from '../format/ascentLogText';

/** Au-delà de ce délai, le bouton montre « Préparation du journal » (maquette 193, E3). */
export const PREPARING_DELAY_MS = 300;

export interface AscentLogExportView {
  /** `null` tant que le statut n'est pas lu. */
  readonly status: AscentLogStatus | null;
  /** Un export en cours : le bouton ne répond plus. */
  readonly exporting: boolean;
  /** La préparation dépasse 300 ms. */
  readonly preparing: boolean;
  readonly failed: boolean;
  /** Les journaux illisibles laissés de côté au dernier export. */
  readonly ignored: number;
  readonly onExport: () => void;
}

/**
 * L'état du bouton « Exporter le journal » et de sa ligne (#196) : le statut, relu à chaque
 * changement de `revision` (l'ascension) et après chaque export ; l'export en cours ; l'erreur,
 * effacée au prochain succès ; les journaux ignorés, annoncés poliment au retour du menu.
 */
export function useAscentLogExport(logExport: LogExport, revision: unknown): AscentLogExportView {
  const [status, setStatus] = useState<AscentLogStatus | null>(null);
  const [exporting, setExporting] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ignored, setIgnored] = useState(0);
  const mounted = useRef(true);
  const busy = useRef(false);

  const refresh = useCallback(() => {
    logExport
      .status()
      .then((next) => {
        if (mounted.current) setStatus(next);
      })
      .catch(() => undefined);
  }, [logExport]);

  useEffect(() => {
    mounted.current = true;
    refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh, revision]);

  const onExport = useCallback(() => {
    if (busy.current) return;
    busy.current = true;
    setExporting(true);
    const timer = setTimeout(() => {
      if (mounted.current) setPreparing(true);
    }, PREPARING_DELAY_MS);
    logExport
      .export()
      .then(
        ({ ignoredLogs }) => {
          if (!mounted.current) return;
          setFailed(false);
          setIgnored(ignoredLogs);
          if (ignoredLogs > 0) {
            AccessibilityInfo.announceForAccessibility(ignoredLogsLine(ignoredLogs));
          }
        },
        () => {
          if (mounted.current) setFailed(true);
        },
      )
      .finally(() => {
        clearTimeout(timer);
        busy.current = false;
        if (!mounted.current) return;
        setExporting(false);
        setPreparing(false);
        refresh();
      });
  }, [logExport, refresh]);

  return { status, exporting, preparing, failed, ignored, onExport };
}
