import { render, screen } from '@testing-library/react-native';

import { DifficultyIcon, DifficultyLabel } from './DifficultyIcon';

const peaks = () => screen.queryAllByTestId('difficulty-peak', { includeHiddenElements: true });

describe('DifficultyIcon', () => {
  it.each([
    ['easy', 1],
    ['medium', 2],
    ['hard', 3],
  ] as const)('draws %s as %d summit(s): a shape, never a colour alone', async (difficulty, n) => {
    await render(<DifficultyIcon difficulty={difficulty} color="#B9C6E6" />);

    expect(peaks()).toHaveLength(n);
    expect(
      screen.getByTestId(`difficulty-icon-${difficulty}`, { includeHiddenElements: true }),
    ).toBeTruthy();
  });

  it('is decorative: the screen reader hears the difficulty in words', async () => {
    await render(<DifficultyIcon difficulty="hard" color="#B9C6E6" />);

    expect(screen.queryByTestId('difficulty-icon-hard')).not.toBeOnTheScreen();
  });

  it.each([
    ['easy', { borderLeftWidth: 6, borderRightWidth: 6, borderBottomWidth: 12 }],
    ['medium', { borderLeftWidth: 6, borderRightWidth: 6, borderBottomWidth: 11 }],
    ['hard', { borderLeftWidth: 5, borderRightWidth: 5, borderBottomWidth: 10 }],
  ] as const)(
    'draws the summits of %s as in the mockup frame of 30 × 16',
    async (difficulty, peak) => {
      await render(<DifficultyIcon difficulty={difficulty} color="#B9C6E6" size={30} />);

      expect(
        screen.getByTestId(`difficulty-icon-${difficulty}`, { includeHiddenElements: true }),
      ).toHaveStyle({ width: 30, height: 16 });
      peaks().forEach((each) => expect(each).toHaveStyle(peak));
    },
  );

  it('scales the summits with the size', async () => {
    await render(<DifficultyIcon difficulty="easy" color="#B9C6E6" size={15} />);

    expect(screen.getByTestId('difficulty-icon-easy', { includeHiddenElements: true })).toHaveStyle(
      { width: 15, height: 8 },
    );
    expect(peaks()[0]).toHaveStyle({ borderLeftWidth: 3, borderBottomWidth: 6 });
  });

  it('is 20 wide by default, as on the rows of the mockup', async () => {
    await render(<DifficultyIcon difficulty="easy" color="#B9C6E6" />);

    expect(screen.getByTestId('difficulty-icon-easy', { includeHiddenElements: true })).toHaveStyle(
      { width: 20, height: 11 },
    );
  });

  it('takes the colour it is given, to follow the text beside it', async () => {
    await render(<DifficultyIcon difficulty="easy" color="#8FE8BF" />);

    expect(peaks()[0]).toHaveStyle({ borderBottomColor: '#8FE8BF' });
  });
});

describe('DifficultyLabel', () => {
  it('writes the difficulty beside its icon, and reads it with what a check-in brings', async () => {
    await render(<DifficultyLabel difficulty="hard" color="#9AA4B8" testID="label" />);

    expect(screen.getByTestId('label')).toHaveTextContent('Difficile');
    expect(screen.getByLabelText('Difficile, 20 XP par suivi')).toBeOnTheScreen();
    expect(peaks()).toHaveLength(3);
    expect(screen.getByText('Difficile')).toHaveStyle({ color: '#9AA4B8' });
  });
});
