/**
 * Scénarios d'interface (`@ui`) de « Difficulté d'une habitude » (#23) : la Vue Journée
 * (`DayViewScreen`), ses panneaux « Nouvelle habitude » et « Modifier l'habitude », sur une vraie
 * base SQLite reliée par le pont expo-sqlite, avec l'horloge fixée au jour du scénario. Le joueur
 * agit comme sur le téléphone : il touche « ⋯ » ou « Ajouter une habitude », une difficulté, une
 * ligne ; il lit le panneau, l'aide, le feedback, ou ce que le lecteur d'écran annonce.
 *
 * Correspondance des libellés : les textes de l'interface emploient l'apostrophe typographique
 * (« S’applique… »), le fichier `.feature` l'apostrophe droite.
 *
 * Les autres scénarios de la fonctionnalité passent par les cas d'usage
 * (`difficulty.use-cases.steps.ts`) ; leur pendant à l'écran est vérifié par les tests
 * d'intégration de `DayViewScreen`, `WeekViewScreen`, `NewHabitSheet`, `EditHabitSheet`,
 * `DifficultyPicker`, `HabitRow` et `WeekGrid`.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { FixedClock } from '../../src/adapters/device/clock/FixedClock';
import { prepareExpoSqliteDatabase } from '../../src/adapters/persistence/sqlite/expoSqliteDatabase';
import { SqliteKeyValueStore } from '../../src/adapters/persistence/sqlite/SqliteKeyValueStore';
import { SqliteUnitOfWork } from '../../src/adapters/persistence/sqlite/SqliteUnitOfWork';
import { FakeExpoSqliteConnection } from '../../src/adapters/persistence/testing/fakeExpoSqlite';
import { difficultyLabels } from '../../src/adapters/ui/format/formatDifficulty';
import { DayViewScreen } from '../../src/adapters/ui/screens/DayViewScreen';
import type { Dependencies } from '../../src/adapters/ui/state/Dependencies';
import { renderScreen } from '../../src/adapters/ui/testing/renderScreen';
import { silentHaptics } from '../../src/adapters/ui/testing/silentHaptics';
import { createHabit } from '../../src/application/useCases/createHabit';
import { getDayView } from '../../src/application/useCases/getDayView';
import { Day } from '../../src/domain/day/Day';
import { DIFFICULTIES, type Difficulty } from '../../src/domain/habit/Difficulty';
import { frenchDay } from '../support/frenchDay';

interface World {
  deps: Dependencies;
  hint: string | null;
}

let world: World;

/** La difficulté écrite `label` (« Difficile »). */
function difficultyNamed(label: string): Difficulty {
  const difficulty = DIFFICULTIES.find((each) => difficultyLabels[each] === label);
  if (difficulty === undefined) {
    throw new Error(`Unknown difficulty: ${label}`);
  }
  return difficulty;
}

/** Le texte tel que l'interface l'écrit, avec l'apostrophe typographique. */
const typographic = (text: string) => text.replaceAll("'", '’');

async function addHabit(name: string, difficulty: Difficulty): Promise<void> {
  await expect(createHabit(world.deps, name, difficulty)).resolves.toMatchObject({ ok: true });
}

/** L'option de difficulté écrite `label`, lue « Difficile, 20 XP par suivi ». */
const option = (label: string) =>
  screen.getByRole('radio', { name: new RegExp(`^${label}, \\d+ XP par suivi$`, 'u') });
const saveButton = () => screen.getByRole('button', { name: 'Enregistrer' });

/** La Vue Journée, une fois lue. */
async function showDayView(): Promise<void> {
  await renderScreen(<DayViewScreen />, world.deps);
  await waitFor(() =>
    expect(screen.queryByLabelText('Chargement de tes habitudes')).not.toBeOnTheScreen(),
  );
}

/** Ouvre « Nouvelle habitude » depuis la Vue Journée (état vide ou liste). */
async function openNewHabit(): Promise<void> {
  await showDayView();
  await fireEvent.press(screen.getByRole('button', { name: 'Ajouter une habitude' }));
  expect(await screen.findByRole('header', { name: 'Nouvelle habitude' })).toBeOnTheScreen();
}

