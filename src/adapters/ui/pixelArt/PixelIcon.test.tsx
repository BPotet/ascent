import { render, screen } from '@testing-library/react-native';
import { PixelRatio } from 'react-native';

import { PixelIcon, PixelRows } from './PixelIcon';

const hidden = { includeHiddenElements: true };

describe('PixelIcon', () => {
  beforeEach(() =>
    jest.spyOn(PixelRatio, 'roundToNearestPixel').mockImplementation((size) => size),
  );
  afterEach(() => jest.restoreAllMocks());

  it('draws a 12 × 12 icon on 24 dp, hidden from the screen reader', async () => {
    await render(<PixelIcon name="check12" color="#6FD3A0" testID="icon" />);

    const icon = screen.getByTestId('icon', hidden);
    expect(icon).toHaveStyle({ width: 24, height: 24 });
    expect(icon).toHaveProp('accessibilityElementsHidden', true);
    expect(icon).toHaveProp('importantForAccessibility', 'no-hide-descendants');
  });

  it('draws an 8 × 8 icon on 16 dp', async () => {
    await render(<PixelIcon name="flag8" color="#F2D49B" testID="icon" />);

    expect(screen.getByTestId('icon', hidden)).toHaveStyle({ width: 16, height: 16 });
  });

  it('draws one view per run of pixels of the same color, at a whole art pixel', async () => {
    await render(
      <PixelRows rows={['XXY.', '.kk.']} color="#111111" secondColor="#222222" testID="rows" />,
    );

    const runs = screen.getByTestId('rows', hidden).children as unknown as {
      props: { style: unknown };
    }[];
    expect(runs.map(({ props }) => props.style)).toEqual([
      expect.objectContaining({ left: 0, top: 0, width: 4, height: 2, backgroundColor: '#111111' }),
      expect.objectContaining({ left: 4, top: 0, width: 2, backgroundColor: '#222222' }),
      expect.objectContaining({ left: 2, top: 2, width: 4, backgroundColor: '#06070C' }),
    ]);
  });

  it('uses the main color for the second color by default', async () => {
    await render(<PixelRows rows={['Y']} color="#123456" testID="rows" />);

    const [run] = screen.getByTestId('rows', hidden).children as unknown as {
      props: { style: unknown };
    }[];
    expect(run?.props.style).toEqual(expect.objectContaining({ backgroundColor: '#123456' }));
  });
});
