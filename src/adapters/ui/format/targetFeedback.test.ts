import { Day } from '../../../domain/day/Day';
import { Week } from '../../../domain/week/Week';
import { type TargetOutcome, targetFeedbackOf, weekOfText } from './targetFeedback';

const currentWeek = Week.containing(Day.of(2026, 10, 16));
const closedWeek = Week.containing(Day.of(2026, 10, 9));

const outcome = (change: Partial<TargetOutcome>): TargetOutcome => ({
  targetBonusChange: 15,
  targetReachedChange: 'reached',
  weeklyProgress: 3,
  weekTarget: 3,
  week: currentWeek,
  closedWeek: false,
  ...change,
});

const gained = { xp: 45, checkInXpChange: 10, correction: false };

describe('weekOfText', () => {
  it('names a week by its Monday', () => {
    expect(weekOfText(closedWeek)).toBe('semaine du 5 octobre');
    expect(weekOfText(Week.containing(Day.of(2027, 3, 3)))).toBe('semaine du 1er mars');
  });
});

describe('targetFeedbackOf', () => {
  it('plays F1 when the target of the current week is reached (mockup F1)', () => {
    expect(targetFeedbackOf(outcome({}), 'Courir 5 km', gained)).toEqual({
      kind: 'reached',
      title: 'Objectif de la semaine atteint',
      detail: 'Courir 5 km 3/3',
      bonusText: '+15 XP prime',
      message: 'Objectif de la semaine atteint · Courir 5 km 3/3 · +15 XP prime',
      bonusPill: 15,
      announcement:
        'Objectif de la semaine atteint pour Courir 5 km, 3 sur 3. +15 points d’expérience de prime. Total : 45 XP.',
      vibrate: true,
    });
  });

  it('names the closed week whose target a correction reaches', () => {
    const feedback = targetFeedbackOf(
      outcome({ week: closedWeek, closedWeek: true }),
      'Courir 5 km',
      { ...gained, correction: true },
    );

    expect(feedback?.title).toBe('Objectif atteint · semaine du 5 octobre');
    expect(feedback?.message).toBe(
      'Objectif atteint · semaine du 5 octobre · Courir 5 km 3/3 · +15 XP prime',
    );
    expect(feedback?.announcement).toBe(
      'Correction enregistrée, objectif de la semaine du 5 octobre atteint pour Courir 5 km, 3 sur 3. +15 points d’expérience de prime. Total : 45 XP.',
    );
  });

  it('tells discreetly, without vibration, when the target is lost', () => {
    const feedback = targetFeedbackOf(
      outcome({ targetBonusChange: -15, targetReachedChange: 'lost', weeklyProgress: 2 }),
      'Courir 5 km',
      { xp: 20, checkInXpChange: -10, correction: false },
    );

    expect(feedback).toEqual({
      kind: 'lost',
      title: 'Objectif de la semaine plus atteint',
      detail: 'Courir 5 km 2/3',
      bonusText: '−15 XP prime',
      message: 'Objectif de la semaine plus atteint · Courir 5 km 2/3 · −15 XP prime',
      bonusPill: -15,
      announcement:
        'Objectif de la semaine plus atteint pour Courir 5 km. −10 points d’expérience, −15 points de prime.',
      vibrate: false,
    });
  });

  it('names the closed week whose target a correction loses', () => {
    const feedback = targetFeedbackOf(
      outcome({
        targetBonusChange: -15,
        targetReachedChange: 'lost',
        weeklyProgress: 2,
        week: closedWeek,
        closedWeek: true,
      }),
      'Courir 5 km',
      { xp: 20, checkInXpChange: -10, correction: false },
    );

    expect(feedback?.message).toBe(
      'Objectif de la semaine du 5 octobre plus atteint · Courir 5 km 2/3 · −15 XP prime',
    );
  });

  it('leaves the bonus out of the message when the floor of 0 Xp took it all', () => {
    const feedback = targetFeedbackOf(
      outcome({ targetBonusChange: 0, targetReachedChange: 'lost', weeklyProgress: 2 }),
      'Courir 5 km',
      { xp: 0, checkInXpChange: -5, correction: false },
    );

    expect(feedback?.message).toBe('Objectif de la semaine plus atteint · Courir 5 km 2/3');
    expect(feedback?.bonusText).toBe('');
  });

  it('plays nothing when the threshold is not crossed', () => {
    expect(
      targetFeedbackOf(
        outcome({ targetBonusChange: 0, targetReachedChange: null }),
        'Courir 5 km',
        gained,
      ),
    ).toBeNull();
    // Seule la prime réévaluée avec la difficulté : F1 n'est pas rejoué.
    expect(
      targetFeedbackOf(
        outcome({ targetBonusChange: -21, targetReachedChange: null }),
        'Courir 5 km',
        gained,
      ),
    ).toBeNull();
  });
});
