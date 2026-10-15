import { fireEvent, render, screen } from '@testing-library/react-native';

import { YesterdayReminderBanner } from './YesterdayReminderBanner';

describe('YesterdayReminderBanner', () => {
  it('says how many habits were done yesterday, in full for the screen reader', async () => {
    await render(<YesterdayReminderBanner doneCount={1} activeCount={2} onDismiss={jest.fn()} />);

    expect(screen.getByText('1/2 faites')).toBeOnTheScreen();
    expect(screen.getByLabelText('Hier : 1 habitude faite sur 2. Un oubli ?')).toBeOnTheScreen();
  });

  it('agrees the count with the number of habits done', async () => {
    await render(<YesterdayReminderBanner doneCount={2} activeCount={4} onDismiss={jest.fn()} />);

    expect(screen.getByLabelText('Hier : 2 habitudes faites sur 4. Un oubli ?')).toBeOnTheScreen();
  });

  it('offers « Corriger » and closes with its own button', async () => {
    const onCorrect = jest.fn();
    const onDismiss = jest.fn();
    await render(
      <YesterdayReminderBanner
        doneCount={0}
        activeCount={3}
        onCorrect={onCorrect}
        onDismiss={onDismiss}
      />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Corriger' }));
    expect(onCorrect).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();

    const close = screen.getByRole('button', { name: 'Fermer le rappel d’hier' });
    expect(close).toHaveStyle({ minWidth: 44, minHeight: 44 });
    await fireEvent.press(close);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('offers no « Corriger » when the app gives no way to correct', async () => {
    await render(<YesterdayReminderBanner doneCount={0} activeCount={3} onDismiss={jest.fn()} />);

    expect(screen.queryByRole('button', { name: 'Corriger' })).toBeNull();
  });
});
