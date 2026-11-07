// Le lancement avec les pouvoirs choisis au pied de la tour (#236) : le choix passe au lancement,
// il est mémorisé sous `camp.equippedPowers`, un échec d'enregistrement garde l'écran et la
// sélection, et les lignes « Attisé » suivent la sélection.
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
  await renderScreen(
    <TowerFootScreen
      session={setUp.session}
      camp={setUp.camp}
      onEnter={onEnter}
      onCamp={jest.fn()}
    />,
    setUp.dependencies,
  );
  await fireEvent.press(await screen.findByRole('button', { name: "Commencer l'ascension" }));
  await act(async () => undefined);
  return { ...setUp, onEnter };
}

const row = (power: PowerKind) => screen.getByTestId(`equipped-powers-row-${power}`);

/** Ouvre le panneau, coche ou décoche chaque pouvoir de `toggles`, puis « Valider ». */
async function choose(...toggles: PowerKind[]) {
  await fireEvent.press(screen.getByRole('button', { name: /^Changer les pouvoirs/u }));
  for (const power of toggles) await fireEvent.press(row(power));
  await fireEvent.press(
    within(screen.getByTestId('equipped-powers-panel')).getByRole('button', { name: 'Valider' }),
  );
}

describe('TowerFootScreen: launching with the chosen powers (#236)', () => {
  it('preselects the base power then the order of the tree, and launches with it', async () => {
    const { session, onEnter, keyValueStore } = await show();

    const cells = within(screen.getByTestId('hero-choice-sentinel'))
      .getAllByTestId(/^equipped-power-(?!kindled|free)/u)
      .map((cell) => cell.props.testID);
    expect(cells).toEqual([
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

  it('launches with the chosen powers, the base power left aside, and remembers them', async () => {
    const { session, keyValueStore } = await show();

    await choose('bulwark', 'holdFast');
    await fireEvent.press(screen.getByRole('button', { name: 'Continuer avec la Sentinelle' }));
    await act(async () => undefined);

    expect(session.current()?.powers).toEqual(['shieldBash', 'retaliation', 'holdFast']);
    expect(JSON.parse(keyValueStore.values.get(EQUIPPED_POWERS_KEY)!).heroes.sentinel).toEqual([
      'shieldBash',
      'retaliation',
      'holdFast',
    ]);
  });

  it('keeps the screen and the choice when the choice cannot be saved, and a retry launches', async () => {
    const { session, onEnter, keyValueStore } = await show();
    const set = keyValueStore.set;
    keyValueStore.set = (key, value) =>
      key === EQUIPPED_POWERS_KEY ? Promise.reject(new Error('disk full')) : set(key, value);

    await choose('bulwark', 'holdFast');
    await fireEvent.press(screen.getByRole('button', { name: 'Continuer avec la Sentinelle' }));
    await act(async () => undefined);

    expect(
      screen.getByText(
        "Tes pouvoirs n'ont pas pu être enregistrés. Ton choix est gardé : réessaie.",
      ),
    ).toBeOnTheScreen();
    expect(session.current()).toBeNull();
    expect(onEnter).not.toHaveBeenCalled();
    expect(screen.getByTestId('equipped-power-holdFast')).toBeOnTheScreen();

    keyValueStore.set = set;
    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    await act(async () => undefined);
    expect(session.current()?.powers).toEqual(['shieldBash', 'retaliation', 'holdFast']);
    expect(onEnter).toHaveBeenCalled();
  });

  it('shows the kindled line of the selection only', async () => {
    const { session } = await show();
    const line = "Attisé : « Courir » faite hier. 1 Élan pour toute l'ascension.";
    expect(screen.getByText(line)).toBeOnTheScreen();

    await choose('retaliation', 'holdFast');

    expect(screen.queryByText(line)).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Continuer avec la Sentinelle' }));
    await act(async () => undefined);
    expect(session.current()?.kindled).toEqual([]);
  });
});
