/**
 * Scénarios de « Objectifs par semaine dans la Vue Mois » (#27), côté métier : exécutés à travers
 * les cas d'usage (`createHabit`, `introduceWeeklyTarget`, `getMonthView`, `getDayDetail`,
 * `dayDetailOf`), sur une vraie base SQLite reliée par le pont expo-sqlite, avec une horloge fixée
 * (`FixedClock`).
 *
 * Correspondance métier des étapes d'interface :
 * - la section « Objectifs par semaine » est `targetsByWeek` de la Vue Mois affichée (le dernier
 *   `getMonthView` chargé) ; elle « s'affiche » quand elle a au moins une ligne ;
 * - une ligne est « Semaine du 5 octobre · 3/4 objectifs atteints » (`week`, `reachedCount`,
 *   `targetCount`), « Cette semaine · … » pour la semaine en cours, avec le drapeau quand
 *   `reachedCount === targetCount` ;
 * - toucher un jour de la Vue Mois ouvre son Détail du jour tel que la Vue Mois le montre
 *   (`dayDetailOf`), puis relu (`getDayDetail`) : les deux sont vérifiés ; la progression d'une
 *   habitude y est « 2/3 semaine du 12 octobre » (`progress`) ;
 * - corriger un jour dans le Détail du jour = `toggleCheckIn` sur ce jour clos ; le message F1 est
 *   « Objectif atteint · semaine du 12 octobre » quand le résultat atteint l'objectif d'une semaine
 *   close (`targetReachedChange`, `closedWeek`, `week`, #26), « Objectif de la semaine atteint » pour
 *   la semaine en cours ; « le personnage a N Xp » avant la correction fixe le solde enregistré ;
 * - le contexte : les 4 habitudes du contexte et leurs objectifs atteints (`targetsByWeekStory`) ;
 *   « avant la mise à jour » : un changement de réglages sans objectif, inséré dans la base comme
 *   la version précédente l'enregistrait, puis le changement d'introduction du 28 septembre.
 *
 * Invariant de l'expérience (ADR 0003) : l'écart entre l'expérience enregistrée et celle des suivis
 * et des primes est fixé par « le personnage a N Xp » (0 sinon), et vérifié à la fin de chaque
 * scénario.
 *
 * Exécutés ici : les scénarios métier (`USE_CASES`). Les autres, et la vérification à l'écran des
 * mêmes scénarios, sont dans `targets-by-week.ui.steps.tsx`.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { FixedClock } from '../../src/adapters/device/clock/FixedClock';
import { prepareExpoSqliteDatabase } from '../../src/adapters/persistence/sqlite/expoSqliteDatabase';
import type { SqlDatabase } from '../../src/adapters/persistence/sqlite/SqlDatabase';
import { SqliteUnitOfWork } from '../../src/adapters/persistence/sqlite/SqliteUnitOfWork';
import { FakeExpoSqliteConnection } from '../../src/adapters/persistence/testing/fakeExpoSqlite';
import { experienceInvariant } from '../../src/application/testing/experienceInvariant';
import {
  dayDetailOf,
  getDayDetail,
  type DayDetail,
} from '../../src/application/useCases/getDayDetail';
import { getCharacter } from '../../src/application/useCases/getCharacter';
import { getMonthView, type MonthView } from '../../src/application/useCases/getMonthView';
import { introduceWeeklyTarget } from '../../src/application/useCases/introduceWeeklyTarget';
import {
  toggleCheckIn,
  type ToggleCheckInResult,
} from '../../src/application/useCases/toggleCheckIn';
import { Character } from '../../src/domain/character/Character';
import type { Day } from '../../src/domain/day/Day';
import { Month } from '../../src/domain/month/Month';
import { Week } from '../../src/domain/week/Week';
import { frenchDay } from '../support/frenchDay';
import {
  createStoryHabits,
  habitNamed,
  on,
  reachStoryTargets,
  reachTargets,
  rowTextOf,
  rowTitleOf,
  setDoneDays,
  STORY_HABITS,
  type StoryDependencies,
  weekNameOf,
  weekOfText,
} from '../support/targetsByWeekStory';

const YEAR = 2026;
const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

interface World {
  db: SqlDatabase;
  deps: StoryDependencies;
  /** Le jour de la mise à jour qui introduit l'objectif hebdomadaire. */
  update?: Day | undefined;
  /** Les Vues Mois affichées, dans l'ordre. */
  shown: MonthView[];
  /** Le Détail du jour ouvert depuis la Vue Mois (`dayDetailOf`), et le même relu. */
  opened?: { readonly fromMonth: DayDetail; readonly read: DayDetail } | undefined;
  /** L'écart entre l'expérience enregistrée et l'invariant, fixé par « le personnage a N Xp ». */
  xpGap: number;
  /** La correction faite dans le Détail du jour, et l'objectif atteint de sa ligne avant elle. */
  corrected?: { readonly result: ToggleCheckInResult; readonly reachedBefore: number } | undefined;
}

