import { useCallback, useEffect, useMemo, useState } from 'react';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import {
  recordTouch,
  touchProbeReport,
  type ClockCalibration,
  type TouchProbeReport,
  type TouchSample,
} from './touchProbeReport';

/** L'horloge monotone du runtime qui l'exécute ; dans un worklet, celle du fil UI. */
export function uiThreadNow(): number {
  'worklet';
  return performance.now();
}

/** L'horloge du fil JS. */
export function jsThreadNow(): number {
  return performance.now();
}

/**
 * Le traitement du worklet `onBegin` du geste : le toucher est daté sur le fil UI dès son début,
 * sans attendre qu'il soit reconnu ni relâché, puis l'instant est transmis au fil JS.
 * `uiNow` doit être un worklet.
 */
export function touchProbeBegin(
  uiNow: () => number,
  onTouch: (touchedAt: number) => void,
): () => void {
  return () => {
    'worklet';
    scheduleOnRN(onTouch, uiNow());
  };
}

/**
 * Méthode (b) : un aller-retour vers le fil UI mesure le décalage « horloge UI − horloge JS »,
 * en supposant l'aller et le retour de même durée.
 */
export function calibrateClocks(
  now: () => number,
  uiNow: () => number,
  onCalibrated: (calibration: ClockCalibration) => void,
): void {
  const sentAt = now();
  const receive = (uiAt: number) => {
    const receivedAt = now();
    onCalibrated({ offset: uiAt - (sentAt + receivedAt) / 2 });
  };
  scheduleOnUI(() => {
    'worklet';
    scheduleOnRN(receive, uiNow());
  });
}

export interface TouchProbe {
  readonly report: TouchProbeReport;
  /** L'écart brut « réception JS − toucher » du dernier appui, en ms. */
  readonly lastGap: number | null;
  /** Absente tant que l'aller-retour vers le fil UI n'est pas revenu. */
  readonly calibration: ClockCalibration | undefined;
  /** Le worklet à brancher sur `onBegin` du geste. */
  readonly onBegin: () => void;
  readonly restart: () => void;
}

/** L'état de la sonde de toucher : les appuis mesurés, la calibration, et leur compte rendu. */
export function useTouchProbe({
  now,
  uiNow,
}: {
  readonly now: () => number;
  readonly uiNow: () => number;
}): TouchProbe {
  const [samples, setSamples] = useState<readonly TouchSample[]>([]);
  const [calibration, setCalibration] = useState<ClockCalibration>();

  useEffect(() => calibrateClocks(now, uiNow, setCalibration), [now, uiNow]);

  const onTouch = useCallback(
    (touchedAt: number) => {
      // La réception est datée ici, pas dans la mise à jour d'état, exécutée plus tard.
      const receivedAt = now();
      setSamples((current) => recordTouch(current, touchedAt, receivedAt));
    },
    [now],
  );
  const onBegin = useMemo(() => touchProbeBegin(uiNow, onTouch), [uiNow, onTouch]);
  const restart = useCallback(() => setSamples([]), []);

  const last = samples.at(-1);
  return {
    report: touchProbeReport(samples, calibration),
    lastGap: last === undefined ? null : last.receivedAt - last.touchedAt,
    calibration,
    onBegin,
    restart,
  };
}
