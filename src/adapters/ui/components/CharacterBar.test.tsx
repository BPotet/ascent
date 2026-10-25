import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, Dimensions, StyleSheet } from 'react-native';

import { InMemoryUnitOfWork } from '../../../application/testing/InMemoryUnitOfWork';
import { settableClock } from '../../../application/testing/settableClock';
import { createHabit } from '../../../application/useCases/createHabit';
import { toggleCheckIn } from '../../../application/useCases/toggleCheckIn';
import { Day } from '../../../domain/day/Day';
import { artPalette } from '../pixelArt/artPalette';
import { pixelFont, textFont } from '../pixelArt/pixelTypography';
import { TARGET_BONUS_DELAY_MS } from '../state/xpFeedback';
import { memoryKeyValueStore } from '../testing/memoryKeyValueStore';
import { renderScreen } from '../testing/renderScreen';
import { silentHaptics } from '../testing/silentHaptics';
import { CharacterBar } from './CharacterBar';

const thin = '\u202f';
const hidden = { includeHiddenElements: true };
const { roles } = artPalette;
const wednesday = Day.of(2026, 10, 21);

const shownXp = () => screen.getByTestId('xp-counter').props.children;
const spriteOf = (testID: string) => screen.getByTestId(testID, hidden).props.sprite as string;
const plate = () => screen.getByTestId('character-plate');

