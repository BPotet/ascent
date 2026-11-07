// L'arbre de pouvoirs au Camp (#235, maquette 232 : A1 à A6, F1 à F5, D1) : les deux arbres en
// onglets, chaque nœud avec son état en mot, la fiche du pouvoir en feuille, le déblocage.
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import {
  CAMP_KEY,
  EQUIPPED_POWERS_KEY,
  POWER_TREES_SEEN_KEY,
} from '../../../application/useCases/CampSession';
import { startAscent } from '../../../domain/ascent/Ascent';
import type { PowerKind } from '../../../domain/battle/powers';
import { ascentSetUp } from '../testing/ascent';
import { reduceMotionInEachTest } from '../testing/motion';
import { renderScreen } from '../testing/renderScreen';
import { PowerTreeScreen } from './PowerTreeScreen';

reduceMotionInEachTest();

async function show(
  options: Parameters<typeof ascentSetUp>[0] = {},
  hero: 'sentinel' | 'wanderer' = 'sentinel',
  remembered?: Readonly<Record<string, readonly PowerKind[]>>,
) {
  const setUp = ascentSetUp(options);
  if (remembered !== undefined) {
    setUp.keyValueStore.values.set(
      EQUIPPED_POWERS_KEY,
      JSON.stringify({ version: 1, heroes: remembered }),
    );
  }
  await setUp.session.load();
  const onLeave = jest.fn();
  await renderScreen(
    <PowerTreeScreen camp={setUp.camp} hero={hero} onLeave={onLeave} onGoToDay={jest.fn()} />,
    setUp.dependencies,
  );
  await screen.findByTestId('power-tree');
  return { ...setUp, onLeave };
}

const node = (code: PowerKind) => screen.getByTestId(`power-node-${code}`);
const inNode = (code: PowerKind) => within(node(code));

async function open(code: PowerKind) {
  await fireEvent.press(node(code));
  return within(await screen.findByTestId('power-sheet'));
}

