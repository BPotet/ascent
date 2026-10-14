import { fireEvent, render, screen } from '@testing-library/react-native';

import { PeriodNavigator } from './PeriodNavigator';

const props = {
  title: 'Semaine dernière',
  subtitle: '5 – 11 oct.',
  label: 'Semaine dernière, du lundi 5 octobre au dimanche 11 octobre',
  previousLabel: 'Semaine précédente',
  nextLabel: 'Semaine suivante',
};

describe('PeriodNavigator', () => {
  it('shows the period shown, and reads it in full when it changes', async () => {
    await render(
      <PeriodNavigator
        {...props}
        canGoPrevious
        canGoNext
        onPrevious={jest.fn()}
        onNext={jest.fn()}
      />,
    );

    expect(screen.getByText('Semaine dernière')).toBeOnTheScreen();
    expect(screen.getByText('5 – 11 oct.')).toBeOnTheScreen();
    expect(screen.getByLabelText(props.label)).toHaveProp('accessibilityLiveRegion', 'polite');
  });

  it('goes to the previous and the next period', async () => {
    const onPrevious = jest.fn();
    const onNext = jest.fn();
    await render(
      <PeriodNavigator
        {...props}
        canGoPrevious
        canGoNext
        onPrevious={onPrevious}
        onNext={onNext}
      />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Semaine précédente' }));
    expect(onPrevious).toHaveBeenCalledTimes(1);
    expect(onNext).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Semaine suivante' }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('disables an action that would leave the history', async () => {
    const onPrevious = jest.fn();
    const onNext = jest.fn();
    await render(
      <PeriodNavigator
        {...props}
        canGoPrevious={false}
        canGoNext={false}
        onPrevious={onPrevious}
        onNext={onNext}
      />,
    );

    const previous = screen.getByRole('button', { name: 'Semaine précédente' });
    const next = screen.getByRole('button', { name: 'Semaine suivante' });
    expect(previous).toBeDisabled();
    expect(next).toBeDisabled();
    await fireEvent.press(previous);
    await fireEvent.press(next);
    expect(onPrevious).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('has buttons of at least 44 × 44 pt', async () => {
    await render(
      <PeriodNavigator
        {...props}
        canGoPrevious
        canGoNext
        onPrevious={jest.fn()}
        onNext={jest.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Semaine suivante' })).toHaveStyle({
      width: 44,
      height: 44,
    });
  });
});
