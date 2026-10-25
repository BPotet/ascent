import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Dimensions } from 'react-native';

import { Day } from '../../../domain/day/Day';
import type { WeeklyTarget } from '../../../domain/habit/WeeklyTarget';
import { artPalette } from '../pixelArt/artPalette';
import { textFont } from '../pixelArt/pixelTypography';
import { WeeklyTargetPicker } from './WeeklyTargetPicker';

const { roles } = artPalette;

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

  describe('on the day of creation (E2, « Semaine de création réduite »)', () => {
    const wednesday = Day.of(2026, 10, 14);

    it('announces the target of the week cut to the days left, today included', async () => {
      await render(<WeeklyTargetPicker value={7} onChange={jest.fn()} creationDay={wednesday} />);

      expect(screen.getByTestId('weekly-target-phrase')).toHaveTextContent(
        'Tous les jours · cette semaine : 5, à partir d’aujourd’hui',
      );

      await screen.rerender(
        <WeeklyTargetPicker value={6} onChange={jest.fn()} creationDay={wednesday} />,
      );

      expect(screen.getByTestId('weekly-target-phrase')).toHaveTextContent(
        '6 fois par semaine · cette semaine : 5, à partir d’aujourd’hui',
      );
    });

    it('announces nothing when the target is not cut', async () => {
      await render(<WeeklyTargetPicker value={5} onChange={jest.fn()} creationDay={wednesday} />);

      expect(screen.getByTestId('weekly-target-phrase')).toHaveTextContent('5 fois par semaine', {
        exact: true,
      });
    });

    it('announces nothing on another day', async () => {
      await show(7);

      expect(screen.getByTestId('weekly-target-phrase')).toHaveTextContent('Tous les jours', {
        exact: true,
      });
    });
  });

  it('chooses the target touched', async () => {
    const onChange = await show(7);

    await fireEvent.press(option(3));

    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('offers options of 48 dp high, the chosen one filled with gold, with its tick and a bold text', async () => {
    await show(5);

    expect(option(1)).toHaveStyle({ minHeight: 48 });
    expect(screen.getByTestId('choice-frame-weekly-target-option-5')).toHaveStyle({
      backgroundColor: roles.gold,
      borderColor: roles.gold,
    });
    expect(screen.getByTestId('choice-frame-weekly-target-option-1')).toHaveStyle({
      borderColor: roles.line,
    });
    expect(within(option(5)).getByText('5')).toHaveStyle({
      color: roles.ink,
      fontFamily: textFont.bold,
    });
    expect(
      within(option(5)).getByTestId('choice-tick', { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(within(option(1)).getByText('1')).toHaveStyle({
      color: roles.light,
      fontFamily: textFont.semiBold,
    });
  });

  describe('on a narrow screen (320 dp)', () => {
    it('shares the row between the seven options, the 7th included, without any touch area beyond its own', async () => {
      await show(3);

      expect(screen.getByTestId('weekly-target-picker')).toHaveStyle({
        flexDirection: 'row',
        gap: 4,
      });
      for (const target of [1, 7]) {
        expect(option(target)).toHaveStyle({ flex: 1, minHeight: 48 });
        expect(option(target)).not.toHaveProp('hitSlop', expect.anything());
      }
      expect(
        screen.getByRole('radio', { name: '7 fois par semaine, tous les jours' }),
      ).toBeOnTheScreen();
    });

    it('chooses the 7th option touched', async () => {
      const onChange = await show(3);

      await fireEvent.press(option(7));

      expect(onChange).toHaveBeenCalledWith(7);
    });
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
      const onChange = await show(4);
      const counter = screen.getByTestId('weekly-target-stepper');
      expect(counter).toHaveProp('accessibilityActions', [
        { name: 'increment' },
        { name: 'decrement' },
      ]);

      await fireEvent(counter, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
      expect(onChange).toHaveBeenLastCalledWith(5);
      await fireEvent(counter, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
      expect(onChange).toHaveBeenLastCalledWith(3);
      await fireEvent(counter, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
      expect(onChange).toHaveBeenCalledTimes(2);
    });

    it('does not go over 7 with the gestures of the screen reader', async () => {
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
      const less = () => screen.getByTestId('weekly-target-less', { includeHiddenElements: true });
      const more = () => screen.getByTestId('weekly-target-more', { includeHiddenElements: true });
      expect(less()).toBeDisabled();
      expect(less()).toHaveStyle({ opacity: 0.45 });
      expect(more()).toBeEnabled();
      expect(more()).not.toHaveStyle({ opacity: 0.45 });
      await fireEvent.press(
        screen.getByTestId('weekly-target-less', { includeHiddenElements: true }),
      );
      await fireEvent(screen.getByTestId('weekly-target-stepper'), 'accessibilityAction', {
        nativeEvent: { actionName: 'decrement' },
      });
      expect(onChange).not.toHaveBeenCalled();

      await screen.rerender(<WeeklyTargetPicker value={7} onChange={onChange} />);

      expect(more()).toBeDisabled();
      expect(more()).toHaveStyle({ opacity: 0.45 });
      expect(less()).toBeEnabled();
      expect(less()).not.toHaveStyle({ opacity: 0.45 });
      await fireEvent.press(
        screen.getByTestId('weekly-target-more', { includeHiddenElements: true }),
      );
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
