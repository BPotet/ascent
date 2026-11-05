/**
 * Scénarios `@ui` de « Lire sa jauge au pied de la tour » (#41) : le pied de la tour, son cadran et
 * le détail de la jauge, puis le camp, avec les vrais cas d'usage sur un stockage en mémoire
 * (`ascentSetUp` : aujourd'hui est le mardi 27 octobre 2026, hier le lundi 26). Le lecteur d'écran
 * est l'annonce du cadre de la jauge ; « le curseur sur +2 » est le cran allumé du cadran, sous le
 * curseur.
 */
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';
import type { ReactElement } from 'react';
import { AccessibilityInfo } from 'react-native';

import type { InMemoryUnitOfWork } from '../../src/application/testing/InMemoryUnitOfWork';
import { startAscent } from '../../src/domain/ascent/Ascent';
import type { Difficulty } from '../../src/domain/habit/Difficulty';
import { Day } from '../../src/domain/day/Day';
import { HabitName } from '../../src/domain/habit/HabitName';
import { CampScreen } from '../../src/adapters/ui/screens/CampScreen';
import { TowerFootScreen } from '../../src/adapters/ui/screens/TowerFootScreen';
import { ascentSetUp } from '../../src/adapters/ui/testing/ascent';
import { renderScreen } from '../../src/adapters/ui/testing/renderScreen';

const hidden = { includeHiddenElements: true } as const;
const YESTERDAY = Day.of(2026, 10, 26);
const CREATED = Day.of(2026, 10, 1);

let setUp: ReturnType<typeof ascentSetUp>;
let rerender: ((element: ReactElement) => Promise<void>) | null = null;

function begin(options: Parameters<typeof ascentSetUp>[0] = {}) {
  setUp = ascentSetUp({ seed: 42, ...options });
  rerender = null;
}

/** `total` habitudes, dont les `done` premières « fait » hier ; la première peut être Difficile. */
async function habits(done: number, total: number, first: Difficulty = 'medium') {
  const unitOfWork = setUp.dependencies.unitOfWork as InMemoryUnitOfWork;
  for (let index = 0; index < total; index += 1) {
    await unitOfWork.run(async ({ habits: repository, settingsChanges, checkIns }) => {
      const habit = await repository.add(HabitName.parse(`Habitude ${index + 1}`), CREATED);
      await settingsChanges.add(habit.id, CREATED, {
        difficulty: index === 0 ? first : 'medium',
        weeklyTarget: 7,
      });
      if (index < done) {
        await checkIns.save({ habitId: habit.id, day: YESTERDAY, done: true, corrected: false });
      }
    });
  }
}

async function show(element: ReactElement) {
  if (rerender !== null) {
    await rerender(element);
    return;
  }
  const rendered = await renderScreen(element, setUp.dependencies);
  rerender = async (next) => {
    await rendered.rerender(next);
  };
}

async function showTowerFoot() {
  await show(
    <TowerFootScreen
      key="tower-foot"
      session={setUp.session}
      camp={setUp.camp}
      onEnter={jest.fn()}
      onCamp={jest.fn()}
    />,
  );
  await screen.findByTestId('tower-foot');
}

const dayCard = () => screen.findByTestId('gauge-card');
const label = (element: ReturnType<typeof screen.getByTestId>) =>
  element.props.accessibilityLabel as string;
const litValue = () =>
  within(screen.getByTestId('gauge-notch-on', hidden)).getAllByTestId(/^gauge-glyph/u, hidden);

async function launch() {
  await act(async () => {
    fireEvent.press(await screen.findByRole('button', { name: "Commencer l'ascension" }));
  });
  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name: 'Continuer avec la Sentinelle' }));
  });
}

