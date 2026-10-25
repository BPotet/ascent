import { fireEvent, render, screen } from '@testing-library/react-native';

import { pixelFont, textFont } from '../pixelArt/pixelTypography';
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

    expect(screen.getByRole('button', { name: 'Semaine précédente' })).toHaveProp(
      'accessibilityState',
      { disabled: false },
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
    expect(previous).toHaveProp('accessibilityState', { disabled: true });
    await fireEvent.press(previous);
    await fireEvent.press(next);
    expect(onPrevious).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('writes the title in the pixel font, and the dates in the text font', async () => {
    await render(
      <PeriodNavigator
        {...props}
        canGoPrevious
        canGoNext
        onPrevious={jest.fn()}
        onNext={jest.fn()}
      />,
    );

    expect(screen.getByText('Semaine dernière')).toHaveStyle({
      fontFamily: pixelFont,
      fontSize: 22,
    });
    expect(screen.getByText('5 – 11 oct.')).toHaveStyle({
      fontFamily: textFont.medium,
      fontSize: 13,
    });
  });

  it('dims a disabled arrow to 35 %', async () => {
    await render(
      <PeriodNavigator
        {...props}
        canGoPrevious
        canGoNext={false}
        onPrevious={jest.fn()}
        onNext={jest.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Semaine suivante' })).toHaveStyle({
      opacity: 0.35,
    });
    expect(screen.getByRole('button', { name: 'Semaine précédente' })).toHaveStyle({ opacity: 1 });
    expect(screen.getAllByTestId(/^period-arrow-/u, { includeHiddenElements: true })).toHaveLength(
      2,
    );
    expect(screen.getByTestId('period-arrow-left', { includeHiddenElements: true })).toBeTruthy();
  });

  it('has buttons of at least 48 × 48 dp', async () => {
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
      width: 48,
      height: 48,
    });
  });
});
