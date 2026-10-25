import { fireEvent, render, screen, within } from '@testing-library/react-native';

import { Day } from '../../../domain/day/Day';
import type { WeekTargetsRow } from '../../../domain/month/TargetsByWeek';
import { Week } from '../../../domain/week/Week';
import { artPalette } from '../pixelArt/artPalette';
import { textFont } from '../pixelArt/pixelTypography';
import { TargetsByWeekSection } from './TargetsByWeekSection';

const { roles } = artPalette;

const today = Day.of(2026, 10, 21);
const weekOf = (month: number, dayOfMonth: number) =>
  Week.containing(Day.of(2026, month, dayOfMonth));
const row = (week: Week, reachedCount: number, targetCount: number): WeekTargetsRow => ({
  week,
  habits: [],
  reachedCount,
  targetCount,
});

/** Le scénario 1 : 2/4, 3/4, 4/4 puis 1/4 cette semaine. */
const october = [
  row(weekOf(9, 28), 2, 4),
  row(weekOf(10, 5), 3, 4),
  row(weekOf(10, 12), 4, 4),
  row(weekOf(10, 19), 1, 4),
];

const line = (monday: string) => screen.getByTestId(`week-targets-${monday}`);

describe('TargetsByWeekSection', () => {
  it('shows its title, then one row per week (scenario 1)', async () => {
    await render(<TargetsByWeekSection rows={october} today={today} />);

    expect(screen.getByRole('header', { name: 'Objectifs par semaine' })).toBeOnTheScreen();
    expect(screen.getAllByRole('button')).toHaveLength(4);
    expect(line('2026-09-28')).toHaveTextContent('Semaine du 28 septembre2/4 objectifs atteints');
    expect(line('2026-10-05')).toHaveTextContent('Semaine du 5 octobre3/4 objectifs atteints');
    expect(line('2026-10-12')).toHaveTextContent('Semaine du 12 octobre4/4 objectifs atteints');
    expect(line('2026-10-19')).toHaveTextContent('Cette semaine1/4 objectifs atteints');
  });

  it('plants the gold flag on a week whose targets are all reached, a grey star otherwise', async () => {
    await render(<TargetsByWeekSection rows={october} today={today} />);

    const hidden = { includeHiddenElements: true };
    expect(within(line('2026-10-12')).getByTestId('summit-flag-glyph', hidden)).toBeTruthy();
    expect(within(line('2026-10-12')).queryByTestId('target-glyph', hidden)).toBeNull();
    expect(within(line('2026-10-05')).getByTestId('target-glyph', hidden)).toBeTruthy();
    expect(within(line('2026-10-05')).queryByTestId('summit-flag-glyph', hidden)).toBeNull();
    expect(within(line('2026-10-12')).getByText('4/4 objectifs atteints')).toHaveStyle({
      color: roles.parchment,
      fontFamily: textFont.medium,
      fontSize: 13,
    });
    expect(within(line('2026-10-12')).getByText('Semaine du 12 octobre')).toHaveStyle({
      color: roles.light,
      fontFamily: textFont.bold,
      fontSize: 15,
    });
    expect(within(line('2026-10-12')).getByTestId('chevron-icon', hidden)).toBeTruthy();
  });

  it('agrees a row with a single habit that has a target', async () => {
    await render(<TargetsByWeekSection rows={[row(weekOf(10, 19), 0, 1)]} today={today} />);

    expect(line('2026-10-19')).toHaveTextContent('Cette semaine0/1 objectif atteint');
    expect(
      screen.getByRole('button', {
        name: 'Cette semaine, 0 objectif atteint sur 1, ouvrir la semaine',
      }),
    ).toBeOnTheScreen();
  });

  it('reads each row to the screen reader (scenario 9)', async () => {
    await render(<TargetsByWeekSection rows={october} today={today} />);

    expect(
      screen.getByRole('button', {
        name: 'Semaine du 12 octobre, 4 objectifs atteints sur 4, ouvrir la semaine',
      }),
    ).toBe(line('2026-10-12'));
    expect(
      screen.getByRole('button', {
        name: 'Cette semaine, 1 objectif atteint sur 4, ouvrir la semaine',
      }),
    ).toBe(line('2026-10-19'));
  });

  it('writes the 1st of the month « 1er », in full and never cut (décision UX)', async () => {
    await render(<TargetsByWeekSection rows={[row(weekOf(6, 1), 2, 4)]} today={today} />);

    const line = screen.getByRole('button', {
      name: 'Semaine du 1er juin, 2 objectifs atteints sur 4, ouvrir la semaine',
    });
    for (const text of ['Semaine du 1er juin', '2/4 objectifs atteints']) {
      expect(within(line).getByText(text).props.numberOfLines).toBeUndefined();
    }
  });

  it('gives each row a pixel frame and a touch target of at least 56 dp', async () => {
    await render(<TargetsByWeekSection rows={october} today={today} />);

    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveStyle({ minHeight: 56 });
      expect(within(button).getByTestId('week-targets-frame')).toHaveStyle({
        borderColor: roles.line,
      });
    }
  });

  it('moves the row 2 dp down while it is pressed', async () => {
    await render(<TargetsByWeekSection rows={october} today={today} />);

    await fireEvent(line('2026-10-12'), 'pressIn');

    expect(within(line('2026-10-12')).getByTestId('week-targets-frame')).toHaveStyle({
      transform: [{ translateY: 2 }],
    });
  });

  it('opens the week of a row (scenario 2)', async () => {
    const onOpenWeek = jest.fn();
    await render(<TargetsByWeekSection rows={october} today={today} onOpenWeek={onOpenWeek} />);

    await fireEvent.press(
      screen.getByRole('button', { name: /^Semaine du 5 octobre, 3 objectifs atteints sur 4/u }),
    );

    expect(onOpenWeek).toHaveBeenCalledTimes(1);
    expect(onOpenWeek).toHaveBeenCalledWith(weekOf(10, 5));
  });

  it('does nothing when touched without a way to open the week', async () => {
    await render(<TargetsByWeekSection rows={october} today={today} />);

    await fireEvent.press(line('2026-10-05'));

    expect(line('2026-10-05')).toBeOnTheScreen();
  });

  it('is not shown without any row (scenario 4)', async () => {
    await render(<TargetsByWeekSection rows={[]} today={today} />);

    expect(screen.queryByTestId('targets-by-week')).toBeNull();
    expect(screen.queryByText('Objectifs par semaine')).toBeNull();
  });
});
