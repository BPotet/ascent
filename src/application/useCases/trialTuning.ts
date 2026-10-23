import { trialTuningFrom, type TrialTuning } from '../../domain/battle/TrialTuning';
import type { PreferenceDependencies } from './checkInHint';

export const TRIAL_TUNING_KEY = 'battle.trialTuning';

function parse(raw: string | null): unknown {
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Cas d'usage : les réglages d'essai enregistrés ; chaque valeur absente ou invalide vaut son défaut. */
export async function getTrialTuning({
  keyValueStore,
}: PreferenceDependencies): Promise<TrialTuning> {
  return trialTuningFrom(parse(await keyValueStore.get(TRIAL_TUNING_KEY)));
}

/** Cas d'usage : enregistrer les réglages d'essai, validés, pour le combat suivant. */
export async function saveTrialTuning(
  { keyValueStore }: PreferenceDependencies,
  tuning: TrialTuning,
): Promise<TrialTuning> {
  const valid = trialTuningFrom(tuning);
  await keyValueStore.set(TRIAL_TUNING_KEY, JSON.stringify(valid));
  return valid;
}