let world: World;

const today = () => world.deps.clock.today();
const dayOf = (text: string): Day => frenchDay(text, YEAR);

/** Un mois écrit « octobre 2026 ». */
function monthOf(text: string): Month {
  const parts = /^(\S+) (\d{4})$/u.exec(text);
  const month = MONTHS.indexOf(parts?.[1] ?? '') + 1;
  if (parts === null || month === 0) {
    throw new Error(`Not a French month: "${text}"`);
  }
  return Month.of(Number(parts[2]), month);
}

/** Les jours « lundi 12 et le mercredi 14 octobre » : un jour sans mois prend celui du dernier. */
function daysOf(text: string): Day[] {
  const parts = text.split(' et le ');
  const lastMonth = /\S+$/u.exec(parts.at(-1) ?? '')?.[0] ?? '';
  return parts.map((part) => dayOf(/^\S+ \d{1,2}$/u.test(part) ? `${part} ${lastMonth}` : part));
}

async function showMonth(month: Month): Promise<MonthView> {
  const view = await getMonthView(world.deps, month);
  expect(view.month).toEqual(month);
  world.shown.push(view);
  return view;
}

function shownView(): MonthView {
  const view = world.shown.at(-1);
  expect(view).toBeDefined();
  return view as MonthView;
}

const rowsTextOf = (view: MonthView) => view.targetsByWeek.map((row) => rowTextOf(row, today()));

