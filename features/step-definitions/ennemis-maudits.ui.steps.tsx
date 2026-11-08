/**
 * Scénarios `@ui` de « Ennemis maudits » (#209) : les portes de « Choisis ta sortie », la colonne et
 * la frise d'action d'un combat où la Goule est maudite, et le pied de la tour avec les vrais cas
 * d'usage sur un stockage en mémoire (`ascentSetUp` : hier est le lundi 26 octobre 2026).
 */
import { render, screen, within } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import type { InMemoryUnitOfWork } from '../../src/application/testing/InMemoryUnitOfWork';
import { ActionTrack } from '../../src/adapters/ui/battle/ActionTrack';
import { EnemyColumn } from '../../src/adapters/ui/battle/EnemyColumn';
import { sceneGeometry } from '../../src/adapters/ui/battle/scene/sceneGeometry';
import { ExitChoice } from '../../src/adapters/ui/components/ExitChoice';
import { TowerFootScreen } from '../../src/adapters/ui/screens/TowerFootScreen';
import { actionTrackView, battleView } from '../../src/adapters/ui/state/battleView';
import { ascentSetUp } from '../../src/adapters/ui/testing/ascent';
import { renderScreen } from '../../src/adapters/ui/testing/renderScreen';
import type { Exit } from '../../src/domain/ascent/exits';
import type { FateGauge } from '../../src/domain/ascent/fateGauge';
import { startBattle, type Battle } from '../../src/domain/battle/Battle';
import { Day } from '../../src/domain/day/Day';
import { HabitName } from '../../src/domain/habit/HabitName';

const hidden = { includeHiddenElements: true } as const;
const YESTERDAY = Day.of(2026, 10, 26);
const CREATED = Day.of(2026, 10, 1);
const DOORS: readonly Exit[] = [
  { kind: 'combat', groupSize: 3 },
  { kind: 'elite', groupSize: null },
];

let gauge: FateGauge;
let battle: Battle;
let card: ReturnType<typeof screen.getByTestId>;

const door = (name: string) => screen.getByRole('button', { name });

async function showDoors(at: FateGauge) {
  // Le palier 1 : l'Élite y vient seule, sans annonce d'escorte (#257).
  await render(<ExitChoice boons={[]} exits={DOORS} gauge={at} tier={1} onChoose={jest.fn()} />);
}

/** Le pied de la tour, hier `done` habitudes « fait » sur 3. */
async function towerFoot(done: number) {
  const setUp = ascentSetUp({ seed: 42 });
  const unitOfWork = setUp.dependencies.unitOfWork as InMemoryUnitOfWork;
  for (let index = 0; index < 3; index += 1) {
    await unitOfWork.run(async ({ habits, settingsChanges, checkIns }) => {
      const habit = await habits.add(HabitName.parse(`Habitude ${index + 1}`), CREATED);
      await settingsChanges.add(habit.id, CREATED, { difficulty: 'medium', weeklyTarget: 7 });
      if (index < done) {
        await checkIns.save({ habitId: habit.id, day: YESTERDAY, done: true, corrected: false });
      }
    });
  }
  await renderScreen(
    <TowerFootScreen
      session={setUp.session}
      camp={setUp.camp}
      onEnter={jest.fn()}
      onCamp={jest.fn()}
    />,
    setUp.dependencies,
  );
  return screen.findByTestId('gauge-card');
}

const steps: StepDefinitions = ({ given, when, then, and }) => {
  // --- Les portes ---

  given(/^une ascension lancée avec une jauge de −2$/u, () => {
    gauge = -2;
  });

  when(
    /^l'écran « Choisis ta sortie » propose une porte Combat de 3 ennemis et une porte Élite$/u,
    () => showDoors(gauge),
  );

  then(/^la porte Combat dit « 3 ennemis » et « dont 1 maudit », sans dire lequel$/u, () => {
    expect(door('Combat · 3 ennemis · dont 1 maudit')).toBeOnTheScreen();
    expect(screen.queryByText(/Goule|Spectre|Nécromancien|Squelette/u)).toBeNull();
  });

  and(/^la porte Élite dit « Élite maudite »$/u, () => {
    expect(door('Élite maudite · objet Rare garanti · coffre scellé')).toBeOnTheScreen();
  });

  and(
    /^avec une jauge de −1, la porte Combat dit « dont 1 maudit » et la porte Élite dit « Élite » au palier 1, comme aujourd'hui$/u,
    async () => {
      await showDoors(-1);
      expect(door('Combat · 3 ennemis · dont 1 maudit')).toBeOnTheScreen();
      expect(door('Élite · objet Rare garanti · coffre scellé')).toBeOnTheScreen();
    },
  );

  // --- Le lecteur d'écran ---

  given(/^la Goule est maudite dans un combat$/u, () => {
    const started = startBattle({
      seed: 1,
      defenseHint: false,
      at: 0,
      initiative: true,
      enemies: ['ghoul', 'specter'],
      cursed: 0,
    }).battle;
    battle = { ...started, phase: { kind: 'hero', since: 0, announced: false }, target: 0 };
  });

  when(/^le lecteur d'écran lit la Goule$/u, async () => {
    await render(
      <>
        <ActionTrack track={actionTrackView(battle)} />
        <EnemyColumn
          view={battleView(battle).enemies[0]!}
          index={0}
          slot={sceneGeometry(390, 440, 2).enemies[0]!}
          sealed={false}
          float={null}
          uiNow={() => 0}
          now={() => 0}
          onTarget={jest.fn()}
        />
      </>,
    );
  });

  then(/^il dit « Goule maudite », avant ses PV$/u, () => {
    const label = screen.getByTestId('enemy-ghoul').props.accessibilityLabel as string;
    expect(label).toMatch(/^Goule maudite, cible, 60 PV sur 60, /u);
  });

  and(
    /^l'ennemi maudit se reconnaît sans la couleur seule \(étiquette et marque dans la frise d'action\)$/u,
    () => {
      expect(within(screen.getByTestId('enemy-ghoul-curse')).getByText('Maudite')).toBeTruthy();
      expect(screen.getByTestId('enemy-ghoul-curse-skull', hidden)).toBeTruthy();
      expect(screen.getAllByTestId('track-cursed-skull', hidden).length).toBeGreaterThan(0);
      expect(screen.getByTestId('battle-action-track').props.accessibilityLabel).toMatch(
        /Goule maudite/u,
      );
    },
  );

  // --- La jauge ---

  given(/^une jauge de −1$/u, () => {
    gauge = -1;
  });

  when(/^le joueur ouvre le pied de la tour$/u, async () => {
    // Hier, 1 habitude « fait » sur 3 : Malédiction.
    expect(gauge).toBe(-1);
    card = await towerFoot(1);
  });

  then(/^les effets de la jauge comptent « 1 ennemi maudit par combat »$/u, () => {
    expect(within(card).getByText('1 ennemi maudit par combat')).toBeOnTheScreen();
    expect(card.props.accessibilityLabel).toMatch(/1 ennemi maudit par combat/u);
  });

  and(/^avec une jauge de −2, ils comptent aussi l'Élite maudite$/u, async () => {
    // Hier, aucune habitude « fait » sur 3 : Malédiction forte.
    screen.unmount();
    card = await towerFoot(0);
    expect(within(card).getByText('Ennemis et Élite maudits')).toBeOnTheScreen();
  });
};

// Les écrans seuls : `@domain` et `@session` ont leurs propres étapes.
const feature = loadFeature('features/ennemis-maudits.feature');
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
