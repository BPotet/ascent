// Le pied de la tour et le camp (#40, C1 et C2) : les Éclats disponibles à la place du Total
// d'Éclats, le bouton « Le camp », et une ascension commencée avec les Déblocages du camp.
import { act, fireEvent, screen } from '@testing-library/react-native';

import { CAMP_KEY } from '../../../application/useCases/CampSession';
import { startAscent } from '../../../domain/ascent/Ascent';
import { ascentSetUp } from '../testing/ascent';
import { renderScreen } from '../testing/renderScreen';
import { TowerFootScreen } from './TowerFootScreen';

async function show(options: Parameters<typeof ascentSetUp>[0] = {}) {
  const setUp = ascentSetUp(options);
  const onEnter = jest.fn();
  const onCamp = jest.fn();
  await renderScreen(
    <TowerFootScreen session={setUp.session} camp={setUp.camp} onEnter={onEnter} onCamp={onCamp} />,
    setUp.dependencies,
  );
  return { ...setUp, onEnter, onCamp };
}

const buttonLabels = () =>
  screen.getAllByRole('button').map((button) => button.props.accessibilityLabel as string);

describe('TowerFootScreen and the camp (#40)', () => {
  it('shows the Available shards, the same number as at the camp, never the Shard total', async () => {
    await show({ shards: 82, unlocks: ['huntingSpear'] });

    expect(await screen.findByLabelText('62 Éclats')).toBeOnTheScreen();
    expect(screen.queryByText('82 Éclats')).not.toBeOnTheScreen();
  });

  it('shows « 22 Éclats » as before, without any Unlock', async () => {
    await show({ shards: 22 });

    expect(await screen.findByLabelText('22 Éclats')).toBeOnTheScreen();
  });

  it('shows no number until the camp is read', async () => {
    const setUp = ascentSetUp({ shards: 82, unlocks: ['huntingSpear'] });
    let read: (value: string | null) => void = () => undefined;
    const get = setUp.keyValueStore.get;
    setUp.keyValueStore.get = (key) =>
      key === CAMP_KEY ? new Promise((resolve) => (read = resolve)) : get(key);
    await renderScreen(
      <TowerFootScreen
        session={setUp.session}
        camp={setUp.camp}
        onEnter={jest.fn()}
        onCamp={jest.fn()}
      />,
      setUp.dependencies,
    );
    await act(async () => {
      await setUp.session.load();
    });

    expect(screen.queryByTestId('tower-foot-shards')).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: "Commencer l'ascension" })).not.toBeOnTheScreen();

    read(JSON.stringify({ version: 1, unlocks: [{ unlock: 'huntingSpear', price: 20 }] }));
    expect(await screen.findByLabelText('62 Éclats')).toBeOnTheScreen();
  });

  it("opens the camp with « Le camp », under « Commencer l'ascension » (C1)", async () => {
    const { onCamp } = await show({ shards: 22 });

    await screen.findByRole('button', { name: "Commencer l'ascension" });
    const labels = buttonLabels();
    expect(labels.indexOf('Le camp')).toBe(labels.indexOf("Commencer l'ascension") + 1);
    await fireEvent.press(screen.getByRole('button', { name: 'Le camp' }));
    expect(onCamp).toHaveBeenCalledTimes(1);
  });

  it('opens the camp between « Reprendre » and « Abandonner » during an ascent (C2)', async () => {
    const { onCamp } = await show({ shards: 82, saved: startAscent(3) });

    await screen.findByRole('button', { name: "Reprendre l'ascension" });
    // Le cadre de la jauge de l'ascension (#41) est un bouton, au-dessus des actions.
    expect(buttonLabels().filter((label) => !label.startsWith('Jauge'))).toEqual([
      "Reprendre l'ascension",
      'Le camp',
      "Abandonner l'ascension",
    ]);
    await fireEvent.press(screen.getByRole('button', { name: 'Le camp' }));
    expect(onCamp).toHaveBeenCalledTimes(1);
  });

  it('begins the ascent with the Unlocks of the camp', async () => {
    const { session, onEnter } = await show({ seed: 42, unlocks: ['flamberge', 'emberHeart'] });

    await fireEvent.press(await screen.findByRole('button', { name: "Commencer l'ascension" }));
    await fireEvent.press(screen.getByRole('radio', { name: /^La Sentinelle/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Continuer avec la Sentinelle' }));

    expect(session.current()).toEqual(startAscent(42, { unlocks: ['flamberge', 'emberHeart'] }));
    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it('shows the equipped powers on the hero choice and begins the ascent with them (#235, H2)', async () => {
    const { session } = await show({ seed: 42, shards: 90, powers: ['retaliation', 'holdFast'] });

    await fireEvent.press(await screen.findByRole('button', { name: "Commencer l'ascension" }));

    expect(screen.getByText('Pouvoirs équipés · 3 sur 3')).toBeOnTheScreen();
    expect(screen.queryByText('Place libre')).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Continuer avec la Sentinelle' }));
    expect(session.current()?.powers).toEqual(['bulwark', 'retaliation', 'holdFast']);
  });
});
