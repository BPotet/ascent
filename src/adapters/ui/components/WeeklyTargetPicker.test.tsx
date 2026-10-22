import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Dimensions } from 'react-native';

import type { WeeklyTarget } from '../../../domain/habit/WeeklyTarget';
import { WeeklyTargetPicker } from './WeeklyTargetPicker';

async function show(value: WeeklyTarget = 7) {
  const onChange = jest.fn();
  await render(<WeeklyTargetPicker value={value} onChange={onChange} />);
  return onChange;
}

const option = (target: number) => screen.getByTestId(`weekly-target-option-${target}`);

describe('WeeklyTargetPicker', () => {
  it('is a radio group « Objectif hebdomadaire », titled as in the mockup (E2, E7)', async () => {
    await show();

    const group = screen.getByTestId('weekly-target-picker');
    expect(group).toHaveProp('accessibilityRole', 'radiogroup');
    expect(group).toHaveAccessibleName('Objectif hebdomadaire');
    expect(screen.getByText('Objectif hebdomadaire')).toBeOnTheScreen();
  });

  it('offers the targets 1 to 7 only, in order, each read « N fois par semaine »', async () => {
    await show();

    const options = screen.getAllByRole('radio');
    expect(options.map((each) => each.props.accessibilityLabel)).toEqual([
      '1 fois par semaine',
      '2 fois par semaine',
      '3 fois par semaine',
      '4 fois par semaine',
      '5 fois par semaine',
      '6 fois par semaine',
      '7 fois par semaine, tous les jours',
    ]);
    for (const target of [1, 2, 3, 4, 5, 6, 7]) {
      expect(option(target)).toHaveTextContent(String(target));
    }
  });

  it('marks the chosen target as selected, and only it', async () => {
    await show(3);

    expect(
      screen.getByRole('radio', { name: '3 fois par semaine', checked: true }),
    ).toBeOnTheScreen();
    expect(option(3)).toBeSelected();
    expect(option(7)).not.toBeChecked();
    expect(option(7)).not.toBeSelected();
  });

  it('says the chosen target in words under the options', async () => {
    await show(3);
    expect(screen.getByTestId('weekly-target-phrase')).toHaveTextContent('3 fois par semaine');

    await screen.rerender(<WeeklyTargetPicker value={7} onChange={jest.fn()} />);

    expect(screen.getByTestId('weekly-target-phrase')).toHaveTextContent('Tous les jours');
  });

  it('chooses the target touched', async () => {
    const onChange = await show(7);

    await fireEvent.press(option(3));

    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('offers 44 × 44 pt round options, the chosen one filled', async () => {
    await show(5);

    expect(option(1)).toHaveStyle({ width: 44, height: 44, borderRadius: 22 });
    expect(option(5)).toHaveStyle({ backgroundColor: '#7C9CFF', borderColor: '#7C9CFF' });
    expect(option(1)).toHaveStyle({ backgroundColor: '#0F1420', borderColor: '#2E3950' });
  });

  describe('with large text', () => {
    const initial = { window: Dimensions.get('window'), screen: Dimensions.get('screen') };

    beforeEach(() => {
      Dimensions.set({
        window: { ...initial.window, fontScale: 1.5 },
        screen: { ...initial.screen, fontScale: 1.5 },
      });
    });

    afterEach(async () => {
      await act(() => Dimensions.set(initial));
    });

    it('shows a counter « − 3 + » instead of the seven options', async () => {
      await show(3);

      expect(screen.queryAllByRole('radio')).toHaveLength(0);
      const counter = screen.getByTestId('weekly-target-stepper');
      expect(counter).toHaveProp('accessibilityRole', 'adjustable');
      expect(counter).toHaveAccessibleName('Objectif hebdomadaire');
      expect(counter).toHaveAccessibilityValue({
        min: 1,
        max: 7,
        now: 3,
        text: '3 fois par semaine',
      });
      expect(
        screen.getByTestId('weekly-target-value', { includeHiddenElements: true }),
      ).toHaveTextContent('3');
      expect(screen.getByTestId('weekly-target-phrase')).toHaveTextContent('3 fois par semaine');
    });

    it('lowers and raises the target with its 56 pt buttons', async () => {
      const onChange = await show(3);
      const less = screen.getByTestId('weekly-target-less', { includeHiddenElements: true });
      const more = screen.getByTestId('weekly-target-more', { includeHiddenElements: true });
      expect(less).toHaveStyle({ width: 56, height: 56 });

      await fireEvent.press(less);
      expect(onChange).toHaveBeenLastCalledWith(2);
      await fireEvent.press(more);
      expect(onChange).toHaveBeenLastCalledWith(4);
    });

    it('lowers and raises the target with the gestures of the screen reader', async () => {
      const onChange = await show(7);
      const counter = screen.getByTestId('weekly-target-stepper');

      await fireEvent(counter, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
      expect(onChange).toHaveBeenLastCalledWith(6);
      await fireEvent(counter, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
      expect(onChange).toHaveBeenCalledTimes(1);
      await fireEvent(counter, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('goes neither under 1 nor over 7', async () => {
      const onChange = await show(1);
      expect(
        screen.getByTestId('weekly-target-less', { includeHiddenElements: true }),
      ).toBeDisabled();
      await fireEvent.press(
        screen.getByTestId('weekly-target-less', { includeHiddenElements: true }),
      );
      await fireEvent(screen.getByTestId('weekly-target-stepper'), 'accessibilityAction', {
        nativeEvent: { actionName: 'decrement' },
      });
      expect(onChange).not.toHaveBeenCalled();

      await screen.rerender(<WeeklyTargetPicker value={7} onChange={onChange} />);

      expect(
        screen.getByTestId('weekly-target-more', { includeHiddenElements: true }),
      ).toBeDisabled();
      expect(
        screen.getByTestId('weekly-target-less', { includeHiddenElements: true }),
      ).toBeEnabled();
      await fireEvent.press(
        screen.getByTestId('weekly-target-more', { includeHiddenElements: true }),
      );
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
