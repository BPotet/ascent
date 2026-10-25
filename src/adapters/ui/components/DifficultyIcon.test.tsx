import { render, screen } from '@testing-library/react-native';

import { artPalette } from '../pixelArt/artPalette';
import { textFont } from '../pixelArt/pixelTypography';
import { DifficultyIcon, DifficultyLabel } from './DifficultyIcon';

const hidden = { includeHiddenElements: true };
const peaks = () => screen.queryAllByTestId('difficulty-peak', hidden);

describe('DifficultyIcon (pixel art)', () => {
  it.each([
    ['easy', 1, 16],
    ['medium', 2, 26],
    ['hard', 3, 36],
  ] as const)('draws %s with %i joined peaks, %i dp wide', async (difficulty, count, width) => {
    await render(<DifficultyIcon difficulty={difficulty} />);

    expect(peaks()).toHaveLength(count);
    expect(screen.getByTestId(`difficulty-icon-${difficulty}`, hidden)).toHaveStyle({
      width,
      height: 16,
    });
  });

  it('is decorative', async () => {
    await render(<DifficultyIcon difficulty="hard" />);

    expect(screen.queryByTestId('difficulty-icon-hard')).toBeNull();
  });
});

describe('DifficultyLabel (pixel art)', () => {
  it('writes the difficulty beside its icon, and reads what a check-in earns', async () => {
    await render(<DifficultyLabel difficulty="medium" testID="label" />);

    expect(screen.getByTestId('label')).toHaveTextContent('Moyenne');
    expect(screen.getByLabelText('Moyenne, 10 XP par suivi')).toBeOnTheScreen();
    expect(screen.getByText('Moyenne')).toHaveStyle({
      fontFamily: textFont.medium,
      color: artPalette.roles.parchment,
    });
    expect(peaks()).toHaveLength(2);
  });
});