describe('PowerTreeScreen (#235)', () => {
  it('opens the tree of the Sentinel for the first time (A1)', async () => {
    await show({ shards: 50 });

    expect(screen.getByLabelText('50 Éclats disponibles')).toBeOnTheScreen();
    expect(inNode('bulwark').getByText('Pouvoir de base')).toBeOnTheScreen();
    expect(inNode('bulwark').queryByText(/Éclats/)).not.toBeOnTheScreen();
    expect(inNode('retaliation').getByText('30 Éclats')).toBeOnTheScreen();
    expect(inNode('holdFast').getByText('Après Représailles')).toBeOnTheScreen();
    expect(node('holdFast').props.accessibilityLabel).toBe(
      "Tenir bon, 3 Élan, Action, verrouillé : débloque d'abord Représailles",
    );
    expect(inNode('shieldBash').getByText('30 Éclats')).toBeOnTheScreen();
    expect(inNode('crushingBlow').getByText('Après Coup de bouclier')).toBeOnTheScreen();
    expect(screen.queryByText('Bientôt')).not.toBeOnTheScreen();
    expect(screen.getByText('Voie Veille')).toBeOnTheScreen();
    expect(screen.getByText('Voie Bouclier')).toBeOnTheScreen();
  });

  it('shows the tree of the Wanderer in its tab (A6)', async () => {
    await show({ shards: 50 });

    await fireEvent.press(screen.getByRole('tab', { name: /Errante/ }));

    expect(inNode('shadowStep').getByText('Pouvoir de base')).toBeOnTheScreen();
    expect(inNode('rend').getByText('30 Éclats')).toBeOnTheScreen();
    expect(inNode('mist').getByText('30 Éclats')).toBeOnTheScreen();
    expect(inNode('flurry').getByText('Après Entaille')).toBeOnTheScreen();
    expect(inNode('ambush').getByText('Après Brume')).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: /Errante/ })).toHaveProp('accessibilityState', {
      selected: true,
    });
  });

  it('marks the trees seen when opened', async () => {
    const { keyValueStore } = await show();

    await act(async () => undefined);
    expect(keyValueStore.values.get(POWER_TREES_SEEN_KEY)).toBe('1');
  });

  it('unlocks a power from its sheet (F1, D1)', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const { keyValueStore, campSound } = await show({ shards: 50 });

    const sheet = await open('retaliation');
    expect(sheet.getByText('La Sentinelle · Voie Veille · Rang 1')).toBeOnTheScreen();
    expect(sheet.getByText('Il te restera')).toBeOnTheScreen();
    expect(sheet.getByText('20 Éclats')).toBeOnTheScreen();
    await fireEvent.press(sheet.getByRole('button', { name: 'Débloquer pour 30 Éclats' }));

    expect(await screen.findByLabelText('20 Éclats disponibles')).toBeOnTheScreen();
    expect(screen.queryByTestId('power-sheet')).not.toBeOnTheScreen();
    expect(inNode('retaliation').getByText('Équipé')).toBeOnTheScreen();
    expect(inNode('holdFast').getByText('Il manque 40 Éclats')).toBeOnTheScreen();
    expect(JSON.parse(keyValueStore.values.get(CAMP_KEY)!).powers).toEqual([
      { power: 'retaliation', price: 30 },
    ]);
    expect(campSound.played).toEqual(['burnCrackle']);
    expect(announce).toHaveBeenCalledWith(
      'Représailles débloqué. Équipé dès ta prochaine ascension. 20 Éclats disponibles.',
    );
    expect(
      screen.getByTestId('power-tree-minus', { includeHiddenElements: true }),
    ).toHaveTextContent('−30');
    expect(
      screen.getByTestId('power-node-ring-retaliation', { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(
      screen.queryByTestId('power-node-ring-holdFast', { includeHiddenElements: true }),
    ).toBeNull();
  });

  it('pays exactly the price', async () => {
    await show({ shards: 30 }, 'wanderer');

    const sheet = await open('rend');
    await fireEvent.press(sheet.getByRole('button', { name: 'Débloquer pour 30 Éclats' }));

    expect(await screen.findByLabelText('0 Éclat disponible')).toBeOnTheScreen();
  });

  it('says how many Shards are missing, with no way to unlock (F3)', async () => {
    await show({ shards: 70, powers: ['retaliation'] });

    expect(inNode('holdFast').getByText('Il manque 20 Éclats')).toBeOnTheScreen();
    const sheet = await open('holdFast');
    const button = sheet.getByRole('button', {
      name: 'Débloquer, indisponible : il manque 20 Éclats',
    });
    expect(button).toHaveProp('accessibilityState', expect.objectContaining({ disabled: true }));
  });

  it('unlocks a rank 2 after its rank 1', async () => {
    await show({ shards: 90, powers: ['retaliation'] });

    const sheet = await open('holdFast');
    await fireEvent.press(sheet.getByRole('button', { name: 'Débloquer pour 60 Éclats' }));

    expect(await screen.findByLabelText('0 Éclat disponible')).toBeOnTheScreen();
    expect(inNode('holdFast').getByText('Équipé')).toBeOnTheScreen();
  });

  it('keeps the Shards when the purchase cannot be saved, and lets the player try again (F2)', async () => {
    const { keyValueStore } = await show({ shards: 50 }, 'wanderer');
    const set = keyValueStore.set;
    keyValueStore.set = (key, value) =>
      key === CAMP_KEY ? Promise.reject(new Error('disk full')) : set(key, value);

    const sheet = await open('mist');
    await fireEvent.press(sheet.getByRole('button', { name: 'Débloquer pour 30 Éclats' }));

    expect(
      await sheet.findByText("Le déblocage n'a pas pu être enregistré. Tes Éclats sont intacts."),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('50 Éclats disponibles')).toBeOnTheScreen();
    expect(inNode('mist').getByText('30 Éclats')).toBeOnTheScreen();

    keyValueStore.set = set;
    await fireEvent.press(sheet.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByLabelText('20 Éclats disponibles')).toBeOnTheScreen();
  });

  it('unlocks Shield Bash then Crushing Blow, down to 0 Shard (#236)', async () => {
    await show({ shards: 90 });

    const bash = await open('shieldBash');
    expect(bash.getByText('Coup de bouclier')).toBeOnTheScreen();
    expect(bash.getByText('Frappe')).toBeOnTheScreen();
    await fireEvent.press(bash.getByRole('button', { name: 'Débloquer pour 30 Éclats' }));
    expect(await screen.findByLabelText('60 Éclats disponibles')).toBeOnTheScreen();
    const crush = await open('crushingBlow');
    await fireEvent.press(crush.getByRole('button', { name: 'Débloquer pour 60 Éclats' }));

    expect(await screen.findByLabelText('0 Éclat disponible')).toBeOnTheScreen();
    expect(inNode('shieldBash').getByText('Équipé')).toBeOnTheScreen();
    expect(inNode('crushingBlow').getByText('Équipé')).toBeOnTheScreen();
  });

  it('says « Débloqué » for a power left out of the 3 equipped (#236, A3, F5)', async () => {
    await show({ shards: 200, powers: ['rend', 'mist', 'flurry'] }, 'wanderer', {
      wanderer: ['shadowStep', 'rend', 'mist'],
    });

    expect(inNode('flurry').getByText('Débloqué')).toBeOnTheScreen();
    expect(node('flurry').props.accessibilityLabel).toBe(
      'Rafale, 2 Élan, Frappe, débloqué, pas équipé',
    );
    expect(inNode('mist').getByText('Équipé')).toBeOnTheScreen();
    const sheet = await open('flurry');
    expect(
      sheet.getByText('Débloqué. Pas équipé : choisis-le au Choix du héros.'),
    ).toBeOnTheScreen();
  });

  it('says that the 3 slots are taken after a 4th unlocked power (#236, D2)', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await show({ shards: 150, powers: ['rend', 'mist'] }, 'wanderer', {
      wanderer: ['shadowStep', 'rend', 'mist'],
    });

    const sheet = await open('flurry');
    await fireEvent.press(sheet.getByRole('button', { name: 'Débloquer pour 60 Éclats' }));

    expect(
      await screen.findByText(
        'Rafale débloqué. Tes 3 places sont prises : choisis tes pouvoirs au Choix du héros.',
      ),
    ).toBeOnTheScreen();
    expect(inNode('flurry').getByText('Débloqué')).toBeOnTheScreen();
    expect(announce).toHaveBeenCalledWith(
      'Rafale débloqué. Tes 3 places sont prises : choisis tes pouvoirs au Choix du héros. 30 Éclats disponibles.',
    );
  });

  it('explains a lock and opens the sheet of the rank 1 (F4)', async () => {
    await show({ shards: 200 });

    const sheet = await open('holdFast');
    expect(
      sheet.getByText("Verrouillé. Débloque d'abord Représailles, le rang 1 de la voie Veille."),
    ).toBeOnTheScreen();
    await fireEvent.press(sheet.getByRole('button', { name: 'Voir Représailles' }));

    expect(
      within(screen.getByTestId('power-sheet')).getByText('La Sentinelle · Voie Veille · Rang 1'),
    ).toBeOnTheScreen();
  });

  it('never sells the base power (Pouvoir de base)', async () => {
    await show({ shards: 500 });

    const sheet = await open('bulwark');

    expect(sheet.getByText(/Pouvoir de base de la Sentinelle : toujours à toi/)).toBeOnTheScreen();
    expect(sheet.queryByRole('button', { name: /^Débloquer/ })).not.toBeOnTheScreen();
  });

  it('keeps the running ascent as it is (A4)', async () => {
    const { session } = await show({ shards: 50, saved: startAscent(4, { hero: 'sentinel' }) });
    expect(session.current()).not.toBeNull();

    expect(screen.getByText(/Ascension en cours · Palier 1, étage 1/)).toBeOnTheScreen();
    const sheet = await open('retaliation');
    expect(
      sheet.getByText("Dès ta prochaine ascension. L'ascension en cours ne change pas."),
    ).toBeOnTheScreen();
    await fireEvent.press(sheet.getByRole('button', { name: 'Débloquer pour 30 Éclats' }));

    expect(
      await within(node('retaliation')).findByText('Dès ta prochaine ascension'),
    ).toBeOnTheScreen();
    expect(session.current()?.powers).toEqual(['bulwark']);
  });

  it('shows skeletons while the Camp is read (A5)', async () => {
    const setUp = ascentSetUp({ shards: 50 });
    await setUp.session.load();
    let read: (value: string | null) => void = () => undefined;
    const get = setUp.keyValueStore.get;
    setUp.keyValueStore.get = (key) =>
      key === CAMP_KEY ? new Promise((resolve) => (read = resolve)) : get(key);
    await renderScreen(
      <PowerTreeScreen camp={setUp.camp} hero="sentinel" onLeave={jest.fn()} />,
      setUp.dependencies,
    );

    expect(
      screen.getAllByTestId('power-tree-skeleton', { includeHiddenElements: true }),
    ).toHaveLength(5);
    expect(screen.queryByTestId('power-node-bulwark')).not.toBeOnTheScreen();

    await act(async () => read(null));
    expect(await screen.findByTestId('power-node-bulwark')).toBeOnTheScreen();
  });

  it('goes back to the Camp', async () => {
    const { onLeave } = await show();

    await fireEvent.press(screen.getByRole('button', { name: 'Retour au camp' }));

    expect(onLeave).toHaveBeenCalled();
  });
});
