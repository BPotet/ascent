/**
 * Scénarios `@ui` du « Serment et du pouvoir attisé » (#237, maquette 232 : S1 à S4) : l'arbre de
 * pouvoirs au camp, la fiche du pouvoir et le choix de l'habitude, sur une vraie session du camp et
 * des ports en mémoire.
 */
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { OATHS_KEY } from '../../src/application/useCases/oaths';
import { PowerTreeScreen } from '../../src/adapters/ui/screens/PowerTreeScreen';
import { ascentSetUp } from '../../src/adapters/ui/testing/ascent';
import { reduceMotionInEachTest } from '../../src/adapters/ui/testing/motion';
import { renderScreen } from '../../src/adapters/ui/testing/renderScreen';
import { Day } from '../../src/domain/day/Day';
import { HabitName } from '../../src/domain/habit/HabitName';

reduceMotionInEachTest();

let setUp: ReturnType<typeof ascentSetUp>;

/** Le camp, Représailles débloqué, avec les habitudes `habits`. */
async function camp(habits: readonly string[]): Promise<void> {
  setUp = ascentSetUp({ shards: 20, powers: ['retaliation'] });
  for (const name of habits) {
    await setUp.dependencies.unitOfWork.run(({ habits: repository }) =>
      repository.add(HabitName.parse(name), Day.of(2026, 10, 1)),
    );
  }
  await setUp.session.load();
}

async function openSheet(): Promise<void> {
  await renderScreen(
    <PowerTreeScreen camp={setUp.camp} hero="sentinel" onLeave={jest.fn()} onGoToDay={jest.fn()} />,
    setUp.dependencies,
  );
  await act(async () => undefined);
  await fireEvent.press(await screen.findByTestId('power-node-retaliation'));
  await screen.findByTestId('power-sheet');
}

async function swearOnRunning(): Promise<void> {
  await openSheet();
  await fireEvent.press(screen.getByRole('button', { name: /^Prêter serment/u }));
  await fireEvent.press(await screen.findByRole('radio', { name: 'Courir' }));
  await fireEvent.press(screen.getByTestId('oath-swear'));
}

const steps: StepDefinitions = ({ given, when, then, and }) => {
  given(/^le joueur a débloqué Représailles \(2 Élan\) et a l'habitude « Courir »$/u, async () => {
    await camp(['Courir']);
  });

  when(
    /^il ouvre Représailles dans l'arbre de la Sentinelle et lie « Courir » par un Serment$/u,
    async () => {
      await swearOnRunning();
    },
  );

  then(/^Représailles porte le Serment « Courir »$/u, async () => {
    const frame = await screen.findByTestId('oath-frame');
    expect(within(frame).getByText('« Courir »')).toBeOnTheScreen();
    expect(
      screen.getByTestId('power-node-oath-retaliation', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
  });

  and(/^la fiche dit que le Serment compte dès demain$/u, () => {
    expect(
      within(screen.getByTestId('oath-frame')).getByText(/^Le Serment compte dès demain/u),
    ).toBeOnTheScreen();
  });

  given(/^le joueur n'a aucune habitude$/u, async () => {
    await camp([]);
  });

  when(/^il ouvre un pouvoir à 2 Élan ou plus dans l'arbre$/u, async () => {
    await openSheet();
    await fireEvent.press(screen.getByRole('button', { name: /^Prêter serment/u }));
  });

  then(
    /^le Serment dit qu'il faut d'abord créer une habitude, sans rien proposer à lier$/u,
    async () => {
      expect(
        await screen.findByText(
          "Tu n'as pas encore d'habitude. Crée-en une dans l'onglet Journée, puis reviens prêter serment.",
        ),
      ).toBeOnTheScreen();
      expect(screen.queryByRole('radio')).not.toBeOnTheScreen();
      expect(screen.queryByTestId('oath-swear')).not.toBeOnTheScreen();
    },
  );

  given(/^l'enregistrement du Serment échoue$/u, async () => {
    await camp(['Courir']);
    setUp.keyValueStore.failWrites();
  });

  when(/^le joueur lie « Courir » à Représailles$/u, async () => {
    await swearOnRunning();
  });

  then(/^un message dit que le Serment n'a pas pu être enregistré$/u, async () => {
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Le Serment n'a pas pu être enregistré. Réessaie.",
    );
  });

  and(/^Représailles ne porte pas de Serment et le joueur peut réessayer$/u, async () => {
    expect(setUp.keyValueStore.values.has(OATHS_KEY)).toBe(false);
    expect(setUp.camp.view().oaths).toEqual({});
    setUp.keyValueStore.failWrites(false);
    await fireEvent.press(screen.getByTestId('oath-swear'));
    expect(await screen.findByTestId('oath-frame')).toBeOnTheScreen();
  });
};

// Les scénarios `@ui` seuls.
const feature = loadFeature('features/serment.feature');
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
