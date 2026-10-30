// Une image recopiée de l'Atelier, rendue par des `View` (#155, avenant à l'ADR 0007 § 2).
import { render, screen } from '@testing-library/react-native';
import { PixelRatio, StyleSheet, type ViewStyle } from 'react-native';

import { AssetRows } from './AssetRows';
import { artPalette } from './artPalette';
import type { AssetImage } from './sprites/atelier/fullAnimation';
import { BULWARK_SHIELD } from './sprites/atelier/data/bulwarkShield';

const hidden = { includeHiddenElements: true };

type Run = { props: { style: unknown } };
const runsOf = (testID: string) =>
  (screen.getByTestId(testID, hidden).children as unknown as Run[]).map(({ props }) =>
    StyleSheet.flatten(props.style as ViewStyle),
  );

const IMAGE: AssetImage = {
  w: 4,
  h: 2,
  palette: ['#06070c', '#D9DCE6'],
  rows: ['0011', '.1..'],
};

describe('AssetRows', () => {
  beforeEach(() =>
    jest.spyOn(PixelRatio, 'roundToNearestPixel').mockImplementation((size) => size),
  );
  afterEach(() => jest.restoreAllMocks());

  it.each([
    [1, 4, 2],
    [2, 8, 4],
    [3, 12, 6],
  ] as const)('draws the image at ×%p, on %p × %p dp', async (scale, width, height) => {
    await render(<AssetRows image={IMAGE} scale={scale} testID="asset" />);

    expect(screen.getByTestId('asset', hidden)).toHaveStyle({ width, height });
  });

  it('draws one view per run of pixels of the same tint, nothing for a transparent pixel', async () => {
    await render(<AssetRows image={IMAGE} scale={2} testID="asset" />);

    expect(runsOf('asset')).toEqual([
      expect.objectContaining({ left: 0, top: 0, width: 4, height: 2, backgroundColor: '#06070C' }),
      expect.objectContaining({ left: 4, top: 0, width: 4, height: 2, backgroundColor: '#D9DCE6' }),
      expect.objectContaining({ left: 2, top: 2, width: 2, height: 2, backgroundColor: '#D9DCE6' }),
    ]);
  });

  it('paints only the tints of the palette of the image, as the art palette writes them', async () => {
    await render(<AssetRows image={BULWARK_SHIELD.cracked} scale={1} testID="asset" />);

    const used = new Set(runsOf('asset').map((style) => style.backgroundColor));
    const palette: readonly (string | null | undefined)[] = BULWARK_SHIELD.cracked.palette.map(
      (tint) => artPalette.tints.find((known) => known?.toLowerCase() === tint.toLowerCase()),
    );
    expect([...used].every((color) => palette.includes(color as string))).toBe(true);
    expect(used.size).toBeGreaterThan(1);
  });

  it('covers the opaque pixels of the image exactly, one art pixel each', async () => {
    await render(<AssetRows image={BULWARK_SHIELD.whole} scale={1} testID="asset" />);

    const covered = runsOf('asset').reduce((total, style) => total + Number(style.width), 0);
    const opaque = BULWARK_SHIELD.whole.rows.join('').replaceAll('.', '').length;
    expect(covered).toBe(opaque);
  });

  it('is decorative: hidden from the screen reader, never touched', async () => {
    await render(<AssetRows image={IMAGE} scale={1} testID="asset" />);

    const asset = screen.getByTestId('asset', hidden);
    expect(asset).toHaveProp('accessibilityElementsHidden', true);
    expect(asset).toHaveProp('importantForAccessibility', 'no-hide-descendants');
    expect(asset).toHaveProp('pointerEvents', 'none');
  });
});
