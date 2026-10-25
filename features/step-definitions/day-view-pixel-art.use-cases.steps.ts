/**
 * Scénarios du ciel du jour (`@use-cases`) de « La Journée en pixel art » (#72), exécutés à travers
 * les cas d'usage (`getDaySky`, `toggleCheckIn`) sur l'unité de travail en mémoire. Le rendu du ciel
 * (dégradé, étoiles, soleil, tour) est vérifié par les tests de l'interface ; ici, la lumière du
 * ciel du jour (`DaySky.light`) : 0 la nuit, 1 au lever du soleil.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { InMemoryUnitOfWork } from '../../src/application/testing/InMemoryUnitOfWork';
import { settableClock } from '../../src/application/testing/settableClock';
import { getDayView } from '../../src/application/useCases/getDayView';
import { getDaySky } from '../../src/application/useCases/getDaySky';
import { toggleCheckIn } from '../../src/application/useCases/toggleCheckIn';
import type { DaySky } from '../../src/domain/day/DaySky';
import type { Habit } from '../../src/domain/habit/Habit';
import { frenchDay } from '../support/frenchDay';
import { type StoryDependencies, storyContext, WEDNESDAY } from '../support/pixelArtDayStory';

interface World {
  deps: StoryDependencies;
  habits: Habit[];
  sky: DaySky | null;
  previous: DaySky | null;
}

let world: World;

beforeEach(() => {
  world = {
    deps: { clock: settableClock(WEDNESDAY), unitOfWork: new InMemoryUnitOfWork() },
    habits: [],
    sky: null,
    previous: null,
  };
});

async function readSky(): Promise<DaySky> {
  world.previous = world.sky;
  world.sky = await getDaySky(world.deps);
  return world.sky;
}

/** Marque « fait » aujourd'hui, une à une, les habitudes attendues pas encore faites. */
async function markExpected(count: number): Promise<void> {
  const view = await getDayView(world.deps);
  const pending = view.habits.filter(({ expected, status }) => expected && status !== 'done');
  for (const { habit } of pending.slice(0, count)) {
    await expect(toggleCheckIn(world.deps, habit.id, WEDNESDAY)).resolves.toMatchObject({
      ok: true,
    });
  }
}

const steps: StepDefinitions = ({ given, when, then }) => {
  given(/^nous sommes le (.+)$/, (date: string) => {
    expect(frenchDay(date, 2026)).toEqual(WEDNESDAY);
  });

  given("le joueur a 5 habitudes actives, dont 2 « fait » aujourd'hui", async () => {
    world.habits = await storyContext(world.deps);
  });

  given("2 habitudes faites sur 5 habitudes attendues aujourd'hui", async () => {
    const view = await getDayView(world.deps);
    expect([view.doneCount, view.expectedCount]).toEqual([2, 5]);
    await readSky();
  });

  given("le joueur n'a aucune habitude", async () => {
    world.deps = { clock: settableClock(WEDNESDAY), unitOfWork: new InMemoryUnitOfWork() };
    await expect(getDayView(world.deps)).resolves.toMatchObject({ habitCount: 0 });
  });

  when('le joueur marque une troisième habitude « fait »', async () => {
    await markExpected(1);
    await readSky();
  });

  then("le ciel du jour s'éclaire d'un cran", () => {
    expect(world.previous?.light).toBeCloseTo(2 / 5);
    expect(world.sky?.light).toBeCloseTo(3 / 5);
  });

  when('toutes les habitudes attendues sont faites', async () => {
    await markExpected(5);
    await readSky();
  });

  then('le soleil se lève derrière la tour', () => {
    expect(world.sky).toEqual({ light: 1 });
  });

  then('le ciel du jour est un ciel de nuit', async () => {
    await expect(readSky()).resolves.toEqual({ light: 0 });
  });
};

// Seuls les scénarios du ciel du jour (`@use-cases`) : les autres passent par les écrans.
const feature = loadFeature('features/day-view-pixel-art.feature');
autoBindSteps(
  [{ ...feature, scenarios: feature.scenarios.filter(({ tags }) => tags.includes('@use-cases')) }],
  [steps],
);
