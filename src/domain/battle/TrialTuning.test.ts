import {
  DEFAULT_TRIAL_TUNING,
  isTrialTuningDuration,
  stepTrialTuningDuration,
  trialTuningFrom,
} from './TrialTuning';

describe('TrialTuning', () => {
  it('defaults to a phase transition of 800 ms and a step-in of 400 ms', () => {
    expect(DEFAULT_TRIAL_TUNING).toEqual({ phaseTransitionMs: 800, stepInMs: 400 });
  });

  it.each([0, 50, 800, 1_950, 2_000])('accepts %i ms', (value) => {
    expect(isTrialTuningDuration(value)).toBe(true);
  });

  it.each([-50, 2_050, 25, 800.5, Number.NaN, '800', null, undefined])('refuses %p', (value) => {
    expect(isTrialTuningDuration(value)).toBe(false);
  });

  it('reads valid tunings as they are', () => {
    expect(trialTuningFrom({ phaseTransitionMs: 1_000, stepInMs: 0 })).toEqual({
      phaseTransitionMs: 1_000,
      stepInMs: 0,
    });
  });

  it('replaces each missing or invalid duration by its default', () => {
    expect(trialTuningFrom({ phaseTransitionMs: 1_000, stepInMs: 33 })).toEqual({
      phaseTransitionMs: 1_000,
      stepInMs: 400,
    });
    expect(trialTuningFrom({ stepInMs: 600 })).toEqual({ phaseTransitionMs: 800, stepInMs: 600 });
  });

  it.each([null, undefined, 'tuning', 42, []])('reads %p as the defaults', (value) => {
    expect(trialTuningFrom(value)).toEqual(DEFAULT_TRIAL_TUNING);
  });

  it('steps a duration by 50 ms within its bounds', () => {
    expect(stepTrialTuningDuration(800, 1)).toBe(850);
    expect(stepTrialTuningDuration(800, -1)).toBe(750);
    expect(stepTrialTuningDuration(2_000, 1)).toBe(2_000);
    expect(stepTrialTuningDuration(0, -1)).toBe(0);
  });
});
