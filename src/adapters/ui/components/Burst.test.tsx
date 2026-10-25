import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Text } from 'react-native';

import type { CheckInStatus } from '../../../domain/checkIn/CheckInStatus';
import { Burst, useBurst } from './Burst';

const hidden = { includeHiddenElements: true };
const burst = () => screen.queryByTestId('habit-burst', hidden);

/** Une case qui joue l'étincelle quand elle passe à « fait ». */
function Box({ status }: { readonly status: CheckInStatus }) {
  const bursts = useBurst(status);
  const box = (lifted: boolean) => <Text testID="box">{lifted ? 'lifted' : 'flat'}</Text>;
  return bursts > 0 ? <Burst key={bursts}>{box}</Burst> : box(false);
}

describe('useBurst', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false);
  });

  it('plays nothing when the box is first shown, even « fait »', async () => {
    await render(<Box status="done" />);

    expect(burst()).toBeNull();
    expect(screen.getByTestId('box')).toHaveTextContent('flat');
  });

  it('bursts 3 frames and lifts the box for 2 frames when it becomes « fait »', async () => {
    await render(<Box status="pending" />);
    await act(async () => undefined);

    await screen.rerender(<Box status="done" />);

    expect(burst()?.props.sprite).toBe('burst-0');
    expect(screen.getByTestId('box')).toHaveTextContent('lifted');
    await act(async () => jest.advanceTimersByTime(83));
    expect(burst()?.props.sprite).toBe('burst-1');
    await act(async () => jest.advanceTimersByTime(83));
    expect(burst()?.props.sprite).toBe('burst-2');
    expect(screen.getByTestId('box')).toHaveTextContent('flat');
    await act(async () => jest.advanceTimersByTime(83));
    expect(burst()).toBeNull();
  });

  it('plays again each time the box becomes « fait »', async () => {
    await render(<Box status="pending" />);
    await act(async () => undefined);
    await screen.rerender(<Box status="done" />);
    await act(async () => jest.advanceTimersByTime(83 * 3));
    await screen.rerender(<Box status="pending" />);

    await screen.rerender(<Box status="done" />);

    expect(burst()?.props.sprite).toBe('burst-0');
  });

  it('never bursts when the box goes back from « fait »', async () => {
    await render(<Box status="done" />);
    await act(async () => undefined);

    await screen.rerender(<Box status="pending" />);
    await screen.rerender(<Box status="missed" />);

    expect(burst()).toBeNull();
  });

  it('never bursts when the motion is reduced', async () => {
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(true);
    await render(<Box status="pending" />);
    await act(async () => undefined);

    await screen.rerender(<Box status="done" />);

    expect(burst()).toBeNull();
    expect(screen.getByTestId('box')).toHaveTextContent('flat');
  });
});
