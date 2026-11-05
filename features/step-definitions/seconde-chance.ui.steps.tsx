/**
 * Scénario `@ui` de « Seconde chance » (#206) : le pied de la tour, avec les vrais cas d'usage sur
 * un stockage en mémoire (`ascentSetUp` : aujourd'hui est le mardi 27 octobre 2026, hier le lundi
 * 26).
 */
import { screen, within } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import type { InMemoryUnitOfWork } from '../../src/application/testing/InMemoryUnitOfWork';
import { Day } from '../../src/domain/day/Day';
import { HabitName } from '../../src/domain/habit/HabitName';
import { TowerFootScreen } from '../../src/adapters/ui/screens/TowerFootScreen';
import { ascentSetUp } from '../../src/adapters/ui/testing/ascent';
import { renderScreen } from '../../src/adapters/ui/testing/renderScreen';

const YESTERDAY = Day.of(2026, 10, 26);
const CREATED = Day.of(2026, 10, 1);

let setUp: ReturnType<typeof ascentSetUp>;

const steps: StepDefinitions = ({ given, when, then }) => {
  given(/^une jauge de \+2$/u, async () => {
    setUp = ascentSetUp({ seed: 42 });
    const unitOfWork = setUp.dependencies.unitOfWork as InMemoryUnitOfWork;
    for (let index = 0; index < 3; index += 1) {
      await unitOfWork.run(async ({ habits, settingsChanges, checkIns }) => {
        const habit = await habits.add(HabitName.parse(`Habitude ${index + 1}`), CREATED);
        await settingsChanges.add(habit.id, CREATED, { difficulty: 'medium', weeklyTarget: 7 });
        await checkIns.save({ habitId: habit.id, day: YESTERDAY, done: true, corrected: false });
      });
    }
  });

  when(/^le joueur ouvre le pied de la tour$/u, async () => {
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
  });

  then(/^les effets de la jauge comptent « 1 seconde chance »$/u, async () => {
    const card = await screen.findByRole('button', {
      name: /^Jauge du jour : Faveur pleine, plus 2\./u,
    });
    expect(within(card).getByText('1 seconde chance')).toBeOnTheScreen();
    expect(card.props.accessibilityLabel).toMatch(/, 1 seconde chance\. /u);
  });
};

// Les écrans seuls : `@domain` et `@session` ont leurs propres étapes.
const feature = loadFeature('features/seconde-chance.feature');
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
