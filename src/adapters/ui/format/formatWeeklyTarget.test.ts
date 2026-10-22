import {
  progressChipAccessibilityLabel,
  progressChipText,
  weeklyProgressAccessibilityLabel,
  weeklyProgressText,
  weeklyTargetChangeMessage,
  weeklyTargetOptionLabel,
  weeklyTargetPhrase,
} from './formatWeeklyTarget';

describe('weeklyTargetPhrase', () => {
  it.each([
    [1, '1 fois par semaine'],
    [3, '3 fois par semaine'],
    [6, '6 fois par semaine'],
    [7, 'Tous les jours'],
  ] as const)('writes the weekly target %s « %s »', (target, phrase) => {
    expect(weeklyTargetPhrase(target)).toBe(phrase);
  });

  it('writes it in lower case inside a line', () => {
    expect(weeklyTargetPhrase(7, 'inline')).toBe('tous les jours');
    expect(weeklyTargetPhrase(3, 'inline')).toBe('3 fois par semaine');
  });
});

describe('weeklyTargetOptionLabel', () => {
  it.each([
    [1, '1 fois par semaine'],
    [3, '3 fois par semaine'],
    [7, '7 fois par semaine, tous les jours'],
  ] as const)('reads the option %s « %s »', (target, label) => {
    expect(weeklyTargetOptionLabel(target)).toBe(label);
  });
});

describe('weeklyProgressText', () => {
  it('writes the progress against the week target', () => {
    expect(weeklyProgressText({ weeklyProgress: 2, weekTarget: 3, targetReached: false })).toBe(
      '2/3 cette semaine',
    );
    expect(weeklyProgressText({ weeklyProgress: 0, weekTarget: 7, targetReached: false })).toBe(
      '0/7 cette semaine',
    );
  });

  it('counts the times once the target is reached', () => {
    expect(weeklyProgressText({ weeklyProgress: 3, weekTarget: 3, targetReached: true })).toBe(
      '3 fois cette semaine',
    );
    expect(weeklyProgressText({ weeklyProgress: 4, weekTarget: 3, targetReached: true })).toBe(
      '4 fois cette semaine',
    );
  });
});

describe('weeklyProgressAccessibilityLabel', () => {
  it('reads « 2 sur 3 cette semaine »', () => {
    expect(
      weeklyProgressAccessibilityLabel({ weeklyProgress: 2, weekTarget: 3, targetReached: false }),
    ).toBe('2 sur 3 cette semaine');
  });

  it('reads « 4 fois cette semaine » once the target is reached', () => {
    expect(
      weeklyProgressAccessibilityLabel({ weeklyProgress: 4, weekTarget: 3, targetReached: true }),
    ).toBe('4 fois cette semaine');
  });
});

describe('progressChipText', () => {
  it('writes « 1/3 », and « 3/3 · Objectif atteint » once reached', () => {
    expect(progressChipText({ weeklyProgress: 1, weekTarget: 3, targetReached: false })).toBe(
      '1/3',
    );
    expect(progressChipText({ weeklyProgress: 3, weekTarget: 3, targetReached: true })).toBe(
      '3/3 · Objectif atteint',
    );
    expect(progressChipText({ weeklyProgress: 4, weekTarget: 3, targetReached: true })).toBe(
      '4/3 · Objectif atteint',
    );
  });

  it('reads « 1 sur 3 », and « 3 sur 3, objectif atteint » once reached', () => {
    expect(
      progressChipAccessibilityLabel({ weeklyProgress: 1, weekTarget: 3, targetReached: false }),
    ).toBe('1 sur 3');
    expect(
      progressChipAccessibilityLabel({ weeklyProgress: 3, weekTarget: 3, targetReached: true }),
    ).toBe('3 sur 3, objectif atteint');
  });
});

describe('weeklyTargetChangeMessage', () => {
  it('says the new target starts next Monday and the week keeps its target', () => {
    expect(weeklyTargetChangeMessage({ appliesThisWeek: false, weekTarget: 3 })).toBe(
      'Nouvel objectif à partir de lundi prochain. Cette semaine reste à 3.',
    );
  });

  it('says only when it starts for a week without target', () => {
    expect(weeklyTargetChangeMessage({ appliesThisWeek: false, weekTarget: null })).toBe(
      'Nouvel objectif à partir de lundi prochain.',
    );
  });

  it('says the new target applies this week on the day of creation', () => {
    expect(weeklyTargetChangeMessage({ appliesThisWeek: true, weekTarget: 7 })).toBe(
      'Habitude créée aujourd’hui : le nouvel objectif s’applique dès cette semaine.',
    );
  });
});
