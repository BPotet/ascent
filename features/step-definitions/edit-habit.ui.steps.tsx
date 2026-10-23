/**
 * Scénarios d'interface (`@ui`) de « Renommer et supprimer une habitude » (#6) : la Vue Journée
 * (`DayViewScreen`) et le panneau « Modifier l'habitude », sur une vraie base SQLite reliée par le
 * pont expo-sqlite, avec l'horloge fixée au jour du scénario. Le joueur agit comme sur le
 * téléphone : il touche « ⋯ », lit le panneau, change le nom ou la difficulté.
 *
 * Les autres scénarios de la fonctionnalité passent par les cas d'usage
 * (`edit-habit.use-cases.steps.ts`) ; leur pendant à l'écran est vérifié par les tests
 * d'intégration de `DayViewScreen`, `WeekViewScreen`, `EditHabitSheet` et `DeleteHabitDialog`.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { FixedClock } from '../../src/adapters/device/clock/FixedClock';
import { prepareExpoSqliteDatabase } from '../../src/adapters/persistence/sqlite/expoSqliteDatabase';
import { SqliteKeyValueStore } from '../../src/adapters/persistence/sqlite/SqliteKeyValueStore';
import { SqliteUnitOfWork } from '../../src/adapters/persistence/sqlite/SqliteUnitOfWork';
import { FakeExpoSqliteConnection } from '../../src/adapters/persistence/testing/fakeExpoSqlite';
import { DayViewScreen } from '../../src/adapters/ui/screens/DayViewScreen';
import type { Dependencies } from '../../src/adapters/ui/state/Dependencies';
import { renderScreen } from '../../src/adapters/ui/testing/renderScreen';
import { silentHaptics } from '../../src/adapters/ui/testing/silentHaptics';
import { createHabit } from '../../src/application/useCases/createHabit';
import { Day } from '../../src/domain/day/Day';
import { frenchDay } from '../support/frenchDay';

interface World {
  clock: FixedClock;
  deps: Dependencies;
  today: Day;
}

let world: World;

/** Crée l'habitude le jour donné, comme si le joueur l'avait créée ce jour-là. */
async function addHabit(name: string, createdOn: Day): Promise<void> {
  world.clock.setToday(createdOn);
  const outcome = await createHabit(world.deps, name);
  world.clock.setToday(world.today);
  if (!outcome.ok) {
    throw new Error(`${name} not created: ${outcome.reason}`);
  }
}

const steps: StepDefinitions = ({ given, when, then }) => {
  given(/^nous sommes le (.+) selon le téléphone$/, (date: string) => {
    world.today = frenchDay(date);
    world.clock.setToday(world.today);
  });
  given(
    /^(?:le joueur|il) a l'habitude « ([^»]+) », créée le (.+)$/,
    (name: string, date: string) => addHabit(name, frenchDay(date)),
  );

  when(/^le joueur ouvre « ([^»]+) » pour la modifier$/, async (name: string) => {
    await renderScreen(<DayViewScreen />, world.deps);
    await screen.findByText(name);
    await fireEvent.press(screen.getByRole('button', { name: `Modifier l’habitude ${name}` }));
  });

  then(
    /^le panneau « Modifier l'habitude » s'affiche avec le nom « ([^»]+) »$/,
    async (name: string) => {
      await waitFor(() =>
        expect(screen.getByRole('header', { name: 'Modifier l’habitude' })).toBeOnTheScreen(),
      );
      expect(screen.getByLabelText('Nom de l’habitude')).toHaveDisplayValue(name);
    },
  );
  then(/^l'action « Supprimer l'habitude » est proposée$/, () => {
    expect(screen.getByRole('button', { name: 'Supprimer l’habitude' })).toBeEnabled();
  });
  then("l'enregistrement est désactivé tant que rien n'a changé", async () => {
    const save = () => screen.getByRole('button', { name: 'Enregistrer' });
    const difficulty = (label: string) =>
      screen.getByRole('radio', { name: new RegExp(`^${label},`, 'u') });
    expect(save()).toBeDisabled();
    // Ni le nom (une fois nettoyé)…
    await fireEvent.changeText(screen.getByLabelText('Nom de l’habitude'), ' Cuisiner ');
    expect(save()).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Nom de l’habitude'), 'Cuisiner maison');
    expect(save()).toBeEnabled();
    await fireEvent.changeText(screen.getByLabelText('Nom de l’habitude'), 'Cuisiner');
    expect(save()).toBeDisabled();
    // … ni la difficulté.
    await fireEvent.press(difficulty('Difficile'));
    expect(save()).toBeEnabled();
    await fireEvent.press(difficulty('Moyenne'));
    expect(save()).toBeDisabled();
  });
};

beforeEach(async () => {
  const connection = FakeExpoSqliteConnection.open();
  const db = await prepareExpoSqliteDatabase(connection);
  const clock = new FixedClock(Day.of(2000, 1, 1));
  world = {
    clock,
    today: Day.of(2000, 1, 1),
    deps: {
      clock,
      unitOfWork: new SqliteUnitOfWork(db),
      keyValueStore: new SqliteKeyValueStore(db),
      haptics: silentHaptics(),
    },
  };
});

// Seuls les scénarios d'interface (`@ui`) : les autres passent par les cas d'usage.
const feature = loadFeature('features/edit-habit.feature');
autoBindSteps(
  [{ ...feature, scenarios: feature.scenarios.filter(({ tags }) => tags.includes('@ui')) }],
  [steps],
);
