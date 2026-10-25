import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Text } from 'react-native';

import type { CheckInStatus } from '../../../domain/checkIn/CheckInStatus';
import { Burst, useBurst } from './Burst';

const hidden = { includeHiddenElements: true };
const burst = () => screen.queryByTestId('habit-burst', hidden);

/** Une case qui joue l'étincelle quand on la touche pour la passer à « fait ». */
function Box({ status }: { readonly status: CheckInStatus }) {
  const { bursts, tap } = useBurst(status);
  const box = (lifted: boolean) => (
    <Text testID="box" onPress={tap}>
      {lifted ? 'lifted' : 'flat'}
    </Text>
  );
  return bursts > 0 ? <Burst key={bursts}>{box}</Burst> : box(false);
}

const tapBox = () => fireEvent.press(screen.getByTestId('box'));

describe('useBurst', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false);
  });

  it('plays nothing when the box is shown, even « fait »', async () => {
    await render(<Box status="done" />);

    expect(burst()).toBeNull();
    expect(screen.getByTestId('box')).toHaveTextContent('flat');
  });

  it('bursts 3 frames and lifts the box for 2 frames when a tap makes it « fait »', async () => {
    await render(<Box status="pending" />);
    await act(async () => undefined);

    await tapBox();

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

  it('plays again at each tap that makes the box « fait »', async () => {
    await render(<Box status="missed" />);
    await act(async () => undefined);
    await tapBox();
    await act(async () => jest.advanceTimersByTime(83 * 3));

    await tapBox();

    expect(burst()?.props.sprite).toBe('burst-0');
  });

  it('never bursts at the tap that takes « fait » back', async () => {
    await render(<Box status="done" />);
    await act(async () => undefined);

    await tapBox();

    expect(burst()).toBeNull();
  });

  it('never bursts when the box becomes « fait » without a tap (failed save, reload)', async () => {
    await render(<Box status="pending" />);
    await act(async () => undefined);

    await screen.rerender(<Box status="done" />);

    expect(burst()).toBeNull();
  });

  it('never bursts when the motion is reduced', async () => {
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(true);
    await render(<Box status="pending" />);
    await act(async () => undefined);

    await tapBox();

    expect(burst()).toBeNull();
    expect(screen.getByTestId('box')).toHaveTextContent('flat');
  });
});
