import { act, fireEvent, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { InMemoryUnitOfWork } from '../../../application/testing/InMemoryUnitOfWork';
import { settableClock } from '../../../application/testing/settableClock';
import { Day } from '../../../domain/day/Day';
import { artPalette } from '../pixelArt/artPalette';
import { pixelFont, textFont } from '../pixelArt/pixelTypography';
import { memoryKeyValueStore } from '../testing/memoryKeyValueStore';
import { renderScreen } from '../testing/renderScreen';
import { silentHaptics } from '../testing/silentHaptics';
import { StartupErrorScreen, StartupLoadingScreen } from './StartupScreen';

const hidden = { includeHiddenElements: true };
const { roles } = artPalette;
const dependencies = {
  clock: settableClock(Day.of(2026, 10, 14)),
  unitOfWork: new InMemoryUnitOfWork(),
  keyValueStore: memoryKeyValueStore(),
  haptics: silentHaptics(),
};
const lit = () =>
  screen
    .getAllByTestId(/^startup-square-/u, hidden)
    .map((square) => square.props.testID.endsWith('-lit'));

describe('Startup screens', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false);
  });

  it('shows the tower in the night, hidden from the screen reader, and a loading indicator', async () => {
    await renderScreen(<StartupLoadingScreen titleShown />, dependencies);

    expect(screen.getByLabelText('Chargement')).toBeOnTheScreen();
    expect(screen.getByTestId('startup-sky', hidden).props.sprite).toMatch(/^startup-sky:/u);
    expect(screen.queryByTestId('startup-sky')).toBeNull();
    expect(screen.getByTestId('startup-loading')).toHaveStyle({ backgroundColor: roles.night });
  });

  it('shows the title in the pixel font, once the fonts are loaded', async () => {
    await renderScreen(<StartupLoadingScreen titleShown={false} />, dependencies);
    expect(screen.queryByText('Ascent')).toBeNull();

    await screen.rerender(<StartupLoadingScreen titleShown />);
    expect(screen.getByText('Ascent')).toHaveStyle({ fontFamily: pixelFont, color: roles.gold });
  });

  it('lights three squares in turn', async () => {
    jest.useFakeTimers();
    await renderScreen(<StartupLoadingScreen titleShown />, dependencies);
    await act(async () => undefined);
    const seen = [];
    for (let frame = 0; frame < 12; frame += 1) {
      seen.push(lit().indexOf(true));
      await act(async () => jest.advanceTimersByTime(83));
    }

    expect(new Set(seen)).toEqual(new Set([0, 1, 2]));
    expect(lit().filter(Boolean)).toHaveLength(1);
  });

  it('keeps the three squares still when the motion is reduced', async () => {
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(true);
    jest.useFakeTimers();
    await renderScreen(<StartupLoadingScreen titleShown />, dependencies);
    await act(async () => undefined);
    const before = lit();

    await act(async () => jest.advanceTimersByTime(83 * 6));

    expect(lit()).toEqual(before);
    expect(before).toEqual([true, true, true]);
  });

  it('explains the error in the text font, under the alert emblem, and offers to retry', async () => {
    const onRetry = jest.fn();
    await renderScreen(<StartupErrorScreen onRetry={onRetry} />, dependencies);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Impossible d’ouvrir les données enregistrées sur le téléphone.',
    );
    expect(screen.getByRole('alert')).toHaveStyle({ fontFamily: textFont.semiBold });
    expect(screen.getByTestId('startup-emblem', hidden).props.sprite).toBe('alert-emblem');
    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
