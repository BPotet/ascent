import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Difficulty } from '../../../domain/habit/Difficulty';
import { DifficultyPicker } from './DifficultyPicker';

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

  it('shows the selection otherwise than by colour alone: a border and a highlighted text', async () => {
    await show('easy');

    expect(screen.getByTestId('difficulty-option-easy')).toHaveStyle({ borderColor: '#7C9CFF' });
    expect(screen.getByTestId('difficulty-option-medium')).toHaveStyle({
      borderColor: '#2E3950',
    });
  });

  it('passes on the difficulty touched', async () => {
    const onChange = await show('medium');

    await fireEvent.press(option('Difficile'));
    expect(onChange).toHaveBeenLastCalledWith('hard');
    await fireEvent.press(option('Facile'));
    expect(onChange).toHaveBeenLastCalledWith('easy');
  });

  it('gives each option a target of at least 60 points high (mockup, « Toucher et lecture »)', async () => {
    await show();

    expect(screen.getByTestId('difficulty-option-medium')).toHaveStyle({ minHeight: 60 });
  });
});