const steps: StepDefinitions = ({ given, when, then }) => {
  given(/^nous sommes le (.+) selon le téléphone$/, (date: string) => {
    world.deps.clock.setToday(dayOf(date));
  });
  given(
    /^la version qui introduit l'objectif hebdomadaire a été ouverte pour la première fois le (.+)$/,
    async (date: string) => {
      world.update = dayOf(date);
      await on(world.deps, world.update, () => introduceWeeklyTarget(world.deps));
    },
  );
  given(
    /^le joueur a (\d) habitudes avec un objectif hebdomadaire, créées le (.+), dont « ([^»]+) »$/,
    async (count: string, date: string, name: string) => {
      expect(STORY_HABITS).toHaveLength(Number(count));
      expect(STORY_HABITS.map((habit) => habit.name)).toContain(name);
      await createStoryHabits(world.deps, dayOf(date));
      await reachStoryTargets(world.deps);
    },
  );
  given(
    /^(\d) habitudes? sur (\d) (?:ont atteint leur objectif|l'ont atteint|l'a atteint) (la semaine du .+|cette semaine)$/,
    async (reached: string, total: string, week: string) => {
      expect(STORY_HABITS).toHaveLength(Number(total));
      await reachTargets(world.deps, weekOfText(week, today()), Number(reached));
    },
  );
  given(
    /^le joueur a aussi l'habitude « ([^»]+) », créée le (.+) avant la mise à jour$/,
    async (name: string, date: string) => {
      const createdOn = dayOf(date);
      const update = world.update as Day;
      expect(createdOn.isBefore(update)).toBe(true);
      // La version précédente enregistrait l'habitude et son changement de réglages sans objectif.
      const { id } = (await world.db.getFirst<{ id: number }>(
        'INSERT INTO habits (name, name_key, created_on) VALUES (?, ?, ?) RETURNING id',
        [name, name.toLowerCase(), createdOn.toIsoString()],
      )) as { id: number };
      await world.db.run(
        "INSERT INTO settings_changes (habit_id, changed_on, difficulty) VALUES (?, ?, 'medium')",
        [id, createdOn.toIsoString()],
      );
      // La première ouverture de la mise à jour lui ajoute son changement d'introduction.
      await expect(on(world.deps, update, () => introduceWeeklyTarget(world.deps))).resolves.toBe(
        1,
      );
    },
  );
  given(
    /^l'habitude « ([^»]+) »(?:, en « ([^»]+) »)?, objectif (\d), est « fait » le (.+)$/,
    async (name: string, difficulty: string | undefined, target: string, dates: string) => {
      expect(STORY_HABITS.find((habit) => habit.name === name)?.weeklyTarget).toBe(Number(target));
      // Les habitudes du contexte sont créées en « Moyenne ».
      expect(difficulty ?? 'Moyenne').toBe('Moyenne');
      const days = daysOf(dates);
      await setDoneDays(
        world.deps,
        await habitNamed(world.deps, name),
        Week.containing(days[0] as Day),
        days,
      );
    },
  );

  when(/^le joueur affiche la Vue Mois (?:d'|de )(\S+ \d{4})$/, async (text: string) => {
    await showMonth(monthOf(text));
  });
  when(
    /^le joueur affiche la Vue Mois d'(\S+ \d{4}) puis celle de (\S+ \d{4})$/,
    async (first: string, second: string) => {
      await showMonth(monthOf(first));
      await showMonth(monthOf(second));
    },
  );
  when(/^le joueur touche le (.+) dans la Vue Mois$/, async (date: string) => {
    const day = dayOf(date);
    const view = await showMonth(Month.containing(day));
    const monthDay = view.days.find((each) => each.day.equals(day));
    expect(monthDay).toBeDefined();
    world.opened = {
      fromMonth: dayDetailOf(monthDay!, view.targetsByWeek),
      read: await getDayDetail(world.deps, day),
    };
  });

  // « Étant donné » avant la correction : fixe le solde enregistré ; « Alors » après : le vérifie.
  given(/^le personnage a (\d+) Xp$/, async (xp: string) => {
    if (world.corrected !== undefined) {
      expect((await getCharacter(world.deps)).xp).toBe(Number(xp));
      return;
    }
    const { expected } = await experienceInvariant(world.deps.unitOfWork);
    await world.deps.unitOfWork.run(({ character }) => character.save(new Character(Number(xp))));
    world.xpGap = Number(xp) - expected;
  });
  when(
    /^le joueur corrige le (.+) de « ([^»]+) » en « fait » dans le Détail du jour$/,
    async (date: string, name: string) => {
      const day = dayOf(date);
      const view = await showMonth(Month.containing(day));
      const monthDay = view.days.find((each) => each.day.equals(day));
      const detail = dayDetailOf(monthDay!, view.targetsByWeek);
      const habitDay = detail.habits.find(({ habit }) => habit.name.value === name);
      expect(habitDay).toMatchObject({ status: 'missed', editable: true });
      const reachedBefore =
        view.targetsByWeek.find((row) => row.week.contains(day))?.reachedCount ?? 0;
      const result = await toggleCheckIn(world.deps, habitDay!.habit.id, day);
      expect(result).toMatchObject({ ok: true, isCorrection: true });
      world.corrected = { result, reachedBefore };
      await showMonth(Month.containing(day));
    },
  );
  then(/^le message « ([^»]+) » s'affiche$/, (message: string) => {
    const { result } = world.corrected as NonNullable<World['corrected']>;
    if (!result.ok) {
      throw new Error('The correction was not saved');
    }
    // F1 : « Objectif atteint · semaine du 12 octobre » pour une semaine close (#26).
    expect(result).toMatchObject({ targetReachedChange: 'reached', targetReached: true });
    const title = result.closedWeek
      ? `Objectif atteint · ${weekNameOf(result.week, today())}`
      : 'Objectif de la semaine atteint';
    expect(title).toBe(message);
    expect(result.targetBonusChange).toBeGreaterThan(0);
  });
  then(
    /^la ligne « ([^»]+) » de la section passe à un objectif atteint de plus$/,
    (title: string) => {
      const { reachedBefore } = world.corrected as NonNullable<World['corrected']>;
      const row = shownView().targetsByWeek.find((each) => rowTitleOf(each, today()) === title);
      expect(row?.reachedCount).toBe(reachedBefore + 1);
    },
  );

  then(/^la section « Objectifs par semaine » s'affiche sous la grille$/, () => {
    expect(shownView().days.length).toBeGreaterThan(0);
    expect(shownView().targetsByWeek.length).toBeGreaterThan(0);
  });
  then(/^elle affiche « ([^»]+) »( avec le drapeau)?$/, (text: string, flag?: string) => {
    const row = shownView().targetsByWeek.find((each) => rowTextOf(each, today()) === text);
    expect(rowsTextOf(shownView())).toContain(text);
    expect(row?.reachedCount === row?.targetCount).toBe(flag !== undefined);
  });
  then(/^aucune ligne n'affiche une semaine à venir$/, () => {
    const current = Week.containing(today());
    expect(shownView().targetsByWeek.some(({ week }) => week.isAfter(current))).toBe(false);
    expect(shownView().targetsByWeek.at(-1)?.week).toEqual(current);
  });
  then(/^la ligne « ([^»]+) » apparaît dans les deux mois$/, (title: string) => {
    const [first, second] = world.shown.slice(-2) as [MonthView, MonthView];
    const rowIn = (view: MonthView) =>
      view.targetsByWeek.find((row) => rowTitleOf(row, today()) === title);
    expect(rowIn(first)).toBeDefined();
    expect(rowIn(second)).toEqual(rowIn(first));
  });
  then(/^la section ne contient pas de ligne pour (la semaine du .+)$/, (text: string) => {
    const week = weekOfText(text, today());
    expect(shownView().days.some(({ day }) => week.contains(day))).toBe(true);
    expect(shownView().targetsByWeek.some((row) => row.week.equals(week))).toBe(false);
  });
  then(/^elle ne contient que « ([^»]+) »$/, (title: string) => {
    expect(shownView().targetsByWeek.map((row) => rowTitleOf(row, today()))).toEqual([title]);
  });
  then(
    /^le Détail du jour affiche pour « ([^»]+) » « (\d+)\/(\d+) (.+) »$/,
    async (name: string, progress: string, target: string, week: string) => {
      const { fromMonth, read } = world.opened as NonNullable<World['opened']>;
      const habit = await habitNamed(world.deps, name);
      for (const detail of [fromMonth, read]) {
        expect(weekNameOf(detail.week, today())).toBe(week);
        expect(detail.progress.find((each) => each.habit.id === habit.id)).toMatchObject({
          weeklyProgress: Number(progress),
          weekTarget: Number(target),
        });
      }
      expect(fromMonth).toEqual(read);
    },
  );
};

