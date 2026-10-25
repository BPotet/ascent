import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Difficulty } from '../../../domain/habit/Difficulty';
import { artPalette } from '../pixelArt/artPalette';
import { textFont } from '../pixelArt/pixelTypography';
import { DifficultyPicker } from './DifficultyPicker';

const { roles } = artPalette;

async function show(value: Difficulty = 'medium') {
  const onChange = jest.fn();
  await render(<DifficultyPicker value={value} onChange={onChange} />);
  return onChange;
}

const option = (name: string) => screen.getByRole('radio', { name: new RegExp(`^${name},`, 'u') });

describe('DifficultyPicker', () => {
  it('is a radio group « Difficulté », titled as in the mockup (E2, E7)', async () => {
    await show();

    // Le groupe n'est pas un élément focalisable à lui seul : ses options le restent.
    const group = screen.getByTestId('difficulty-picker');
    expect(group).toHaveProp('accessibilityRole', 'radiogroup');
    expect(group).toHaveAccessibleName('Difficulté');
    expect(screen.getByText('Difficulté')).toBeOnTheScreen();
  });

  it('offers the three difficulties in order, each with its icon and what a check-in brings', async () => {
    await show();

    const options = screen.getAllByRole('radio');
    expect(options.map((each) => each.props.accessibilityLabel)).toEqual([
      'Facile, 5 XP par suivi',
      'Moyenne, 10 XP par suivi',
      'Difficile, 20 XP par suivi',
    ]);
    expect(screen.getByTestId('difficulty-option-easy')).toHaveTextContent('Facile+5 XP');
    expect(screen.getByTestId('difficulty-option-medium')).toHaveTextContent('Moyenne+10 XP');
    expect(screen.getByTestId('difficulty-option-hard')).toHaveTextContent('Difficile+20 XP');
    expect(screen.getAllByTestId('difficulty-peak', { includeHiddenElements: true })).toHaveLength(
      1 + 2 + 3,
    );
  });

  it('marks the chosen difficulty as selected, and only it', async () => {
    await show('hard');

    expect(
      screen.getByRole('radio', { name: 'Difficile, 20 XP par suivi', checked: true }),
    ).toBeOnTheScreen();
    expect(option('Difficile')).toBeChecked();
    expect(option('Facile')).not.toBeChecked();
    expect(option('Moyenne')).not.toBeChecked();
    expect(option('Difficile')).toBeSelected();
    expect(option('Moyenne')).not.toBeSelected();
  });

  it('shows the selection otherwise than by colour alone: a gold frame, a tick and a bold text', async () => {
    await show('easy');

    expect(screen.getByTestId('choice-frame-difficulty-option-easy')).toHaveStyle({
      borderColor: roles.gold,
    });
    expect(screen.getByTestId('choice-frame-difficulty-option-medium')).toHaveStyle({
      borderColor: roles.line,
    });
    expect(screen.getAllByTestId('choice-tick', { includeHiddenElements: true })).toHaveLength(1);
    expect(screen.getByText('Facile')).toHaveStyle({ fontFamily: textFont.bold });
    expect(screen.getByText('Moyenne')).toHaveStyle({ fontFamily: textFont.semiBold });
  });

  it('passes on the difficulty touched', async () => {
    const onChange = await show('medium');

    await fireEvent.press(option('Difficile'));
    expect(onChange).toHaveBeenLastCalledWith('hard');
    await fireEvent.press(option('Facile'));
    expect(onChange).toHaveBeenLastCalledWith('easy');
  });

  it('gives each option a target of at least 72 dp high (mockup E2)', async () => {
    await show();

    expect(screen.getByTestId('difficulty-option-medium')).toHaveStyle({ minHeight: 72 });
  });
});
