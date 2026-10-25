import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { artPalette } from './artPalette';
import { PixelSheet } from './PixelSheet';

const hidden = { includeHiddenElements: true };
const { roles } = artPalette;

describe('PixelSheet', () => {
  it('holds its content on the surface, with its handle', async () => {
    await render(
      <PixelSheet testID="sheet">
        <Text>Nouvelle habitude</Text>
      </PixelSheet>,
    );

    expect(screen.getByText('Nouvelle habitude')).toBeOnTheScreen();
    expect(screen.getByTestId('sheet-body')).toHaveStyle({ backgroundColor: roles.surface });
    expect(screen.getByTestId('pixel-sheet-grab', hidden)).toHaveStyle({
      width: 40,
      height: 4,
      backgroundColor: roles.line,
    });
  });

  it('notches its top corners by one art pixel, with its line then its raised edge', async () => {
    await render(<PixelSheet testID="sheet" />);

    const [line, raised] = screen.getAllByTestId('pixel-sheet-edge', hidden);
    expect(line).toHaveStyle({ height: 2, marginHorizontal: 4, backgroundColor: roles.line });
    expect(raised).toHaveStyle({ height: 2, marginHorizontal: 2, backgroundColor: roles.raised });
  });

  it('is decorative: its edges and handle are not read', async () => {
    await render(<PixelSheet testID="sheet" />);

    expect(screen.queryByTestId('pixel-sheet-grab')).toBeNull();
    expect(screen.queryAllByTestId('pixel-sheet-edge')).toHaveLength(0);
  });

  it('passes its other properties to the sheet', async () => {
    await render(<PixelSheet testID="sheet" accessibilityViewIsModal />);

    expect(screen.getByTestId('sheet')).toHaveProp('accessibilityViewIsModal', true);
  });
});
