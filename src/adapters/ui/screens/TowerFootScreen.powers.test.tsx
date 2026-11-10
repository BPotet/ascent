// Le lancement avec les pouvoirs équipés au pied de la tour (#236, #270) : la présélection du camp,
// qui contient le choix validé au menu des pouvoirs, passe au lancement ; elle est mémorisée sous
// `camp.equippedPowers` ; un échec d'enregistrement garde l'écran et la sélection ; les lignes
// « Attisé » suivent la sélection ; le lien « Changer les pouvoirs » ouvre le menu (H2, M13).
import { act, fireEvent, screen, within } from '@testing-library/react-native';

import { EQUIPPED_POWERS_KEY } from '../../../application/useCases/CampSession';
import { OATHS_KEY } from '../../../application/useCases/oaths';
import type { PowerKind } from '../../../domain/battle/powers';
import { Day } from '../../../domain/day/Day';
import { HabitName } from '../../../domain/habit/HabitName';
import { ascentSetUp } from '../testing/ascent';
import { reduceMotionInEachTest } from '../testing/motion';
import { renderScreen } from '../testing/renderScreen';
import { TowerFootScreen } from './TowerFootScreen';

reduceMotionInEachTest();

/** La Sentinelle a Représailles, Tenir bon et Coup de bouclier ; Représailles sous Serment, tenu hier. */
async function show() {
  const setUp = ascentSetUp({
    seed: 42,
    shards: 200,
    powers: ['retaliation', 'holdFast', 'shieldBash'],
  });
  await setUp.dependencies.unitOfWork.run(async ({ habits, checkIns }) => {
    const habit = await habits.add(HabitName.parse('Courir'), Day.of(2026, 10, 1));
    await checkIns.save({
      habitId: habit.id,
      day: Day.of(2026, 10, 26),
      done: true,
      corrected: false,
    });
  });
  setUp.keyValueStore.values.set(
    OATHS_KEY,
    JSON.stringify({
      version: 1,
      oaths: [{ power: 'retaliation', habit: 1, since: '2026-10-20' }],
    }),
  );
  const onEnter = jest.fn();
  const onOpenPowers = jest.fn();
  await renderScreen(
    <TowerFootScreen
      session={setUp.session}
      camp={setUp.camp}
      onEnter={onEnter}
      onCamp={jest.fn()}
      onOpenPowers={onOpenPowers}
    />,
    setUp.dependencies,
  );
  await screen.findByTestId('equipped-powers-card');
  await fireEvent.press(await screen.findByRole('button', { name: "Commencer l'ascension" }));
  await act(async () => undefined);
  /** Le choix validé au menu des pouvoirs, ouvert depuis le Choix du héros (M13). */
  const validate = async (sentinel: readonly PowerKind[]) => {
    await act(async () => {
      expect(
        await setUp.camp.equipPowers({ sentinel, wanderer: setUp.camp.view().equipped.wanderer }),
      ).toBe('equipped');
    });
  };
  return { ...setUp, onEnter, onOpenPowers, validate };
}

const sentinelCells = () =>
  within(screen.getByTestId('hero-choice-sentinel'))
    .getAllByTestId(/^equipped-power-(?!kindled|free)/u)
    .map((cell) => cell.props.testID);

