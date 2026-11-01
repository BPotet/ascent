// Les écrans des paliers et des Éclats (#38, maquette 30) : le boss vaincu (X3), la transition de
// palier (C4), la fin de l'ascension (X6) et le Sommet atteint (X7), sur une vraie session.
import { act, fireEvent, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { startAscent, type Ascent } from '../../../domain/ascent/Ascent';
import type { ShardAward } from '../../../domain/ascent/shards';
import { ascentSetUp } from '../testing/ascent';
import { renderScreen } from '../testing/renderScreen';
import { AscentScreen } from './AscentScreen';

jest.mock('../battle/BattleCanvas', () => jest.requireActual('../battle/testing/fakeBattleCanvas'));

const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
beforeEach(() => announce.mockClear());

async function show(saved: Ascent, shards?: number) {
  const setUp = ascentSetUp({ saved, ...(shards !== undefined && { shards }) });
  await setUp.session.load();
  const onLeave = jest.fn();
  await renderScreen(
    <AscentScreen
      session={setUp.session}
      visibility={{ onChange: () => () => {} }}
      onLeave={onLeave}
    />,
    setUp.dependencies,
  );
  return { ...setUp, onLeave };
}

const award = (id: string, amount: number): ShardAward => ({ id: `42:${id}`, amount });

/** Le boss du palier `tier` vaincu : l'écran du boss vaincu, ou celui de la transition. */
function passage(tier: 1 | 2, step: 'bossDefeated' | 'announce', lastGold: number): Ascent {
  return {
    ...startAscent(42),
    tier,
    floor: 6,
    encounter: null,
    lastGold,
    gold: 60 + lastGold,
    shardAwards: [award('1:6:boss', 8), ...(tier === 2 ? [award('2:6:boss', 12)] : [])],
    passage: { to: (tier + 1) as 2 | 3, step },
  };
}

describe('the defeated boss screen (X3, #38)', () => {
  it('shows the Shards in large, kept for ever, and the Gold of the boss', async () => {
    await show(passage(1, 'bossDefeated', 40));

    expect(screen.getByTestId('ascent-boss-defeated')).toBeOnTheScreen();
    expect(screen.getByText('Boss vaincu')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Palier 1 franchi' })).toBeOnTheScreen();
    expect(screen.getByLabelText('8 Éclats gagnés, gardés pour toujours')).toHaveTextContent('+8');
    expect(screen.getByText('Éclats · gardés pour toujours, même si tu tombes.')).toBeOnTheScreen();
    expect(screen.getByText('+40 Or')).toBeOnTheScreen();
    expect(announce).toHaveBeenCalledWith('8 Éclats gagnés, gardés pour toujours');
  });

  it('shows the 12 Shards of the boss of tier 2, and goes on to tier 3', async () => {
    await show(passage(2, 'bossDefeated', 50));

    expect(screen.getByRole('header', { name: 'Palier 2 franchi' })).toBeOnTheScreen();
    expect(screen.getByLabelText('12 Éclats gagnés, gardés pour toujours')).toHaveTextContent(
      '+12',
    );
    expect(screen.getByRole('button', { name: 'Continuer vers le palier 3' })).toBeOnTheScreen();
  });

  it('pauses on « Faire une pause », the ascent saved on this screen', async () => {
    const { onLeave, session } = await show(passage(1, 'bossDefeated', 40));

    fireEvent.press(screen.getByRole('button', { name: 'Faire une pause' }));

    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(session.current()?.passage).toEqual({ to: 2, step: 'bossDefeated' });
  });
});

describe('the transition screen (C4, #38)', () => {
  it('announces tier 2, the Ash gardens, after the defeated boss screen', async () => {
    const { session } = await show(passage(1, 'bossDefeated', 40));

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Continuer vers le palier 2' }));
    });

    expect(session.current()?.passage).toEqual({ to: 2, step: 'announce' });
    expect(screen.getByTestId('ascent-tier')).toBeOnTheScreen();
    expect(screen.getByText('Palier 1 franchi')).toBeOnTheScreen();
    expect(screen.getByText('Palier 2')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Les Jardins de cendre' })).toBeOnTheScreen();
    expect(screen.getByText('Les ennemis y sont plus forts.')).toBeOnTheScreen();
    expect(announce).toHaveBeenCalledWith('Palier 2, les Jardins de cendre');
  });

  it('announces tier 3, the Belfry', async () => {
    await show(passage(2, 'announce', 50));

    expect(screen.getByRole('header', { name: 'Le Beffroi' })).toBeOnTheScreen();
    expect(screen.getByText('Palier 3')).toBeOnTheScreen();
  });

  it('enters floor 1 of tier 2, on its forced battle', async () => {
    const { session } = await show(passage(1, 'announce', 40));

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Entrer' }));
    });

    expect(session.current()).toMatchObject({ tier: 2, floor: 1, passage: null });
    expect(await screen.findByTestId('ascent-battle')).toBeOnTheScreen();
    expect(screen.getByTestId('ascent-status')).toHaveTextContent(/^Palier 2 · Étage 1 sur 6/);
  });
});

