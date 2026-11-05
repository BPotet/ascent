/**
 * Scénarios de « Lire sa jauge au pied de la tour » (#41), côté métier : exécutés à travers les cas
 * d'usage (`getFateGauge`, `sealFateGauge`, `toggleCheckIn`, `updateHabit`, `deleteHabit`,
 * `getYesterdayReminder`), sur un stockage en mémoire et une horloge fixée en novembre 2026 (lundi 2,
 * mercredi 4, jeudi 5, vendredi 6, dimanche 8, lundi 9).
 *
 * Correspondance métier des étapes d'interface :
 * - « la jauge … au pied de la tour » est la lecture de `getFateGauge` ;
 * - corriger un jour clos = `toggleCheckIn` sur ce jour ; changer la difficulté = `updateHabit` ;
 *   supprimer = `deleteHabit` ;
 * - « le détail de la jauge dit qu'hier est compté tel qu'à la clôture » : la lecture marque
 *   l'habitude `atClosingOnly`, que le détail annonce avec `closingNote` ;
 * - « les bénédictions annoncées » sont les raretés de la lecture (`blessings`) ;
 * - « les noms restent dans la tour » : la lecture et son scellement (sur l'appareil) nomment les
 *   habitudes ; l'ascension lancée avec cette jauge, le journal et son export, par la vraie session
 *   et le vrai enregistreur du journal, n'en contiennent aucun.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { InMemoryUnitOfWork } from '../../src/application/testing/InMemoryUnitOfWork';
import { settableClock } from '../../src/application/testing/settableClock';
import { deleteHabit } from '../../src/application/useCases/deleteHabit';
import {
  GAUGE_SEAL_KEY,
  getFateGauge,
  sealFateGauge,
  type FateGaugeReading,
} from '../../src/application/useCases/fateGauge';
import { toggleCheckIn } from '../../src/application/useCases/toggleCheckIn';
import { updateHabit } from '../../src/application/useCases/updateHabit';
import { getYesterdayReminder } from '../../src/application/useCases/yesterdayReminder';
import { closingNote } from '../../src/adapters/ui/format/gaugeText';
import { Day } from '../../src/domain/day/Day';
import type { Difficulty } from '../../src/domain/habit/Difficulty';
import type { Habit } from '../../src/domain/habit/Habit';
import { HabitName } from '../../src/domain/habit/HabitName';
import type { WeeklyTarget } from '../../src/domain/habit/WeeklyTarget';
import { lastExport, logStory, type LogStory } from '../support/ascentLogStory';

const november = (dayOfMonth: number) => Day.of(2026, 11, dayOfMonth);
const CREATED = Day.of(2026, 10, 5);

function mapStore() {
  const values = new Map<string, string>();
  return {
    values,
    get: async (key: string) => values.get(key) ?? null,
    set: async (key: string, value: string) => {
      values.set(key, value);
    },
    remove: async (key: string) => {
      values.delete(key);
    },
  };
}

let unitOfWork: InMemoryUnitOfWork;
let clock: ReturnType<typeof settableClock>;
let keyValueStore: ReturnType<typeof mapStore> | LogStory['store'];
let before: FateGaugeReading;
let story: LogStory;

const deps = () => ({ clock, unitOfWork, keyValueStore });
const reading = () => getFateGauge(deps());

function setUp(today: Day) {
  unitOfWork = new InMemoryUnitOfWork();
  clock = settableClock(today);
  keyValueStore = mapStore();
}

async function addHabit(
  name: string,
  difficulty: Difficulty = 'medium',
  weeklyTarget: WeeklyTarget = 7,
): Promise<Habit> {
  return unitOfWork.run(async ({ habits, settingsChanges }) => {
    const habit = await habits.add(HabitName.parse(name), CREATED);
    await settingsChanges.add(habit.id, CREATED, { difficulty, weeklyTarget });
    return habit;
  });
}

async function habitNamed(name: string): Promise<Habit> {
  return unitOfWork.run(async ({ habits }) =>
    (await habits.listAll()).find((habit) => habit.name.value === name)!,
  );
}

async function done(habit: Habit, day: Day) {
  await unitOfWork.run(({ checkIns }) =>
    checkIns.save({ habitId: habit.id, day, done: true, corrected: false }),
  );
}

/** `total` habitudes, dont les `count` premières « fait » le jour `day`. */
async function habitsDone(count: number, total: number, day: Day): Promise<Habit[]> {
  const created: Habit[] = [];
  for (let index = 0; index < total; index += 1) {
    const habit = await addHabit(`Habitude ${index + 1}`);
    if (index < count) await done(habit, day);
    created.push(habit);
  }
  return created;
}

