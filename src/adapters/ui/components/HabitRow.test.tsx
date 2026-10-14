import { render, screen } from '@testing-library/react-native';

import { Day } from '../../../domain/day/Day';
import { Habit } from '../../../domain/habit/Habit';
import { HabitName } from '../../../domain/habit/HabitName';
import { HabitRow } from './HabitRow';

const wednesday = Day.of(2026, 10, 14);
const cooking = new Habit(7, HabitName.parse('Cuisiner'), wednesday);

describe('HabitRow', () => {
  it('shows the habit with its status written in full', async () => {
    await render(<HabitRow habitDay={{ habit: cooking, day: wednesday, status: 'pending' }} />);

    expect(screen.getByText('Cuisiner')).toBeOnTheScreen();
    expect(screen.getByText('À faire')).toBeOnTheScreen();
  });

  it.each([
    ['pending', 'Cuisiner, mercredi 14 octobre, à faire'],
    ['done', 'Cuisiner, mercredi 14 octobre, fait'],
    ['missed', 'Cuisiner, mercredi 14 octobre, pas fait'],
    ['upcoming', 'Cuisiner, mercredi 14 octobre, à venir'],
    ['notStarted', 'Cuisiner, mercredi 14 octobre, hors habitude'],
  ] as const)('is read « %s » by the screen reader as « %s »', async (status, label) => {
    await render(<HabitRow habitDay={{ habit: cooking, day: wednesday, status }} />);

    expect(screen.getByLabelText(label)).toBeOnTheScreen();
  });

  it('can be highlighted', async () => {
    await render(
      <HabitRow habitDay={{ habit: cooking, day: wednesday, status: 'pending' }} highlighted />,
    );

    expect(screen.getByTestId('habit-row-7')).toHaveStyle({ borderColor: '#7C9CFF' });
  });

  it('is not highlighted by default', async () => {
    await render(<HabitRow habitDay={{ habit: cooking, day: wednesday, status: 'pending' }} />);

    expect(screen.getByTestId('habit-row-7')).toHaveStyle({ borderColor: 'transparent' });
  });
});