describe('the end of the ascent (X6, X7, #38)', () => {
  it('shows a fall with the Shards won among what is kept, in green, and the Gold lost, in red', async () => {
    const fallen: Ascent = {
      ...startAscent(42),
      tier: 2,
      floor: 4,
      gold: 23,
      encounter: null,
      outcome: 'fall',
      shardAwards: [award('1:6:boss', 8), award('2:3:elite', 2)],
    };

    await show(fallen, 34);

    expect(screen.getByTestId('ascent-end')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: "Fin de l'ascension" })).toBeOnTheScreen();
    expect(screen.getByText('La Sentinelle est tombée au palier 2, étage 4.')).toBeOnTheScreen();
    expect(screen.getByText('Éclats gagnés')).toBeOnTheScreen();
    expect(screen.getByLabelText('10 Éclats gagnés')).toHaveTextContent('+10');
    expect(screen.getByText('Total : 44 Éclats')).toBeOnTheScreen();
    expect(screen.getByTestId('ascent-end-kept')).toHaveTextContent('Tu gardes tes Éclats.');
    expect(screen.getByTestId('ascent-end-lost')).toHaveTextContent(
      "L'Or (23 Or), l'équipement et les bienfaits de cette ascension sont perdus.",
    );
  });

  it('shows the Summit reached, with the 10 Shards of the Summit', async () => {
    const summit: Ascent = {
      ...startAscent(42),
      tier: 3,
      floor: 6,
      encounter: null,
      outcome: 'victory',
      shardAwards: [
        award('1:6:boss', 8),
        award('2:6:boss', 12),
        award('3:6:boss', 18),
        { id: '42:summit', amount: 10 },
      ],
    };

    await show(summit);

    expect(screen.getByRole('header', { name: 'Sommet atteint' })).toBeOnTheScreen();
    expect(screen.getByText('Les trois paliers franchis avec la Sentinelle.')).toBeOnTheScreen();
    expect(screen.getByLabelText('48 Éclats gagnés')).toHaveTextContent('+48');
    expect(screen.getByText('Dont 10 pour le Sommet · Total : 48 Éclats')).toBeOnTheScreen();
    expect(announce).toHaveBeenCalledWith('28 Éclats gagnés, Sommet atteint');
  });

  it('shows a fall without any Shard, and goes back to the tower foot', async () => {
    const { session, onLeave } = await show({ ...startAscent(42), floor: 3, outcome: 'fall' });

    expect(screen.getByText('La Sentinelle est tombée au palier 1, étage 3.')).toBeOnTheScreen();
    expect(screen.getByLabelText('0 Éclat gagné')).toHaveTextContent('+0');
    fireEvent.press(screen.getByRole('button', { name: 'Retour au pied de la tour' }));

    expect(session.current()).toBeNull();
    expect(onLeave).toHaveBeenCalledTimes(1);
  });
});
