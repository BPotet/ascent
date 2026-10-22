import { Day } from '../../../domain/day/Day';
import {
  creationWeekNote,
  habitCreatedMessage,
  nextWeeklyTargetText,
  progressChipAccessibilityLabel,
  weekCardTargetText,
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

  it('keeps « 3/3 » when the target is just reached (decision PM, E1)', () => {
    expect(weeklyProgressText({ weeklyProgress: 3, weekTarget: 3, targetReached: true })).toBe(
      '3/3 cette semaine',
    );
  });

  it('counts the times beyond the target', () => {
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

  it('reads « 3 sur 3 cette semaine » when the target is just reached', () => {
    expect(
      weeklyProgressAccessibilityLabel({ weeklyProgress: 3, weekTarget: 3, targetReached: true }),
    ).toBe('3 sur 3 cette semaine');
  });

  it('reads « 4 fois cette semaine » beyond the target', () => {
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
  const wednesday = Day.of(2026, 10, 14);

  it('says the new target starts next Monday, with its date, and the week keeps its target', () => {
    expect(
      weeklyTargetChangeMessage({ appliesThisWeek: false, weekTarget: 3, today: wednesday }),
    ).toBe('Nouvel objectif à partir de lundi prochain (19 octobre). Cette semaine reste à 3.');
  });

  it.each([
    ['Monday', Day.of(2026, 10, 12), '19 octobre'],
    ['Sunday', Day.of(2026, 10, 18), '19 octobre'],
    ['the end of a month', Day.of(2026, 10, 28), '2 novembre'],
  ])('dates next Monday from %s: %s', (_, today, date) => {
    expect(weeklyTargetChangeMessage({ appliesThisWeek: false, weekTarget: null, today })).toBe(
      `Nouvel objectif à partir de lundi prochain (${date}).`,
    );
  });

  it('says only when it starts for a week without target', () => {
    expect(
      weeklyTargetChangeMessage({ appliesThisWeek: false, weekTarget: null, today: wednesday }),
    ).toBe('Nouvel objectif à partir de lundi prochain (19 octobre).');
  });

  it('says the new target applies this week on the day of creation', () => {
    expect(
      weeklyTargetChangeMessage({ appliesThisWeek: true, weekTarget: 7, today: wednesday }),
    ).toBe('Habitude créée aujourd’hui : le nouvel objectif s’applique dès cette semaine.');
  });
});

describe('creationWeekNote', () => {
  it('announces the target of the week of creation when it is cut (E2)', () => {
    expect(creationWeekNote({ weeklyTarget: 7, creationWeekTarget: 5 })).toBe(
      'cette semaine : 5, à partir d’aujourd’hui',
    );
    expect(creationWeekNote({ weeklyTarget: 4, creationWeekTarget: 1 })).toBe(
      'cette semaine : 1, à partir d’aujourd’hui',
    );
  });

  it('announces nothing when the target is not cut', () => {
    expect(creationWeekNote({ weeklyTarget: 3, creationWeekTarget: 3 })).toBeNull();
    expect(creationWeekNote({ weeklyTarget: 7, creationWeekTarget: 7 })).toBeNull();
  });
});

describe('habitCreatedMessage', () => {
  it('says « Habitude créée » when the target of the week is not cut', () => {
    expect(habitCreatedMessage({ weeklyTarget: 3, creationWeekTarget: 3 })).toBe('Habitude créée');
  });

  it('gives the target of the week when it is cut', () => {
    expect(habitCreatedMessage({ weeklyTarget: 7, creationWeekTarget: 5 })).toBe(
      'Habitude créée · objectif 5 cette semaine',
    );
  });
});

describe('weekCardTargetText', () => {
  const thursday = Day.of(2026, 10, 15);

  it('writes the weekly target of the week shown, in lower case after the difficulty', () => {
    expect(
      weekCardTargetText({
        weeklyTarget: 3,
        weekTarget: 3,
        currentWeek: true,
        createdOn: thursday,
      }),
    ).toBe('3 fois par semaine');
    expect(
      weekCardTargetText({
        weeklyTarget: 7,
        weekTarget: 7,
        currentWeek: false,
        createdOn: thursday,
      }),
    ).toBe('tous les jours');
  });

  it('says the week target of the week of creation, reduced to the days left', () => {
    expect(
      weekCardTargetText({
        weeklyTarget: 7,
        weekTarget: 4,
        currentWeek: true,
        createdOn: thursday,
      }),
    ).toBe('tous les jours · 4 cette semaine (créée jeudi)');
    expect(
      weekCardTargetText({
        weeklyTarget: 5,
        weekTarget: 4,
        currentWeek: false,
        createdOn: thursday,
      }),
    ).toBe('5 fois par semaine · 4 cette semaine-là (créée jeudi)');
  });
});

describe('nextWeeklyTargetText', () => {
  it('announces a target that changes next Monday', () => {
    expect(nextWeeklyTargetText(4)).toBe('4 fois par semaine dès lundi');
    expect(nextWeeklyTargetText(7)).toBe('tous les jours dès lundi');
  });
});
