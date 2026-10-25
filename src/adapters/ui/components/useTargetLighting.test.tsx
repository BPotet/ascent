import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Text } from 'react-native';

import { useTargetLighting } from './useTargetLighting';

/** Montre le palier courant et si l'allumage est en cours. */
function Probe({ flash }: { readonly flash: number | undefined }) {
  const { step, lighting } = useTargetLighting(flash);
  return <Text testID="probe">{`${step} ${lighting ? 'lighting' : 'still'}`}</Text>;
}

const probe = () => screen.getByTestId('probe');

describe('useTargetLighting', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false);
  });

  it('stays in its final step without a target just reached', async () => {
    await render(<Probe flash={undefined} />);

    expect(probe()).toHaveTextContent('2 still');
  });

  it('lights up in 3 steps of 83 ms when the target is just reached', async () => {
    await render(<Probe flash={1} />);

    expect(probe()).toHaveTextContent('0 lighting');
    await act(async () => jest.advanceTimersByTime(82));
    expect(probe()).toHaveTextContent('0 lighting');
    await act(async () => jest.advanceTimersByTime(1));
    expect(probe()).toHaveTextContent('1 lighting');
    await act(async () => jest.advanceTimersByTime(83));
    expect(probe()).toHaveTextContent('2 lighting');
    await act(async () => jest.advanceTimersByTime(83 * 3));
    expect(probe()).toHaveTextContent('2 lighting');
  });

  it('lights up again for each new target reached', async () => {
    await render(<Probe flash={1} />);
    await act(async () => jest.advanceTimersByTime(83 * 2));

    await screen.rerender(<Probe flash={2} />);

    expect(probe()).toHaveTextContent('0 lighting');
  });

  it('stops lighting when the target is no more just reached', async () => {
    await render(<Probe flash={1} />);

    await screen.rerender(<Probe flash={undefined} />);

    expect(probe()).toHaveTextContent('2 still');
  });

  it('is in its final step at once when the motion is reduced', async () => {
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(true);
    await render(<Probe flash={1} />);
    await act(async () => undefined);

    expect(probe()).toHaveTextContent('2 still');
  });
});
