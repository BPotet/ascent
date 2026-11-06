/**
 * Scénarios `@ui` de « Coffre scellé, clés et Fortune » (#226) : le pied de la tour, la porte
 * Élite, l'écran du coffre scellé, l'en-tête et la feuille de l'Équipement, avec les vrais cas
 * d'usage sur un stockage en mémoire (`ascentSetUp` : aujourd'hui est le mardi 27 octobre 2026,
 * hier le lundi 26).
 */
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { ExitChoice } from '../../src/adapters/ui/components/ExitChoice';
import { AscentScreen } from '../../src/adapters/ui/screens/AscentScreen';
import { TowerFootScreen } from '../../src/adapters/ui/screens/TowerFootScreen';
import { ascentSetUp } from '../../src/adapters/ui/testing/ascent';
import { renderScreen } from '../../src/adapters/ui/testing/renderScreen';
import type { InMemoryUnitOfWork } from '../../src/application/testing/InMemoryUnitOfWork';
import {
  endFloorBattle,
  leaveItem,
  startAscent,
  type Ascent,
} from '../../src/domain/ascent/Ascent';
import type { FateGauge } from '../../src/domain/ascent/fateGauge';
import { eliteGold } from '../../src/domain/ascent/rewards';
import { Day } from '../../src/domain/day/Day';
import { HabitName } from '../../src/domain/habit/HabitName';

jest.mock('../../src/adapters/ui/battle/BattleCanvas', () =>
  jest.requireActual('../../src/adapters/ui/battle/testing/fakeBattleCanvas'),
);

const YESTERDAY = Day.of(2026, 10, 26);
const CREATED = Day.of(2026, 10, 1);
const OPEN_TWO = "Ouvrir avec une clé, il t'en reste 2";

let setUp: ReturnType<typeof ascentSetUp>;
let before: Ascent;

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

const visibility = { onChange: () => () => undefined };

/** L'écran de l'ascension sur l'ascension sauvegardée `saved`. */
async function showAscent(saved: Ascent) {
  setUp = ascentSetUp({ saved });
  await setUp.session.load();
  await renderScreen(
    <AscentScreen session={setUp.session} visibility={visibility} onLeave={jest.fn()} />,
    setUp.dependencies,
  );
}

/** L'Élite de l'étage 3 gagnée, avec `keys` clés : son objet garanti en attente. */
function afterElite(keys: number, gauge: FateGauge = 1): Ascent {
  return endFloorBattle(
    {
      ...startAscent(42, { gauge }),
      floor: 3,
      keys,
      encounter: { kind: 'elite', enemies: ['twins'], battleSeed: 3 },
    },
    { outcome: 'victory', heroHp: 50 },
  );
}

const current = () => setUp.session.current()!;

