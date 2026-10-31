import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import type { InMemoryUnitOfWork } from '../../../application/testing/InMemoryUnitOfWork';
import { GAUGE_SEAL_KEY } from '../../../application/useCases/fateGauge';
import { startAscent, type Ascent } from '../../../domain/ascent/Ascent';
import { Day } from '../../../domain/day/Day';
import { HabitName } from '../../../domain/habit/HabitName';
import { ascentSetUp } from '../testing/ascent';
import { renderScreen } from '../testing/renderScreen';
import { TowerFootScreen } from './TowerFootScreen';

async function show(options: Parameters<typeof ascentSetUp>[0] = {}) {
  const setUp = ascentSetUp(options);
  const onEnter = jest.fn();
  await renderScreen(
    <TowerFootScreen session={setUp.session} onEnter={onEnter} />,
    setUp.dependencies,
  );
  return { ...setUp, onEnter };
}

describe('TowerFootScreen', () => {
  it('starts an ascent with the chosen hero, from the tower foot', async () => {
    const { session, onEnter } = await show({ seed: 42 });

    await fireEvent.press(await screen.findByRole('button', { name: "Commencer l'ascension" }));
    expect(screen.getByRole('header', { name: 'Choisir un héros' })).toBeOnTheScreen();
    expect(screen.getByText("Il ne change plus jusqu'à la fin de l'ascension.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: /^L'Errante/ }));
    await fireEvent.press(screen.getByRole('button', { name: "Continuer avec l'Errante" }));

    expect(session.current()).toEqual(startAscent(42, { hero: 'wanderer' }));
    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it('goes back from the hero choice without starting an ascent', async () => {
    const { session } = await show();

    await fireEvent.press(await screen.findByRole('button', { name: "Commencer l'ascension" }));
    await fireEvent.press(screen.getByRole('button', { name: 'Retour' }));

    expect(session.current()).toBeNull();
    expect(screen.getByRole('button', { name: "Commencer l'ascension" })).toBeOnTheScreen();
  });

  it('shows the hero of the ascent in progress, without a way to change him', async () => {
    await show({ saved: startAscent(3, { hero: 'wanderer' }) });

    expect(await screen.findByText("L'Errante")).toBeOnTheScreen();
    expect(screen.queryByRole('radio')).not.toBeOnTheScreen();
  });

  it('only offers to resume or abandon while an ascent is in progress', async () => {
    const { onEnter } = await show({ saved: startAscent(3) });

    expect(await screen.findByRole('button', { name: "Reprendre l'ascension" })).toBeOnTheScreen();
    expect(screen.getByText('Palier 1 · Étage 1 sur 6 · 80/80 PV · 0 Or')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: "Commencer l'ascension" })).not.toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: "Reprendre l'ascension" }));
    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it('abandons the ascent after a confirmation, as a fall', async () => {
    const { session } = await show({ saved: { ...startAscent(3), gold: 12 } });

    fireEvent.press(await screen.findByRole('button', { name: "Abandonner l'ascension" }));
    fireEvent.press(await screen.findByRole('button', { name: 'Annuler' }));
    expect(session.current()?.outcome).toBeNull();

    fireEvent.press(await screen.findByRole('button', { name: "Abandonner l'ascension" }));
    const confirm = await screen.findByRole('button', { name: 'Abandonner' });
    await act(async () => {
      fireEvent.press(confirm);
    });

    expect(session.current()?.outcome).toBe('fall');
    expect(screen.getByText('Ascension terminée : 12 Or, perdus à la fin.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: "Commencer l'ascension" })).toBeOnTheScreen();
  });
});

describe('TowerFootScreen with the fate gauge (#93)', () => {
  const yesterday = Day.of(2026, 10, 26);

  async function showWithHabits(done: number, total: number) {
    const setUp = ascentSetUp({ seed: 42 });
    const unitOfWork = setUp.dependencies.unitOfWork as InMemoryUnitOfWork;
    for (let index = 0; index < total; index += 1) {
      await unitOfWork.run(async ({ habits, settingsChanges, checkIns }) => {
        const habit = await habits.add(HabitName.parse(`Habitude ${index}`), Day.of(2026, 10, 1));
        await settingsChanges.add(habit.id, Day.of(2026, 10, 1), {
          difficulty: 'medium',
          weeklyTarget: 7,
        });
        if (index < done) {
          await checkIns.save({ habitId: habit.id, day: yesterday, done: true, corrected: false });
        }
      });
    }
    const onEnter = jest.fn();
    await renderScreen(
      <TowerFootScreen session={setUp.session} onEnter={onEnter} />,
      setUp.dependencies,
    );
    return { ...setUp, onEnter };
  }

  it('shows the gauge of the day from yesterday, and launches the ascent with it', async () => {
    const { session, keyValueStore } = await showWithHabits(3, 4);

    expect(await screen.findByText('Jauge du jour : Faveur')).toBeOnTheScreen();
    expect(screen.getByText("D'après hier : 3 habitudes sur 4.")).toBeOnTheScreen();
    expect(screen.getByText('3 bénédictions de départ')).toBeOnTheScreen();
    expect(screen.queryByTestId('loadout-section')).toBeNull();

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: "Commencer l'ascension" }));
    });
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Continuer avec la Sentinelle' }));
    });

    expect(session.current()).toMatchObject({
      gauge: 1,
      blessingRarities: ['rare', 'rare', 'rare'],
    });
    expect(keyValueStore.values.get(GAUGE_SEAL_KEY)).toContain('"gauge":1');
  });

  it('tells the fatigue of a curse, and keeps the gauge of the ascent in progress', async () => {
    const { session } = await showWithHabits(1, 3);

    expect(await screen.findByText('Jauge du jour : Malédiction')).toBeOnTheScreen();
    expect(screen.getByText('Fatigue : PV max −10 %')).toBeOnTheScreen();

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: "Commencer l'ascension" }));
    });
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Continuer avec la Sentinelle' }));
    });
    await act(async () => {
      session.pause();
    });

    expect(screen.getByText("Jauge de l'ascension : Malédiction")).toBeOnTheScreen();
  });
});

