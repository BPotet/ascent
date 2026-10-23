import {
  DEFAULT_WEEKLY_TARGET,
  InvalidWeeklyTargetError,
  parseWeeklyTarget,
  WEEKLY_TARGETS,
} from './WeeklyTarget';

describe('WeeklyTarget', () => {
  it('goes from 1 to 7, in display order (R3)', () => {
    expect(WEEKLY_TARGETS).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('is 7, « Tous les jours », by default (R4)', () => {
    expect(DEFAULT_WEEKLY_TARGET).toBe(7);
  });

  it.each([1, 2, 3, 4, 5, 6, 7])('reads %p', (value) => {
    expect(parseWeeklyTarget(value)).toBe(value);
  });

  it.each([0, 8, -1, 2.5, Number.NaN, Infinity, '3', '', null, undefined, [3], { value: 3 }])(
    'refuses %p (R3)',
    (value) => {
      expect(() => parseWeeklyTarget(value)).toThrow(InvalidWeeklyTargetError);
    },
  );

  it('tells which value is invalid', () => {
    expect(() => parseWeeklyTarget(8)).toThrow('Invalid weekly target: 8');
    expect(() => parseWeeklyTarget('3')).toThrow('Invalid weekly target: "3"');
    expect(new InvalidWeeklyTargetError(0).name).toBe('InvalidWeeklyTargetError');
  });
});
