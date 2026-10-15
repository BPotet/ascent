import { act, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, Animated } from 'react-native';

import { CharacterBar, XP_COUNTER_DURATION_MS, XP_PULSE_DURATION_MS } from './CharacterBar';

const thin = ' ';
const reduceMotion = () =>
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValueOnce(true);

const shownXp = () => screen.getByTestId('xp-counter').props.children;

describe('CharacterBar', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('shows the experience of the character (R24)', async () => {
    await render(<CharacterBar xp={1510} change={null} />);

    expect(screen.getByText('Expérience du personnage')).toBeOnTheScreen();
    expect(shownXp()).toBe(`1${thin}510 XP`);
    expect(screen.getByLabelText(`Expérience du personnage : 1${thin}510 XP`)).toBeOnTheScreen();
    expect(screen.getByTestId('xp-counter')).toHaveStyle({ color: '#FFC94D' });
  });

  it('shows 0 XP to a new player', async () => {
    await render(<CharacterBar xp={0} change={null} />);

    expect(shownXp()).toBe('0 XP');
  });

  it('shows a placeholder while the experience is read', async () => {
    await render(<CharacterBar xp={null} change={null} />);

    expect(
      screen.getByTestId('character-bar-loading', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('xp-counter')).not.toBeOnTheScreen();
    expect(screen.queryByText(/XP/)).not.toBeOnTheScreen();
  });

  it('shows a new experience at once when it is read again, without a change to show', async () => {
    await render(<CharacterBar xp={40} change={null} />);
    const timing = jest.spyOn(Animated, 'timing');

    await screen.rerender(<CharacterBar xp={30} change={null} />);

    expect(shownXp()).toBe('30 XP');
    expect(timing).not.toHaveBeenCalled();
  });

  it('shows the experience once it is read', async () => {
    await render(<CharacterBar xp={null} change={null} />);

    await screen.rerender(<CharacterBar xp={40} change={null} />);

    expect(shownXp()).toBe('40 XP');
  });

  it('counts up to the new experience in 450 ms, and tells the new total at once', async () => {
    jest.useFakeTimers();
    await render(<CharacterBar xp={40} change={null} />);
    const timing = jest.spyOn(Animated, 'timing');

    await screen.rerender(<CharacterBar xp={50} change={{ id: 1, amount: 10 }} />);

    expect(screen.getByLabelText('Expérience du personnage : 50 XP')).toBeOnTheScreen();
    expect(timing.mock.calls.map(([, config]) => config.duration)).toContain(
      XP_COUNTER_DURATION_MS,
    );
    expect(XP_COUNTER_DURATION_MS).toBe(450);
    await act(() => jest.advanceTimersByTime(XP_COUNTER_DURATION_MS / 3));
    expect(shownXp()).not.toBe('40 XP');
    expect(shownXp()).not.toBe('50 XP');
    await act(() => jest.advanceTimersByTime(XP_COUNTER_DURATION_MS));
    expect(shownXp()).toBe('50 XP');
  });

  it('pulses for a gain', async () => {
    await render(<CharacterBar xp={40} change={null} />);
    const timing = jest.spyOn(Animated, 'timing');

    await screen.rerender(<CharacterBar xp={50} change={{ id: 1, amount: 10 }} />);

    const configs = timing.mock.calls.map(([, config]) => config);
    const grow = configs.findIndex(({ toValue }) => toValue === 1.14);
    expect(configs.filter(({ toValue }) => toValue === 1.14)).toHaveLength(1);
    expect(configs[grow + 1]?.toValue).toBe(1);
    expect((configs[grow]?.duration ?? 0) + (configs[grow + 1]?.duration ?? 0)).toBe(
      XP_PULSE_DURATION_MS,
    );
    expect(XP_PULSE_DURATION_MS).toBe(600);
  });

  it('does not pulse for a loss', async () => {
    await render(<CharacterBar xp={50} change={null} />);
    const timing = jest.spyOn(Animated, 'timing');

    await screen.rerender(<CharacterBar xp={40} change={{ id: 1, amount: -10 }} />);

    expect(timing.mock.calls.filter(([, config]) => config.toValue === 1.14)).toHaveLength(0);
  });

  it('shows a gain in a gold pill', async () => {
    await render(<CharacterBar xp={50} change={{ id: 1, amount: 10 }} />);

    expect(screen.getByTestId('xp-change', { includeHiddenElements: true })).toHaveTextContent(
      '+10 XP',
    );
    expect(screen.getByTestId('xp-change', { includeHiddenElements: true })).toHaveStyle({
      backgroundColor: '#FFC94D',
    });
  });

  it('shows a loss in a discreet grey pill', async () => {
    await render(<CharacterBar xp={40} change={{ id: 1, amount: -10 }} />);

    expect(screen.getByTestId('xp-change', { includeHiddenElements: true })).toHaveTextContent(
      '−10 XP',
    );
    expect(screen.getByTestId('xp-change', { includeHiddenElements: true })).toHaveStyle({
      backgroundColor: '#222B3D',
    });
  });

  it('shows no pill without a change', async () => {
    await render(<CharacterBar xp={40} change={null} />);

    expect(
      screen.queryByTestId('xp-change', { includeHiddenElements: true }),
    ).not.toBeOnTheScreen();
  });

  it('fades the pill in and out', async () => {
    const timing = jest.spyOn(Animated, 'timing');

    await render(<CharacterBar xp={50} change={{ id: 1, amount: 10 }} />);

    const fades = timing.mock.calls.filter(([, config]) => config.toValue === 0);
    expect(fades.length).toBeGreaterThan(0);
  });

  it('updates the experience at once, without pulse nor fade, when motion is reduced', async () => {
    reduceMotion();
    await render(<CharacterBar xp={40} change={null} />);
    await waitFor(() => expect(AccessibilityInfo.isReduceMotionEnabled).toHaveBeenCalled());
    await act(async () => undefined);
    const timing = jest.spyOn(Animated, 'timing');

    await screen.rerender(<CharacterBar xp={50} change={{ id: 1, amount: 10 }} />);

    expect(shownXp()).toBe('50 XP');
    expect(timing).not.toHaveBeenCalled();
    expect(screen.getByTestId('xp-change', { includeHiddenElements: true })).toHaveTextContent(
      '+10 XP',
    );
  });

  it('glows for a gain only', async () => {
    await render(<CharacterBar xp={50} change={{ id: 1, amount: 10 }} />);
    expect(screen.getByTestId('xp-counter')).toHaveStyle({ textShadowRadius: 18 });

    await screen.rerender(<CharacterBar xp={40} change={{ id: 2, amount: -10 }} />);
    expect(screen.getByTestId('xp-counter')).not.toHaveStyle({ textShadowRadius: 18 });
  });

  it('grows the counter for 35 % of the pulse, on the native thread', async () => {
    await render(<CharacterBar xp={40} change={null} />);
    const timing = jest.spyOn(Animated, 'timing');

    await screen.rerender(<CharacterBar xp={50} change={{ id: 1, amount: 10 }} />);

    const grow = timing.mock.calls.find(([, config]) => config.toValue === 1.14)?.[1];
    expect(grow).toMatchObject({ duration: 210, useNativeDriver: true });
  });

  it('writes the pill in dark on gold for a gain, in grey for a loss', async () => {
    await render(<CharacterBar xp={50} change={{ id: 1, amount: 10 }} />);
    expect(screen.getByText('+10 XP', { includeHiddenElements: true })).toHaveStyle({
      color: '#2A1E00',
    });

    await screen.rerender(<CharacterBar xp={40} change={{ id: 2, amount: -10 }} />);
    expect(screen.getByText('−10 XP', { includeHiddenElements: true })).toHaveStyle({
      color: '#9AA4B8',
    });
  });

  it('lets the pill appear from transparent, unless motion is reduced', async () => {
    await render(<CharacterBar xp={50} change={{ id: 1, amount: 10 }} />);
    expect(screen.getByTestId('xp-change', { includeHiddenElements: true })).toHaveStyle({
      opacity: 0,
    });
  });

  it('jumps to an experience read again while the last change is still shown', async () => {
    await render(<CharacterBar xp={40} change={null} />);
    await screen.rerender(<CharacterBar xp={50} change={{ id: 1, amount: 10 }} />);
    const timing = jest.spyOn(Animated, 'timing');

    await screen.rerender(<CharacterBar xp={60} change={{ id: 1, amount: 10 }} />);

    expect(timing.mock.calls.map(([, config]) => config.duration)).not.toContain(
      XP_COUNTER_DURATION_MS,
    );
  });

  it('stops its animations when it leaves the screen', async () => {
    const stop = jest.fn();
    const animation = { start: jest.fn(), stop, reset: jest.fn() };
    jest.spyOn(Animated, 'timing').mockReturnValue(animation);
    jest.spyOn(Animated, 'sequence').mockReturnValue(animation);
    await render(<CharacterBar xp={40} change={null} />);
    await screen.rerender(<CharacterBar xp={50} change={{ id: 1, amount: 10 }} />);
    expect(animation.start).toHaveBeenCalled();

    await screen.unmount();

    // Le compteur et la pastille s'arrêtent.
    expect(stop).toHaveBeenCalledTimes(2);
  });
});
