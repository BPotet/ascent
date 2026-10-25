import { useCallback, useEffect, useState } from 'react';

import { getTrialTuning, saveTrialTuning } from '../../../application/useCases/trialTuning';
import {
  DEFAULT_TRIAL_TUNING,
  stepTrialTuningDuration,
  type TrialTuning,
} from '../../../domain/battle/TrialTuning';
import { usePreferenceDependencies } from './Dependencies';

/** Les réglages d'essai du build de preview : lus, puis réglés d'un pas et enregistrés. */
export function useTrialTuning(): {
  readonly tuning: TrialTuning;
  readonly step: (field: keyof TrialTuning, direction: 1 | -1) => void;
} {
  const preferences = usePreferenceDependencies();
  const [tuning, setTuning] = useState<TrialTuning>(DEFAULT_TRIAL_TUNING);

  useEffect(() => {
    let mounted = true;
    getTrialTuning(preferences).then(
      (stored) => mounted && setTuning(stored),
      () => undefined,
    );
    return () => {
      mounted = false;
    };
  }, [preferences]);

  const step = useCallback(
    (field: keyof TrialTuning, direction: 1 | -1) => {
      setTuning((current) => {
        const next = { ...current, [field]: stepTrialTuningDuration(current[field], direction) };
        saveTrialTuning(preferences, next).catch(() => undefined);
        return next;
      });
    },
    [preferences],
  );

  return { tuning, step };
}