describe('TowerFootScreen: launching with the equipped powers (#236, #270)', () => {
  it('preselects the base power then the order of the tree, and launches with it', async () => {
    const { session, onEnter, keyValueStore } = await show();

    expect(sentinelCells()).toEqual([
      'equipped-power-bulwark',
      'equipped-power-shieldBash',
      'equipped-power-retaliation',
    ]);
    await fireEvent.press(screen.getByRole('button', { name: 'Continuer avec la Sentinelle' }));
    await act(async () => undefined);

    expect(session.current()?.powers).toEqual(['bulwark', 'shieldBash', 'retaliation']);
    expect(onEnter).toHaveBeenCalled();
    expect(JSON.parse(keyValueStore.values.get(EQUIPPED_POWERS_KEY)!).heroes).toEqual({
      sentinel: ['bulwark', 'shieldBash', 'retaliation'],
    });
  });

  it('opens the powers menu on the chosen hero from the discreet link (H2, M13)', async () => {
    const { onOpenPowers, validate } = await show();

    await fireEvent.press(
      screen.getByRole('button', {
        name: 'Changer les pouvoirs de la Sentinelle : ouvre le menu des pouvoirs',
      }),
    );
    expect(onOpenPowers).toHaveBeenCalledWith({ hero: 'sentinel', from: 'choice' });

    await validate(['shieldBash', 'retaliation', 'holdFast']);
    expect(screen.getByTestId('hero-choice')).toBeOnTheScreen();
    expect(sentinelCells()).toEqual([
      'equipped-power-shieldBash',
      'equipped-power-retaliation',
      'equipped-power-holdFast',
    ]);
  });

  it('launches with the powers validated in the menu, the base power left aside', async () => {
    const { session, keyValueStore, validate } = await show();

    await validate(['shieldBash', 'retaliation', 'holdFast']);
    await fireEvent.press(screen.getByRole('button', { name: 'Continuer avec la Sentinelle' }));
    await act(async () => undefined);

    expect(session.current()?.powers).toEqual(['shieldBash', 'retaliation', 'holdFast']);
    expect(JSON.parse(keyValueStore.values.get(EQUIPPED_POWERS_KEY)!).heroes.sentinel).toEqual([
      'shieldBash',
      'retaliation',
      'holdFast',
    ]);
  });

  it('keeps the screen and the choice when the choice cannot be saved, and a retry launches (H4)', async () => {
    const { session, onEnter, keyValueStore } = await show();
    const set = keyValueStore.set;
    keyValueStore.set = (key, value) =>
      key === EQUIPPED_POWERS_KEY ? Promise.reject(new Error('disk full')) : set(key, value);

    await fireEvent.press(screen.getByRole('button', { name: 'Continuer avec la Sentinelle' }));
    await act(async () => undefined);

    expect(
      screen.getByText(
        "Tes pouvoirs n'ont pas pu être enregistrés. Ton choix est gardé : réessaie.",
      ),
    ).toBeOnTheScreen();
    expect(session.current()).toBeNull();
    expect(onEnter).not.toHaveBeenCalled();
    expect(screen.getByTestId('equipped-power-shieldBash')).toBeOnTheScreen();

    keyValueStore.set = set;
    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    await act(async () => undefined);
    expect(session.current()?.powers).toEqual(['bulwark', 'shieldBash', 'retaliation']);
    expect(onEnter).toHaveBeenCalled();
  });

  it('offers « Continuer » again after a new choice validated in the menu', async () => {
    const { keyValueStore, validate } = await show();
    const set = keyValueStore.set;
    keyValueStore.set = (key, value) =>
      key === EQUIPPED_POWERS_KEY ? Promise.reject(new Error('disk full')) : set(key, value);
    await fireEvent.press(screen.getByRole('button', { name: 'Continuer avec la Sentinelle' }));
    await act(async () => undefined);
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeOnTheScreen();

    keyValueStore.set = set;
    await validate(['shieldBash', 'retaliation', 'holdFast']);

    expect(screen.getByRole('button', { name: 'Continuer avec la Sentinelle' })).toBeOnTheScreen();
  });

  it('shows the kindled line of the selection only', async () => {
    const { session, validate } = await show();
    const line = "Attisé : « Courir » faite hier. 1 Élan pour toute l'ascension.";
    expect(screen.getByText(line)).toBeOnTheScreen();

    await validate(['bulwark', 'shieldBash', 'holdFast']);

    expect(screen.queryByText(line)).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Continuer avec la Sentinelle' }));
    await act(async () => undefined);
    expect(session.current()?.kindled).toEqual([]);
  });
});
