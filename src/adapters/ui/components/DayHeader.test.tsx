import { render, screen } from '@testing-library/react-native';

import { Day } from '../../../domain/day/Day';
import { DayHeader } from './DayHeader';

const wednesday = Day.of(2026, 10, 14);

describe('DayHeader', () => {
  it('shows today and its date', async () => {
    await render(<DayHeader day={wednesday} doneCount={0} activeCount={1} />);

    expect(screen.getByRole('header', { name: 'Aujourd’hui' })).toBeOnTheScreen();
    expect(screen.getByText('Mercredi 14 octobre')).toBeOnTheScreen();
  });

  it.each([
    [0, 1, '0/1', '0 habitude faite sur 1', '0%'],
    [1, 4, '1/4', '1 habitude faite sur 4', '25%'],
    [2, 4, '2/4', '2 habitudes faites sur 4', '50%'],
    [0, 0, '0/0', '0 habitude faite sur 0', '0%'],
  ] as const)(
    'counts %i done habits out of %i',
    async (doneCount, activeCount, count, label, width) => {
      await render(<DayHeader day={wednesday} doneCount={doneCount} activeCount={activeCount} />);

      expect(screen.getByLabelText(label)).toHaveTextContent(`${count} faites`);
      expect(screen.getByTestId('day-progress')).toHaveStyle({ width });
    },
  );
});
