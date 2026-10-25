import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { InMemoryUnitOfWork } from '../../../application/testing/InMemoryUnitOfWork';
import { settableClock } from '../../../application/testing/settableClock';
import { createHabit } from '../../../application/useCases/createHabit';
import { toggleCheckIn } from '../../../application/useCases/toggleCheckIn';
import { Day } from '../../../domain/day/Day';
import { memoryKeyValueStore } from '../testing/memoryKeyValueStore';
import { renderScreen } from '../testing/renderScreen';
import { silentHaptics } from '../testing/silentHaptics';
import { useTrackingChanges } from './TrackingRevision';
import { useDaySky } from './useDaySky';

const wednesday = Day.of(2026, 10, 21);

function Sky() {
  const { light } = useDaySky();
  return <Text testID="light">{String(light)}</Text>;
}

/** Une autre vue, qui enregistre un changement quand on la touche. */
function Notifier() {
  const notify = useTrackingChanges(() => undefined);
  return <Pressable testID="notify" onPress={notify} />;
}
const notify = () => fireEvent.press(screen.getByTestId('notify'));

const light = () => screen.getByTestId('light').props.children;

describe('useDaySky', () => {
  let unitOfWork: InMemoryUnitOfWork;
  let clock: ReturnType<typeof settableClock>;
  const deps = () => ({
    clock,
    unitOfWork,
    keyValueStore: memoryKeyValueStore(),
    haptics: silentHaptics(),
  });

  afterEach(() => jest.restoreAllMocks());

  beforeEach(async () => {
    unitOfWork = new InMemoryUnitOfWork();
    clock = settableClock(wednesday);
    for (const name of ['Cuisiner', 'Lire']) {
      await createHabit({ clock, unitOfWork }, name);
    }
  });

  it('reads the sky of today', async () => {
    await toggleCheckIn({ clock, unitOfWork }, 1, wednesday);
    await renderScreen(<Sky />, deps());

    await waitFor(() => expect(light()).toBe('0.5'));
  });

  it('is the night until the sky of today can be read', async () => {
    await toggleCheckIn({ clock, unitOfWork }, 1, wednesday);
    unitOfWork.failReads();
    await renderScreen(<Sky />, deps());
    await act(async () => undefined);

    expect(light()).toBe('0');
  });

  it('reads the sky again when a view saves a change', async () => {
    await renderScreen(
      <>
        <Sky />
        <Notifier />
      </>,
      deps(),
    );
    await waitFor(() => expect(light()).toBe('0'));

    await toggleCheckIn({ clock, unitOfWork }, 1, wednesday);
    await notify();

    await waitFor(() => expect(light()).toBe('0.5'));
  });

  it('reads the sky again when today changes', async () => {
    await toggleCheckIn({ clock, unitOfWork }, 1, wednesday);
    await toggleCheckIn({ clock, unitOfWork }, 2, wednesday);
    await renderScreen(<Sky />, deps());
    await waitFor(() => expect(light()).toBe('1'));

    await act(async () => clock.setToday(Day.of(2026, 10, 22)));

    await waitFor(() => expect(light()).toBe('0'));
  });

  it('shows only the most recent reading, even when an older one answers last', async () => {
    await toggleCheckIn({ clock, unitOfWork }, 1, wednesday);
    // La première lecture, celle du ciel au montage (l'effet de l'enfant passe avant celui de
    // l'expérience), répond la dernière.
    let answerSlowly: (sky: { light: number }) => void = () => undefined;
    jest.spyOn(unitOfWork, 'run').mockImplementationOnce(
      () =>
        new Promise((done) => {
          answerSlowly = done as (sky: { light: number }) => void;
        }),
    );
    await renderScreen(
      <>
        <Sky />
        <Notifier />
      </>,
      deps(),
    );

    await notify();
    await waitFor(() => expect(light()).toBe('0.5'));
    await act(async () => answerSlowly({ light: 0.1 }));

    expect(light()).toBe('0.5');
  });

  it('keeps its last sky when it cannot be read', async () => {
    await toggleCheckIn({ clock, unitOfWork }, 1, wednesday);
    await renderScreen(
      <>
        <Sky />
        <Notifier />
      </>,
      deps(),
    );
    await waitFor(() => expect(light()).toBe('0.5'));

    unitOfWork.failReads();
    await notify();
    await act(async () => undefined);

    expect(light()).toBe('0.5');
  });
});
