import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { useState } from 'react';
import { AccessibilityInfo, Dimensions, ScrollView, StyleSheet } from 'react-native';

import { InMemoryUnitOfWork } from '../../../application/testing/InMemoryUnitOfWork';
import { settableClock } from '../../../application/testing/settableClock';
import { CHECK_IN_HINT_DISMISSED_KEY } from '../../../application/useCases/checkInHint';
import { WHATS_NEW_CARD_DISMISSED_KEY } from '../../../application/useCases/whatsNewCard';
import { createHabit } from '../../../application/useCases/createHabit';
import { deleteHabit } from '../../../application/useCases/deleteHabit';
import { toggleCheckIn } from '../../../application/useCases/toggleCheckIn';
import { updateHabit } from '../../../application/useCases/updateHabit';
import { getDayView } from '../../../application/useCases/getDayView';
import { Day } from '../../../domain/day/Day';
import { HabitName } from '../../../domain/habit/HabitName';
import { Week } from '../../../domain/week/Week';
import { TOAST_DURATION_MS } from '../format/toast';
import { artPalette } from '../pixelArt/artPalette';
import { memoryKeyValueStore } from '../testing/memoryKeyValueStore';
import { reduceMotionInEachTest, withMotion } from '../testing/motion';
import { renderScreen } from '../testing/renderScreen';
import {
  DayViewScreen,
  HIGHLIGHT_DURATION_MS,
  listBottomSpaceOf,
  REVEAL_CHECK_MS,
  revealOffsetOf,
} from './DayViewScreen';

const { roles } = artPalette;

const nbsp = ' ';
const tuesday = Day.of(2026, 10, 13);
const wednesday = Day.of(2026, 10, 14);

const thursday = Day.of(2026, 10, 15);

let dependencies: {
  clock: ReturnType<typeof settableClock>;
  unitOfWork: InMemoryUnitOfWork;
  keyValueStore: ReturnType<typeof memoryKeyValueStore>;
  haptics: { success: jest.Mock };
};

reduceMotionInEachTest();

beforeEach(() => {
  dependencies = {
    clock: settableClock(wednesday),
    unitOfWork: new InMemoryUnitOfWork(),
    keyValueStore: memoryKeyValueStore(),
    haptics: { success: jest.fn() },
  };
});

async function given(...names: string[]) {
  for (const name of names) {
    await createHabit(dependencies, name);
  }
}

async function show() {
  await renderScreen(<DayViewScreen />, dependencies);
}

const rowNames = () =>
  screen
    .getAllByTestId(/^habit-row-/)
    .map((row) => within(row).getAllByText(/.+/)[0]?.props.children);

/**
 * La progression de la semaine lue sur la ligne d'une habitude créée ce mercredi (objectif de la
 * semaine 5, réduit aux jours actifs) : sa case du jour seule compte.
 */
const progress = (status: string) => `${status === 'fait' ? 1 : 0} sur 5 cette semaine`;

/** Le nombre de sommets de l'icône de difficulté sur la ligne de l'habitude `id` (E1). */
async function peaksOf(id: number): Promise<number> {
  const icon = await screen.findByTestId(`habit-difficulty-${id}`);
  return within(icon).getAllByTestId('difficulty-peak', { includeHiddenElements: true }).length;
}

const addButton = () => screen.getByRole('button', { name: 'Ajouter une habitude' });

async function openSheetAndType(name: string) {
  await fireEvent.press(addButton());
  await fireEvent.changeText(screen.getByLabelText('Nom de l’habitude'), name);
}

async function names(): Promise<string[]> {
  const view = await getDayView(dependencies);
  return view.habits.map(({ habit }) => habit.name.value);
}