async function correct(name: string, day: Day) {
  const result = await toggleCheckIn(deps(), (await habitNamed(name)).id, day);
  expect(result.ok).toBe(true);
}

async function changeDifficulty(name: string, difficulty: Difficulty) {
  const result = await updateHabit(deps(), (await habitNamed(name)).id, { name, difficulty });
  expect(result.ok).toBe(true);
}

const steps: StepDefinitions = ({ given, when, then, and, but }) => {
  // --- Corriger hier ---

  given(
    /^hier compte 1 habitude « fait » sur 3 et aucune ascension n'a été lancée aujourd'hui$/u,
    async () => {
      setUp(november(5));
      await habitsDone(1, 3, november(4));
      before = await reading();
      expect(before.gauge).toBe(-1);
    },
  );

  when(/^le joueur corrige une habitude d'hier en « fait »$/u, async () => {
    await correct('Habitude 2', november(4));
  });

  then(/^la jauge passe de −1 à 0 au pied de la tour$/u, async () => {
    expect(before.gauge).toBe(-1);
    await expect(reading()).resolves.toMatchObject({ gauge: 0, done: 2, expected: 3 });
  });

  // --- Corriger avant-hier ---

  given(/^aujourd'hui est vendredi et aucune ascension n'a été lancée aujourd'hui$/u, () => {
    setUp(november(6));
  });

  and(
    /^« Courir » \(objectif de 3 fois par semaine\) comptait 2 suivis à la clôture de mercredi, puis était attendue jeudi sans être faite$/u,
    async () => {
      const running = await addHabit('Courir', 'medium', 3);
      await done(running, november(2));
      await done(running, november(3));
      await expect(getYesterdayReminder(deps())).resolves.toMatchObject({
        doneCount: 0,
        expectedCount: 1,
      });
      before = await reading();
      expect(before).toMatchObject({ gauge: -2, done: 0, expected: 1 });
    },
  );

  when(/^le joueur corrige mercredi en « fait » pour « Courir »$/u, async () => {
    await correct('Courir', november(4));
  });

  then(/^le Rappel d'hier ne compte plus « Courir » comme attendue$/u, async () => {
    await expect(getYesterdayReminder(deps())).resolves.toBeNull();
  });

  but(
    /^la jauge compte toujours « Courir » comme attendue hier, et elle ne change pas$/u,
    async () => {
      const after = await reading();
      expect(after).toMatchObject({ gauge: before.gauge, done: 0, expected: 1 });
      expect(after.habits).toEqual([{ name: 'Courir', done: false, atClosingOnly: true }]);
    },
  );

  and(/^le détail de la jauge dit qu'hier est « compté tel qu'à la clôture »$/u, async () => {
    const { habits } = await reading();
    const note = closingNote(habits.filter((habit) => habit.atClosingOnly).map(({ name }) => name));
    expect(note).toContain("hier est compté tel qu'à la clôture");
    expect(note).toContain('« Courir »');
  });

  // --- Le lundi ---

  given(/^aujourd'hui est lundi et dimanche compte 1 habitude « fait » sur 2$/u, async () => {
    setUp(november(9));
    await habitsDone(1, 2, november(8));
    await expect(reading()).resolves.toMatchObject({ gauge: 0, done: 1, expected: 2 });
  });

  when(
    /^le joueur corrige l'habitude manquée de dimanche en « fait » avant de jouer$/u,
    async () => {
      await correct('Habitude 2', november(8));
    },
  );

  then(/^la jauge passe à \+2$/u, async () => {
    await expect(reading()).resolves.toMatchObject({ gauge: 2, done: 2, expected: 2 });
  });

  // --- La difficulté de la clôture d'hier ---

  given(
    /^« (Courir|Lire) » était (Facile|Difficile) à la clôture d'hier et a été faite hier$/u,
    async (name: string, word: string) => {
      setUp(november(5));
      await done(await addHabit(name, word === 'Facile' ? 'easy' : 'hard'), november(4));
      before = await reading();
    },
  );

  and(/^aujourd'hui est dans la même semaine qu'hier, sans ascension lancée$/u, async () => {
    expect(before.sealed).toBe(false);
    expect(keyValueStore.values.has(GAUGE_SEAL_KEY)).toBe(false);
  });

  when(/^le joueur passe « (Courir|Lire) » en (Facile|Difficile)$/u, async (name, word) => {
    await changeDifficulty(name as string, word === 'Facile' ? 'easy' : 'hard');
  });

  then(
    /^« (?:Courir|Lire) » donne toujours une bénédiction (Commune|Épique) aujourd'hui$/u,
    async (word: string) => {
      await expect(reading()).resolves.toMatchObject({
        blessings: [word === 'Commune' ? 'common' : 'epic'],
      });
    },
  );

  and(
    /^la jauge du pied de la tour annonce toujours ses bénédictions avec les mêmes raretés$/u,
    async () => {
      expect((await reading()).blessings).toEqual(before.blessings);
    },
  );

  // --- Les noms restent dans la tour ---

  given(/^le joueur a ouvert le détail de la jauge, qui nomme ses habitudes d'hier$/u, async () => {
    story = logStory();
    unitOfWork = new InMemoryUnitOfWork();
    clock = settableClock(november(5));
    keyValueStore = story.store;
    for (const name of ['Courir le matin', 'Lire Proust', 'Méditer']) {
      await done(await addHabit(name), november(4));
    }
    before = await reading();
    expect(before.habits.map(({ name }) => name)).toEqual([
      'Courir le matin',
      'Lire Proust',
      'Méditer',
    ]);
  });

  when(/^l'ascension se termine et que le joueur exporte le journal$/u, async () => {
    story.session.begin({ hero: 'sentinel', gauge: before.gauge, blessings: before.blessings });
    await sealFateGauge(deps(), before);
    story.session.abandon();
    await story.logExport.export();
  });

  then(/^aucun journal d'ascension ne contient le nom d'une habitude$/u, () => {
    const exported = JSON.stringify(lastExport(story));
    const ascent = story.store.values.get('ascent.current') ?? '';
    expect(lastExport(story).ascents.length).toBeGreaterThan(0);
    for (const name of ['Courir le matin', 'Lire Proust', 'Méditer']) {
      expect(exported).not.toContain(name);
      expect(ascent).not.toContain(name);
    }
    // Les noms ne sont gardés que sur l'appareil, dans le scellement de la jauge.
    expect(story.store.values.get(GAUGE_SEAL_KEY)).toContain('Lire Proust');
  });

  // --- Une habitude supprimée ---

  given(/^hier, 3 habitudes attendues, dont 2 « fait »$/u, async () => {
    setUp(november(5));
    await habitsDone(2, 3, november(4));
    await expect(reading()).resolves.toMatchObject({ gauge: 0, done: 2, expected: 3 });
  });

  when(/^le joueur supprime l'habitude manquée, avant de lancer une ascension$/u, async () => {
    const result = await deleteHabit(deps(), (await habitNamed('Habitude 3')).id);
    expect(result.ok).toBe(true);
  });

  then(/^la jauge vaut \+2 \(2 sur 2\)$/u, async () => {
    await expect(reading()).resolves.toMatchObject({ gauge: 2, done: 2, expected: 2 });
  });
};

// Les scénarios d'interface (`@ui`) sont laissés aux étapes des écrans.
const feature = loadFeature('features/jauge-au-pied-de-la-tour.feature');
autoBindSteps(
  [{ ...feature, scenarios: feature.scenarios.filter(({ tags }) => !tags.includes('@ui')) }],
  [steps],
);
