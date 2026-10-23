import { useCallback, useEffect, useState } from 'react';

import {
  touchProbeReport,
  type ClockCalibration,
  type TouchProbeReport,
  type TouchSample,
} from './touchProbeReport';
import { calibrateClocks } from './useTouchProbe';

/** Au-delà, les appuis les plus anciens sortent de la mesure. */
const MAX_SAMPLES = 500;

/**
 * Les mesures des appuis du combat, sous charge (panneau Mesures du build de preview, #31 § 7) :
 * chaque appui est daté à son début (fil UI) et à sa réception (fil JS), et la méthode de
 * datation est recalculée sur eux par le compte rendu de la sonde de toucher, réutilisé tel quel.
 */
export function useBattleMeasures({
  now,
  uiNow,
}: {
  readonly now: () => number;
  readonly uiNow: () => number;
}): {
  readonly report: TouchProbeReport;
  readonly record: (touchedAt: number) => void;
  readonly reset: () => void;
} {
  const [samples, setSamples] = useState<readonly TouchSample[]>([]);
  const [calibration, setCalibration] = useState<ClockCalibration>();

  useEffect(() => calibrateClocks(now, uiNow, setCalibration), [now, uiNow]);

  const record = useCallback(
    (touchedAt: number) => {
      // La réception est datée ici, à l'arrivée sur le fil JS, pas dans la mise à jour d'état.
      const receivedAt = now();
      setSamples((current) => [...current, { touchedAt, receivedAt }].slice(-MAX_SAMPLES));
    },
    [now],
  );

  const reset = useCallback(() => setSamples([]), []);

  const report = touchProbeReport(samples, calibration);
  return { report, record, reset };
}
