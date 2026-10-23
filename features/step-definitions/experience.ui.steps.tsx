/**
 * Scénarios d'interface (`@ui`) de « Gagner de l'expérience en tenant ses habitudes » (#5), à
 * travers la Vue Journée (`DayViewScreen`) : l'en-tête du personnage et le feedback d'un tap,
 * quand le téléphone demande de réduire les animations. Les données sont en mémoire
 * (`InMemoryUnitOfWork`), l'horloge est fixée au jour du scénario. Les autres scénarios de la
 * fonctionnalité sont exécutés à travers les cas d'usage (`experience.use-cases.steps.ts`).
 */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';
import { AccessibilityInfo, Animated } from 'react-native';

import { FixedClock } from '../../src/adapters/device/clock/FixedClock';
import { DayViewScreen } from '../../src/adapters/ui/screens/DayViewScreen';
import type { Dependencies } from '../../src/adapters/ui/state/Dependencies';
import { memoryKeyValueStore } from '../../src/adapters/ui/testing/memoryKeyValueStore';
import { renderScreen } from '../../src/adapters/ui/testing/renderScreen';
import { InMemoryUnitOfWork } from '../../src/application/testing/InMemoryUnitOfWork';
import { createHabit } from '../../src/application/useCases/createHabit';
import { Character } from '../../src/domain/character/Character';
import { frenchDay } from '../support/frenchDay';

interface World {
  unitOfWork: InMemoryUnitOfWork;
  deps: Dependencies;
  timing: jest.SpyInstance;
}

let world: World;

beforeEach(() => {
  const unitOfWork = new InMemoryUnitOfWork();
  world = {
    unitOfWork,
    deps: {
      clock: new FixedClock(frenchDay('mercredi 14 octobre 2026')),
      unitOfWork,
      keyValueStore: memoryKeyValueStore(),
      haptics: { success: jest.fn() },
    },
    timing: jest.spyOn(Animated, 'timing'),
  };
});

afterEach(() => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false);
  jest.restoreAllMocks();
});

const steps: StepDefinitions = ({ given, when, then }) => {
  given(/^nous sommes le (.+) selon le téléphone$/, (date: string) => {
    world.deps = { ...world.deps, clock: new FixedClock(frenchDay(date)) };
  });

  given(
    /^le joueur a l'habitude « ([^»]+) », créée le (.+)$/,
    async (name: string, date: string) => {
      const today = world.deps.clock;
      world.deps = { ...world.deps, clock: new FixedClock(frenchDay(date)) };
      await expect(createHabit(world.deps, name)).resolves.toMatchObject({ ok: true });
      world.deps = { ...world.deps, clock: today };
    },
  );

  given('le téléphone demande de réduire les animations', () => {
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(true);
  });

  given(/^le personnage a (\d+) Xp$/, async (xp: string) => {
    await world.unitOfWork.run(({ character }) => character.save(new Character(Number(xp))));
  });

  when(/^le joueur confirme « ([^»]+) »$/, async (name: string) => {
    await renderScreen(<DayViewScreen />, world.deps);
    const row = await screen.findByRole('switch', {
      name: new RegExp(`^${name}, .*, à faire, .* cette semaine, Moyenne, 10 XP par suivi$`, 'u'),
    });
    await waitFor(() => expect(screen.getByTestId('character-bar')).toBeOnTheScreen());
    world.timing.mockClear();

    await fireEvent.press(row);
  });

  then(/^l'en-tête affiche « ([^»]+) » sans animation de déplacement$/, async (xp: string) => {
    await waitFor(() =>
      expect(screen.getByTestId('character-bar')).toHaveAccessibleName(
        `Expérience du personnage : ${xp}`,
      ),
    );
    // Le compteur est à jour tout de suite, sans monter image par image.
    expect(screen.getByTestId('xp-counter')).toHaveTextContent(xp);
    // Ni rebond, ni pulsation, ni envol, ni compteur animé.
    expect(world.timing).not.toHaveBeenCalled();
    expect(screen.queryByTestId('xp-float', { includeHiddenElements: true })).not.toBeOnTheScreen();
    // Le gain reste dit : la pastille « +10 XP », la vibration et l'annonce au lecteur d'écran.
    expect(screen.getByTestId('xp-change', { includeHiddenElements: true })).toHaveTextContent(
      '+10 XP',
    );
    expect(world.deps.haptics?.success).toHaveBeenCalledTimes(1);
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      `+10 points d’expérience. Total : ${xp}.`,
    );
  });
};

// Seuls les scénarios d'interface (`@ui`) : les autres passent par les cas d'usage.
const feature = loadFeature('features/experience.feature');
autoBindSteps(
  [{ ...feature, scenarios: feature.scenarios.filter(({ tags }) => tags.includes('@ui')) }],
  [steps],
);