describe('CharacterBar', () => {
  let unitOfWork: InMemoryUnitOfWork;
  const deps = () => ({
    clock: settableClock(wednesday),
    unitOfWork,
    keyValueStore: memoryKeyValueStore(),
    haptics: silentHaptics(),
  });
  const show = (element: Parameters<typeof renderScreen>[0]) => renderScreen(element, deps());

  beforeEach(() => {
    unitOfWork = new InMemoryUnitOfWork();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false);
  });

  it('shows the experience of the character, in the pixel font (R24)', async () => {
    await show(<CharacterBar xp={1510} change={null} />);

    expect(screen.getByText('Expérience du personnage')).toHaveStyle({
      fontFamily: textFont.medium,
    });
    expect(shownXp()).toBe(`1${thin}510 XP`);
    expect(screen.getByTestId('xp-counter')).toHaveStyle({ fontFamily: pixelFont, fontSize: 24 });
    expect(screen.getByLabelText(`Expérience du personnage : 1${thin}510 XP`)).toBeOnTheScreen();
  });

  it('shows no level and no experience gauge', async () => {
    await show(<CharacterBar xp={340} change={null} />);

    expect(screen.queryByText(/niveau/iu, hidden)).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('shows the character in pixels, before the day sky and the tower, hidden from the screen reader', async () => {
    await show(<CharacterBar xp={340} change={null} />);

    expect(spriteOf('character-sprite')).toBe('character-0');
    expect(screen.getByTestId('character-sprite', hidden).props.scale).toBe(2);
    expect(spriteOf('day-sky')).toMatch(/^day-sky:0:/u);
    expect(screen.getByTestId('day-sky', hidden).props.scale).toBe(2);
    expect(screen.queryByTestId('day-sky')).toBeNull();
    expect(screen.queryByTestId('character-sprite')).toBeNull();
  });

  it('paints the day sky at the width of the screen: half of it in art pixels', async () => {
    await show(<CharacterBar xp={340} change={null} />);

    const sky = screen.getByTestId('day-sky', hidden);
    expect(sky.props).toMatchObject({
      pixelWidth: Math.ceil(Dimensions.get('window').width / 2),
      pixelHeight: 66,
    });
    expect(screen.getByTestId('character-sprite', hidden).props).toMatchObject({
      pixelWidth: 24,
      pixelHeight: 32,
    });
  });

  it('grows with its text, and paints the sky again at its new height', async () => {
    await show(<CharacterBar xp={340} change={null} />);
    const bar = screen.getByTestId('character-bar').parent;

    await fireEvent(bar as never, 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 180 } },
    });

    expect(spriteOf('day-sky')).toMatch(/x90$/u);
    expect(screen.getByTestId('day-sky', hidden).props.pixelHeight).toBe(90);
  });

  it('never paints the sky lower than the header', async () => {
    await show(<CharacterBar xp={340} change={null} />);
    const bar = screen.getByTestId('character-bar').parent;

    await fireEvent(bar as never, 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 100 } },
    });

    expect(spriteOf('day-sky')).toMatch(/x66$/u);
  });

  it('raises its lantern at sunrise, when every expected habit is done', async () => {
    const clock = settableClock(wednesday);
    await createHabit({ clock, unitOfWork }, 'Cuisiner');
    await toggleCheckIn({ clock, unitOfWork }, 1, wednesday);

    await show(<CharacterBar xp={10} change={null} />);

    await waitFor(() => expect(spriteOf('character-sprite')).toBe('character-2'));
  });

  it('lights the day sky with the habits done today', async () => {
    const clock = settableClock(wednesday);
    for (const name of ['Cuisiner', 'Lire', 'Courir', 'Méditer', 'Marcher']) {
      await createHabit({ clock, unitOfWork }, name);
    }
    await toggleCheckIn({ clock, unitOfWork }, 1, wednesday);
    await toggleCheckIn({ clock, unitOfWork }, 2, wednesday);

    await show(<CharacterBar xp={20} change={null} />);

    await waitFor(() => expect(spriteOf('day-sky')).toMatch(/^day-sky:0\.4:/u));
  });

  it('is 132 dp high, and 92 dp in the week and month views', async () => {
    await show(<CharacterBar xp={340} change={null} />);
    expect(screen.getByTestId('character-bar')).toHaveStyle({ minHeight: 132 });

    await screen.rerender(<CharacterBar xp={340} change={null} compact />);
    expect(screen.getByTestId('character-bar')).toHaveStyle({ minHeight: 92 });
  });

  it('shows a placeholder while the experience is read', async () => {
    await show(<CharacterBar xp={null} change={null} />);

    expect(screen.getByTestId('character-bar-loading', hidden)).toBeOnTheScreen();
    expect(screen.queryByTestId('xp-counter')).not.toBeOnTheScreen();
    expect(screen.queryByText(/XP/)).not.toBeOnTheScreen();
  });

  it('shows the new experience at once, without counting nor scaling it', async () => {
    await show(<CharacterBar xp={340} change={null} />);
    const timing = jest.spyOn(Animated, 'timing');

    await screen.rerender(<CharacterBar xp={350} change={{ id: 1, amount: 10 }} />);

    expect(shownXp()).toBe('350 XP');
    expect(screen.getByLabelText('Expérience du personnage : 350 XP')).toBeOnTheScreen();
    expect(timing).not.toHaveBeenCalled();
  });

  it('shows a gain in a gold pill, in the pixel font at 18', async () => {
    await show(<CharacterBar xp={350} change={{ id: 1, amount: 10 }} />);

    const pill = screen.getByTestId('xp-change', hidden);
    expect(pill).toHaveTextContent('+10 XP');
    expect(pill).toHaveStyle({ backgroundColor: roles.gold });
    expect(screen.getByText('+10 XP', hidden)).toHaveStyle({
      fontFamily: pixelFont,
      fontSize: 18,
      color: roles.ink,
    });
    expect(pill).toHaveProp('pointerEvents', 'none');
  });

  it('shows a loss in a discreet grey pill', async () => {
    await show(<CharacterBar xp={340} change={{ id: 1, amount: -10 }} />);

    expect(screen.getByTestId('xp-change', hidden)).toHaveTextContent('−10 XP');
    expect(screen.getByTestId('xp-change', hidden)).toHaveStyle({ backgroundColor: roles.raised });
    expect(screen.getByText('−10 XP', hidden)).toHaveStyle({ color: roles.parchment });
  });

  it('shows no pill without a change', async () => {
    await show(<CharacterBar xp={40} change={null} />);

    expect(screen.queryByTestId('xp-change', hidden)).not.toBeOnTheScreen();
  });

  it('lets the pill come up by steps of 2 dp', async () => {
    jest.useFakeTimers();
    await show(<CharacterBar xp={350} change={{ id: 1, amount: 10 }} />);
    const offset = () =>
      (
        StyleSheet.flatten(screen.getByTestId('xp-change', hidden).props.style).transform as {
          translateY: number;
        }[]
      )[0]?.translateY;

    expect(offset()).toBe(6);
    await act(async () => jest.advanceTimersByTime(83));
    expect(offset()).toBe(4);
    await act(async () => jest.advanceTimersByTime(83));
    await act(async () => jest.advanceTimersByTime(83));
    expect(offset()).toBe(0);
  });

  it('borders the experience plate in gold for one frame after a gain', async () => {
    jest.useFakeTimers();
    await show(<CharacterBar xp={340} change={null} />);
    expect(plate()).toHaveStyle({ borderColor: roles.line });

    await screen.rerender(<CharacterBar xp={350} change={{ id: 1, amount: 10 }} />);
    expect(plate()).toHaveStyle({ borderColor: roles.gold });

    await act(async () => jest.advanceTimersByTime(83));
    expect(plate()).toHaveStyle({ borderColor: roles.line });
  });

  it('does not border the plate in gold for a loss', async () => {
    await show(<CharacterBar xp={340} change={{ id: 1, amount: -10 }} />);

    expect(plate()).toHaveStyle({ borderColor: roles.line });
  });

  describe('target bonus (#26)', () => {
    it('shows the bonus in a second pill, 0.4 s after the case', async () => {
      jest.useFakeTimers();
      await show(<CharacterBar xp={20} change={null} />);

      await screen.rerender(<CharacterBar xp={45} change={{ id: 1, amount: 25, bonus: 15 }} />);

      expect(screen.getByTestId('xp-change', hidden)).toHaveTextContent('+10 XP');
      expect(screen.queryByTestId('xp-change-bonus', hidden)).toBeNull();
      await act(async () => jest.advanceTimersByTime(TARGET_BONUS_DELAY_MS));
      const bonus = screen.getByTestId('xp-change-bonus', hidden);
      expect(bonus).toHaveTextContent('+15 XP prime');
      expect(bonus).toHaveStyle({ backgroundColor: roles.light });
      expect(screen.getByText('+15 XP prime', hidden)).toHaveStyle({ fontSize: 18 });
    });

    it('shows a lost bonus in grey, at the same time as the case', async () => {
      await show(<CharacterBar xp={45} change={{ id: 1, amount: -25, bonus: -15 }} />);

      expect(screen.getByTestId('xp-change', hidden)).toHaveTextContent('−10 XP');
      expect(screen.getByTestId('xp-change-bonus', hidden)).toHaveTextContent('−15 XP prime');
      expect(screen.getByTestId('xp-change-bonus', hidden)).toHaveStyle({
        backgroundColor: roles.raised,
      });
    });

    it('shows the bonus alone when the case brings nothing (objectif baissé, E7)', async () => {
      await show(<CharacterBar xp={13} change={{ id: 1, amount: 3, bonus: 3 }} />);

      expect(screen.queryByTestId('xp-change', hidden)).not.toBeOnTheScreen();
      expect(screen.getByTestId('xp-change-bonus', hidden)).toHaveTextContent('+3 XP prime');
    });

    it('shows both pills at once, in place, when the motion is reduced', async () => {
      jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(true);
      await show(<CharacterBar xp={20} change={null} />);
      await act(async () => undefined);

      await screen.rerender(<CharacterBar xp={45} change={{ id: 1, amount: 25, bonus: 15 }} />);

      expect(screen.getByTestId('xp-change-bonus', hidden)).toHaveStyle({
        transform: [{ translateY: 0 }],
      });
      expect(screen.getByTestId('xp-change', hidden)).toHaveStyle({
        transform: [{ translateY: 0 }],
      });
      expect(plate()).toHaveStyle({ borderColor: roles.line });
      expect(shownXp()).toBe('45 XP');
    });

    it('shows the pills beside the experience, under its label, never over it (F1-2)', async () => {
      await show(<CharacterBar xp={45} change={{ id: 1, amount: 25, bonus: 15 }} />);

      const pills = screen.getByTestId('xp-change-pills', hidden);
      expect(within(plate()).getByTestId('xp-change-pills', hidden)).toBe(pills);
      expect(pills.parent).toBe(screen.getByTestId('xp-counter').parent);
      expect(screen.getByTestId('xp-row')).toHaveStyle({ flexWrap: 'wrap' });
    });

    it('keeps both pills whole, the label giving way, on a narrow screen (320 dp)', async () => {
      await show(<CharacterBar xp={45} change={{ id: 1, amount: 25, bonus: 15 }} />);

      expect(screen.getByTestId('xp-change-pills', hidden)).toHaveStyle({ flexShrink: 0 });
      expect(screen.getByTestId('character-bar-texts')).toHaveStyle({ flexShrink: 1, minWidth: 0 });
    });
  });
});
