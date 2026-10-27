import { act, fireEvent, screen } from '@testing-library/react-native';

import { startAscent, type Ascent } from '../../../domain/ascent/Ascent';
import { ascentSetUp } from '../testing/ascent';
import { renderScreen } from '../testing/renderScreen';
import { AscentScreen, RESUME_COUNTDOWN_S } from './AscentScreen';

jest.mock('../battle/BattleCanvas', () => jest.requireActual('../battle/testing/fakeBattleCanvas'));

function visibility() {
  let listener: ((visible: boolean) => void) | null = null;
  return {
    onChange: (next: (visible: boolean) => void) => {
      listener = next;
      return () => {
        listener = null;
      };
    },
    set: async (visible: boolean) => {
      await act(async () => {
        listener?.(visible);
      });
    },
  };
}

async function show(
  saved: Ascent,
  prepare?: (session: ReturnType<typeof ascentSetUp>['session']) => Promise<void>,
) {
  const setUp = ascentSetUp({ saved });
  await setUp.session.load();
  await prepare?.(setUp.session);
  const onLeave = jest.fn();
  const app = visibility();
  const rendered = await renderScreen(
    <AscentScreen session={setUp.session} visibility={app} onLeave={onLeave} />,
    setUp.dependencies,
  );
  return { ...setUp, onLeave, app, rendered };
}

const between = (ascent: Ascent, exits: Ascent['exits'], lastGold = 0): Ascent => ({
  ...ascent,
  encounter: null,
  exits,
  lastGold,
  gold: lastGold,
});

describe('AscentScreen', () => {
  it('shows the floor battle, with the floor, HP and Gold', async () => {
    await show(startAscent(42));

    expect(await screen.findByRole('header', { name: 'Étage 1' })).toBeOnTheScreen();
    expect(screen.getByTestId('ascent-status')).toHaveTextContent(
      'Palier 1 · Étage 1 sur 6 · 80/80 PV · 0 Or',
    );
  });

  it('offers the exits after a floor, the Combat door announcing the group size', async () => {
    const { session } = await show(
      between(
        startAscent(42),
        [
          { kind: 'combat', groupSize: 4 },
          { kind: 'campfire', groupSize: null },
        ],
        9,
      ),
    );

    expect(screen.getByRole('header', { name: 'Choisis ta sortie' })).toBeOnTheScreen();
    expect(screen.getByText('Étage franchi · +9 Or')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Combat · 4 ennemis' }));

    expect(session.current()?.encounter?.enemies).toHaveLength(4);
    expect(await screen.findByRole('header', { name: 'Étage 2' })).toBeOnTheScreen();
    expect(screen.getByTestId('ascent-status')).toHaveTextContent(/\+1 en réserve$/);
  });

  it('shows the last door before the boss', async () => {
    await show(between({ ...startAscent(42), floor: 5 }, [{ kind: 'boss', groupSize: null }]));

    expect(screen.getByRole('header', { name: 'Dernière porte' })).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Affronter le boss' }));
    expect(await screen.findByRole('header', { name: 'Le boss' })).toBeOnTheScreen();
  });

  it('pauses on Pause, and when the app goes to the background, then counts down 3 s before resuming', async () => {
    jest.useFakeTimers();
    try {
      const { session, app, onLeave } = await show(startAscent(42), async (current) => {
        await current.battleSession().start();
      });

      expect(screen.getByTestId('ascent-countdown')).toHaveTextContent(
        `Reprise dans${RESUME_COUNTDOWN_S}`,
      );
      for (let second = 0; second < RESUME_COUNTDOWN_S; second += 1) {
        await act(async () => {
          jest.advanceTimersByTime(1_000);
        });
      }
      expect(await screen.findByRole('header', { name: 'Étage 1' })).toBeOnTheScreen();

      await app.set(false);
      expect(screen.queryByRole('header', { name: 'Étage 1' })).not.toBeOnTheScreen();
      await app.set(true);
      expect(screen.getByTestId('ascent-countdown')).toBeOnTheScreen();

      fireEvent.press(screen.getByRole('button', { name: 'Pause' }));
      expect(onLeave).toHaveBeenCalledTimes(1);
      expect(session.resuming()).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('shows the end of the ascent, the Gold being lost, and goes back to the tower foot', async () => {
    const { session, onLeave } = await show({ ...startAscent(42), gold: 30, floor: 3 });
    await act(async () => {
      session.abandon();
    });

    expect(screen.getByRole('header', { name: 'Chute' })).toBeOnTheScreen();
    expect(screen.getByText("Tombé à l'étage 3.")).toBeOnTheScreen();
    expect(screen.getByText('Or gagné : 30 Or')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Retour au pied de la tour' }));

    expect(session.current()).toBeNull();
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('shows a victory over the boss', async () => {
    await show({ ...startAscent(42), outcome: 'victory', encounter: null, gold: 80 });

    expect(screen.getByRole('header', { name: 'Victoire !' })).toBeOnTheScreen();
    expect(screen.getByText('Le boss des Catacombes est vaincu.')).toBeOnTheScreen();
  });
});
