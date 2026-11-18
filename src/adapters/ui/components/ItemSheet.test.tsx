// La fiche d'un objet découvert (#284, maquette 278, O3, D11) : une feuille avec l'image à 96 dp dans
// l'écrin de 112 dp, le nom, la rareté, l'effet en or et la description ; « Fermer », le retour
// Android, le voile et un glissement vers le bas la ferment.
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import {
  AccessibilityInfo,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native';

import { swipe } from '../testing/swipe';
import { ItemSheet, closesOnSwipe, swipeDownToClose } from './ItemSheet';

async function show(item: 'hammer' | 'hasteAmulet' = 'hammer') {
  const onClose = jest.fn();
  await render(<ItemSheet item={item} onClose={onClose} />);
  return { onClose };
}

const gesture = (dy: number, vy: number, dx = 0) =>
  ({ dx, dy, vx: 0, vy }) as PanResponderGestureState;
const event = {} as GestureResponderEvent;

describe('ItemSheet (#284, O3)', () => {
  it('shows the image, the name, the rarity, the effect, the description and the note', async () => {
    await show();

    expect(screen.getByTestId('item-sheet')).toHaveProp('accessibilityLabel', 'Marteau, Rare');
    expect(screen.getByTestId('item-sheet')).toHaveProp('accessibilityViewIsModal', true);
    expect(screen.getByRole('header', { name: 'Marteau' })).toBeOnTheScreen();
    expect(screen.getByText('◆◆ Rare · Arme')).toBeOnTheScreen();
    expect(screen.getByText('Brise-garde ×1,6 · Initiative −1')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Un marteau de forge, trop lourd pour un combat rapide. Aucune garde ne lui résiste longtemps.',
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByText("Trouvé dans la tour. Il se porte le temps d'une ascension."),
    ).toBeOnTheScreen();
    const image = screen.getByTestId('item-sheet-image', { includeHiddenElements: true });
    expect(image).toHaveProp('sprite', 'item-hammer');
    const { pixelWidth, scale } = image.props;
    expect(pixelWidth * scale).toBe(96);
  });

  it('shows the description copied from the Codex for the Haste amulet (D14)', async () => {
    await show('hasteAmulet');

    expect(
      screen.getByText(
        'Un pendentif de verre où tourne un sable qui ne tombe jamais. Celui qui le porte agit avant les autres.',
      ),
    ).toBeOnTheScreen();
  });

  it('closes on « Fermer »', async () => {
    const { onClose } = await show();

    await fireEvent.press(screen.getByRole('button', { name: 'Fermer' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on the back button of Android, and on the scrim', async () => {
    const { onClose } = await show();

    await fireEvent(screen.getByTestId('item-sheet-modal'), 'requestClose');
    await fireEvent.press(screen.getByTestId('item-sheet-scrim', { includeHiddenElements: true }));

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('closes on a swipe down far enough, not on a short or upward one', async () => {
    const { onClose } = await show();
    const sheet = screen.getByTestId('item-sheet');

    await swipe(sheet, 40, 400);
    await swipe(sheet, -150, 200);
    expect(onClose).not.toHaveBeenCalled();
    await swipe(sheet, 120, 400);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('ItemSheet and the reduced motion', () => {
  const reduceMotion = jest.mocked(AccessibilityInfo.isReduceMotionEnabled);

  afterEach(() => {
    reduceMotion.mockResolvedValue(false);
  });

  it('slides up, or appears at once with reduced motion', async () => {
    reduceMotion.mockResolvedValue(false);
    await show();
    await act(async () => {});
    expect(screen.getByTestId('item-sheet-modal')).toHaveProp('animationType', 'slide');

    reduceMotion.mockResolvedValue(true);
    await show();
    await act(async () => {});
    expect(screen.getByTestId('item-sheet-modal')).toHaveProp('animationType', 'none');
  });
});

describe('the swipe down of the item sheet (#284, D11)', () => {
  it('closes beyond 80 dp down, or faster than 0.5 dp per ms down', () => {
    expect(closesOnSwipe(81, 0)).toBe(true);
    expect(closesOnSwipe(20, 0.6)).toBe(true);
    expect(closesOnSwipe(80, 0.5)).toBe(false);
    expect(closesOnSwipe(10, 0.1)).toBe(false);
  });

  it('never closes upwards', () => {
    expect(closesOnSwipe(-120, -1)).toBe(false);
    expect(closesOnSwipe(-10, 0.8)).toBe(false);
  });

  it('takes a vertical move down, never a tap nor a sideways move', () => {
    const onClose = jest.fn();
    const config = swipeDownToClose(onClose);

    expect(config.onMoveShouldSetPanResponder!(event, gesture(12, 0.1))).toBe(true);
    expect(config.onMoveShouldSetPanResponder!(event, gesture(4, 0))).toBe(false);
    expect(config.onMoveShouldSetPanResponder!(event, gesture(12, 0, 30))).toBe(false);
    expect(config.onMoveShouldSetPanResponder!(event, gesture(-20, -0.5))).toBe(false);
  });

  it('closes the sheet at the release of a swipe far or fast enough, not otherwise', () => {
    const onClose = jest.fn();
    const config = swipeDownToClose(onClose);

    config.onPanResponderRelease!(event, gesture(30, 0.1));
    expect(onClose).not.toHaveBeenCalled();
    config.onPanResponderRelease!(event, gesture(120, 0.1));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
