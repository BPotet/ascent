import { fireEvent, render, screen } from '@testing-library/react-native';

import { AddHabitButton } from './AddHabitButton';

describe('AddHabitButton', () => {
  it('offers to add a habit', async () => {
    const onPress = jest.fn();
    await render(<AddHabitButton canAddHabit onPress={onPress} onLimitPress={jest.fn()} />);

    const button = screen.getByRole('button', { name: 'Ajouter une habitude' });
    expect(button).toBeEnabled();
    await fireEvent.press(button);

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is disabled at the limit, explains it, and still reacts to a touch', async () => {
    const onPress = jest.fn();
    const onLimitPress = jest.fn();
    await render(
      <AddHabitButton canAddHabit={false} onPress={onPress} onLimitPress={onLimitPress} />,
    );

    const button = screen.getByRole('button', { name: 'Ajouter une habitude' });
    expect(button).toBeDisabled();
    expect(button).toHaveProp(
      'accessibilityHint',
      '10 habitudes au plus. Supprime une habitude pour en ajouter une.',
    );
    expect(screen.getByText('Limite atteinte · 10/10')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Limite atteinte · 10/10'));

    expect(onLimitPress).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });
});