describe('DayViewScreen', () => {
  it('shows a loading state while the habits are read', async () => {
    let read: () => void = () => undefined;
    const reading = new Promise<void>((resolve) => {
      read = resolve;
    });
    const run = dependencies.unitOfWork.run.bind(dependencies.unitOfWork);
    jest
      .spyOn(dependencies.unitOfWork, 'run')
      .mockImplementation((work) => reading.then(() => run(work)));

    await show();

    expect(screen.getByLabelText('Chargement de tes habitudes')).toBeBusy();
    await act(async () => read());
    expect(await screen.findByText('Aucune habitude pour l’instant')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Chargement de tes habitudes')).not.toBeOnTheScreen();
  });

  it('shows the difficulty of each habit this week on its row (E1)', async () => {
    await createHabit(dependencies, 'Courir 5 km', 'hard');
    await createHabit(dependencies, 'Lire', 'easy');

    await show();

    expect(await peaksOf(1)).toBe(3);
    expect(await peaksOf(2)).toBe(1);
    expect(screen.getByTestId('habit-difficulty-1')).toHaveTextContent('Difficile');
    expect(screen.getByTestId('habit-difficulty-2')).toHaveTextContent('Facile');
    expect(
      screen.getByRole('switch', {
        name: 'Courir 5 km, mercredi 14 octobre, à faire, 0 sur 5 cette semaine, Difficile, 20 XP par suivi',
      }),
    ).toBeOnTheScreen();
  });

  it('creates a habit with the difficulty chosen in the sheet', async () => {
    await show();
    await screen.findByTestId('day-view-empty');

    await openSheetAndType('Courir 5 km');
    await fireEvent.press(screen.getByRole('radio', { name: /^Difficile,/u }));
    await fireEvent.press(screen.getByRole('button', { name: 'Créer l’habitude' }));

    expect(await peaksOf(1)).toBe(3);
    const [running] = (await getDayView(dependencies)).habits;
    expect(running?.weekSettings).toMatchObject({ difficulty: 'hard' });
  });

  it('invites to create a first habit when there is none', async () => {
    await show();

    expect(await screen.findByTestId('day-view-empty')).toBeOnTheScreen();
    expect(screen.getByText('Aucune habitude pour l’instant')).toBeOnTheScreen();
    expect(
      screen.getByRole('header', {
        name: 'Aucune habitude pour l’instant Crée ta première habitude et commence à gagner de l’expérience.',
      }),
    ).toHaveProp('accessibilityLiveRegion', 'none');
    expect(
      screen.getByText('Crée ta première habitude et commence à gagner de l’expérience.'),
    ).toBeOnTheScreen();
    expect(addButton()).toBeEnabled();
  });

  it('shows no weekly progress on the row of a habit whose week has no target (R17)', async () => {
    const reading = await dependencies.unitOfWork.run(({ habits }) =>
      habits.add(HabitName.parse('Lire'), Day.of(2026, 10, 5)),
    );
    await dependencies.unitOfWork.addSettingsChangeBeforeWeeklyTarget(
      reading.id,
      Day.of(2026, 10, 5),
    );

    await show();

    expect(
      await screen.findByLabelText('Lire, mercredi 14 octobre, à faire, Moyenne, 10 XP par suivi'),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId(`habit-progress-${reading.id}`)).not.toBeOnTheScreen();
    expect(screen.queryByText(/cette semaine/)).not.toBeOnTheScreen();
    expect(screen.queryByText('Objectif atteint')).not.toBeOnTheScreen();
  });

  it('shows today and the habits of the day, in their order of creation, to do', async () => {
    await given('Cuisiner', 'Budget du jour');

    await show();

    expect(await screen.findByRole('header', { name: 'Aujourd’hui' })).toBeOnTheScreen();
    expect(screen.getByText('Mercredi 14 octobre')).toBeOnTheScreen();
    expect(rowNames()).toEqual(['Cuisiner', 'Budget du jour']);
    expect(
      screen.getByLabelText(
        'Cuisiner, mercredi 14 octobre, à faire, 0 sur 5 cette semaine, Moyenne, 10 XP par suivi',
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText(
        'Budget du jour, mercredi 14 octobre, à faire, 0 sur 5 cette semaine, Moyenne, 10 XP par suivi',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('0 habitude faite sur 2 attendues')).toBeOnTheScreen();
    expect(screen.getByLabelText('2 habitudes sur 10')).toHaveTextContent('2/10');
    expect(addButton()).toBeEnabled();
  });

  it('shows an error with « Réessayer » when the habits cannot be read, and erases nothing', async () => {
    await given('Cuisiner');
    dependencies.unitOfWork.failReads();

    await show();

    expect(
      await screen.findByRole('alert', {
        name: 'Impossible de charger tes habitudes. Une erreur est survenue en lisant tes données sur ce téléphone.',
      }),
    ).toHaveProp('accessibilityLiveRegion', 'assertive');
    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('alert')).toBeOnTheScreen();

    dependencies.unitOfWork.failReads(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));

    expect(
      await screen.findByLabelText(
        'Cuisiner, mercredi 14 octobre, à faire, 0 sur 5 cette semaine, Moyenne, 10 XP par suivi',
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
  });

  it('opens the « Nouvelle habitude » sheet each time it is asked to', async () => {
    let ask: (request: string) => void = () => undefined;
    function Host() {
      const [request, setRequest] = useState<string | undefined>(undefined);
      ask = setRequest;
      return <DayViewScreen newHabitRequest={request} />;
    }
    await renderScreen(<Host />, dependencies);
    await screen.findByTestId('day-view-empty');
    expect(screen.queryByTestId('new-habit-sheet')).not.toBeOnTheScreen();

    await act(async () => ask('1'));
    expect(await screen.findByTestId('new-habit-sheet')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByTestId('new-habit-sheet')).not.toBeOnTheScreen();

    await act(async () => ask('2'));
    expect(await screen.findByTestId('new-habit-sheet')).toBeOnTheScreen();
  });

  it('creates a first habit: the sheet closes and the new habit is highlighted', async () => {
    await show();
    await screen.findByTestId('day-view-empty');

    await openSheetAndType('Cuisiner');
    await fireEvent.press(screen.getByRole('button', { name: 'Créer l’habitude' }));

    expect(
      await screen.findByLabelText(
        'Cuisiner, mercredi 14 octobre, à faire, 0 sur 5 cette semaine, Moyenne, 10 XP par suivi',
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('new-habit-sheet')).not.toBeOnTheScreen();
    // Créée un mercredi, « Tous les jours » : objectif 5 cette semaine (R6, maquette E2).
    expect(screen.getByTestId('toast')).toHaveTextContent(
      'Habitude créée · objectif 5 cette semaine',
      { exact: true },
    );
    expect(screen.getByTestId('habit-card-1')).toHaveStyle({ borderColor: roles.gold });
    expect(await names()).toEqual(['Cuisiner']);
  });

  it('adds the new habit at the bottom of the list', async () => {
    await given('Cuisiner');
    await show();
    await screen.findByText('Cuisiner');

    await openSheetAndType('  Lire   20  minutes  ');
    await fireEvent(screen.getByLabelText('Nom de l’habitude'), 'submitEditing');

    await waitFor(() => expect(rowNames()).toEqual(['Cuisiner', 'Lire 20 minutes']));
    expect(screen.getByTestId('habit-card-2')).toHaveStyle({ borderColor: roles.gold });
    expect(screen.getByTestId('habit-card-1')).toHaveStyle({ borderColor: roles.line });
  });

  describe('reveals a new habit without hiding the top of the list', () => {
    const layout = (testID: string, y: number, height: number) =>
      fireEvent(screen.getByTestId(testID), 'layout', {
        nativeEvent: { layout: { x: 0, y, width: 390, height } },
      });
    const list = () => screen.getByTestId('day-view-list');

    // Les espions du prototype gardent leurs appels d'un test à l'autre : on part de zéro.
    beforeEach(() => jest.clearAllMocks());
    afterEach(() => jest.restoreAllMocks());

    async function createMeditation(): Promise<void> {
      await openSheetAndType('Méditer');
      await fireEvent.press(screen.getByRole('button', { name: 'Créer l’habitude' }));
      await screen.findByText('Méditer');
    }

    it('does not scroll when the new habit is already on the screen, so that the hint and « Toutes faites » stay visible', async () => {
      const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');
      const scrollToEnd = jest.spyOn(ScrollView.prototype, 'scrollToEnd');
      await given('Cuisiner');
      await show();
      await screen.findByText('Cuisiner');
      await layout('day-view-list', 0, 400);

      await createMeditation();
      await layout('habit-card-2', 180, 76);
      await fireEvent(list(), 'contentSizeChange', 390, 380);

      expect(scrollTo).not.toHaveBeenCalled();
      expect(scrollToEnd).not.toHaveBeenCalled();
    });

    it('scrolls just enough to show a new habit below the fold, not to the bottom', async () => {
      const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');
      const scrollToEnd = jest.spyOn(ScrollView.prototype, 'scrollToEnd');
      await given('Cuisiner');
      await show();
      await screen.findByText('Cuisiner');
      await layout('day-view-list', 0, 300);

      await createMeditation();
      await layout('habit-card-2', 340, 76);
      await fireEvent(list(), 'contentSizeChange', 390, 560);

      // Le bas de la ligne (340 + 76), plus la place du bouton flottant avant sa mesure (80), moins
      // la hauteur visible (300). Sans animation : la ligne est en place avant que le joueur la touche.
      expect(scrollTo).toHaveBeenCalledWith({ y: 196, animated: false });
      expect(scrollToEnd).not.toHaveBeenCalled();
    });

    it('reveals a new habit hidden under the floating button above it', async () => {
      const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');
      await given('Cuisiner');
      await show();
      await screen.findByText('Cuisiner');
      await layout('day-view-list', 0, 300);

      await createMeditation();
      // La ligne est à l'écran (160 à 236), mais sous le bouton, qui couvre les 80 derniers dp.
      await layout('habit-card-2', 160, 76);
      await fireEvent(list(), 'contentSizeChange', 390, 360);

      expect(scrollTo).toHaveBeenCalledWith({ y: 16, animated: false });
    });

    it('does not move the new habit again once it is revealed', async () => {
      const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');
      await given('Cuisiner');
      await show();
      await screen.findByText('Cuisiner');
      await layout('day-view-list', 0, 300);
      await createMeditation();
      await fireEvent(list(), 'contentSizeChange', 390, 560);
      await layout('habit-card-2', 340, 76);
      expect(scrollTo).toHaveBeenCalledTimes(1);
      // La liste a défilé : la ligne est à l'écran.
      await fireEvent.scroll(list(), { nativeEvent: { contentOffset: { x: 0, y: 196 } } });

      // La ligne bouge (une aide apparaît au-dessus) : elle n'est plus déplacée sous le doigt.
      await layout('habit-card-2', 420, 76);
      await fireEvent(list(), 'contentSizeChange', 390, 700);

      expect(scrollTo).toHaveBeenCalledTimes(1);
    });

    it('does not scroll again once the new habit is on the screen', async () => {
      const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');
      await given('Cuisiner');
      await show();
      await screen.findByText('Cuisiner');
      await layout('day-view-list', 0, 300);
      await createMeditation();
      await fireEvent.scroll(list(), { nativeEvent: { contentOffset: { x: 0, y: 196 } } });

      await layout('habit-card-2', 340, 76);
      await fireEvent(list(), 'contentSizeChange', 390, 560);

      expect(scrollTo).not.toHaveBeenCalled();
    });

    it('scrolls back to the top when « Toutes faites » appears, so that the moment is seen', async () => {
      const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');
      await given('Cuisiner');
      await show();
      await screen.findByText('Cuisiner');
      await fireEvent.scroll(list(), { nativeEvent: { contentOffset: { x: 0, y: 40 } } });

      await fireEvent.press(screen.getByRole('switch', { name: /^Cuisiner, /u }));

      await screen.findByTestId('all-done');
      expect(scrollTo).toHaveBeenCalledWith({ y: 0, animated: true });
    });

    it('stays in place when « Toutes faites » appears at the top of the screen', async () => {
      const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');
      await given('Cuisiner');
      await show();
      await screen.findByText('Cuisiner');

      await fireEvent.press(screen.getByRole('switch', { name: /^Cuisiner, /u }));

      await screen.findByTestId('all-done');
      expect(scrollTo).not.toHaveBeenCalled();
    });

    describe('on a small screen of 320 × 640 (review of #75)', () => {
      const bottomSpace = () =>
        StyleSheet.flatten(list().props.contentContainerStyle).paddingBottom as number;

      it('reserves under the list the real footprint of the floating button, not 112 dp', async () => {
        await given('Cuisiner');
        await show();
        await screen.findByText('Cuisiner');

        await layout('add-habit', 568, 56);

        // 16 dp sous le bouton, ses 56 dp et 8 dp d'écart : 80 dp, et non 112.
        expect(bottomSpace()).toBe(80);
        expect(StyleSheet.flatten(list().props.contentContainerStyle).flexGrow).toBe(1);
      });

      it('follows a floating button that grows with the text', async () => {
        await given('Cuisiner');
        await show();
        await screen.findByText('Cuisiner');

        await layout('add-habit', 524, 100);

        // 16 dp sous le bouton, ses 100 dp et 8 dp d'écart.
        expect(bottomSpace()).toBe(124);
      });

      it('reveals a new habit just above the button, without cutting the hint at the top', async () => {
        const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');
        await given('Cuisiner');
        await show();
        await screen.findByText('Cuisiner');
        // 640 dp de haut : l'en-tête, le titre du jour et la barre d'onglets laissent 360 dp.
        await layout('day-view-list', 0, 360);
        await layout('add-habit', 568, 56);

        await createMeditation();
        await layout('habit-card-2', 280, 76);
        await fireEvent(list(), 'contentSizeChange', 390, 474);

        // Le bas de la ligne (356), plus 80 dp, moins 360 : 76 dp, et non 108 avec les 112 dp.
        expect(scrollTo).toHaveBeenCalledWith({ y: 76, animated: false });
      });

      it('does not ask for a scroll beyond the content it knows, and follows the content when it grows', async () => {
        const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');
        await given('Cuisiner', 'Lire');
        await show();
        await screen.findByText('Lire');
        await layout('day-view-list', 0, 360);
        await layout('add-habit', 568, 56);
        // Le contenu avant la création : 2 lignes, le libellé et la marge du bouton.
        await fireEvent(list(), 'contentSizeChange', 390, 330);

        await createMeditation();
        // La ligne est placée avant que le contenu ne grandisse : aucun défilement n'est possible.
        await layout('habit-card-3', 324, 76);
        expect(scrollTo).not.toHaveBeenCalled();

        await fireEvent(list(), 'contentSizeChange', 390, 518);

        // Le bas de la ligne (400), plus 80 dp, moins 360 : 120 dp.
        expect(scrollTo).toHaveBeenCalledWith({ y: 120, animated: false });
      });

      it('asks again when a scroll is cut short by Android, then stops once the row is shown', async () => {
        const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');
        await given('Cuisiner', 'Lire');
        await show();
        await screen.findByText('Lire');
        await layout('day-view-list', 0, 360);
        await layout('add-habit', 568, 56);

        await createMeditation();
        await fireEvent(list(), 'contentSizeChange', 390, 518);
        await layout('habit-card-3', 324, 76);
        expect(scrollTo).toHaveBeenCalledTimes(1);

        // La ligne n'était pas encore montée : Android s'est arrêté au bas de l'ancien contenu, sans
        // autre événement. Après REVEAL_CHECK_MS, le défilement est redemandé.
        await fireEvent.scroll(list(), { nativeEvent: { contentOffset: { x: 0, y: 0 } } });
        expect(scrollTo).toHaveBeenCalledTimes(2);
        await waitFor(() => expect(scrollTo).toHaveBeenCalledTimes(3), {
          timeout: REVEAL_CHECK_MS * 4,
        });
        expect(scrollTo).toHaveBeenLastCalledWith({ y: 120, animated: false });

        // Cette fois, la liste a défilé : plus rien n'est demandé, même quand le contenu change.
        await fireEvent.scroll(list(), { nativeEvent: { contentOffset: { x: 0, y: 120 } } });
        await fireEvent(list(), 'contentSizeChange', 390, 700);
        await new Promise((done) => setTimeout(done, REVEAL_CHECK_MS * 2));
        expect(scrollTo).toHaveBeenCalledTimes(3);
      });

      it('never asks more than 5 times, and leaves the list to a player who scrolls', async () => {
        const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');
        await given('Cuisiner', 'Lire');
        await show();
        await screen.findByText('Lire');
        await layout('day-view-list', 0, 360);

        await createMeditation();
        await fireEvent(list(), 'contentSizeChange', 390, 518);
        await layout('habit-card-3', 324, 76);
        for (let attempt = 0; attempt < 8; attempt += 1) {
          await fireEvent.scroll(list(), { nativeEvent: { contentOffset: { x: 0, y: 0 } } });
        }
        expect(scrollTo).toHaveBeenCalledTimes(5);

        scrollTo.mockClear();
        await fireEvent(list(), 'scrollBeginDrag');
        await fireEvent(list(), 'contentSizeChange', 390, 700);
        expect(scrollTo).not.toHaveBeenCalled();
      });

      it('keeps the label « Habitudes » and its counter above the button at the end of the list', async () => {
        await given('Cuisiner');
        await show();
        await screen.findByText('Cuisiner');
        await layout('day-view-list', 0, 360);
        await layout('add-habit', 568, 56);
        await layout('day-view-section', 120, 24);

        // Le libellé finit à 144 dp, et la liste garde ses 80 derniers dp pour le bouton.
        expect(144).toBeLessThanOrEqual(360 - bottomSpace());
        expect(screen.getByText('Habitudes')).toBeOnTheScreen();
        expect(screen.getByLabelText('1 habitude sur 10')).toBeOnTheScreen();
      });
    });

    it('never scrolls for a habit that is not new', async () => {
      const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');
      await given('Cuisiner');
      await show();
      await screen.findByText('Cuisiner');
      await layout('day-view-list', 0, 100);

      await layout('habit-card-1', 340, 76);
      await fireEvent(list(), 'contentSizeChange', 390, 900);

      expect(scrollTo).not.toHaveBeenCalled();
    });
  });

  it('stops highlighting the new habit and hides the message after a moment', async () => {
    jest.useFakeTimers();
    try {
      await show();
      await screen.findByTestId('day-view-empty');
      await openSheetAndType('Cuisiner');
      await fireEvent.press(screen.getByRole('button', { name: 'Créer l’habitude' }));
      await screen.findByText('Cuisiner');

      await act(() => jest.advanceTimersByTime(HIGHLIGHT_DURATION_MS));
      expect(screen.getByTestId('habit-card-1')).toHaveStyle({ borderColor: roles.line });
      await act(() => jest.advanceTimersByTime(TOAST_DURATION_MS - HIGHLIGHT_DURATION_MS));
      expect(screen.queryByTestId('toast')).not.toBeOnTheScreen();
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps the sheet open with the name typed when it is a duplicate', async () => {
    await given('Cuisiner');
    await show();
    await screen.findByText('Cuisiner');

    await openSheetAndType('cuisiner  ');
    await fireEvent.press(screen.getByRole('button', { name: 'Créer l’habitude' }));

    expect(
      await screen.findByRole('alert', {
        name: `Tu as déjà une habitude «${nbsp}Cuisiner${nbsp}».`,
      }),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Nom de l’habitude')).toHaveDisplayValue('cuisiner  ');
    expect(await names()).toEqual(['Cuisiner']);
  });

  it('keeps the sheet open with the name typed when the habit cannot be saved', async () => {
    await show();
    await screen.findByTestId('day-view-empty');
    dependencies.unitOfWork.failWrites();

    await openSheetAndType('Méditer');
    await fireEvent.press(screen.getByRole('button', { name: 'Créer l’habitude' }));

    expect(
      await screen.findByRole('alert', { name: 'L’habitude n’a pas pu être créée. Réessaie.' }),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Nom de l’habitude')).toHaveDisplayValue('Méditer');
    expect(screen.queryByText(/^Habitude créée/u)).not.toBeOnTheScreen();
    dependencies.unitOfWork.failWrites(false);
    expect(await names()).toEqual([]);
  });

  it('closes the sheet without creating anything', async () => {
    await show();
    await screen.findByTestId('day-view-empty');

    await openSheetAndType('Méditer');
    await fireEvent.press(screen.getByRole('button', { name: 'Annuler' }));

    expect(screen.queryByTestId('new-habit-sheet')).not.toBeOnTheScreen();
    expect(await names()).toEqual([]);
    await fireEvent.press(addButton());
    expect(screen.getByLabelText('Nom de l’habitude')).toHaveDisplayValue('');
  });

  it('counts every existing habit, even one not active yet after the clock went back', async () => {
    dependencies.clock.setToday(Day.of(2026, 10, 15));
    await given('Méditer');
    dependencies.clock.setToday(wednesday);
    await given('Cuisiner');

    await show();

    expect(await screen.findByLabelText('2 habitudes sur 10')).toHaveTextContent('2/10');
    expect(rowNames()).toEqual(['Cuisiner']);
    expect(screen.getByLabelText('0 habitude faite sur 1 attendue')).toBeOnTheScreen();
  });

  it('shows the day, not the empty state, when no existing habit is active yet', async () => {
    dependencies.clock.setToday(Day.of(2026, 10, 15));
    await given('Méditer');
    dependencies.clock.setToday(wednesday);

    await show();

    expect(await screen.findByLabelText('1 habitude sur 10')).toHaveTextContent('1/10');
    expect(screen.queryByTestId('day-view-empty')).not.toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Aujourd’hui' })).toBeOnTheScreen();
    expect(screen.queryAllByTestId(/^habit-row-/)).toEqual([]);
    expect(screen.queryByTestId('all-done')).not.toBeOnTheScreen();
  });

  it('disables adding a habit at 10 habits and explains why', async () => {
    await given(...Array.from({ length: 10 }, (_, index) => `Habitude ${index + 1}`));

    await show();

    expect(await screen.findByText('Limite atteinte · 10/10')).toBeOnTheScreen();
    expect(addButton()).toBeDisabled();
    expect(screen.getByLabelText('10 habitudes sur 10')).toHaveTextContent('10/10');
    await fireEvent.press(screen.getByText('Limite atteinte · 10/10'));
    expect(screen.getByTestId('toast')).toHaveTextContent(
      '10 habitudes au plus. Supprime une habitude pour en ajouter une.',
    );
    expect(screen.queryByTestId('new-habit-sheet')).not.toBeOnTheScreen();
  });

  describe('check-ins', () => {
    const HINT =
      'Tape ton habitude quand c’est fait : ton personnage gagne de l’XP selon sa difficulté.';
    const ALL_DONE = 'Toutes tes habitudes du jour sont faites. Belle ascension !';
    const SAVE_FAILED = 'Le suivi n’a pas été enregistré.';
    const cooking = (status: string, day = 'mercredi 14 octobre') =>
      screen.getByRole('switch', {
        name: `Cuisiner, ${day}, ${status}, ${progress(status)}, Moyenne, 10 XP par suivi`,
      });

    async function storedStatuses(): Promise<string[]> {
      const view = await getDayView(dependencies);
      return view.habits.map(({ habit, status }) => `${habit.name.value}: ${status}`);
    }

    async function showWith(...habitNames: string[]) {
      await given(...habitNames);
      await show();
      await screen.findByText(habitNames[0] ?? '');
    }

    it('confirms a habit with a tap on its row, and a second tap undoes it', async () => {
      await showWith('Cuisiner', 'Budget du jour');

      await fireEvent.press(cooking('à faire'));

      expect(await screen.findByRole('switch', { checked: true })).toHaveAccessibleName(
        'Cuisiner, mercredi 14 octobre, fait, 1 sur 5 cette semaine, Moyenne, 10 XP par suivi',
      );
      expect(screen.getByTestId('habit-progress-1')).toHaveTextContent('Fait · 1/5 cette semaine');
      expect(screen.getByLabelText('1 habitude faite sur 2 attendues')).toHaveTextContent(
        '1/2 faites',
      );
      expect(
        within(screen.getByLabelText('1 habitude faite sur 2 attendues')).getAllByTestId(
          'week-notch-on',
          { includeHiddenElements: true },
        ),
      ).toHaveLength(1);
      expect(await storedStatuses()).toEqual(['Cuisiner: done', 'Budget du jour: pending']);
      expect(screen.queryByTestId('toast')).not.toBeOnTheScreen();

      await fireEvent.press(cooking('fait'));

      expect(await screen.findByLabelText('0 habitude faite sur 2 attendues')).toBeOnTheScreen();
      expect(cooking('à faire')).not.toBeChecked();
      expect(await storedStatuses()).toEqual(['Cuisiner: pending', 'Budget du jour: pending']);
    });

    it('shows « à faire » at once when a habit « fait » is touched, before it is saved', async () => {
      await given('Cuisiner');
      await toggleCheckIn(dependencies, 1, wednesday);
      await show();
      await screen.findByText('Cuisiner');
      let open: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => {
        open = resolve;
      });
      const run = dependencies.unitOfWork.run.bind(dependencies.unitOfWork);
      jest
        .spyOn(dependencies.unitOfWork, 'run')
        .mockImplementation((work) => gate.then(() => run(work)));

      await fireEvent.press(cooking('fait'));

      expect(cooking('à faire')).not.toBeChecked();
      await act(async () => open());
      expect(await storedStatuses()).toEqual(['Cuisiner: pending']);
    });

    it('shows the habits already done today', async () => {
      await given('Cuisiner');
      await toggleCheckIn(dependencies, 1, wednesday);

      await show();

      expect(
        await screen.findByLabelText(
          'Cuisiner, mercredi 14 octobre, fait, 1 sur 5 cette semaine, Moyenne, 10 XP par suivi',
        ),
      ).toBeChecked();
    });

    it('encourages the player when every habit of the day is done', async () => {
      await showWith('Cuisiner', 'Lire');
      expect(screen.queryByText(ALL_DONE)).not.toBeOnTheScreen();

      await fireEvent.press(cooking('à faire'));
      await screen.findByLabelText('1 habitude faite sur 2 attendues');
      expect(screen.queryByText(ALL_DONE)).not.toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('switch', { name: /^Lire/u }));

      expect(await screen.findByText(ALL_DONE)).toBeOnTheScreen();
      expect(screen.getByLabelText('2 habitudes faites sur 2 attendues')).toBeOnTheScreen();
    });

    it('comes back to « à faire » and says so when the check-in cannot be saved', async () => {
      await showWith('Cuisiner');
      dependencies.unitOfWork.failWrites();

      await fireEvent.press(cooking('à faire'));

      expect(await screen.findByTestId('toast')).toHaveTextContent(`${SAVE_FAILED}Réessayer`);
      expect(cooking('à faire')).not.toBeChecked();
      expect(screen.getByLabelText('0 habitude faite sur 1 attendue')).toBeOnTheScreen();
      dependencies.unitOfWork.failWrites(false);
      expect(await storedStatuses()).toEqual(['Cuisiner: pending']);
    });

    it('tries the same check-in again with « Réessayer »', async () => {
      await showWith('Cuisiner');
      dependencies.unitOfWork.failWrites();
      await fireEvent.press(cooking('à faire'));
      await screen.findByText(SAVE_FAILED);
      dependencies.unitOfWork.failWrites(false);

      await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));

      expect(await screen.findByRole('switch', { checked: true })).toHaveAccessibleName(
        'Cuisiner, mercredi 14 octobre, fait, 1 sur 5 cette semaine, Moyenne, 10 XP par suivi',
      );
      expect(screen.queryByText(SAVE_FAILED)).not.toBeOnTheScreen();
      expect(await storedStatuses()).toEqual(['Cuisiner: done']);
    });

    it('explains the tap once, until the first habit is done', async () => {
      await showWith('Cuisiner');
      expect(await screen.findByText(HINT)).toBeOnTheScreen();

      await fireEvent.press(cooking('à faire'));

      await waitFor(() => expect(screen.queryByText(HINT)).not.toBeOnTheScreen());
      expect(dependencies.keyValueStore.values.get(CHECK_IN_HINT_DISMISSED_KEY)).toBe('true');
      await screen.unmount();
      await show();
      await screen.findByText('Cuisiner');
      expect(screen.queryByText(HINT)).not.toBeOnTheScreen();
    });

    it('explains the tap without promising a fixed amount: true for every difficulty', async () => {
      await createHabit(dependencies, 'Courir 5 km', 'hard');
      await show();
      expect(await screen.findByText(HINT)).toBeOnTheScreen();
      expect(screen.queryByText(/10 XP/u)).not.toBeOnTheScreen();

      await fireEvent.press(screen.getByRole('switch', { name: /^Courir 5 km, /u }));

      await waitFor(() =>
        expect(screen.getByTestId('xp-change', { includeHiddenElements: true })).toHaveTextContent(
          '+20 XP',
        ),
      );
      await waitFor(() => expect(screen.queryByText(HINT)).not.toBeOnTheScreen());
    });

    it('keeps the hint when the check-in cannot be saved', async () => {
      await showWith('Cuisiner');
      await screen.findByText(HINT);
      dependencies.unitOfWork.failWrites();

      await fireEvent.press(cooking('à faire'));
      await screen.findByText(SAVE_FAILED);

      expect(screen.getByText(HINT)).toBeOnTheScreen();
    });

    it('keeps the hint when a habit goes back to « à faire »', async () => {
      await given('Cuisiner');
      await toggleCheckIn(dependencies, 1, wednesday);
      await show();
      await screen.findByText(HINT);

      await fireEvent.press(cooking('fait'));
      await waitFor(async () => expect(await storedStatuses()).toEqual(['Cuisiner: pending']));
      await act(async () => undefined);

      expect(screen.getByText(HINT)).toBeOnTheScreen();
      expect(dependencies.keyValueStore.values.size).toBe(0);
    });

    it('moves to the new day by itself, and announces it', async () => {
      await given('Cuisiner');
      await toggleCheckIn(dependencies, 1, wednesday);
      await show();
      await screen.findByLabelText('1 habitude faite sur 1 attendue');

      await act(() => dependencies.clock.setToday(thursday));

      expect(await screen.findByText('Jeudi 15 octobre')).toBeOnTheScreen();
      expect(
        screen.getByRole('switch', {
          name: 'Cuisiner, jeudi 15 octobre, à faire, 1 sur 5 cette semaine, Moyenne, 10 XP par suivi',
        }),
      ).not.toBeChecked();
      expect(screen.getByLabelText('0 habitude faite sur 1 attendue')).toBeOnTheScreen();
      expect(screen.getByTestId('toast')).toHaveTextContent('Nouvelle journée : jeudi 15 octobre.');
    });

    it('saves a tap on the day just closed as a correction, then shows the new day', async () => {
      await showWith('Cuisiner');
      const changes = jest.spyOn(dependencies.clock, 'today');
      changes.mockReturnValue(thursday);

      await fireEvent.press(cooking('à faire'));

      expect(await screen.findByText('Jeudi 15 octobre')).toBeOnTheScreen();
      expect(
        screen.getByRole('switch', {
          name: 'Cuisiner, jeudi 15 octobre, à faire, 1 sur 5 cette semaine, Moyenne, 10 XP par suivi',
        }),
      ).toBeOnTheScreen();
      expect(screen.getByTestId('toast')).toHaveTextContent(
        'Mercredi 14 octobre vient d’être clos : enregistré comme correction.',
      );
      // Le suivi « fait » du mercredi est enregistré : un nouveau tap ce jour-là le retire.
      await expect(toggleCheckIn(dependencies, 1, wednesday)).resolves.toMatchObject({
        isCorrection: true,
        habitDay: { status: 'missed' },
      });
      changes.mockRestore();
    });

    it('does nothing, and says nothing, on a tap refused because the day became « à venir »', async () => {
      await showWith('Cuisiner');
      // L'horloge recule avant que l'écran ne l'apprenne : le mercredi affiché est « à venir » (R7).
      const changes = jest.spyOn(dependencies.clock, 'today');
      changes.mockReturnValue(tuesday);

      await fireEvent.press(cooking('à faire'));

      expect(await screen.findByText('Mardi 13 octobre')).toBeOnTheScreen();
      expect(screen.queryByText('Cuisiner')).not.toBeOnTheScreen();
      expect(screen.queryByTestId('toast')).not.toBeOnTheScreen();
      expect(dependencies.keyValueStore.values.size).toBe(0);
      changes.mockRestore();
      expect(await storedStatuses()).toEqual(['Cuisiner: pending']);
    });
  });

  describe('yesterday reminder', () => {
    const tuesday = Day.of(2026, 10, 13);

    async function givenHabitsSinceTuesday() {
      dependencies.clock.setToday(tuesday);
      await given('Cuisiner', 'Lire');
      const [cooking] = (await getDayView(dependencies)).habits;
      await toggleCheckIn(dependencies, cooking?.habit.id ?? 0, tuesday);
      dependencies.clock.setToday(wednesday);
    }

    it('reminds the habits done yesterday at the top, and leads to their week', async () => {
      await givenHabitsSinceTuesday();
      const onCorrectYesterday = jest.fn();
      await renderScreen(<DayViewScreen onCorrectYesterday={onCorrectYesterday} />, dependencies);

      expect(
        await screen.findByLabelText('Hier : 1 habitude faite sur 2 attendues. Un oubli ?'),
      ).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Corriger' }));

      expect(onCorrectYesterday).toHaveBeenCalledWith(Week.containing(tuesday));
    });

    it('closes the reminder for the day', async () => {
      await givenHabitsSinceTuesday();
      await show();
      await screen.findByTestId('yesterday-reminder');

      await fireEvent.press(screen.getByRole('button', { name: 'Fermer le rappel d’hier' }));

      expect(screen.queryByTestId('yesterday-reminder')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Corriger' })).toBeNull();
    });

    it('shows no reminder when every habit was done yesterday', async () => {
      await given('Cuisiner');
      await show();
      await screen.findByText('Cuisiner');

      expect(screen.queryByTestId('yesterday-reminder')).toBeNull();
    });
  });
});

describe('DayViewScreen and the experience', () => {
  const announce = jest.mocked(AccessibilityInfo.announceForAccessibility);
  const xpBar = () => screen.getByTestId('character-bar');
  const xpChange = () => screen.queryByTestId('xp-change', { includeHiddenElements: true });
  const row = (status: string) =>
    screen.getByRole('switch', {
      name: `Cuisiner, mercredi 14 octobre, ${status}, ${progress(status)}, Moyenne, 10 XP par suivi`,
    });

  beforeEach(() => announce.mockClear());
  afterEach(() => jest.restoreAllMocks());

  async function showCooking() {
    await given('Cuisiner');
    await show();
    await screen.findByText('Cuisiner');
    await waitFor(() => expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 0 XP'));
  }

  it('shows the experience of the character in the header (R24)', async () => {
    await given('Cuisiner', 'Lire');
    await toggleCheckIn(dependencies, 1, wednesday);
    await toggleCheckIn(dependencies, 2, wednesday);

    await show();

    await waitFor(() => expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 20 XP'));
    expect(screen.getByText('Expérience du personnage')).toBeOnTheScreen();
    expect(screen.getByTestId('xp-counter')).toHaveTextContent('20 XP');
  });

  it('shows 0 XP to a new player, above the empty state', async () => {
    await show();

    expect(await screen.findByTestId('day-view-empty')).toBeOnTheScreen();
    await waitFor(() => expect(screen.getByTestId('xp-counter')).toHaveTextContent('0 XP'));
  });

  it('shows the shape of the header while loading', async () => {
    jest.spyOn(dependencies.unitOfWork, 'run').mockReturnValue(new Promise(() => undefined));

    await show();

    expect(
      within(screen.getByTestId('day-view-loading')).getByTestId('character-bar-loading', {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
  });

  it('earns 10 XP for a habit done, with a light vibration and an announcement', async () => {
    await showCooking();

    await fireEvent.press(row('à faire'));

    await waitFor(() => expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 10 XP'));
    expect(screen.getByTestId('xp-counter')).toHaveTextContent('10 XP');
    expect(xpChange()).toHaveTextContent('+10 XP');
    expect(dependencies.haptics.success).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith('+10 points d’expérience. Total : 10 XP.');
  });

  it('loses 10 XP, discreetly and without vibration, when a habit goes back to « à faire »', async () => {
    await given('Cuisiner');
    await toggleCheckIn(dependencies, 1, wednesday);
    await show();
    await waitFor(() => expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 10 XP'));

    await fireEvent.press(row('fait'));

    await waitFor(() => expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 0 XP'));
    expect(xpChange()).toHaveTextContent('−10 XP');
    expect(dependencies.haptics.success).not.toHaveBeenCalled();
    expect(announce).toHaveBeenCalledWith('−10 points d’expérience. Total : 0 XP.');
  });

  it('changes no experience when the check-in cannot be saved', async () => {
    await showCooking();
    dependencies.unitOfWork.failWrites();

    await fireEvent.press(row('à faire'));

    await screen.findByText('Le suivi n’a pas été enregistré.');
    expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 0 XP');
    expect(xpChange()).not.toBeOnTheScreen();
    expect(dependencies.haptics.success).not.toHaveBeenCalled();
    expect(announce).not.toHaveBeenCalledWith(expect.stringContaining('expérience'));
  });

  it('announces a tap on the day just closed as a correction', async () => {
    await showCooking();
    jest.spyOn(dependencies.clock, 'today').mockReturnValue(thursday);

    await fireEvent.press(row('à faire'));

    await screen.findByText('Jeudi 15 octobre');
    expect(announce).toHaveBeenCalledWith(
      'Correction enregistrée, +10 points d’expérience. Total : 10 XP.',
    );
    expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 10 XP');
  });

  it('lets « +10 XP » fly up from the row and counts up to the new experience', async () => {
    withMotion();
    await showCooking();

    await fireEvent.press(row('à faire'));

    await waitFor(() =>
      expect(
        within(row('fait')).getByTestId('xp-float', { includeHiddenElements: true }),
      ).toHaveTextContent('+10 XP'),
    );
    await waitFor(() => expect(screen.getByTestId('xp-counter')).toHaveTextContent('10 XP'));
  });

  it('lets nothing fly up when the player asked to reduce motion', async () => {
    await showCooking();

    await fireEvent.press(row('à faire'));

    await waitFor(() => expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 10 XP'));
    expect(screen.queryByTestId('xp-float', { includeHiddenElements: true })).not.toBeOnTheScreen();
  });

  it('reads the experience again with « Réessayer »', async () => {
    await given('Cuisiner');
    await toggleCheckIn(dependencies, 1, wednesday);
    dependencies.unitOfWork.failReads();
    await show();
    await screen.findByTestId('day-view-error');
    dependencies.unitOfWork.failReads(false);

    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));

    await waitFor(() => expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 10 XP'));
  });
});

describe('DayViewScreen and editing a habit', () => {
  const xpBar = () => screen.getByTestId('character-bar');
  const editButton = (name: string) =>
    screen.getByRole('button', { name: `Modifier l’habitude ${name}` });
  const nameField = () => screen.getByLabelText('Nom de l’habitude');
  const toast = () => screen.getByTestId('toast');

  /** « Cuisiner », créée mardi et « fait » mardi et mercredi, et « Budget du jour ». */
  async function showTwoHabits({ cookingDoneToday = true } = {}) {
    dependencies.clock.setToday(tuesday);
    await given('Cuisiner');
    await toggleCheckIn(dependencies, 1, tuesday);
    dependencies.clock.setToday(wednesday);
    await given('Budget du jour');
    if (cookingDoneToday) {
      await toggleCheckIn(dependencies, 1, wednesday);
    }
    await show();
    await screen.findByText('Cuisiner');
  }

  async function askDeletion(name = 'Cuisiner') {
    await fireEvent.press(editButton(name));
    await fireEvent.press(screen.getByRole('button', { name: 'Supprimer l’habitude' }));
    await screen.findByTestId('delete-habit-dialog');
  }

  it('opens « Modifier l’habitude » from « ⋯ », without toggling the habit', async () => {
    await showTwoHabits({ cookingDoneToday: false });

    await fireEvent.press(editButton('Cuisiner'));

    expect(screen.getByRole('header', { name: 'Modifier l’habitude' })).toBeOnTheScreen();
    expect(nameField()).toHaveDisplayValue('Cuisiner');
    expect(nameField()).toHaveProp('autoFocus', false);
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Supprimer l’habitude' })).toBeOnTheScreen();
    expect(
      screen.getByRole('switch', {
        name: 'Cuisiner, mercredi 14 octobre, à faire, 1 sur 6 cette semaine, Moyenne, 10 XP par suivi',
      }),
    ).not.toBeChecked();
  });

  it('closes « Modifier l’habitude » with « Annuler », changing nothing', async () => {
    await showTwoHabits();
    await fireEvent.press(editButton('Cuisiner'));

    await fireEvent.press(screen.getByRole('button', { name: 'Annuler' }));

    expect(screen.queryByTestId('edit-habit-sheet')).not.toBeOnTheScreen();
    expect(await names()).toEqual(['Cuisiner', 'Budget du jour']);
  });

  it('renames a habit, highlights it, and keeps its check-ins and the experience', async () => {
    await showTwoHabits();
    await waitFor(() => expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 20 XP'));
    await fireEvent.press(editButton('Cuisiner'));

    await fireEvent.changeText(nameField(), 'Cuisiner maison');
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(
      await screen.findByRole('switch', {
        name: 'Cuisiner maison, mercredi 14 octobre, fait, 2 sur 6 cette semaine, Moyenne, 10 XP par suivi',
      }),
    ).toBeChecked();
    expect(screen.queryByTestId('edit-habit-sheet')).not.toBeOnTheScreen();
    expect(screen.getByTestId('habit-card-1')).toHaveStyle({ borderColor: roles.gold });
    expect(toast()).toHaveTextContent('Habitude renommée');
    expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 20 XP');
    expect(await names()).toEqual(['Cuisiner maison', 'Budget du jour']);
  });

  it('does not scroll to the end of the list for a renamed habit', async () => {
    await showTwoHabits();
    // Un espion déjà posé par un test précédent garde ses appels : on part de zéro.
    const scrollToEnd = jest.spyOn(ScrollView.prototype, 'scrollToEnd');
    scrollToEnd.mockClear();
    await fireEvent.press(editButton('Cuisiner'));
    await fireEvent.changeText(nameField(), 'Cuisiner maison');
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));
    await screen.findByText('Cuisiner maison');

    await fireEvent(screen.getByTestId('day-view-list'), 'contentSizeChange', 390, 900);

    expect(scrollToEnd).not.toHaveBeenCalled();
    scrollToEnd.mockRestore();
  });

  it('refuses the name of another habit and keeps the habit as it is', async () => {
    await showTwoHabits();
    await fireEvent.press(editButton('Cuisiner'));

    await fireEvent.changeText(nameField(), 'budget du jour');
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(
      await screen.findByRole('alert', {
        name: `Tu as déjà une habitude «${nbsp}Budget du jour${nbsp}».`,
      }),
    ).toBeOnTheScreen();
    expect(await names()).toEqual(['Cuisiner', 'Budget du jour']);
  });

  it('says the name could not be saved, and keeps the habit as it is', async () => {
    await showTwoHabits();
    await fireEvent.press(editButton('Cuisiner'));
    dependencies.unitOfWork.failWrites();

    await fireEvent.changeText(nameField(), 'Cuisiner maison');
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(
      await screen.findByRole('alert', {
        name: 'Les modifications n’ont pas pu être enregistrées. Réessaie.',
      }),
    ).toBeOnTheScreen();
    dependencies.unitOfWork.failWrites(false);
    expect(await names()).toEqual(['Cuisiner', 'Budget du jour']);
  });

  describe('and its difficulty', () => {
    const option = (name: string) =>
      screen.getByRole('radio', { name: new RegExp(`^${name},`, 'u') });

    it('prefills the difficulty of the current week, without message', async () => {
      await showTwoHabits();

      await fireEvent.press(editButton('Cuisiner'));

      expect(option('Moyenne')).toBeChecked();
      expect(screen.queryByTestId('difficulty-change-info')).not.toBeOnTheScreen();
    });

    it('opens with the settings already shown, without reading them again', async () => {
      await showTwoHabits();
      dependencies.unitOfWork.failReads();

      await fireEvent.press(editButton('Cuisiner'));

      expect(await screen.findByTestId('edit-habit-sheet')).toBeOnTheScreen();
      expect(option('Moyenne')).toBeChecked();
      expect(screen.queryByText('L’habitude n’a pas pu être ouverte. Réessaie.')).toBeNull();
    });

    it('prefills the difficulty of the habit opened, not of another one', async () => {
      await showTwoHabits();
      await updateHabit(dependencies, 1, { name: 'Cuisiner', difficulty: 'hard' });
      await screen.unmount();
      await show();
      expect(await peaksOf(1)).toBe(3);

      await fireEvent.press(editButton('Budget du jour'));

      expect(option('Moyenne')).toBeChecked();
    });

    it('re-evaluates the week at a higher difficulty: +20 XP, with a vibration', async () => {
      await showTwoHabits();
      await waitFor(() => expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 20 XP'));
      await fireEvent.press(editButton('Cuisiner'));

      await fireEvent.press(option('Difficile'));
      await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));

      expect(
        await screen.findByRole('switch', {
          name: 'Cuisiner, mercredi 14 octobre, fait, 2 sur 6 cette semaine, Difficile, 20 XP par suivi',
        }),
      ).toBeChecked();
      expect(await peaksOf(1)).toBe(3);
      expect(screen.queryByTestId('edit-habit-sheet')).not.toBeOnTheScreen();
      expect(toast()).toHaveTextContent(`Habitude modifiée · +20 XP`);
      expect(screen.getByTestId('habit-card-1')).toHaveStyle({ borderColor: roles.gold });
      expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 40 XP');
      expect(screen.getByTestId('xp-change', { includeHiddenElements: true })).toHaveTextContent(
        '+20 XP',
      );
      expect(dependencies.haptics.success).toHaveBeenCalledTimes(1);
      expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
        '+20 points d’expérience. Total : 40 XP.',
      );
    });

    it('takes back the difference at a lower difficulty, never with a vibration', async () => {
      await showTwoHabits();
      await fireEvent.press(editButton('Cuisiner'));

      await fireEvent.press(option('Facile'));
      await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));

      await waitFor(() => expect(toast()).toHaveTextContent('Habitude modifiée · −10 XP'));
      expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 10 XP');
      expect(dependencies.haptics.success).not.toHaveBeenCalled();
    });

    it('then gives a check-in at the new rate', async () => {
      await showTwoHabits({ cookingDoneToday: false });
      await fireEvent.press(editButton('Cuisiner'));
      await fireEvent.press(option('Difficile'));
      await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));
      await waitFor(() => expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 20 XP'));

      await fireEvent.press(
        await screen.findByRole('switch', {
          name: 'Cuisiner, mercredi 14 octobre, à faire, 1 sur 6 cette semaine, Difficile, 20 XP par suivi',
        }),
      );

      await waitFor(() => expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 40 XP'));
    });

    it('says « Habitude modifiée » when the name and the difficulty change together', async () => {
      await showTwoHabits({ cookingDoneToday: false });
      await fireEvent.press(editButton('Cuisiner'));

      await fireEvent.changeText(nameField(), 'Cuisiner maison');
      await fireEvent.press(option('Difficile'));
      await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));

      await waitFor(() => expect(toast()).toHaveTextContent('Habitude modifiée · +10 XP'));
      expect(await names()).toEqual(['Cuisiner maison', 'Budget du jour']);
    });

    it('changes nothing when the change cannot be saved, and keeps the choice', async () => {
      await showTwoHabits();
      await fireEvent.press(editButton('Cuisiner'));
      dependencies.unitOfWork.failWrites();

      await fireEvent.press(option('Difficile'));
      await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));

      expect(
        await screen.findByRole('alert', {
          name: 'Les modifications n’ont pas pu être enregistrées. Réessaie.',
        }),
      ).toBeOnTheScreen();
      expect(option('Difficile')).toBeChecked();
      dependencies.unitOfWork.failWrites(false);
      const [cooking] = (await getDayView(dependencies)).habits;
      expect(cooking?.weekSettings).toMatchObject({ difficulty: 'medium' });
      expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 20 XP');
    });

    it('keeps the difficulty chosen after a failed preparation of the deletion', async () => {
      await showTwoHabits();
      await fireEvent.press(editButton('Cuisiner'));
      await fireEvent.press(option('Difficile'));
      dependencies.unitOfWork.failReads();

      await fireEvent.press(screen.getByRole('button', { name: 'Supprimer l’habitude' }));

      expect(await screen.findByRole('alert')).toBeOnTheScreen();
      expect(option('Difficile')).toBeChecked();
      expect(screen.getByTestId('difficulty-change-info')).toBeOnTheScreen();
    });
  });

  it('asks to confirm a deletion, announcing the experience removed today', async () => {
    await showTwoHabits();

    await askDeletion();

    expect(screen.queryByTestId('edit-habit-sheet')).not.toBeOnTheScreen();
    expect(
      screen.getByRole('header', { name: `Supprimer «${nbsp}Cuisiner${nbsp}»${nbsp}?` }),
    ).toBeOnTheScreen();
    expect(screen.getByText(/seule celle d’aujourd’hui est retirée \(−10 XP\)\.$/u)).toBeTruthy();
  });

  it('announces no experience removed when the habit is not done today', async () => {
    await showTwoHabits({ cookingDoneToday: false });

    await askDeletion();

    expect(
      screen.getByText(
        'Ses suivis seront effacés. L’expérience gagnée les jours passés reste acquise.',
      ),
    ).toBeOnTheScreen();
  });

  it('deletes the habit once confirmed, and shows the experience removed', async () => {
    await showTwoHabits();
    await waitFor(() => expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 20 XP'));
    await askDeletion();

    await fireEvent.press(screen.getByRole('button', { name: 'Supprimer' }));

    await waitFor(() => expect(screen.queryByText('Cuisiner')).not.toBeOnTheScreen());
    expect(screen.queryByTestId('delete-habit-dialog')).not.toBeOnTheScreen();
    expect(toast()).toHaveTextContent('Habitude supprimée · −10 XP');
    expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 10 XP');
    expect(screen.getByTestId('xp-change', { includeHiddenElements: true })).toHaveTextContent(
      '−10 XP',
    );
    expect(screen.getByLabelText('1 habitude sur 10')).toBeOnTheScreen();
    expect(await names()).toEqual(['Budget du jour']);
  });

  it('says « Habitude supprimée » alone when no experience is removed', async () => {
    await showTwoHabits({ cookingDoneToday: false });
    await askDeletion();

    await fireEvent.press(screen.getByRole('button', { name: 'Supprimer' }));

    await waitFor(() => expect(toast()).toHaveTextContent('Habitude supprimée'));
    expect(toast()).not.toHaveTextContent('XP');
    expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 10 XP');
  });

  it('keeps the habit and the experience when the deletion is cancelled', async () => {
    await showTwoHabits();
    await askDeletion();

    await fireEvent.press(screen.getByRole('button', { name: 'Annuler' }));

    expect(screen.queryByTestId('delete-habit-dialog')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('edit-habit-sheet')).not.toBeOnTheScreen();
    expect(
      screen.getByRole('switch', {
        name: 'Cuisiner, mercredi 14 octobre, fait, 2 sur 6 cette semaine, Moyenne, 10 XP par suivi',
      }),
    ).toBeChecked();
    expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 20 XP');
    expect(await names()).toEqual(['Cuisiner', 'Budget du jour']);
  });

  it('keeps the habit, its check-ins and the experience when the deletion fails', async () => {
    await showTwoHabits();
    await askDeletion();
    dependencies.unitOfWork.failWrites();

    await fireEvent.press(screen.getByRole('button', { name: 'Supprimer' }));

    expect(
      await screen.findByRole('alert', { name: 'La suppression a échoué. Réessaie.' }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeOnTheScreen();
    dependencies.unitOfWork.failWrites(false);
    expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 20 XP');
    expect(await names()).toEqual(['Cuisiner', 'Budget du jour']);
    expect((await getDayView(dependencies)).habits[0]?.status).toBe('done');
  });

  it('explains a deletion that could not be prepared, in the sheet', async () => {
    await showTwoHabits();
    await fireEvent.press(editButton('Cuisiner'));
    dependencies.unitOfWork.failReads();

    await fireEvent.press(screen.getByRole('button', { name: 'Supprimer l’habitude' }));

    expect(
      await screen.findByRole('alert', { name: 'La suppression a échoué. Réessaie.' }),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('edit-habit-sheet')).toBeOnTheScreen();
    expect(screen.queryByTestId('delete-habit-dialog')).not.toBeOnTheScreen();
    dependencies.unitOfWork.failReads(false);
  });

  it('shows the empty state once the last habit is deleted', async () => {
    await given('Cuisiner');
    await show();
    await screen.findByText('Cuisiner');
    await askDeletion();

    await fireEvent.press(screen.getByRole('button', { name: 'Supprimer' }));

    expect(await screen.findByTestId('day-view-empty')).toBeOnTheScreen();
    expect(toast()).toHaveTextContent('Habitude supprimée');
  });

  it('lets the player add a habit again once one of 10 habits is deleted', async () => {
    await given(...Array.from({ length: 10 }, (_, index) => `Habitude ${index + 1}`));
    await show();
    expect(await screen.findByText('Limite atteinte · 10/10')).toBeOnTheScreen();
    await askDeletion('Habitude 3');

    await fireEvent.press(screen.getByRole('button', { name: 'Supprimer' }));

    await waitFor(() => expect(addButton()).toBeEnabled());
    expect(screen.queryByText('Limite atteinte · 10/10')).not.toBeOnTheScreen();
    expect(screen.getByLabelText('9 habitudes sur 10')).toBeOnTheScreen();
  });

  it('reloads and closes everything when the habit no longer exists', async () => {
    await showTwoHabits();
    await fireEvent.press(editButton('Cuisiner'));
    await deleteHabit(dependencies, 1);

    await fireEvent.changeText(nameField(), 'Cuisiner maison');
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(screen.queryByText('Cuisiner')).not.toBeOnTheScreen());
    expect(screen.queryByTestId('edit-habit-sheet')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('toast')).not.toBeOnTheScreen();
  });
});

describe('DayViewScreen and the weekly progress (E1)', () => {
  const MONDAY = Day.of(2026, 10, 12);
  const progressLine = () => screen.getByTestId('habit-progress-1');
  const badge = () =>
    screen.queryByTestId('habit-target-reached-1', { includeHiddenElements: true });

  /** « Courir 5 km », 3 fois par semaine, créée le lundi 5 octobre et « fait » lundi 12. */
  async function showRunning() {
    dependencies.clock.setToday(Day.of(2026, 10, 5));
    await createHabit(dependencies, 'Courir 5 km', 'hard', 3);
    dependencies.clock.setToday(MONDAY);
    await toggleCheckIn(dependencies, 1, MONDAY);
    dependencies.clock.setToday(wednesday);
    await show();
    await screen.findByText('Courir 5 km');
  }

  it('shows the secondary line of the loading skeleton: an icon and the progress', async () => {
    const run = dependencies.unitOfWork.run.bind(dependencies.unitOfWork);
    jest
      .spyOn(dependencies.unitOfWork, 'run')
      .mockImplementation((work) => new Promise(() => run(work)));

    await show();

    expect(screen.getAllByTestId('day-view-loading-secondary-line')).toHaveLength(5);
    jest.restoreAllMocks();
  });

  it('writes the status and the progress of the week on each row', async () => {
    await showRunning();

    expect(progressLine()).toHaveTextContent('À faire · 1/3 cette semaine');
    expect(badge()).not.toBeOnTheScreen();
  });

  it('follows the taps: « Fait · 2/3 cette semaine », then « À faire · 1/3 »', async () => {
    await showRunning();
    expect(progressLine()).toHaveTextContent('À faire · 1/3 cette semaine');

    await fireEvent.press(screen.getByRole('switch', { name: /^Courir 5 km, /u }));

    await waitFor(() => expect(progressLine()).toHaveTextContent('Fait · 2/3 cette semaine'));
    await fireEvent.press(screen.getByRole('switch', { name: /^Courir 5 km, /u }));
    await waitFor(() => expect(progressLine()).toHaveTextContent('À faire · 1/3 cette semaine'));
  });

  it('carries the badge once the target is reached, and loses it below, without failure mark', async () => {
    await showRunning();
    await act(async () => {
      await toggleCheckIn(dependencies, 1, tuesday);
    });
    await screen.unmount();
    await show();
    await screen.findByText('Courir 5 km');
    expect(progressLine()).toHaveTextContent('À faire · 2/3 cette semaine');

    await fireEvent.press(screen.getByRole('switch', { name: /^Courir 5 km, /u }));

    await waitFor(() => expect(badge()).toHaveTextContent('Objectif atteint'));
    expect(progressLine()).toHaveTextContent('Fait · 3/3 cette semaine');
    expect(
      screen.getByRole('switch', {
        name: 'Courir 5 km, mercredi 14 octobre, fait, 3 sur 3 cette semaine, Difficile, 20 XP par suivi, objectif atteint',
      }),
    ).toBeEnabled();

    await fireEvent.press(screen.getByRole('switch', { name: /^Courir 5 km, /u }));

    await waitFor(() => expect(badge()).not.toBeOnTheScreen());
    expect(progressLine()).toHaveTextContent('À faire · 2/3 cette semaine');
    expect(screen.queryByTestId('cross-mark', { includeHiddenElements: true })).toBeNull();
  });
});

describe('DayViewScreen and the expected habits (#25)', () => {
  const october = (dayOfMonth: number) => Day.of(2026, 10, dayOfMonth);
  const running = () => screen.getByRole('switch', { name: /^Courir 5 km, /u });
  const cooking = () => screen.getByRole('switch', { name: /^Cuisiner, /u });

  /**
   * Le contexte de la story : « Courir 5 km », objectif 3, et « Cuisiner », objectif 7, créées le
   * lundi 5 octobre ; « Courir 5 km » est « fait » les jours `runningDays`, et aujourd'hui est `today`.
   */
  async function showStory(today: Day, runningDays: readonly number[], withCooking = true) {
    dependencies.clock.setToday(october(5));
    await createHabit(dependencies, 'Courir 5 km', 'medium', 3);
    if (withCooking) {
      await createHabit(dependencies, 'Cuisiner', 'medium', 7);
    }
    for (const each of runningDays) {
      dependencies.clock.setToday(october(each));
      await toggleCheckIn(dependencies, 1, october(each));
    }
    dependencies.clock.setToday(today);
    await show();
    await screen.findByText('Courir 5 km');
  }

  it('leaves out of the counter a habit whose target is reached, still listed, with its badge and tappable', async () => {
    await showStory(thursday, [12, 13, 14]);

    expect(screen.getByLabelText('0 habitude faite sur 1 attendue')).toHaveTextContent(
      '0/1 faites',
    );
    expect(
      screen.getByTestId('habit-target-reached-1', { includeHiddenElements: true }),
    ).toHaveTextContent('Objectif atteint');
    expect(running()).toBeEnabled();
    expect(screen.queryByTestId('goals-reached')).toBeNull();
  });

  it('counts it again at once when touched, then once saved: « 1/2 faites »', async () => {
    await showStory(thursday, [12, 13, 14]);
    let save: () => void = () => undefined;
    const saving = new Promise<void>((resolve) => {
      save = resolve;
    });
    const run = dependencies.unitOfWork.run.bind(dependencies.unitOfWork);
    jest
      .spyOn(dependencies.unitOfWork, 'run')
      .mockImplementation((work) => saving.then(() => run(work)));

    await fireEvent.press(running());

    expect(screen.getByLabelText('1 habitude faite sur 2 attendues')).toHaveTextContent(
      '1/2 faites',
    );
    await act(async () => save());
    jest.restoreAllMocks();
    await waitFor(() =>
      expect(screen.getByLabelText('1 habitude faite sur 2 attendues')).toBeOnTheScreen(),
    );
    await expect(getDayView(dependencies)).resolves.toMatchObject({
      doneCount: 1,
      expectedCount: 2,
    });
  });

  it('goes back to « 0/1 faites » when the tap cannot be saved', async () => {
    await showStory(thursday, [12, 13, 14]);
    dependencies.unitOfWork.failWrites();

    await fireEvent.press(running());

    expect(await screen.findByTestId('toast')).toBeOnTheScreen();
    expect(screen.getByLabelText('0 habitude faite sur 1 attendue')).toBeOnTheScreen();
  });

  it('celebrates « Toutes faites » without the habit whose target is reached', async () => {
    await showStory(thursday, [12, 13, 14]);
    expect(screen.queryByTestId('all-done')).toBeNull();

    await fireEvent.press(cooking());

    expect(await screen.findByTestId('all-done')).toBeOnTheScreen();
    expect(screen.getByLabelText('1 habitude faite sur 1 attendue')).toHaveTextContent(
      '1/1 faites',
    );
  });

  it('says « Objectifs de la semaine atteints » calmly when no habit is expected, without « Toutes faites »', async () => {
    await showStory(Day.of(2026, 10, 18), [12, 14, 16], false);

    const notice = screen.getByTestId('goals-reached');
    expect(notice).toHaveTextContent(
      'Objectifs de la semaine atteintsRien n’est attendu aujourd’hui. Un « fait » en plus rapporte quand même son XP.',
    );
    expect(notice).toHaveAccessibleName(
      'Objectifs de la semaine atteints. Rien n’est attendu aujourd’hui. Un « fait » en plus rapporte quand même son XP.',
    );
    expect(screen.getByTestId('day-goals-reached')).toHaveTextContent('Atteints');
    expect(screen.queryByText(/faites$/u)).toBeNull();
    expect(screen.queryByTestId('all-done')).toBeNull();
    expect(running()).toBeEnabled();

    await fireEvent.press(running());

    await waitFor(() => expect(screen.queryByTestId('goals-reached')).toBeNull());
    expect(screen.getByLabelText('1 habitude faite sur 1 attendue')).toBeOnTheScreen();
    expect(await screen.findByTestId('all-done')).toBeOnTheScreen();
  });

  it('reminds yesterday with the expected habits only', async () => {
    dependencies.clock.setToday(october(5));
    await createHabit(dependencies, 'Courir 5 km', 'medium', 3);
    await createHabit(dependencies, 'Cuisiner', 'medium', 7);
    dependencies.clock.setToday(october(12));
    await toggleCheckIn(dependencies, 2, october(12));
    dependencies.clock.setToday(tuesday);

    await show();

    expect(
      await screen.findByLabelText('Hier : 1 habitude faite sur 2 attendues. Un oubli ?'),
    ).toHaveTextContent('Hier : 1/2 faites. Un oubli ?');
  });
});

describe('DayViewScreen and the whats-new card', () => {
  const card = () => screen.queryByTestId('whats-new-card');

  /** « Cuisiner » et « Budget du jour », d'avant la mise à jour qui introduit l'objectif. */
  async function givenHabitsBeforeTheUpdate() {
    await given('Cuisiner', 'Budget du jour');
    await dependencies.unitOfWork.addSettingsChangeBeforeWeeklyTarget(1, Day.of(2026, 10, 5));
  }

  it('shows the card at the top, above the reminder of yesterday', async () => {
    dependencies.clock.setToday(tuesday);
    await given('Cuisiner', 'Budget du jour');
    await toggleCheckIn(dependencies, 1, tuesday);
    dependencies.clock.setToday(wednesday);
    await dependencies.unitOfWork.addSettingsChangeBeforeWeeklyTarget(1, Day.of(2026, 10, 5));

    await show();

    expect(await screen.findByTestId('whats-new-card')).toBeOnTheScreen();
    const list = screen.getByTestId('day-view-list');
    const order = within(list)
      .getAllByTestId(/^(whats-new-card|yesterday-reminder)$/u)
      .map((each) => each.props.testID as string);
    expect(order).toEqual(['whats-new-card', 'yesterday-reminder']);
  });

  it('opens « Modifier l’habitude » on the first habit with « Régler », and is gone for good', async () => {
    await givenHabitsBeforeTheUpdate();
    await show();

    await fireEvent.press(await screen.findByRole('button', { name: 'Régler' }));

    expect(await screen.findByTestId('edit-habit-sheet')).toBeOnTheScreen();
    expect(screen.getByLabelText('Nom de l’habitude')).toHaveDisplayValue('Cuisiner');
    expect(card()).not.toBeOnTheScreen();
    expect(dependencies.keyValueStore.values.get(WHATS_NEW_CARD_DISMISSED_KEY)).toBe('true');
    await screen.unmount();
    await show();
    await screen.findByText('Cuisiner');
    expect(card()).not.toBeOnTheScreen();
  });

  it('closes for good', async () => {
    await givenHabitsBeforeTheUpdate();
    await show();

    await fireEvent.press(await screen.findByRole('button', { name: 'Fermer la nouveauté' }));

    expect(card()).not.toBeOnTheScreen();
    expect(screen.queryByTestId('edit-habit-sheet')).not.toBeOnTheScreen();
    expect(dependencies.keyValueStore.values.get(WHATS_NEW_CARD_DISMISSED_KEY)).toBe('true');
  });

  it('shows no card on a first install', async () => {
    await given('Cuisiner');

    await show();
    await screen.findByText('Cuisiner');
    await act(async () => undefined);

    expect(card()).not.toBeOnTheScreen();
  });
});

describe('DayViewScreen and the target bonus (#26)', () => {
  const friday16 = Day.of(2026, 10, 16);
  const hidden = { includeHiddenElements: true };
  const announce = jest.mocked(AccessibilityInfo.announceForAccessibility);
  const badge = () => screen.queryByTestId('habit-target-reached-1', hidden);
  const xpBar = () => screen.getByTestId('character-bar');
  const row = () => screen.getByRole('switch', { name: /^Courir 5 km, /u });
  const toast = () => screen.queryByTestId('toast');

  /** « Courir 5 km », Moyenne, objectif 3, créée le lundi 5 et « fait » lundi 12 et mercredi 14. */
  async function showRunning() {
    dependencies.clock.setToday(Day.of(2026, 10, 5));
    await createHabit(dependencies, 'Courir 5 km', 'medium', 3);
    for (const day of [Day.of(2026, 10, 12), wednesday]) {
      dependencies.clock.setToday(day);
      await toggleCheckIn(dependencies, 1, day);
    }
    dependencies.clock.setToday(friday16);
    await show();
    await screen.findByText('Courir 5 km');
    await waitFor(() => expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 20 XP'));
    announce.mockClear();
  }

  it('plays F1 when the target is reached: badge, bonus pill, message, two vibrations (E1)', async () => {
    await showRunning();

    await fireEvent.press(row());

    await waitFor(() => expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 45 XP'));
    expect(badge()).toHaveTextContent('Objectif atteint');
    expect(screen.getByTestId('xp-change', hidden)).toHaveTextContent('+10 XP');
    expect(screen.getByTestId('xp-change-bonus', hidden)).toHaveTextContent('+15 XP prime');
    expect(toast()).toHaveTextContent(
      'Objectif de la semaine atteint\nCourir 5 km 3/3 · +15 XP prime',
    );
    expect(dependencies.haptics.success).toHaveBeenCalledTimes(2);
    expect(announce).toHaveBeenCalledWith(
      'Objectif de la semaine atteint pour Courir 5 km, 3 sur 3. +15 points d’expérience de prime. Total : 45 XP.',
    );
    expect(announce).not.toHaveBeenCalledWith(expect.stringMatching(/^\+25 points/u));
  });

  it('takes the bonus back, discreetly and without vibration, below the target', async () => {
    await showRunning();
    await fireEvent.press(row());
    await waitFor(() => expect(badge()).toBeOnTheScreen());
    dependencies.haptics.success.mockClear();

    await fireEvent.press(row());

    await waitFor(() => expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 20 XP'));
    expect(badge()).not.toBeOnTheScreen();
    expect(screen.getByTestId('xp-change', hidden)).toHaveTextContent('−10 XP');
    expect(screen.getByTestId('xp-change-bonus', hidden)).toHaveTextContent('−15 XP prime');
    expect(toast()).toHaveTextContent(
      'Objectif de la semaine plus atteint · Courir 5 km 2/3 · −15 XP prime',
    );
    expect(dependencies.haptics.success).not.toHaveBeenCalled();
    expect(announce).toHaveBeenLastCalledWith(
      'Objectif de la semaine plus atteint pour Courir 5 km. −10 points d’expérience, −15 points de prime.',
    );
  });

  it('pays the normal experience beyond the target, without a new bonus nor message', async () => {
    await showRunning();
    await fireEvent.press(row());
    await waitFor(() => expect(badge()).toBeOnTheScreen());
    await act(async () => {
      await toggleCheckIn(dependencies, 1, Day.of(2026, 10, 13));
    });
    dependencies.clock.setToday(Day.of(2026, 10, 17));
    await screen.unmount();
    await show();
    await screen.findByText('Courir 5 km');
    announce.mockClear();

    await fireEvent.press(row());

    await waitFor(() => expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 65 XP'));
    expect(screen.queryByTestId('xp-change-bonus', hidden)).not.toBeOnTheScreen();
    expect(toast()).not.toBeOnTheScreen();
    expect(announce).toHaveBeenLastCalledWith('+10 points d’expérience. Total : 65 XP.');
  });

  it('shows neither the badge nor the bonus when the check-in cannot be saved', async () => {
    await showRunning();
    dependencies.unitOfWork.failWrites();

    await fireEvent.press(row());

    expect(await screen.findByText('Le suivi n’a pas été enregistré.')).toBeOnTheScreen();
    await waitFor(() =>
      expect(screen.getByTestId('habit-progress-1')).toHaveTextContent(
        'À faire · 2/3 cette semaine',
      ),
    );
    expect(badge()).not.toBeOnTheScreen();
    expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 20 XP');
    expect(screen.queryByTestId('xp-change-bonus', hidden)).not.toBeOnTheScreen();
  });

  it('plays F1 after « Enregistrer » when the target lowered on the day of creation is reached (E7)', async () => {
    await createHabit(dependencies, 'Méditer 10 minutes', 'easy', 7);
    await toggleCheckIn(dependencies, 1, wednesday);
    await show();
    await screen.findByText('Méditer 10 minutes');

    await fireEvent.press(
      screen.getByRole('button', { name: 'Modifier l’habitude Méditer 10 minutes' }),
    );
    await fireEvent.press(await screen.findByTestId('weekly-target-option-1'));
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() =>
      expect(toast()).toHaveTextContent(
        'Objectif de la semaine atteint\nMéditer 10 minutes 1/1 · +3 XP prime',
      ),
    );
    expect(screen.queryByText(/^Habitude modifiée/u)).not.toBeOnTheScreen();
    expect(screen.getByTestId('xp-change-bonus', hidden)).toHaveTextContent('+3 XP prime');
    expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 8 XP');
    // La vibration de F1 seule : la modification ne change pas l'expérience des cases.
    expect(dependencies.haptics.success).toHaveBeenCalledTimes(1);
  });

  it('re-evaluates the bonus with the difficulty without replaying F1', async () => {
    await showRunning();
    await fireEvent.press(row());
    await waitFor(() => expect(badge()).toBeOnTheScreen());

    await fireEvent.press(screen.getByRole('button', { name: 'Modifier l’habitude Courir 5 km' }));
    await fireEvent.press(screen.getByRole('radio', { name: /^Difficile,/u }));
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 90 XP'));
    expect(toast()).toHaveTextContent('Habitude modifiée · +45 XP');
    expect(screen.getByTestId('xp-change', hidden)).toHaveTextContent('+30 XP');
    expect(screen.getByTestId('xp-change-bonus', hidden)).toHaveTextContent('+15 XP prime');
  });

  it('announces the bonus that falls in the confirmation of the deletion (E8)', async () => {
    await showRunning();
    await fireEvent.press(row());
    await waitFor(() => expect(badge()).toBeOnTheScreen());

    await fireEvent.press(screen.getByRole('button', { name: 'Modifier l’habitude Courir 5 km' }));
    await fireEvent.press(await screen.findByTestId('delete-habit'));

    expect(
      await screen.findByText(
        `Ses suivis seront effacés. L’expérience gagnée les jours passés reste acquise. Sont retirés le suivi d’aujourd’hui (−10 XP) et la prime de cette semaine (−15 XP), l’objectif n’étant plus atteint${nbsp}: −25 XP en tout.`,
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('confirm-delete-habit'));

    await waitFor(() => expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 20 XP'));
    expect(toast()).toHaveTextContent('Habitude supprimée · −25 XP');
  });
});

describe('DayViewScreen in pixel art (#72)', () => {
  const hidden = { includeHiddenElements: true };
  const names = ['Cuisiner', 'Budget du jour', 'Courir 5 km', 'Me coucher avant 23 h', 'Lire'];
  const sky = () => screen.getByTestId('day-sky', hidden).props.sprite as string;
  const switchOf = (name: string) =>
    screen.getByRole('switch', { name: new RegExp(`^${name}, `, 'u') });

  async function twoOfFiveDone() {
    await given(...names);
    await toggleCheckIn(dependencies, 1, wednesday);
    await toggleCheckIn(dependencies, 2, wednesday);
    await show();
    await screen.findByText('Cuisiner');
  }

  afterEach(() => {
    jest.useRealTimers();
  });

  it('dresses the day view in the pixel art identity', async () => {
    await twoOfFiveDone();

    expect(screen.getByTestId('day-view')).toHaveStyle({ backgroundColor: roles.night });
    expect(screen.getByRole('header', { name: 'Aujourd’hui' })).toHaveStyle({
      fontFamily: 'PixelifySans_700Bold',
    });
    expect(screen.getByText('2/5')).toHaveStyle({
      fontFamily: 'PixelifySans_700Bold',
      fontSize: 22,
    });
    expect(screen.getByText('faites')).toHaveStyle({ fontSize: 18 });
    expect(screen.getByText('Cuisiner')).toHaveStyle({ fontFamily: 'Inter_600SemiBold' });
    screen
      .getAllByTestId(/^(day-sky|character-sprite)$/u, hidden)
      .forEach((sprite) => expect([2, 3]).toContain(sprite.props.scale));
  });

  it('lights the day sky one notch with a third habit done, and raises the sun when all are done', async () => {
    await twoOfFiveDone();
    await waitFor(() => expect(sky()).toMatch(/^day-sky:0\.4:/u));

    await fireEvent.press(switchOf('Courir 5 km'));
    await waitFor(() => expect(sky()).toMatch(/^day-sky:0\.6:/u));

    await fireEvent.press(switchOf('Me coucher avant 23 h'));
    await waitFor(() => expect(screen.getByText('4/5')).toBeOnTheScreen());
    await fireEvent.press(switchOf('Lire'));
    await waitFor(() => expect(sky()).toMatch(/^day-sky:1:/u));
    expect(screen.getByText('Toutes faites')).toHaveStyle({ fontFamily: 'PixelifySans_700Bold' });
  });

  it('waits for the first habit with the character at ×3 under a night sky, and a single button', async () => {
    await show();
    await screen.findByTestId('day-view-empty');

    expect(screen.getByTestId('illustration-character', hidden).props.scale).toBe(3);
    await waitFor(() => expect(sky()).toMatch(/^day-sky:0:/u));
    expect(screen.getAllByRole('button', { name: 'Ajouter une habitude' })).toHaveLength(1);
  });

  it('shows the alert emblem, the message in the text font and « Réessayer » when the habits cannot be read', async () => {
    dependencies.unitOfWork.failReads();
    await show();

    await screen.findByTestId('day-view-error');
    expect(screen.getByTestId('illustration-alert', hidden).props.sprite).toBe('alert-emblem');
    expect(
      screen.getByText('Une erreur est survenue en lisant tes données sur ce téléphone.'),
    ).toHaveStyle({
      fontFamily: 'Inter_400Regular',
    });
    expect(screen.getByRole('button', { name: 'Réessayer' })).toHaveStyle({ minHeight: 48 });
  });

  it('plays the game feedback of a habit done: spark, check, pill, experience and counter', async () => {
    withMotion();
    await createHabit(dependencies, 'Cuisiner');
    await createHabit(dependencies, 'Lire');
    await show();
    await screen.findByText('Cuisiner');
    await waitFor(() => expect(screen.getByTestId('xp-counter')).toHaveTextContent('0 XP'));

    await fireEvent.press(switchOf('Cuisiner'));

    expect(screen.getByTestId('habit-burst', hidden).props.sprite).toBe('burst-0');
    await waitFor(() => expect(screen.getByTestId('xp-counter')).toHaveTextContent('10 XP'));
    expect(screen.getByTestId('check-mark', hidden)).toBeTruthy();
    expect(screen.getByTestId('xp-change', hidden)).toHaveTextContent('+10 XP');
    expect(screen.getByLabelText('1 habitude faite sur 2 attendues')).toBeOnTheScreen();
    expect(dependencies.haptics.success).toHaveBeenCalledTimes(1);
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      '+10 points d’expérience. Total : 10 XP.',
    );
  });

  it('plays no spark when a failed save puts « fait » back on the row', async () => {
    withMotion();
    await createHabit(dependencies, 'Cuisiner');
    await toggleCheckIn(dependencies, 1, wednesday);
    await show();
    await waitFor(() => expect(screen.getByTestId('xp-counter')).toHaveTextContent('10 XP'));
    dependencies.unitOfWork.failWrites();

    await fireEvent.press(switchOf('Cuisiner'));

    await screen.findByText('Le suivi n’a pas été enregistré.');
    await waitFor(() => expect(switchOf('Cuisiner')).toBeChecked());
    expect(screen.queryByTestId('habit-burst', hidden)).toBeNull();
  });

  it('shows « −10 XP » in grey, without spark nor vibration, when a habit goes back', async () => {
    withMotion();
    await createHabit(dependencies, 'Cuisiner');
    await toggleCheckIn(dependencies, 1, wednesday);
    await show();
    await waitFor(() => expect(screen.getByTestId('xp-counter')).toHaveTextContent('10 XP'));

    await fireEvent.press(switchOf('Cuisiner'));

    await waitFor(() => expect(screen.getByTestId('xp-counter')).toHaveTextContent('0 XP'));
    expect(screen.queryByTestId('habit-burst', hidden)).toBeNull();
    expect(screen.getByTestId('xp-float', hidden)).toHaveTextContent('−10 XP');
    expect(dependencies.haptics.success).not.toHaveBeenCalled();
    expect(screen.getByTestId('habit-check-1', hidden)).toHaveStyle({ borderColor: roles.gold });
  });

  it('puts everything back, without any bonus, when a check-in is not saved', async () => {
    await createHabit(dependencies, 'Cuisiner', 'medium', 1);
    await show();
    await screen.findByText('Cuisiner');
    dependencies.unitOfWork.failWrites();

    await fireEvent.press(switchOf('Cuisiner'));

    await waitFor(() =>
      expect(screen.getByTestId('toast')).toHaveTextContent(/^Le suivi n’a pas été enregistré\./u),
    );
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeOnTheScreen();
    expect(switchOf('Cuisiner')).not.toBeChecked();
    expect(screen.getByTestId('xp-counter')).toHaveTextContent('0 XP');
    expect(screen.queryByTestId('xp-change-bonus', hidden)).toBeNull();
    expect(screen.queryByTestId('habit-target-reached-1', hidden)).toBeNull();
  });

  it('shows the final states at once when the motion is reduced', async () => {
    await createHabit(dependencies, 'Courir 5 km', 'hard', 1);
    await show();
    await screen.findByText('Courir 5 km');

    await fireEvent.press(switchOf('Courir 5 km'));

    await waitFor(() => expect(screen.getByTestId('habit-target-reached-1', hidden)).toBeTruthy());
    expect(screen.queryByTestId('habit-burst', hidden)).toBeNull();
    expect(screen.queryByTestId('xp-float', hidden)).toBeNull();
    expect(screen.getByTestId('xp-change', hidden)).toHaveTextContent('+20 XP');
    expect(screen.getByTestId('habit-target-reached-1', hidden)).toHaveStyle({
      borderColor: roles.goldDark,
    });
    expect(dependencies.haptics.success).toHaveBeenCalledTimes(2);
  });

  it('lets the text grow at 200 %, pixel font included, without scaling any sprite', async () => {
    Dimensions.set({
      window: { ...Dimensions.get('window'), fontScale: 2 },
      screen: { ...Dimensions.get('screen'), fontScale: 2 },
    });
    await twoOfFiveDone();

    [screen.getByRole('header', { name: 'Aujourd’hui' }), screen.getByText('2/5')].forEach(
      (text) => {
        expect(text.props.numberOfLines).toBeUndefined();
        expect(text.props.adjustsFontSizeToFit).toBeUndefined();
        expect(text.props.allowFontScaling).not.toBe(false);
      },
    );
    screen
      .getAllByTestId(/^(day-sky|character-sprite)$/u, hidden)
      .forEach((sprite) => expect(sprite.props.scale).toBe(2));
  });
});

describe('listBottomSpaceOf', () => {
  it('reserves the bottom of the screen, the floating button and a gap', () => {
    expect(listBottomSpaceOf(56)).toBe(80);
    expect(listBottomSpaceOf(100)).toBe(124);
  });

  it('reserves the room of a 56 dp button before it is measured', () => {
    expect(listBottomSpaceOf(undefined)).toBe(80);
  });
});

describe('revealOffsetOf', () => {
  it('scrolls just enough to see the bottom of the row above the button, on a 320 × 640 screen', () => {
    expect(revealOffsetOf({ y: 280, height: 76 }, { offset: 0, height: 360 }, 80)).toBe(76);
  });

  it('does not scroll for a row already seen above the button', () => {
    expect(revealOffsetOf({ y: 180, height: 76 }, { offset: 0, height: 360 }, 80)).toBeNull();
    expect(revealOffsetOf({ y: 204, height: 76 }, { offset: 0, height: 360 }, 80)).toBeNull();
  });

  it('waits for the height of the list to be known', () => {
    expect(revealOffsetOf({ y: 280, height: 76 }, { offset: 0, height: 0 }, 80)).toBeNull();
  });

  it('counts the scrolling already done', () => {
    expect(revealOffsetOf({ y: 280, height: 76 }, { offset: 100, height: 360 }, 80)).toBeNull();
  });
});
