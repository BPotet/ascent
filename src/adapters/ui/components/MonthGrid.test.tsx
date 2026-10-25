import { fireEvent, render, screen, within } from '@testing-library/react-native';

import type { CheckInStatus } from '../../../domain/checkIn/CheckInStatus';
import type { HabitDay } from '../../../domain/checkIn/HabitDay';
import { Day } from '../../../domain/day/Day';
import { Habit } from '../../../domain/habit/Habit';
import { HabitName } from '../../../domain/habit/HabitName';
import { Month } from '../../../domain/month/Month';
import type { MonthDay } from '../../../domain/month/MonthDay';
import { artPalette } from '../pixelArt/artPalette';
import { textFont } from '../pixelArt/pixelTypography';
import { MonthDayCell, MonthDaysHeader, MonthGrid, MonthLegend } from './MonthGrid';

const { roles } = artPalette;
const hidden = { includeHiddenElements: true };

const october = (dayOfMonth: number) => Day.of(2026, 10, dayOfMonth);
const cooking = new Habit(1, HabitName.parse('Cuisiner'), october(5));
const budget = new Habit(2, HabitName.parse('Budget du jour'), october(5));
const reading = new Habit(3, HabitName.parse('Lire'), october(5));

const habitDay = (habit: Habit, day: Day, status: CheckInStatus): HabitDay => ({
  habit,
  day,
  status,
  editable: true,
  corrected: false,
});

function tracked(dayOfMonth: number, statuses: readonly CheckInStatus[]): MonthDay {
  const day = october(dayOfMonth);
  const habits = statuses.map((status, index) =>
    habitDay([cooking, budget, reading][index] as Habit, day, status),
  );
  return {
    day,
    kind: 'tracked',
    isToday: false,
    habits,
    expectedHabits: habits,
    notStartedHabits: [],
    doneCount: statuses.filter((status) => status === 'done').length,
    activeCount: statuses.length,
    expectedCount: statuses.length,
    corrected: false,
  };
}

const neutral = (dayOfMonth: number): MonthDay => ({
  day: october(dayOfMonth),
  kind: 'neutral',
  isToday: false,
  habits: [],
  expectedHabits: [],
  notStartedHabits: [],
  doneCount: 0,
  activeCount: 0,
  expectedCount: 0,
  corrected: false,
});

const upcoming = (dayOfMonth: number): MonthDay => ({ ...neutral(dayOfMonth), kind: 'upcoming' });

const dayCell = (dayOfMonth: number) =>
  screen.getByTestId(`month-day-${october(dayOfMonth).toIsoString()}`);

