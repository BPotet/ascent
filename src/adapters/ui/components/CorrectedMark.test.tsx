import { render, screen } from '@testing-library/react-native';

import { artPalette } from '../pixelArt/artPalette';
import { CorrectedMark } from './CorrectedMark';

const hidden = { includeHiddenElements: true };
const { roles } = artPalette;
const mark = () => screen.getByTestId('corrected-mark', hidden);

describe('CorrectedMark', () => {
  it('is a light square of 6 dp ringed with ink, in the corner of a cell', async () => {
    await render(<CorrectedMark />);

    expect(mark()).toHaveStyle({
      position: 'absolute',
      width: 10,
      height: 10,
      borderWidth: 2,
      borderColor: roles.ink,
      backgroundColor: roles.light,
    });
  });

  it('is a light square of 4 dp on a day of the Month view', async () => {
    await render(<CorrectedMark size="day" />);

    expect(mark()).toHaveStyle({ width: 4, height: 4, backgroundColor: roles.light });
  });

  it('is a light square of 4 dp ringed with ink in a legend', async () => {
    await render(<CorrectedMark size="legend" />);

    expect(mark()).toHaveStyle({ width: 8, height: 8, borderWidth: 2, borderColor: roles.ink });
  });

  it('is decorative: the word « corrigé » is read in the announcement', async () => {
    await render(<CorrectedMark />);

    expect(screen.queryByTestId('corrected-mark')).toBeNull();
  });
});
