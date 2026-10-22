import { render, screen } from '@testing-library/react-native';

import { Day } from '../../../domain/day/Day';
import { DayHeader } from './DayHeader';

const wednesday = Day.of(2026, 10, 14);

describe('DayHeader', () => {
  it('shows today and its date', async () => {
    await render(<DayHeader day={wednesday} doneCount={0} expectedCount={1} activeCount={1} />);

    expect(screen.getByRole('header', { name: 'Aujourd’hui' })).toBeOnTheScreen();
    expect(screen.getByText('Mercredi 14 octobre')).toBeOnTheScreen();
  });

  it.each([
    [0, 1, 1, '0/1', '0 habitude faite sur 1 attendue', '0%'],
    [1, 4, 4, '1/4', '1 habitude faite sur 4 attendues', '25%'],
    [2, 4, 5, '2/4', '2 habitudes faites sur 4 attendues', '50%'],
    [0, 0, 0, '0/0', '0 habitude faite sur 0 attendue', '0%'],
  ] as const)(
    'counts %i done habits out of %i expected (%i active)',
    async (doneCount, expectedCount, activeCount, count, label, width) => {
      await render(
        <DayHeader
          day={wednesday}
          doneCount={doneCount}
          expectedCount={expectedCount}
          activeCount={activeCount}
        />,
      );

      expect(screen.getByLabelText(label)).toHaveTextContent(`${count} faites`);
      expect(screen.getByTestId('day-progress')).toHaveStyle({ width });
      expect(screen.queryByText('Atteints')).toBeNull();
    },
  );

  it('shows « Atteints » instead of the counter when no active habit is expected (#25)', async () => {
    await render(<DayHeader day={wednesday} doneCount={0} expectedCount={0} activeCount={2} />);

    expect(screen.getByLabelText('Objectifs de la semaine atteints')).toHaveTextContent('Atteints');
    expect(screen.getByTestId('day-goals-reached')).toBeOnTheScreen();
    expect(screen.queryByText(/faites/)).toBeNull();
    expect(screen.queryByTestId('day-progress')).toBeNull();
  });
});