const steps: StepDefinitions = ({ given, when, then, and }) => {
  // --- Le cadran ---

  given(/^hier, 3 habitudes attendues, toutes « fait », dont une Difficile$/u, async () => {
    begin();
    await habits(3, 3, 'hard');
  });

  and(/^aucune ascension en cours$/u, () => {
    expect(setUp.session.current()).toBeNull();
  });

  given(/^hier, 1 habitude « fait » sur 3 attendues$/u, async () => {
    begin();
    await habits(1, 3);
  });

  when(/^le joueur ouvre le pied de la tour$/u, showTowerFoot);

  then(/^la jauge montre son curseur sur \+2 et le mot « Faveur pleine »$/u, async () => {
    const card = await dayCard();
    expect(within(card).getByText('Faveur pleine')).toBeOnTheScreen();
    expect(within(card).getByText('+2')).toBeOnTheScreen();
    expect(litValue().map((glyph) => glyph.props.testID)).toEqual([
      'gauge-glyph-plus8',
      'gauge-glyph-plus8',
    ]);
  });

  and(/^elle dit « D'après hier : 3 habitudes sur 3\. »$/u, async () => {
    expect(
      within(await dayCard()).getByText("D'après hier : 3 habitudes sur 3."),
    ).toBeOnTheScreen();
  });

  and(
    /^elle liste ses effets du jour : 3 bénédictions de départ, objets plus fréquents, objets Rares plus fréquents$/u,
    async () => {
      const effects = within(await dayCard()).getByTestId('gauge-effects');
      expect(
        within(effects)
          .getAllByText(/./u)
          .map((text) => text.props.children),
      ).toEqual([
        '3 bénédictions de départ',
        'Objets plus fréquents',
        'Objets Rares plus fréquents',
      ]);
    },
  );

  then(/^la jauge montre son curseur sur −1 et le mot « Malédiction »$/u, async () => {
    const card = await dayCard();
    expect(within(card).getByText('Malédiction')).toBeOnTheScreen();
    expect(within(card).getByText('−1')).toBeOnTheScreen();
    expect(litValue().map((glyph) => glyph.props.testID)).toEqual(['gauge-glyph-skull']);
  });

  and(/^elle liste la fatigue \(PV max −10 %\) et les objets Rares moins fréquents$/u, async () => {
    const effects = within(within(await dayCard()).getByTestId('gauge-effects'));
    expect(effects.getByText('Fatigue : PV max −10 %')).toBeOnTheScreen();
    expect(effects.getByText('Objets Rares moins fréquents')).toBeOnTheScreen();
  });

  and(
    /^une phrase dit que c'est seulement pour aujourd'hui et que l'ascension reste gagnable$/u,
    async () => {
      expect(
        within(await dayCard()).getByText(
          "D'après hier, seulement aujourd'hui. L'ascension reste gagnable.",
        ),
      ).toBeOnTheScreen();
    },
  );

  and(/^« Commencer l'ascension » est disponible$/u, async () => {
    expect(await screen.findByRole('button', { name: "Commencer l'ascension" })).toBeEnabled();
  });

  given(/^une jauge de −2$/u, async () => {
    begin();
    await habits(0, 3);
    await showTowerFoot();
  });

  when(/^le lecteur d'écran lit la jauge$/u, async () => {
    await dayCard();
  });

  then(/^il dit son mot, « Malédiction forte », sa valeur et le compte d'hier$/u, async () => {
    expect(label(await dayCard())).toMatch(
      /^Jauge du jour : Malédiction forte, moins 2\. D'après hier : 0 habitude sur 3\./u,
    );
  });

  given(
    /^aucune habitude n'était attendue hier \(nouveau joueur, habitude créée aujourd'hui, ou objectifs de la semaine atteints sans rien de fait hier\)$/u,
    async () => {
      begin();
      const unitOfWork = setUp.dependencies.unitOfWork as InMemoryUnitOfWork;
      const today = Day.of(2026, 10, 27);
      await unitOfWork.run(async ({ habits: repository, settingsChanges }) => {
        const habit = await repository.add(HabitName.parse('Lire'), today);
        await settingsChanges.add(habit.id, today, { difficulty: 'medium', weeklyTarget: 7 });
      });
    },
  );

  then(/^la jauge est Neutre, dans son état « pas encore de compte »$/u, async () => {
    const card = await dayCard();
    expect(within(card).getByText('Neutre')).toBeOnTheScreen();
    expect(within(card).getByText('Pas encore')).toBeOnTheScreen();
    expect(screen.getAllByTestId('gauge-notch-hatched', hidden)).toHaveLength(5);
    expect(label(card)).toMatch(/^Jauge du jour : Neutre, pas encore de compte\./u);
  });

  and(/^elle dit qu'elle comptera dès demain, d'après les habitudes d'aujourd'hui$/u, async () => {
    expect(
      within(await dayCard()).getByText(
        "Elle comptera dès demain, d'après tes habitudes d'aujourd'hui.",
      ),
    ).toBeOnTheScreen();
  });

  // --- Le détail ---

  given(/^une jauge de \+1 \(3 habitudes sur 4 hier\)$/u, async () => {
    begin();
    await habits(3, 4);
    await showTowerFoot();
  });

  when(/^le joueur ouvre le détail de la jauge$/u, async () => {
    await fireEvent.press(await dayCard());
  });

  then(
    /^il voit le compte d'hier, les 5 niveaux de la jauge avec leurs seuils, et les effets du niveau du jour$/u,
    () => {
      expect(screen.getByRole('header', { name: 'Jauge du jour' })).toBeOnTheScreen();
      expect(screen.getByText('3 sur 4, soit 75 %.')).toBeOnTheScreen();
      expect(screen.getAllByTestId(/^gauge-level/u)).toHaveLength(5);
      expect(screen.getByText('Faveur pleine · toutes faites')).toBeOnTheScreen();
      expect(screen.getByText('Malédiction forte · moins de 25 %')).toBeOnTheScreen();
      expect(screen.getByTestId('gauge-level-on')).toHaveTextContent(/Aujourd'hui$/u);
      const sheet = within(screen.getByTestId('gauge-detail'));
      expect(sheet.getByText("Ce qu'elle change aujourd'hui")).toBeOnTheScreen();
      expect(sheet.getByText('Objets plus fréquents')).toBeOnTheScreen();
    },
  );

  and(/^il voit, par leur nom, les habitudes attendues hier, faites ou non$/u, () => {
    expect(screen.getAllByTestId('gauge-habit').map(label)).toEqual([
      'Habitude 1, faite',
      'Habitude 2, faite',
      'Habitude 3, faite',
      'Habitude 4, manquée',
    ]);
  });

  and(
    /^il lit les garde-fous : seul hier compte, seulement aujourd'hui, l'ascension se lance toujours, jamais d'effet sur les Éclats, les déblocages ni le camp$/u,
    () => {
      for (const text of [
        "Seul hier compte, tel qu'à la clôture. Corriger un jour plus ancien ne la change pas.",
        "Elle ne vaut que pour aujourd'hui. Demain, elle repart d'aujourd'hui.",
        "L'ascension se lance toujours, et reste gagnable.",
        "Jamais d'effet sur tes Éclats, tes déblocages, leurs prix ni le camp.",
      ]) {
        expect(screen.getByText(text)).toBeOnTheScreen();
      }
    },
  );

  when(/^il ferme le détail$/u, async () => {
    jest.mocked(AccessibilityInfo.sendAccessibilityEvent).mockClear();
    await fireEvent.press(
      screen.getAllByRole('button', { name: 'Fermer le détail de la jauge' })[1]!,
    );
  });

  then(/^il revient au pied de la tour, sur la jauge$/u, () => {
    expect(screen.queryByRole('header', { name: 'Jauge du jour' })).toBeNull();
    expect(screen.getByRole('button', { name: "Commencer l'ascension" })).toBeOnTheScreen();
    const focus = jest.mocked(AccessibilityInfo.sendAccessibilityEvent);
    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus.mock.calls[0]?.[0]).toMatchObject({ props: { testID: 'gauge-card' } });
  });

  given(/^le joueur a lancé une ascension aujourd'hui avec une jauge de −1$/u, async () => {
    begin();
    await habits(1, 3);
    await showTowerFoot();
    await launch();
    expect(setUp.session.current()?.gauge).toBe(-1);
    await act(async () => {
      setUp.session.abandon();
    });
  });

  when(/^il ouvre le détail de la jauge du jour$/u, async () => {
    const card = await dayCard();
    expect(within(card).getByText('Scellée')).toBeOnTheScreen();
    await fireEvent.press(card);
  });

  then(/^il lit que la jauge est scellée pour aujourd'hui$/u, () => {
    expect(screen.getByTestId('gauge-sealed')).toHaveTextContent(/^Scellée pour aujourd'hui\./u);
  });

  and(/^une correction d'hier ne change plus que l'expérience$/u, () => {
    expect(screen.getByTestId('gauge-sealed')).toHaveTextContent(
      /Corriger hier ne change plus que ton expérience\.$/u,
    );
  });

  // --- L'ascension en cours ---

  given(/^une ascension lancée hier avec une jauge de \+2, toujours en cours$/u, () => {
    begin({ saved: { ...startAscent(3), gauge: 2 } });
  });

  and(/^la jauge d'aujourd'hui vaut −1$/u, async () => {
    await habits(1, 3);
  });

  then(/^il voit la jauge de l'ascension, \+2, « Faveur pleine », et son détail$/u, async () => {
    const card = await screen.findByTestId('ascent-gauge-card');
    expect(label(card)).toMatch(/^Jauge de l'ascension : Faveur pleine, plus 2\./u);
    expect(within(card).getByText('+2')).toBeOnTheScreen();
    expect(
      await screen.findByText(
        'Jauge du jour : Malédiction. Elle comptera pour ta prochaine ascension.',
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(card);
    expect(screen.getByRole('header', { name: "Jauge de l'ascension" })).toBeOnTheScreen();
    expect(screen.getByTestId('gauge-level-on')).toHaveTextContent(/^\+2Faveur pleine/u);
    await fireEvent.press(
      screen.getAllByRole('button', { name: 'Fermer le détail de la jauge' })[0]!,
    );
  });

  and(/^la fatigue ne s'applique pas à cette ascension$/u, () => {
    expect(setUp.session.current()?.hero).toMatchObject({ hp: 80, maxHp: 80 });
    expect(screen.getByText('Palier 1 · Étage 1 sur 6 · 80/80 PV · 0 Or')).toBeOnTheScreen();
  });

  // --- Lecture impossible ---

  given(/^les habitudes ne peuvent pas être lues$/u, () => {
    begin();
    (setUp.dependencies.unitOfWork as InMemoryUnitOfWork).failReads();
  });

  then(/^la jauge est Neutre, sans effet$/u, async () => {
    const card = await dayCard();
    expect(label(card)).toMatch(/^Jauge du jour : Neutre, 0\./u);
    expect(within(card).getByText("Aucun effet aujourd'hui")).toBeOnTheScreen();
  });

  // --- Le camp ---

  given(/^une jauge de −2 et 62 Éclats disponibles$/u, async () => {
    begin({ shards: 62 });
    await habits(0, 3);
    await showTowerFoot();
    expect(label(await dayCard())).toMatch(/^Jauge du jour : Malédiction forte/u);
  });

  when(/^le joueur ouvre le camp$/u, async () => {
    await show(<CampScreen camp={setUp.camp} onLeave={jest.fn()} />);
    await screen.findByTestId('camp-purse');
  });

  then(/^il a toujours 62 Éclats disponibles, aux mêmes prix de déblocage$/u, async () => {
    expect(await screen.findByLabelText('62 Éclats disponibles')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Débloquer Épieu de chasse, 20 Éclats' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Débloquer Clochette du guet, 40 Éclats' }),
    ).toBeOnTheScreen();
  });
};

const feature = loadFeature('features/jauge-au-pied-de-la-tour.feature');
autoBindSteps(
  [{ ...feature, scenarios: feature.scenarios.filter(({ tags }) => tags.includes('@ui')) }],
  [steps],
);
