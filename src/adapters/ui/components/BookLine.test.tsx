// La ligne du carnet (#282, maquette D1, D2) : en or, 500 ms après l'écran qui suit le combat, sans
// se toucher ; annoncée poliment ; en mouvement réduit, elle apparaît en fondu, sans glisser.
import { act, screen } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import { ascentSetUp } from '../testing/ascent';
import { renderScreen } from '../testing/renderScreen';
import { BOOK_LINE_DELAY_MS, BookLine } from './BookLine';

async function show(
  kinds: Parameters<typeof BookLine>[0]['kinds'],
  animate = true,
  reduced = false,
  onShown: () => void = () => undefined,
) {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(reduced);
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  announce.mockClear();
  const { dependencies } = ascentSetUp();
  const view = await renderScreen(
    <BookLine kinds={kinds} animate={animate} onShown={onShown} />,
    dependencies,
  );
  return { announce, view, onShown };
}

describe('BookLine', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false);
  });

  it('shows nothing without a filled page', async () => {
    await show([]);

    expect(screen.queryByTestId('book-line')).not.toBeOnTheScreen();
  });

  it('appears 500 ms after the screen, in gold, untouchable, then is announced politely', async () => {
    const { announce } = await show(['burningHusk']);

    const line = screen.getByTestId('book-line');
    expect(StyleSheet.flatten(line.props.style).opacity).toBe(0);
    expect(announce).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(BOOK_LINE_DELAY_MS + 300);
    });
    expect(BOOK_LINE_DELAY_MS).toBe(500);
    expect(StyleSheet.flatten(screen.getByTestId('book-line').props.style).opacity).toBe(1);
    expect(screen.getByText('Embrasé')).toHaveStyle({ color: '#F2D49B' });
    expect(screen.getByText(/Nouvelle page :/u)).toBeOnTheScreen();
    expect(screen.queryAllByRole('button')).toEqual([]);
    expect(line).toHaveProp('accessibilityLabel', 'Carnet : nouvelle page, Embrasé.');
    expect(announce).toHaveBeenCalledWith('Carnet : nouvelle page, Embrasé.');
  });

  it('slides 6 dp up as it appears, and only fades in with a reduced motion', async () => {
    await show(['burningHusk']);
    await act(async () => {
      jest.advanceTimersByTime(BOOK_LINE_DELAY_MS + 90);
    });
    const moving = StyleSheet.flatten(screen.getByTestId('book-line').props.style);
    expect(moving.transform).toEqual([{ translateY: expect.any(Number) }]);
    expect(moving.transform[0].translateY).toBeGreaterThan(0);
  });

  it('never slides with a reduced motion', async () => {
    await show(['burningHusk'], true, true);
    await act(async () => {
      jest.advanceTimersByTime(BOOK_LINE_DELAY_MS + 90);
    });
    const style = StyleSheet.flatten(screen.getByTestId('book-line').props.style);
    expect(style.transform).toEqual([{ translateY: 0 }]);
    expect(style.opacity).toBeGreaterThan(0);
  });

  it('announces once, and says once that it is shown, whatever the renders that follow', async () => {
    const onShown = jest.fn();
    const { announce, view } = await show(['burningHusk'], true, false, onShown);
    await act(async () => {
      jest.advanceTimersByTime(BOOK_LINE_DELAY_MS + 300);
    });
    // L'écran rend la ligne de nouveau, déjà vue : elle reste, sans se rejouer.
    await view.rerender(
      <BookLine kinds={['burningHusk']} animate={false} onShown={() => onShown()} />,
    );
    await act(async () => {
      jest.advanceTimersByTime(1_000);
    });
    expect(announce).toHaveBeenCalledTimes(1);
    expect(onShown).toHaveBeenCalledTimes(1);
    expect(StyleSheet.flatten(screen.getByTestId('book-line').props.style).opacity).toBe(1);
  });

  it('is already there on the next screens after the battle, without a second announcement', async () => {
    const { announce } = await show(['ghoul', 'specter', 'necromancer', 'skeleton'], false);

    expect(StyleSheet.flatten(screen.getByTestId('book-line').props.style).opacity).toBe(1);
    expect(screen.getByText('Goule, Spectre, Nécromancien … et 1 autre')).toBeOnTheScreen();
    expect(screen.getByText(/4 nouvelles pages :/u)).toBeOnTheScreen();
    await act(async () => {
      jest.advanceTimersByTime(2_000);
    });
    expect(announce).not.toHaveBeenCalled();
  });
});
