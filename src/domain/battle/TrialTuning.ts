/**
 * Réglages d'essai (`TrialTuning`) : les durées de la transition de phase et de l'avancée, réglables
 * dans le build de preview pour l'essai du propriétaire, appliquées au combat suivant (C12).
 */
export interface TrialTuning {
  readonly phaseTransitionMs: number;
  readonly stepInMs: number;
}

/** Les valeurs validées par le propriétaire (C12). */
export const DEFAULT_TRIAL_TUNING: TrialTuning = { phaseTransitionMs: 800, stepInMs: 400 };

export const TRIAL_TUNING_MIN_MS = 0;
export const TRIAL_TUNING_MAX_MS = 2_000;
export const TRIAL_TUNING_STEP_MS = 50;

/** Une durée réglable : un multiple de 50 ms, de 0 à 2 000 ms. */
export function isTrialTuningDuration(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= TRIAL_TUNING_MIN_MS &&
    value <= TRIAL_TUNING_MAX_MS &&
    value % TRIAL_TUNING_STEP_MS === 0
  );
}

/** Des réglages lus : chaque durée absente ou invalide prend sa valeur par défaut. */
export function trialTuningFrom(value: unknown): TrialTuning {
  const fields =
    typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const { phaseTransitionMs, stepInMs } = fields;
  return {
    phaseTransitionMs: isTrialTuningDuration(phaseTransitionMs)
      ? phaseTransitionMs
      : DEFAULT_TRIAL_TUNING.phaseTransitionMs,
    stepInMs: isTrialTuningDuration(stepInMs) ? stepInMs : DEFAULT_TRIAL_TUNING.stepInMs,
  };
}

/** Une durée réglée d'un pas, vers le haut (+1) ou vers le bas (−1), dans les bornes. */
export function stepTrialTuningDuration(value: number, direction: 1 | -1): number {
  const next = value + direction * TRIAL_TUNING_STEP_MS;
  return Math.min(TRIAL_TUNING_MAX_MS, Math.max(TRIAL_TUNING_MIN_MS, next));
}