const steps: StepDefinitions = ({ given, when, then }) => {
  given(/^nous sommes le (.+) selon le téléphone$/, (date: string) => {
    world.deps = { ...world.deps, clock: new FixedClock(frenchDay(date)) };
  });

  given(/^l'habitude « ([^»]+) » est en « ([^»]+) »$/, (name: string, label: string) =>
    addHabit(name, difficultyNamed(label)),
  );
  given(/^le joueur a l'habitude « ([^»]+) »$/, (name: string) => addHabit(name, 'medium'));
  given(
    /^il a l'habitude « ([^»]+) » avec la difficulté « ([^»]+) »$/,
    (name: string, label: string) => addHabit(name, difficultyNamed(label)),
  );
  given("le joueur n'a encore enregistré aucun suivi", async () => {
    const view = await getDayView(world.deps);
    expect(view.doneCount).toBe(0);
  });

  when(/^le joueur ouvre « ([^»]+) » pour la modifier$/, async (name: string) => {
    await showDayView();
    await fireEvent.press(screen.getByRole('button', { name: `Modifier l’habitude ${name}` }));
    expect(await screen.findByRole('header', { name: 'Modifier l’habitude' })).toBeOnTheScreen();
  });
  when(/^il choisit « ([^»]+) »$/, async (label: string) => {
    await fireEvent.press(option(label));
  });
  when(
    /^il saisit « ([^»]+) » dans « Nouvelle habitude » avec la difficulté « ([^»]+) »$/,
    async (name: string, label: string) => {
      await openNewHabit();
      await fireEvent.press(option(label));
      await fireEvent.changeText(screen.getByLabelText('Nom de l’habitude'), name);
      await fireEvent.press(screen.getByRole('button', { name: 'Créer l’habitude' }));
    },
  );
  when('il ouvre la Vue Journée', async () => {
    await showDayView();
  });
  when(/^il touche « ([^»]+) »$/, async (name: string) => {
    await fireEvent.press(screen.getByRole('switch', { name: new RegExp(`^${name}, `, 'u') }));
  });
  when(
    /^le lecteur d'écran parcourt le bloc « Difficulté » de « Nouvelle habitude » après le choix de « ([^»]+) »$/,
    async (label: string) => {
      await openNewHabit();
      await fireEvent.press(option(label));
    },
  );

  then(
    /^la difficulté « ([^»]+) » (?:est présélectionnée|reste sélectionnée)$/,
    (label: string) => {
      expect(option(label)).toBeChecked();
      for (const other of DIFFICULTIES.map((each) => difficultyLabels[each])) {
        if (other !== label) {
          expect(option(other)).not.toBeChecked();
        }
      }
    },
  );
  then('« Enregistrer » est désactivé', () => {
    expect(saveButton()).toBeDisabled();
  });
  then('« Enregistrer » est activé', () => {
    expect(saveButton()).toBeEnabled();
  });
  then(/^le message « (.+) » s'affiche$/, (message: string) => {
    const shown = screen.getByTestId('difficulty-change-info');
    expect(shown).toHaveAccessibleName(typographic(message));
    expect(screen.getByText(typographic(message))).toBeOnTheScreen();
  });
  then("un message d'erreur indique qu'une habitude porte déjà ce nom", async () => {
    expect(
      await screen.findByRole('alert', { name: /^Tu as déjà une habitude/u }),
    ).toBeOnTheScreen();
  });
  then(/^l'aide au premier usage affiche « (.+) »$/, async (text: string) => {
    await screen.findByTestId('check-in-hint');
    expect(screen.getByText(text)).toBeOnTheScreen();
    world.hint = text;
  });
  then(/^le feedback « ([^»]+) » s'affiche$/, async (feedback: string) => {
    await waitFor(() =>
      expect(screen.getByTestId('xp-change', { includeHiddenElements: true })).toHaveTextContent(
        feedback,
      ),
    );
  });
  then("l'aide au premier usage disparaît", async () => {
    await waitFor(() => expect(screen.queryByTestId('check-in-hint')).not.toBeOnTheScreen());
    expect(world.hint).not.toBeNull();
    expect(screen.queryByText(world.hint ?? '')).not.toBeOnTheScreen();
  });
  then(/^il annonce le groupe « ([^»]+) »$/, (group: string) => {
    const picker = screen.getByTestId('difficulty-picker');
    expect(picker).toHaveProp('accessibilityRole', 'radiogroup');
    expect(picker).toHaveAccessibleName(group);
  });
  then(/^il annonce « (.+), sélectionné »$/, (name: string) => {
    const chosen = screen.getByRole('radio', { name, checked: true });
    expect(chosen).toBeSelected();
  });
};

beforeEach(async () => {
  const connection = FakeExpoSqliteConnection.open();
  const db = await prepareExpoSqliteDatabase(connection);
  world = {
    hint: null,
    deps: {
      clock: new FixedClock(Day.of(2000, 1, 1)),
      unitOfWork: new SqliteUnitOfWork(db),
      keyValueStore: new SqliteKeyValueStore(db),
      haptics: silentHaptics(),
    },
  };
});

// Seuls les scénarios d'interface (`@ui`) : les autres passent par les cas d'usage.
const feature = loadFeature('features/difficulty.feature');
const onScreen = ({ tags }: { readonly tags: readonly string[] }) => tags.includes('@ui');
autoBindSteps(
  [
    {
      ...feature,
      scenarios: feature.scenarios.filter(onScreen),
      scenarioOutlines: feature.scenarioOutlines.filter(onScreen),
    },
  ],
  [steps],
);