const steps: StepDefinitions = ({ given, when, then, and }) => {
  // --- Le pied de la tour (K1) ---

  given(/^une jauge de \+2$/u, async () => {
    setUp = ascentSetUp({ seed: 42 });
    await habits(3, 3);
  });

  when(/^le joueur ouvre le pied de la tour$/u, showTowerFoot);

  then(/^les effets de la jauge comptent « 1 clé »$/u, async () => {
    const card = await screen.findByTestId('gauge-card');
    expect(within(card).getByText('1 clé')).toBeOnTheScreen();
    expect(card.props.accessibilityLabel).toMatch(/, 2 relances, 1 clé, 1 seconde chance\./u);
  });

  and(/^avec une jauge de 0, ils ne parlent d'aucune clé$/u, async () => {
    setUp = ascentSetUp({ seed: 42 });
    await habits(2, 4);
    await showTowerFoot();
    const card = await screen.findByTestId('gauge-card');
    expect(within(card).queryByText('1 clé')).toBeNull();
    expect(card.props.accessibilityLabel).not.toMatch(/clé/u);
  });

  // --- La porte Élite (CH3) ---

  when(/^une porte Élite est proposée$/u, async () => {
    await renderScreen(
      <ExitChoice boons={[]} exits={[{ kind: 'elite', groupSize: null }]} onChoose={jest.fn()} />,
      ascentSetUp().dependencies,
    );
  });

  then(/^elle annonce l'objet Rare garanti et le coffre scellé$/u, () => {
    expect(
      screen.getByRole('button', { name: 'Élite · objet Rare garanti · coffre scellé' }),
    ).toBeOnTheScreen();
  });

  and(/^à −2, la porte « Élite maudite » les annonce aussi$/u, async () => {
    await renderScreen(
      <ExitChoice
        boons={[]}
        exits={[{ kind: 'elite', groupSize: null }]}
        gauge={-2}
        onChoose={jest.fn()}
      />,
      ascentSetUp().dependencies,
    );
    expect(
      screen.getByRole('button', { name: 'Élite maudite · objet Rare garanti · coffre scellé' }),
    ).toBeOnTheScreen();
  });

  // --- Le coffre scellé (CH2, CH4, CH5, CH8) ---

  given(/^le héros a 1 clé et vient de battre une Élite$/u, async () => {
    await showAscent(afterElite(1));
    expect(screen.getByRole('header', { name: 'Objet trouvé' })).toBeOnTheScreen();
  });

  when(/^le joueur a équipé ou laissé l'objet Rare garanti$/u, async () => {
    await fireEvent.press(screen.getByRole('button', { name: 'Équiper' }));
  });

  then(/^un coffre scellé apparaît, avec « Ouvrir · 1 clé » et « Laisser »$/u, () => {
    expect(screen.getByRole('header', { name: 'Coffre scellé' })).toBeOnTheScreen();
    const open = screen.getByRole('button', { name: "Ouvrir avec une clé, il t'en reste 1" });
    expect(within(open).getByText('Ouvrir · 1 clé')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Laisser' })).toBeOnTheScreen();
  });

  and(/^l'offre de bienfaits ne vient qu'après lui$/u, async () => {
    expect(screen.queryByTestId('ascent-boons')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Laisser' }));
    expect(screen.getByTestId('ascent-boons')).toBeOnTheScreen();
  });

  given(/^le héros a (\d) clés? devant un coffre scellé$/u, async (keys: string) => {
    await showAscent(leaveItem(afterElite(Number(keys))));
  });

  when(/^le joueur touche « Ouvrir · 1 clé »$/u, async () => {
    jest.useFakeTimers();
    await fireEvent.press(screen.getByRole('button', { name: OPEN_TWO }));
  });

  then(/^il reste 1 clé au héros$/u, () => {
    expect(current().keys).toBe(1);
    expect(screen.getByTestId('ascent-status')).toHaveTextContent(/· 1 clé$/u);
  });

  and(/^l'objet du coffre est révélé et comparé à celui que porte le héros$/u, async () => {
    for (let step = 0; step < 8; step += 1) {
      await act(async () => {
        jest.advanceTimersByTime(100);
      });
    }
    jest.useRealTimers();
    expect(screen.getByText('Du coffre scellé')).toBeOnTheScreen();
    expect(screen.getByText(/^Tu portes : /u)).toBeOnTheScreen();
    expect(current().foundItem).not.toBeNull();
  });

  and(/^le joueur peut l'équiper ou le laisser, comme tout objet$/u, async () => {
    const item = current().foundItem!;
    await fireEvent.press(screen.getByRole('button', { name: 'Équiper' }));
    expect(Object.values(current().equipment)).toContain(item);
    expect(current().sealedChest).toBeNull();
  });

  and(/^l'écran dit « Laissé fermé, il ne revient pas\. » avant le choix$/u, () => {
    expect(screen.getByText('Laissé fermé, il ne revient pas.')).toBeOnTheScreen();
  });

  when(/^le joueur touche « Laisser »$/u, async () => {
    await fireEvent.press(screen.getByRole('button', { name: 'Laisser' }));
  });

  then(/^aucune confirmation n'est demandée$/u, () => {
    expect(screen.queryByText(/sûr/u)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Laisser' })).toBeNull();
  });

  and(/^il a toujours 1 clé$/u, () => {
    expect(current().keys).toBe(1);
  });

  and(
    /^le coffre est perdu, et l'offre de bienfaits s'affiche, avec un bandeau qui dit que ses clés sont gardées$/u,
    () => {
      expect(current().sealedChest).toBeNull();
      expect(screen.getByTestId('ascent-boons')).toBeOnTheScreen();
      expect(screen.getByTestId('sealed-left-band')).toHaveTextContent(
        'Coffre scellé laissé fermé. Tu gardes ta clé.',
      );
    },
  );

  given(/^le héros n'a aucune clé et vient de battre une Élite$/u, async () => {
    before = afterElite(0, 0);
    await showAscent(before);
    await fireEvent.press(screen.getByRole('button', { name: 'Laisser' }));
  });

  when(/^le coffre scellé apparaît$/u, () => {
    expect(screen.getByRole('header', { name: 'Coffre scellé' })).toBeOnTheScreen();
  });

  then(
    /^il reste fermé et le bouton « Aucune clé » est indisponible et dit qu'il faut une clé$/u,
    () => {
      expect(screen.getByTestId('chest-closed', { includeHiddenElements: true })).toBeTruthy();
      const none = screen.getByRole('button', {
        name: 'Aucune clé : il faut une clé pour ouvrir ce coffre',
      });
      expect(none).toBeDisabled();
      expect(within(none).getByText('Aucune clé')).toBeOnTheScreen();
    },
  );

  when(/^le joueur touche « Continuer »$/u, async () => {
    await fireEvent.press(screen.getByRole('button', { name: 'Continuer' }));
  });

  then(
    /^l'Or, l'objet garanti et l'offre de bienfaits de cette Élite sont ceux qu'il aurait eus sans coffre scellé$/u,
    () => {
      const without = leaveItem({ ...before, sealedChest: null });
      expect(current()).toEqual(without);
      expect(current().lastGold).toBe(eliteGold(1));
      expect(screen.getByTestId('ascent-boons')).toBeOnTheScreen();
      expect(screen.queryByTestId('sealed-left-band')).toBeNull();
    },
  );

  // --- L'en-tête ---

  given(/^le héros a 2 clés$/u, async () => {
    await showAscent({ ...startAscent(42), keys: 2 });
  });

  then(/^l'en-tête de l'ascension montre « 2 clés » à côté de l'Or$/u, () => {
    expect(screen.getByTestId('ascent-status')).toHaveTextContent(/· 0 Or · 2 clés$/u);
  });

  and(/^sans clé, l'en-tête n'en parle pas$/u, async () => {
    await showAscent(startAscent(42));
    expect(screen.getByTestId('ascent-status')).not.toHaveTextContent(/clé/u);
  });

  // --- Les Réserves de l'Équipement ---

  given(/^une ascension lancée à une jauge de 0 avec une bénédiction Fortune Rare$/u, () => {
    setUp = ascentSetUp({
      saved: {
        ...startAscent(3),
        blessings: [{ family: 'fortune', rarity: 'rare' }],
        keys: 2,
        gold: 35,
      },
    });
  });

  when(/^le joueur ouvre la feuille de l'Équipement$/u, async () => {
    await showTowerFoot();
    await fireEvent.press(
      await screen.findByRole('button', { name: "Voir le détail de l'Équipement" }),
    );
  });

  then(/^elle commence par la section « Réserves », avec l'Or et « 2 clés »$/u, () => {
    const order = within(screen.getByTestId('loadout-sheet'))
      .getAllByText(/^(Réserves|Or|Clés|Bénédictions de départ)$/u, {
        includeHiddenElements: true,
      })
      .map((text) => text.props.children);
    expect(order).toEqual(['Réserves', 'Or', 'Clés', 'Bénédictions de départ']);
    expect(screen.getByTestId('reserve-row-gold')).toHaveAccessibleName('Or, 35');
    expect(screen.getByTestId('reserve-row-keys')).toHaveAccessibleName(
      "Clés, 2 : ouvrent le coffre scellé d'une Élite",
    );
    expect(screen.getByText('+2 clés')).toBeOnTheScreen();
  });

  and(/^il n'y a pas de section « Faveur de l'ascension »$/u, () => {
    expect(screen.queryByText("Faveur de l'ascension", { includeHiddenElements: true })).toBeNull();
  });

  and(
    /^avec une jauge de \+1, la section « Faveur de l'ascension » suit les Réserves, avec ses relances, sans ligne de clés$/u,
    async () => {
      setUp = ascentSetUp({
        saved: {
          ...startAscent(3, { gauge: 1 }),
          blessings: [{ family: 'haste', rarity: 'rare' }],
          gold: 35,
        },
      });
      await showTowerFoot();
      await fireEvent.press(
        await screen.findByRole('button', { name: "Voir le détail de l'Équipement" }),
      );
      const order = screen
        .getAllByText(/^(Réserves|Clés|Faveur de l'ascension|Relances)$/u, {
          includeHiddenElements: true,
        })
        .map((text) => text.props.children);
      expect(order).toEqual(['Réserves', 'Clés', "Faveur de l'ascension", 'Relances']);
      expect(screen.getByTestId('favor-row-rerolls')).toBeOnTheScreen();
      expect(screen.queryByTestId('favor-row-keys')).toBeNull();
    },
  );
};

// Les écrans seuls : `@domain` et `@session` ont leurs propres étapes.
const feature = loadFeature('features/coffre-scelle-cles-fortune.feature');
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