beforeEach(async () => {
  const db = await prepareExpoSqliteDatabase(FakeExpoSqliteConnection.open());
  world = {
    db,
    deps: {
      clock: new FixedClock(frenchDay('mercredi 21 octobre', YEAR)),
      unitOfWork: new SqliteUnitOfWork(db),
    },
    shown: [],
    xpGap: 0,
  };
});

afterEach(async () => {
  const { xp, expected } = await experienceInvariant(world.deps.unitOfWork);
  expect(xp - expected).toBe(world.xpGap);
});

/** Les scénarios exécutés à travers les cas d'usage (notes techniques de #27). */
const USE_CASES = new Set([
  'Une ligne par semaine du mois',
  'Une semaine à cheval sur deux mois apparaît dans les deux',
  "Les semaines d'avant la mise à jour n'ont pas de ligne",
  'Le Détail du jour affiche la progression de la semaine de ce jour',
  "Une correction dans le Détail du jour qui atteint l'objectif joue le feedback",
]);

const feature = loadFeature('features/targets-by-week.feature');
const scenarios = feature.scenarios.filter(({ title }) => USE_CASES.has(title));
if (scenarios.length !== USE_CASES.size) {
  throw new Error('A scenario run through the use cases is missing from targets-by-week.feature');
}
autoBindSteps([{ ...feature, scenarios, scenarioOutlines: [] }], [steps]);
