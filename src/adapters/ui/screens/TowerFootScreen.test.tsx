import { act, fireEvent, screen } from '@testing-library/react-native';

import { startAscent } from '../../../domain/ascent/Ascent';
import { ascentSetUp } from '../testing/ascent';
import { renderScreen } from '../testing/renderScreen';
import { TowerFootScreen } from './TowerFootScreen';

async function show(options: Parameters<typeof ascentSetUp>[0] = {}) {
  const setUp = ascentSetUp(options);
  const onEnter = jest.fn();
  await renderScreen(
    <TowerFootScreen session={setUp.session} onEnter={onEnter} />,
    setUp.dependencies,
  );
  return { ...setUp, onEnter };
}

describe('TowerFootScreen', () => {
  it('starts an ascent from the tower foot', async () => {
    const { session, onEnter } = await show({ seed: 42 });

    fireEvent.press(await screen.findByRole('button', { name: "Commencer l'ascension" }));

    expect(session.current()).toEqual(startAscent(42));
    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it('only offers to resume or abandon while an ascent is in progress', async () => {
    const { onEnter } = await show({ saved: startAscent(3) });

    expect(await screen.findByRole('button', { name: "Reprendre l'ascension" })).toBeOnTheScreen();
    expect(screen.getByText('Palier 1 · Étage 1 sur 6 · 80/80 PV · 0 Or')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: "Commencer l'ascension" })).not.toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: "Reprendre l'ascension" }));
    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it('abandons the ascent after a confirmation, as a fall', async () => {
    const { session } = await show({ saved: { ...startAscent(3), gold: 12 } });

    fireEvent.press(await screen.findByRole('button', { name: "Abandonner l'ascension" }));
    fireEvent.press(await screen.findByRole('button', { name: 'Annuler' }));
    expect(session.current()?.outcome).toBeNull();

    fireEvent.press(await screen.findByRole('button', { name: "Abandonner l'ascension" }));
    const confirm = await screen.findByRole('button', { name: 'Abandonner' });
    await act(async () => {
      fireEvent.press(confirm);
    });

    expect(session.current()?.outcome).toBe('fall');
    expect(screen.getByText('Ascension terminée : 12 Or, perdus à la fin.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: "Commencer l'ascension" })).toBeOnTheScreen();
  });
});
