import { fireEvent, render, screen, within } from '@testing-library/react-native';

import type { CheckInStatus } from '../../../domain/checkIn/CheckInStatus';
import type { HabitDay } from '../../../domain/checkIn/HabitDay';
import { Day } from '../../../domain/day/Day';
import { Habit } from '../../../domain/habit/Habit';
import { HabitName } from '../../../domain/habit/HabitName';
import { Week } from '../../../domain/week/Week';
import { HabitWeekCard, WeekDaysHeader, WeekLegend } from './WeekGrid';

const wednesday = Day.of(2026, 10, 14);
const week = Week.containing(wednesday);
const cooking = new Habit(3, HabitName.parse('Cuisiner'), Day.of(2026, 10, 5));
const hidden = { includeHiddenElements: true } as const;

const statuses: CheckInStatus[] = [
  'done',
  'missed',
  'pending',
  'upcoming',
  'upcoming',
  'upcoming',
  'upcoming',
];
const days: HabitDay[] = week.days().map((day, index) => ({
  habit: cooking,
  day,
  status: statuses[index] ?? 'upcoming',
  // Aujourd'hui et les jours clos se modifient (correction, R10).
  editable: !day.isAfter(wednesday),
  corrected: day.equals(Day.of(2026, 10, 13)),
}));

describe('WeekDaysHeader', () => {
  it('shows the initial and the number of each day, from Monday to Sunday', async () => {
    await render(<WeekDaysHeader days={week.days()} today={wednesday} />);

    const texts = screen
      .getAllByText(/^(\w|\d+)$/u, hidden)
      .map((text) => String(text.props.children));
    expect(texts).toEqual([
      'L',
      '12',
      'M',
      '13',
      'M',
      '14',
      'J',
      '15',
      'V',
      '16',
      'S',
      '17',
      'D',
      '18',
    ]);
  });

  it('highlights today, and is not read by the screen reader (each cell says its day)', async () => {
    await render(<WeekDaysHeader days={week.days()} today={wednesday} />);

    expect(screen.queryByText('14')).toBeNull();
    expect(screen.getByTestId('weekday-2026-10-14', hidden)).toHaveStyle({
      backgroundColor: '#7C9CFF',
    });
    const [, todayInitial, todayNumber] = screen.getAllByText(/^(M|14)$/u, hidden);
    expect(todayInitial).toHaveStyle({ color: '#7C9CFF' });
    expect(todayNumber).toHaveStyle({ color: '#0B1020' });
    const [mondayInitial, mondayNumber] = screen.getAllByText(/^(L|12)$/u, hidden);
    expect(mondayInitial).toHaveStyle({ color: '#9AA4B8' });
    expect(mondayNumber).toHaveStyle({ color: '#EEF1F7' });
    expect(screen.getByTestId('weekday-2026-10-13', hidden)).not.toHaveStyle({
      backgroundColor: '#7C9CFF',
    });
  });

  it('highlights no day when today is not in the week', async () => {
    await render(<WeekDaysHeader days={week.previous().days()} today={wednesday} />);

    for (const day of week.previous().days()) {
      expect(screen.getByTestId(`weekday-${day.toIsoString()}`, hidden)).not.toHaveStyle({
        backgroundColor: '#7C9CFF',
      });
    }
  });
});

describe('HabitWeekCard', () => {
  it('shows the habit and its 7 cells, from Monday to Sunday', async () => {
    await render(<HabitWeekCard days={days} today={wednesday} onToggle={jest.fn()} />);

    const card = screen.getByTestId('week-card-3');
    expect(within(card).getByText('Cuisiner')).toBeOnTheScreen();
    expect(
      within(card)
        .getAllByRole('switch')
        .map((cell) => cell.props.accessibilityLabel),
    ).toEqual([
      'Cuisiner, lundi 12 octobre, fait',
      'Cuisiner, mardi 13 octobre, pas fait, corrigé',
      'Cuisiner, mercredi 14 octobre, à faire',
      'Cuisiner, jeudi 15 octobre, à venir, indisponible',
      'Cuisiner, vendredi 16 octobre, à venir, indisponible',
      'Cuisiner, samedi 17 octobre, à venir, indisponible',
      'Cuisiner, dimanche 18 octobre, à venir, indisponible',
    ]);
  });

  it('passes on the tap on a cell', async () => {
    const onToggle = jest.fn();
    await render(<HabitWeekCard days={days} today={wednesday} onToggle={onToggle} />);

    await fireEvent.press(screen.getByTestId('cell-3-2026-10-14'));

    expect(onToggle).toHaveBeenCalledWith(days[2]);
  });

  it('passes on the tap on a « hors habitude » cell, to explain it', async () => {
    const onNotStartedPress = jest.fn();
    const before = days.map((habitDay) => ({
      ...habitDay,
      status: 'notStarted' as const,
      editable: false,
    }));
    await render(
      <HabitWeekCard
        days={before}
        today={wednesday}
        onToggle={jest.fn()}
        onNotStartedPress={onNotStartedPress}
      />,
    );

    await fireEvent.press(screen.getByTestId('cell-3-2026-10-12'));

    expect(onNotStartedPress).toHaveBeenCalledWith(before[0]);
  });
});

it('shows nothing for a habit without cells', async () => {
  await render(<HabitWeekCard days={[]} today={wednesday} onToggle={jest.fn()} />);

  expect(screen.toJSON()).toBeNull();
});

describe('WeekLegend', () => {
  it('names the five shapes and the mark « corrigé », hidden from the screen reader', async () => {
    await render(<WeekLegend />);

    expect(screen.queryByText('Fait')).toBeNull();
    expect(screen.getAllByText(/.+/u, hidden).map((text) => text.props.children as string)).toEqual(
      ['Fait', 'À faire', 'Pas fait', 'À venir', 'Hors habitude', 'Corrigé'],
    );
    expect(screen.getByTestId('check-mark', hidden)).toBeTruthy();
    expect(screen.getAllByTestId('cross-mark', hidden)).toHaveLength(2);
    expect(screen.getByTestId('dot-mark', hidden)).toBeTruthy();
    expect(screen.getByTestId('corrected-mark', hidden)).toHaveStyle({
      backgroundColor: '#C9D5FF',
    });
  });
});
