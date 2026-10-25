import { fireEvent, render, screen } from '@testing-library/react-native';

import { artPalette } from '../pixelArt/artPalette';
import { textFont } from '../pixelArt/pixelTypography';
import { YesterdayReminderBanner } from './YesterdayReminderBanner';

describe('YesterdayReminderBanner', () => {
  it('says how many expected habits were done yesterday, in full for the screen reader', async () => {
    await render(<YesterdayReminderBanner doneCount={1} expectedCount={2} onDismiss={jest.fn()} />);

    expect(screen.getByText('1/2 faites')).toBeOnTheScreen();
    expect(screen.getByText('Hier : 1/2 faites. Un oubli ?')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Hier : 1 habitude faite sur 2 attendues. Un oubli ?'),
    ).toBeOnTheScreen();
  });

  it('agrees the count with the number of habits done', async () => {
    await render(<YesterdayReminderBanner doneCount={2} expectedCount={4} onDismiss={jest.fn()} />);

    expect(
      screen.getByLabelText('Hier : 2 habitudes faites sur 4 attendues. Un oubli ?'),
    ).toBeOnTheScreen();
  });

  it('offers « Corriger » and closes with its own button', async () => {
    const onCorrect = jest.fn();
    const onDismiss = jest.fn();
    await render(
      <YesterdayReminderBanner
        doneCount={0}
        expectedCount={3}
        onCorrect={onCorrect}
        onDismiss={onDismiss}
      />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Corriger' }));
    expect(onCorrect).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();

    const close = screen.getByRole('button', { name: 'Fermer le rappel d’hier' });
    expect(close).toHaveStyle({ minWidth: 48, minHeight: 48 });
    expect(screen.getByRole('button', { name: 'Corriger' })).toHaveStyle({ minHeight: 48 });
    await fireEvent.press(close);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('is a notched frame, in the text font, with « Corriger » in gold', async () => {
    await render(
      <YesterdayReminderBanner
        doneCount={1}
        expectedCount={2}
        onCorrect={jest.fn()}
        onDismiss={jest.fn()}
      />,
    );

    expect(screen.getByTestId('yesterday-reminder')).toHaveStyle({
      borderColor: artPalette.roles.line,
      borderWidth: 2,
    });
    expect(screen.getByText('Hier : 1/2 faites. Un oubli ?')).toHaveStyle({
      fontFamily: textFont.medium,
    });
    expect(screen.getByText('Corriger')).toHaveStyle({
      fontFamily: textFont.bold,
      color: artPalette.roles.gold,
      textDecorationLine: 'underline',
    });
  });

  it('offers no « Corriger » when the app gives no way to correct', async () => {
    await render(<YesterdayReminderBanner doneCount={0} expectedCount={3} onDismiss={jest.fn()} />);

    expect(screen.queryByRole('button', { name: 'Corriger' })).toBeNull();
  });
});
