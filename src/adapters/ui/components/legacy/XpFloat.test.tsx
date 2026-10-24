import { render, screen } from '@testing-library/react-native';
import { Animated } from 'react-native';

import { XP_FLOAT_DURATION_MS, XpFloat } from './XpFloat';

const float = () => screen.queryByTestId('xp-float', { includeHiddenElements: true });

describe('XpFloat', () => {
  afterEach(() => jest.restoreAllMocks());

  it('lets « +10 XP » fly up from the touched case, in gold, for 900 ms', async () => {
    const timing = jest.spyOn(Animated, 'timing');

    await render(<XpFloat reducedMotion={false} change={{ id: 1, amount: 10 }} />);

    expect(float()).toHaveTextContent('+10 XP');
    expect(screen.getByText('+10 XP', { includeHiddenElements: true })).toHaveStyle({
      color: '#FFC94D',
    });
    expect(timing.mock.calls.map(([, config]) => config.duration)).toEqual([XP_FLOAT_DURATION_MS]);
    expect(XP_FLOAT_DURATION_MS).toBe(900);
  });

  it('lets « −10 XP » fly up in a discreet grey', async () => {
    await render(<XpFloat reducedMotion={false} change={{ id: 1, amount: -10 }} />);

    expect(float()).toHaveTextContent('−10 XP');
    expect(screen.getByText('−10 XP', { includeHiddenElements: true })).toHaveStyle({
      color: '#9AA4B8',
    });
  });

  it('lets only the share of the case fly up, not the target bonus (#26)', async () => {
    await render(<XpFloat reducedMotion={false} change={{ id: 1, amount: 25, bonus: 15 }} />);

    expect(float()).toHaveTextContent('+10 XP');
  });

  it('lets nothing fly up when only the target bonus changes', async () => {
    await render(<XpFloat reducedMotion={false} change={{ id: 1, amount: 3, bonus: 3 }} />);

    expect(float()).not.toBeOnTheScreen();
  });

  it('is hidden from the screen reader, which hears the announcement', async () => {
    await render(<XpFloat reducedMotion={false} change={{ id: 1, amount: 10 }} />);

    expect(screen.queryByText('+10 XP')).not.toBeOnTheScreen();
  });

  it('flies again for each new change', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    await render(<XpFloat reducedMotion={false} change={{ id: 1, amount: 10 }} />);

    await screen.rerender(<XpFloat reducedMotion={false} change={{ id: 2, amount: 10 }} />);

    expect(timing).toHaveBeenCalledTimes(2);
  });

  it('shows nothing without a change', async () => {
    await render(<XpFloat reducedMotion={false} change={undefined} />);

    expect(float()).not.toBeOnTheScreen();
  });

  it('does not fly when the player asked to reduce motion', async () => {
    const timing = jest.spyOn(Animated, 'timing');

    await render(<XpFloat reducedMotion change={{ id: 1, amount: 10 }} />);

    expect(float()).not.toBeOnTheScreen();
    expect(timing).not.toHaveBeenCalled();
  });

  it('starts below the case, small and transparent', async () => {
    await render(<XpFloat reducedMotion={false} change={{ id: 1, amount: 10 }} />);

    expect(float()).toHaveStyle({ opacity: 0, transform: [{ translateY: 8 }, { scale: 0.8 }] });
  });

  it('flies on the native thread, and stops when it leaves the screen', async () => {
    const animation = { start: jest.fn(), stop: jest.fn(), reset: jest.fn() };
    const timing = jest.spyOn(Animated, 'timing').mockReturnValue(animation);
    await render(<XpFloat reducedMotion={false} change={{ id: 1, amount: 10 }} />);

    expect(timing.mock.calls[0]?.[1]).toMatchObject({ toValue: 1, useNativeDriver: true });
    expect(animation.start).toHaveBeenCalled();
    await screen.unmount();
    expect(animation.stop).toHaveBeenCalled();
  });
});