describe('TowerFootScreen with the loadout (#159)', () => {
  const hidden = { includeHiddenElements: true } as const;

  function inProgress(blessings: Ascent['blessings'], boons: Ascent['hero']['boons']): Ascent {
    const ascent = startAscent(3);
    return { ...ascent, blessings, hero: { ...ascent.hero, boons } };
  }

  const THREE = inProgress(
    [{ family: 'haste', rarity: 'rare' }],
    ['perfectEcho', 'lingeringFrost'],
  );
  const MAX = inProgress(
    [
      { family: 'protection', rarity: 'epic' },
      { family: 'haste', rarity: 'rare' },
      { family: 'vigor', rarity: 'common' },
    ],
    ['perfectEcho', 'lingeringFrost', 'shatteringEmber', 'blazingEmber', 'emberHeart'],
  );

  it('shows the loadout in the frame of the ascent in progress, under the gauge', async () => {
    await show({ saved: THREE });

    const section = await screen.findByTestId('loadout-section');
    expect(within(section).getByText('Équipement · 3')).toBeOnTheScreen();
    expect(screen.getByLabelText('Bénédictions de départ : Hâte, Rare')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Bienfaits : Écho parfait, Commun ; Givre persistant, Rare'),
    ).toBeOnTheScreen();
    const frame = screen.getByTestId('tower-foot-ascent');
    expect(within(frame).getByText("Jauge de l'ascension : Neutre")).toBeOnTheScreen();
    expect(within(frame).getByTestId('loadout-section')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: "Reprendre l'ascension" })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: "Abandonner l'ascension" })).toBeOnTheScreen();
  });

  it('keeps « Reprendre » and « Abandonner » out of the scrolled frame, at the bottom', async () => {
    await show({ saved: MAX });

    const scroll = await screen.findByTestId('tower-foot-scroll');
    expect(within(scroll).getByTestId('loadout-section')).toBeOnTheScreen();
    expect(within(scroll).queryByRole('button', { name: "Reprendre l'ascension" })).toBeNull();
    expect(within(scroll).queryByRole('button', { name: "Abandonner l'ascension" })).toBeNull();
    expect(screen.getByRole('button', { name: "Reprendre l'ascension" })).toBeOnTheScreen();
  });

  it('hints « Fais défiler » on the longest build only', async () => {
    await show({ saved: MAX });
    expect(await screen.findByTestId('tower-foot-more', hidden)).toHaveTextContent(
      '▼ Fais défiler',
    );
  });

  it('hints nothing on a short build', async () => {
    await show({ saved: THREE });

    await screen.findByTestId('loadout-section');
    expect(screen.queryByTestId('tower-foot-more', hidden)).toBeNull();
  });

  it('opens the loadout sheet with « Voir le détail », without pausing, and gives the focus back on close', async () => {
    await show({ saved: THREE });
    const detail = await screen.findByRole('button', { name: "Voir le détail de l'Équipement" });

    await fireEvent.press(detail);

    expect(screen.getByRole('header', { name: 'Équipement' })).toBeOnTheScreen();
    expect(screen.queryByText('Combat en pause')).toBeNull();
    expect(screen.getAllByTestId('loadout-row')).toHaveLength(3);
    const focus = jest.mocked(AccessibilityInfo.sendAccessibilityEvent);
    focus.mockClear();

    await fireEvent.press(screen.getByRole('button', { name: 'Fermer' }));

    expect(screen.queryByRole('header', { name: 'Équipement' })).toBeNull();
    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus.mock.calls[0]?.[1]).toBe('focus');
    expect(focus.mock.calls[0]?.[0]).toMatchObject({ props: { testID: 'loadout-detail' } });
  });

  it('tells an empty loadout, without « Voir le détail »', async () => {
    await show({ saved: startAscent(3) });

    expect(await screen.findByText('Équipement · 0')).toBeOnTheScreen();
    expect(screen.getByText('Aucune bénédiction de départ')).toBeOnTheScreen();
    expect(screen.getByText('Aucun bienfait')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: "Voir le détail de l'Équipement" })).toBeNull();
  });

  it('keeps the confirmation of the abandon at the bottom', async () => {
    await show({ saved: THREE });

    await fireEvent.press(await screen.findByRole('button', { name: "Abandonner l'ascension" }));

    const scroll = screen.getByTestId('tower-foot-scroll');
    expect(within(scroll).queryByRole('button', { name: 'Abandonner' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Abandonner' })).toBeOnTheScreen();
    expect(screen.getByTestId('loadout-section')).toBeOnTheScreen();
  });

  it('shows no loadout before the ascent', async () => {
    await show();

    expect(await screen.findByRole('button', { name: "Commencer l'ascension" })).toBeOnTheScreen();
    expect(screen.queryByTestId('loadout-section')).toBeNull();
    expect(screen.queryByText(/Équipement/u)).toBeNull();
  });
});
