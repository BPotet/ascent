// Le pouvoir attisé au pied de la tour (#237, parcours E) : le Choix du héros le montre, le
// lancement le fige avec la jauge scellée, et l'Équipement de l'ascension nomme son habitude.
import { act, fireEvent, screen, within } from '@testing-library/react-native';

import { OATHS_KEY } from '../../../application/useCases/oaths';
import { startAscent } from '../../../domain/ascent/Ascent';
import { Day } from '../../../domain/day/Day';
import { HabitName } from '../../../domain/habit/HabitName';
import { ascentSetUp } from '../testing/ascent';
import { renderScreen } from '../testing/renderScreen';
import { TowerFootScreen } from './TowerFootScreen';

/** « Courir », liée à Représailles depuis le 20 octobre ; le 27 octobre, faite hier ou non. */
async function show({ doneYesterday }: { readonly doneYesterday: boolean }) {
  const setUp = ascentSetUp({ seed: 42, shards: 90, powers: ['retaliation', 'holdFast'] });
  await setUp.dependencies.unitOfWork.run(async ({ habits, checkIns }) => {
    const habit = await habits.add(HabitName.parse('Courir 20 minutes'), Day.of(2026, 10, 1));
    if (doneYesterday) {
      await checkIns.save({
        habitId: habit.id,
        day: Day.of(2026, 10, 26),
        done: true,
        corrected: false,
      });
    }
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
  return setUp;
}

describe('TowerFootScreen: the kindled powers (#237)', () => {
  it('shows Retaliation kindled on the hero choice, then begins the ascent with it (S8)', async () => {
    const { session } = await show({ doneYesterday: true });

    const cell = screen.getByTestId('equipped-power-retaliation');
    expect(within(cell).getByText('2 → 1 Élan')).toBeOnTheScreen();
    expect(
      screen.getByText("Attisé : « Courir 20 minutes » faite hier. 1 Élan pour toute l'ascension."),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Continuer avec la Sentinelle' }));

    expect(session.current()?.kindled).toEqual([{ power: 'retaliation', habit: 1 }]);
  });

  it('says the habit was not done yesterday, and kindles nothing (S9)', async () => {
    const { session } = await show({ doneYesterday: false });

    expect(
      screen.getByText(
        "Serment de Représailles : « Courir 20 minutes » pas faite hier. Fais-la aujourd'hui, il sera attisé demain.",
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Continuer avec la Sentinelle' }));

    expect(session.current()?.kindled).toEqual([]);
  });

  it('names the habit of the kept Oath in the Loadout of the ascent in progress (S10)', async () => {
    const launched = startAscent(42, {
      powers: ['bulwark', 'retaliation'],
      kindled: [{ power: 'retaliation', habit: 1 }],
    });
    const setUp = ascentSetUp({
      saved: { ...launched, hero: { ...launched.hero, boons: ['perfectEcho'] } },
    });
    await setUp.dependencies.unitOfWork.run(({ habits }) =>
      habits.add(HabitName.parse('Courir 20 minutes'), Day.of(2026, 10, 1)),
    );
    await renderScreen(
      <TowerFootScreen
        session={setUp.session}
        camp={setUp.camp}
        onEnter={jest.fn()}
        onCamp={jest.fn()}
      />,
      setUp.dependencies,
    );

    await fireEvent.press(await screen.findByTestId('loadout-detail'));

    expect(
      await screen.findByText('Serment : « Courir 20 minutes », faite hier.'),
    ).toBeOnTheScreen();
  });
});