describe('MonthDayCell', () => {
  it('shows a tracked day with its number, its counter and a dot per expected habit', async () => {
    await render(
      <MonthDayCell monthDay={tracked(13, ['done', 'missed', 'done'])} onOpen={jest.fn()} />,
    );

    const cell = screen.getByRole('button', {
      name: 'mardi 13 octobre, 2 habitudes faites sur 3 attendues',
    });
    expect(within(cell).getByText('13')).toBeOnTheScreen();
    expect(within(cell).getByText('2/3')).toBeOnTheScreen();
    expect(
      within(cell).getAllByTestId('month-dot-done', { includeHiddenElements: true }),
    ).toHaveLength(2);
    expect(
      within(cell).getAllByTestId('month-dot-missed', { includeHiddenElements: true }),
    ).toHaveLength(1);
    expect(cell).toHaveStyle({ backgroundColor: roles.surface, borderBottomColor: roles.ink });
  });

  it('counts and dots the expected habits only (#25)', async () => {
    const day = tracked(15, ['missed', 'done', 'missed']);
    const [running, cooking, budget] = day.habits;
    await render(
      <MonthDayCell
        monthDay={{ ...day, expectedHabits: [cooking!, budget!], expectedCount: 2 }}
        onOpen={jest.fn()}
      />,
    );

    const cell = screen.getByRole('button', {
      name: 'jeudi 15 octobre, 1 habitude faite sur 2 attendues',
    });
    expect(running).toBeDefined();
    expect(within(cell).getByText('1/2')).toBeOnTheScreen();
    expect(
      within(cell).getAllByTestId(/^month-dot-/u, { includeHiddenElements: true }),
    ).toHaveLength(2);
    expect(cell).toHaveStyle({ backgroundColor: roles.surface, borderBottomColor: roles.ink });
  });

  it('shows the complete background when every expected habit is done (#25)', async () => {
    const day = tracked(15, ['missed', 'done']);
    await render(
      <MonthDayCell
        monthDay={{ ...day, expectedHabits: [day.habits[1]!], expectedCount: 1 }}
        onOpen={jest.fn()}
      />,
    );

    expect(dayCell(15)).toHaveStyle({ backgroundColor: roles.doneBg, borderColor: roles.doneLine });
  });

  it('shows the flag instead of the counter on a day without any expected habit (#25)', async () => {
    const onOpen = jest.fn();
    const monthDay: MonthDay = {
      ...tracked(15, ['missed']),
      expectedHabits: [],
      expectedCount: 0,
    };
    await render(<MonthDayCell monthDay={monthDay} onOpen={onOpen} />);

    const cell = screen.getByRole('button', {
      name: 'jeudi 15 octobre, objectifs de la semaine atteints, aucune habitude attendue',
    });
    expect(within(cell).getByText('15')).toBeOnTheScreen();
    expect(within(cell).getByTestId('flag-glyph', hidden)).toBeTruthy();
    expect(within(cell).queryByText(/\//u)).toBeNull();
    expect(
      within(cell).queryAllByTestId(/^month-dot-/u, { includeHiddenElements: true }),
    ).toHaveLength(0);
    expect(cell).toHaveStyle({ backgroundColor: roles.doneBg });

    await fireEvent.press(cell);
    expect(onOpen).toHaveBeenCalledWith(monthDay);
  });

  it('reads the flag of today, corrected', async () => {
    await render(
      <MonthDayCell
        monthDay={{
          ...tracked(24, ['missed']),
          isToday: true,
          corrected: true,
          expectedHabits: [],
          expectedCount: 0,
        }}
        onOpen={jest.fn()}
      />,
    );

    expect(
      screen.getByRole('button', {
        name: 'samedi 24 octobre, aujourd’hui, objectifs de la semaine atteints, aucune habitude attendue, corrigé',
      }),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('corrected-mark', { includeHiddenElements: true })).toBeTruthy();
  });

  it('shows a habit still to do today with a full gold dot, today in a gold frame', async () => {
    await render(
      <MonthDayCell
        monthDay={{ ...tracked(14, ['pending', 'done']), isToday: true }}
        onOpen={jest.fn()}
      />,
    );

    const cell = screen.getByRole('button', {
      name: 'mercredi 14 octobre, aujourd’hui, 1 habitude faite sur 2 attendues',
    });
    expect(
      within(cell).getAllByTestId('month-dot-pending', { includeHiddenElements: true }),
    ).toHaveLength(1);
    expect(within(cell).getByTestId('month-dot-pending', hidden)).toHaveStyle({
      width: 4,
      height: 4,
      backgroundColor: roles.gold,
    });
    expect(within(cell).getByTestId('month-dot-done', hidden)).toHaveStyle({
      backgroundColor: roles.done,
    });
    expect(cell).toHaveStyle({ borderColor: roles.gold, borderWidth: 2 });
  });

  it('shows a complete day on a green background, with a 2 dp frame no other day has', async () => {
    await render(<MonthDayCell monthDay={tracked(12, ['done', 'done'])} onOpen={jest.fn()} />);

    expect(dayCell(12)).toHaveStyle({
      backgroundColor: roles.doneBg,
      borderColor: roles.doneLine,
      borderWidth: 2,
    });
    expect(within(dayCell(12)).getByText('2/2')).toHaveStyle({
      color: roles.light,
      fontFamily: textFont.bold,
      fontSize: 12,
    });
    expect(within(dayCell(12)).getByText('12')).toHaveStyle({
      color: roles.parchment,
      fontFamily: textFont.semiBold,
      fontSize: 12,
    });
  });

  it('draws a missed habit as an outline dot, not only by its color', async () => {
    await render(<MonthDayCell monthDay={tracked(12, ['missed'])} onOpen={jest.fn()} />);

    expect(screen.getByTestId('month-dot-missed', hidden)).toHaveStyle({
      backgroundColor: 'transparent',
      borderColor: roles.muted,
    });
    expect(dayCell(12)).not.toHaveStyle({ borderColor: roles.doneLine });
  });

  it('shows the mark « corrigé » on a corrected day, and reads it', async () => {
    const { rerender } = await render(
      <MonthDayCell monthDay={tracked(8, ['done'])} onOpen={jest.fn()} />,
    );
    expect(screen.queryByTestId('corrected-mark', { includeHiddenElements: true })).toBeNull();

    await rerender(
      <MonthDayCell monthDay={{ ...tracked(8, ['done']), corrected: true }} onOpen={jest.fn()} />,
    );

    expect(screen.getByTestId('corrected-mark', { includeHiddenElements: true })).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: 'jeudi 8 octobre, 1 habitude faite sur 1 attendue, corrigé',
      }),
    ).toBeOnTheScreen();
  });

  it('opens the detail of a tracked day when touched', async () => {
    const onOpen = jest.fn();
    const monthDay = tracked(13, ['done']);
    await render(<MonthDayCell monthDay={monthDay} onOpen={onOpen} />);

    await fireEvent.press(dayCell(13));

    expect(onOpen).toHaveBeenCalledWith(monthDay);
  });

  it('shows a neutral day with its number only, not touchable', async () => {
    const onOpen = jest.fn();
    await render(<MonthDayCell monthDay={neutral(3)} onOpen={onOpen} />);

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByLabelText('samedi 3 octobre, aucune habitude active')).toBeOnTheScreen();
    expect(within(dayCell(3)).queryByText(/\//u)).toBeNull();
    expect(dayCell(3)).toHaveStyle({ backgroundColor: 'transparent' });
    await fireEvent.press(dayCell(3));
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('shows a day to come with its dimmed number, without counter, not touchable', async () => {
    const onOpen = jest.fn();
    await render(<MonthDayCell monthDay={upcoming(15)} onOpen={onOpen} />);

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByLabelText('jeudi 15 octobre, à venir')).toBeOnTheScreen();
    expect(within(dayCell(15)).queryByText(/\//u)).toBeNull();
    expect(within(dayCell(15)).getByText('15')).toHaveStyle({ color: roles.muted });
    await fireEvent.press(dayCell(15));
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('frames a neutral today too', async () => {
    await render(<MonthDayCell monthDay={{ ...neutral(14), isToday: true }} onOpen={jest.fn()} />);

    expect(dayCell(14)).toHaveStyle({ borderColor: roles.gold });
  });

  it('gives a touch target as wide as its column, 48 dp at most, and 58 dp high at least', async () => {
    await render(<MonthDayCell monthDay={tracked(13, ['done'])} onOpen={jest.fn()} />);

    expect(dayCell(13)).toHaveStyle({ width: 48, minHeight: 58 });
    expect(dayCell(13)).not.toHaveStyle({ height: 58 });
  });

  it('takes the width of its column on a narrow screen, never more', async () => {
    await render(
      <MonthDayCell monthDay={tracked(13, ['done'])} columnWidth={41} onOpen={jest.fn()} />,
    );

    expect(dayCell(13)).toHaveStyle({ width: 41 });
    expect(dayCell(13)).not.toHaveProp('hitSlop', expect.anything());
  });
});

describe('MonthGrid', () => {
  it('lays the month out in weeks of 7 places, blank before the 1st and after the last day', async () => {
    const days = Month.of(2026, 10)
      .days()
      .map((day) => neutral(day.dayOfMonth));
    const weeks = Month.of(2026, 10)
      .weeks()
      .map((week) => week.map((day) => (day === null ? null : days[day.dayOfMonth - 1]!)));

    await render(<MonthGrid weeks={weeks} onOpen={jest.fn()} />);

    expect(screen.getAllByTestId(/^month-day-/u)).toHaveLength(31);
    // Octobre 2026 commence un jeudi et finit un samedi : 3 places vides avant, 1 après.
    expect(screen.getAllByTestId('month-blank', { includeHiddenElements: true })).toHaveLength(4);
  });

  it('passes the touched day to `onOpen`', async () => {
    const onOpen = jest.fn();
    const day = tracked(13, ['done']);

    await render(<MonthGrid weeks={[[null, day, null, null, null, null, null]]} onOpen={onOpen} />);
    await fireEvent.press(dayCell(13));

    expect(onOpen).toHaveBeenCalledWith(day);
  });
});

describe('MonthDaysHeader', () => {
  it('shows the initials of the days, from Monday to Sunday, hidden from the screen reader', async () => {
    await render(<MonthDaysHeader />);

    expect(screen.queryByText('L')).toBeNull();
    expect(
      screen
        .getAllByText(/^[LMJVSD]$/u, { includeHiddenElements: true })
        .map((initial) => initial.props.children as string),
    ).toEqual(['L', 'M', 'M', 'J', 'V', 'S', 'D']);
  });
});

describe('MonthLegend', () => {
  it('explains the dots and the mark « corrigé », hidden from the screen reader', async () => {
    await render(<MonthLegend />);

    expect(screen.queryByText('Fait')).toBeNull();
    for (const label of ['Fait', 'À faire', 'Pas fait', 'Corrigé', 'Objectifs atteints']) {
      expect(screen.getByText(label, { includeHiddenElements: true })).toBeTruthy();
    }
    expect(screen.getByTestId('corrected-mark', { includeHiddenElements: true })).toBeTruthy();
  });
});
