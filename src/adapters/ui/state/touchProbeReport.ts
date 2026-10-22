/**
 * Le calcul d'affichage de la sonde de toucher (outil du build de preview, voir le glossaire) :
 * à partir des appuis datés à leur début (horloge du fil UI) et à leur réception (horloge JS),
 * l'écart médian, son p95 et la méthode de datation des appuis retenue pour le combat (#31, § 7).
 *
 * Les bornes ci-dessous sont reprises dans l'ADR du socle du combat 2D.
 */

/** Le nombre d'appuis d'une mesure. */
export const TOUCH_PROBE_TARGET = 20;

/**
 * Un écart « réception JS − toucher » compris dans [−2 ms, 500 ms] montre deux horloges sur la même
 * base : la réception suit le toucher (à l'arrondi près des deux horloges, 2 ms), et de moins
 * qu'une latence déjà inacceptable pour un appui jugé.
 */
export const SAME_BASE_MIN_GAP_MS = -2;
export const SAME_BASE_MAX_GAP_MS = 500;

/** Un appui : l'instant de son début (fil UI) et celui de sa réception par le JS, en ms. */
export interface TouchSample {
  readonly touchedAt: number;
  readonly receivedAt: number;
}

/** Le décalage mesuré par un aller-retour vers le fil UI : horloge UI − horloge JS, en ms. */
export interface ClockCalibration {
  readonly offset: number;
}

/**
 * (a) toucher daté dans le worklet du geste, même base que l'horloge JS ;
 * (b) même datation, recalée par le décalage calibré ;
 * (c) toucher daté à sa réception par le JS.
 */
export type TimingMethod = 'a' | 'b' | 'c';

export interface TouchProbeReport {
  readonly count: number;
  readonly complete: boolean;
  /** Écarts de la méthode retenue (recalés pour (b), bruts sinon), en ms. */
  readonly median: number | null;
  readonly p95: number | null;
  readonly method: TimingMethod | null;
}

function sorted(samples: readonly number[]): number[] {
  return [...samples].sort((left, right) => left - right);
}

/** La valeur du milieu, ou la moyenne des deux du milieu pour un nombre pair d'échantillons. */
export function median(samples: readonly number[]): number | null {
  if (samples.length === 0) return null;
  const ordered = sorted(samples);
  const middle = Math.floor(ordered.length / 2);
  // Les rangs lus existent : il y a au moins un échantillon.
  return ordered.length % 2 === 1
    ? ordered[middle]!
    : (ordered[middle - 1]! + ordered[middle]!) / 2;
}

/** Le 95ᵉ centile au rang le plus proche : la ⌈0,95 n⌉-ième plus petite valeur. */
export function p95(samples: readonly number[]): number | null {
  if (samples.length === 0) return null;
  const ordered = sorted(samples);
  return ordered[Math.ceil(0.95 * ordered.length) - 1]!;
}

/** Ajoute un appui à la mesure ; au-delà de l'objectif, les appuis sont ignorés. */
export function recordTouch(
  samples: readonly TouchSample[],
  touchedAt: number,
  receivedAt: number,
): readonly TouchSample[] {
  if (samples.length >= TOUCH_PROBE_TARGET) return samples;
  return [...samples, { touchedAt, receivedAt }];
}

function withinSameBase(gaps: readonly number[]): boolean {
  return gaps.every((gap) => gap >= SAME_BASE_MIN_GAP_MS && gap <= SAME_BASE_MAX_GAP_MS);
}

/** La méthode retenue, et les écarts qu'elle mesure : recalés pour (b), bruts sinon. */
function chooseMethod(
  rawGaps: readonly number[],
  calibratedGaps: readonly number[] | null,
): { readonly method: TimingMethod; readonly gaps: readonly number[] } {
  if (withinSameBase(rawGaps)) return { method: 'a', gaps: rawGaps };
  if (calibratedGaps !== null && withinSameBase(calibratedGaps)) {
    return { method: 'b', gaps: calibratedGaps };
  }
  return { method: 'c', gaps: rawGaps };
}

export function touchProbeReport(
  samples: readonly TouchSample[],
  calibration?: ClockCalibration,
): TouchProbeReport {
  const count = samples.length;
  const complete = count >= TOUCH_PROBE_TARGET;
  if (count === 0) return { count, complete, median: null, p95: null, method: null };

  const rawGaps = samples.map(({ touchedAt, receivedAt }) => receivedAt - touchedAt);
  // Le toucher ramené sur l'horloge JS : touchedAt − offset.
  const calibratedGaps = calibration
    ? samples.map(({ touchedAt, receivedAt }) => receivedAt - (touchedAt - calibration.offset))
    : null;
  const { method, gaps } = chooseMethod(rawGaps, calibratedGaps);
  return { count, complete, median: median(gaps), p95: p95(gaps), method };
}
