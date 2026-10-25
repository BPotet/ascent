import type { TargetFeedback } from './targetFeedback';
import {
  TARGET_TOAST_DURATION_MS,
  targetToastOf,
  TOAST_DURATION_MS,
  toastDurationOf,
  TOAST_WITH_ACTION_DURATION_MS,
} from './toast';

const feedback = (kind: TargetFeedback['kind']): TargetFeedback => ({
  kind,
  title: 'Objectif de la semaine atteint',
  detail: 'Courir 5 km 3/3',
  bonusText: '+15 XP prime',
  message: 'Objectif de la semaine atteint · Courir 5 km 3/3 · +15 XP prime',
  bonusPill: 15,
  announcement: 'Objectif de la semaine atteint pour Courir 5 km, 3 sur 3.',
  vibrate: kind === 'reached',
});

describe('targetToastOf', () => {
  it('shows F1 in the « goal » toast', () => {
    expect(targetToastOf(feedback('reached'))).toEqual({
      message: 'Objectif de la semaine atteint · Courir 5 km 3/3 · +15 XP prime',
      variant: 'goal',
      target: {
        title: 'Objectif de la semaine atteint',
        detail: 'Courir 5 km 3/3',
        bonusText: '+15 XP prime',
      },
      announcement: 'Objectif de la semaine atteint pour Courir 5 km, 3 sur 3.',
    });
  });

  it('shows the return under the target in the « soft » toast', () => {
    expect(targetToastOf(feedback('lost')).variant).toBe('soft');
  });
});

describe('toastDurationOf', () => {
  it('shows a toast 2.8 s, 5 s with an action, 4 s for F1', () => {
    expect([TOAST_DURATION_MS, TOAST_WITH_ACTION_DURATION_MS, TARGET_TOAST_DURATION_MS]).toEqual([
      2800, 5000, 4000,
    ]);
    expect(toastDurationOf(false, 'default')).toBe(TOAST_DURATION_MS);
    expect(toastDurationOf(false, 'soft')).toBe(TOAST_DURATION_MS);
    expect(toastDurationOf(false, 'goal')).toBe(TARGET_TOAST_DURATION_MS);
    expect(toastDurationOf(true, 'goal')).toBe(TOAST_WITH_ACTION_DURATION_MS);
  });
});
