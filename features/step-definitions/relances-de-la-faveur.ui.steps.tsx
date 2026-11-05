/**
 * Scénarios `@ui` de « Relances de la faveur » (#42) : le pied de la tour et la feuille de
 * l'Équipement, avec les vrais cas d'usage sur un stockage en mémoire (`ascentSetUp` : aujourd'hui
 * est le mardi 27 octobre 2026, hier le lundi 26).
 */
import { fireEvent, screen, within } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import type { InMemoryUnitOfWork } from '../../src/application/testing/InMemoryUnitOfWork';
import { startAscent } from '../../src/domain/ascent/Ascent';
import { Day } from '../../src/domain/day/Day';
import { HabitName } from '../../src/domain/habit/HabitName';
import { TowerFootScreen } from '../../src/adapters/ui/screens/TowerFootScreen';
import { ascentSetUp } from '../../src/adapters/ui/testing/ascent';
import { renderScreen } from '../../src/adapters/ui/testing/renderScreen';

const YESTERDAY = Day.of(2026, 10, 26);
const CREATED = Day.of(2026, 10, 1);

let setUp: ReturnType<typeof ascentSetUp>;

/** `total` habitudes, dont les `done` premières « fait » hier. */
async function habits(done: number, total: number) {
  const unitOfWork = setUp.dependencies.unitOfWork as InMemoryUnitOfWork;
  for (let index = 0; index < total; index += 1) {
    await unitOfWork.run(async ({ habits: repository, settingsChanges, checkIns }) => {
      const habit = await repository.add(HabitName.parse(`Habitude ${index + 1}`), CREATED);
      await settingsChanges.add(habit.id, CREATED, { difficulty: 'medium', weeklyTarget: 7 });
      if (index < done) {
        await checkIns.save({ habitId: habit.id, day: YESTERDAY, done: true, corrected: false });
      }
    });
  }
}

async function showTowerFoot() {
  await renderScreen(
    <TowerFootScreen
      session={setUp.session}
      camp={setUp.camp}
      onEnter={jest.fn()}
      onCamp={jest.fn()}
    />,
    setUp.dependencies,
  );
  await screen.findByTestId('tower-foot');
}

const steps: StepDefinitions = ({ given, when, then, and }) => {
  given(/^une jauge de \+1$/u, async () => {
    setUp = ascentSetUp({ seed: 42 });
    await habits(3, 4);
  });

  when(/^le joueur ouvre le pied de la tour$/u, showTowerFoot);

  then(/^les effets de la jauge comptent « 1 relance »$/u, async () => {
    const card = await screen.findByRole('button', { name: /^Jauge du jour : Faveur, plus 1\./u });
    expect(within(card).getByText('1 relance')).toBeOnTheScreen();
    expect(card.props.accessibilityLabel).toMatch(/, 1 relance\. /u);
  });

  given(/^une ascension lancée avec une jauge de \+2, où il reste 1 relance sur 2$/u, () => {
    const ascent = startAscent(3, { gauge: 2 });
    setUp = ascentSetUp({
      saved: { ...ascent, blessings: [{ family: 'haste', rarity: 'rare' }], rerolls: 1 },
    });
  });

  when(/^le joueur ouvre la feuille de l'Équipement$/u, async () => {
    await showTowerFoot();
    await fireEvent.press(
      await screen.findByRole('button', { name: "Voir le détail de l'Équipement" }),
    );
  });

  then(/^la section « Faveur de l'ascension » dit qu'il reste 1 relance sur 2$/u, () => {
    expect(screen.getByLabelText("Faveur de l'ascension, plus 2")).toBeOnTheScreen();
    expect(screen.getByTestId('favor-row')).toHaveAccessibleName(
      "Relances, 1 sur 2. Redonnent l'offre de bienfaits.",
    );
  });

  and(/^au pied de la tour, le cadre de l'ascension en cours le dit en une ligne$/u, () => {
    const card = screen.getByTestId('ascent-gauge-card');
    expect(within(card).getByText('1 relance sur 2')).toBeOnTheScreen();
  });
};

// Les écrans seuls : `@domain` et `@session` ont leurs propres étapes.
const feature = loadFeature('features/relances-de-la-faveur.feature');
const ofUi = ({ tags }: { readonly tags: readonly string[] }) => tags.includes('@ui');
autoBindSteps(
  [
    {
      ...feature,
      scenarios: feature.scenarios.filter(ofUi),
      scenarioOutlines: feature.scenarioOutlines.filter(ofUi),
    },
  ],
  [steps],
);
