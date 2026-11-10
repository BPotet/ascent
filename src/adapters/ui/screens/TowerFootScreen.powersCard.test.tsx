// La carte « Pouvoirs équipés » au pied de la tour (#270, maquette 269, T1, T4 à T8) : sous la jauge,
// elle ouvre le menu des pouvoirs ; elle dit un pouvoir en attente et la première visite, montre le
// héros parti pendant une ascension, attend le camp, et retourne les cases changées après « Valider ».
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import {
  CAMP_KEY,
  EQUIPPED_POWERS_KEY,
  NEW_POWERS_KEY,
  POWERS_CARD_SEEN_KEY,
} from '../../../application/useCases/CampSession';
import { OATHS_KEY } from '../../../application/useCases/oaths';
import { startAscent } from '../../../domain/ascent/Ascent';
import type { HeroKind } from '../../../domain/battle/combatants';
import type { PowerKind } from '../../../domain/battle/powers';
import { Day } from '../../../domain/day/Day';
import { HabitName } from '../../../domain/habit/HabitName';
import { artPalette } from '../pixelArt/artPalette';
import { ascentSetUp } from '../testing/ascent';
import { reduceMotionInEachTest } from '../testing/motion';
import { renderScreen } from '../testing/renderScreen';
import { TowerFootScreen } from './TowerFootScreen';

const { roles } = artPalette;

reduceMotionInEachTest();

interface Options {
  readonly powers?: readonly PowerKind[];
  readonly remembered?: Partial<Record<HeroKind, readonly PowerKind[]>>;
  readonly newPowers?: readonly PowerKind[];
  readonly cardSeen?: boolean;
  readonly saved?: NonNullable<Parameters<typeof ascentSetUp>[0]>['saved'];
}

async function show({
  powers = ['retaliation', 'holdFast', 'rend', 'mist', 'flurry'],
  remembered = {
    sentinel: ['bulwark', 'retaliation', 'holdFast'],
    wanderer: ['shadowStep', 'rend', 'mist'],
  },
  newPowers,
  cardSeen = true,
  saved,
}: Options = {}) {
  const setUp = ascentSetUp({ shards: 0, powers, ...(saved !== undefined && { saved }) });
  setUp.keyValueStore.values.set(
    EQUIPPED_POWERS_KEY,
    JSON.stringify({ version: 1, heroes: remembered }),
  );
  if (cardSeen) setUp.keyValueStore.values.set(POWERS_CARD_SEEN_KEY, '1');
  if (newPowers !== undefined) {
    setUp.keyValueStore.values.set(
      NEW_POWERS_KEY,
      JSON.stringify({ version: 1, powers: newPowers }),
    );
  }
  const onOpenPowers = jest.fn();
  const element = (focused: boolean) => (
    <TowerFootScreen
      session={setUp.session}
      camp={setUp.camp}
      onEnter={jest.fn()}
      onCamp={jest.fn()}
      onOpenPowers={onOpenPowers}
      focused={focused}
    />
  );
  const view = await renderScreen(element(true), setUp.dependencies);
  await screen.findByTestId('equipped-powers-card');
  /** Le joueur quitte le pied de la tour (le menu, le camp), puis y revient. */
  const leave = async () => {
    await view.rerender(element(false));
    await act(async () => undefined);
  };
  const back = async () => {
    await view.rerender(element(true));
    await act(async () => undefined);
  };
  return { ...setUp, onOpenPowers, leave, back };
}

const card = () => screen.getByTestId('equipped-powers-card');
const cells = (hero: HeroKind) =>
  within(screen.getByTestId(`powers-card-row-${hero}`))
    .getAllByTestId(/^powers-card-(cell|free)-/u)
    .map((cell) => cell.props.testID as string);

describe('TowerFootScreen: the card of the equipped powers (#270)', () => {
  it('shows what each hero takes under the gauge, and opens the menu on the Sentinel (T1)', async () => {
    const { onOpenPowers } = await show();

    expect(await screen.findByTestId('gauge-card')).toBeOnTheScreen();
    const order = screen
      .getAllByTestId(/^(gauge-card|equipped-powers-card)$/u)
      .map((each) => each.props.testID);
    expect(order).toEqual(['gauge-card', 'equipped-powers-card']);
    expect(cells('sentinel')).toEqual([
      'powers-card-cell-bulwark',
      'powers-card-cell-retaliation',
      'powers-card-cell-holdFast',
    ]);
    expect(cells('wanderer')).toEqual([
      'powers-card-cell-shadowStep',
      'powers-card-cell-rend',
      'powers-card-cell-mist',
    ]);
    expect(within(card()).getAllByText('3 sur 3')).toHaveLength(2);
    expect(within(card()).getByText('Changer')).toBeOnTheScreen();

    await fireEvent.press(card());
    expect(onOpenPowers).toHaveBeenCalledWith({ hero: 'sentinel', from: 'tower' });
  });

  it('shows the preselection when nothing was validated', async () => {
    await show({ powers: ['retaliation', 'holdFast', 'shieldBash'], remembered: {} });

    expect(cells('sentinel')).toEqual([
      'powers-card-cell-bulwark',
      'powers-card-cell-shieldBash',
      'powers-card-cell-retaliation',
    ]);
  });

  it('says that a power waits for a slot until the menu is opened, and opens its hero (T4)', async () => {
    const { onOpenPowers, camp, leave, back } = await show({ newPowers: ['flurry'] });

    expect(
      within(screen.getByTestId('powers-card-waiting-flurry')).getByText(
        'Rafale attend une place.',
      ),
    ).toBeOnTheScreen();
    expect(card().props.accessibilityLabel).toContain('Nouveau : Rafale attend une place.');
    await fireEvent.press(card());
    expect(onOpenPowers).toHaveBeenCalledWith({ hero: 'wanderer', from: 'tower' });

    await leave();
    await camp.markPowersMenuSeen();
    await back();
    expect(screen.queryByTestId('powers-card-waiting-flurry')).not.toBeOnTheScreen();
  });

  it('carries « nouveau » on the first visit only (T8)', async () => {
    const { camp, keyValueStore, leave, back } = await show({ cardSeen: false });

    expect(within(screen.getByTestId('powers-card-head')).getByText('nouveau')).toBeOnTheScreen();
    expect(camp.view().powersCardSeen).toBe(true);
    expect(keyValueStore.values.get(POWERS_CARD_SEEN_KEY)).toBe('1');

    await leave();
    await back();
    expect(within(screen.getByTestId('powers-card-head')).queryByText('nouveau')).toBeNull();
  });

  it('turns the changed cells over, framed in gold, and focuses the card after « Valider » (T5)', async () => {
    const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
    try {
      const { camp, leave, back } = await show();

      await leave();
      expect(
        await camp.equipPowers({
          sentinel: ['bulwark', 'retaliation', 'holdFast'],
          wanderer: ['rend', 'flurry', 'mist'],
        }),
      ).toBe('equipped');
      await back();

      expect(cells('wanderer')).toEqual([
        'powers-card-cell-rend',
        'powers-card-cell-flurry',
        'powers-card-cell-mist',
      ]);
      expect(screen.getByTestId('powers-card-flip-flurry')).toBeOnTheScreen();
      expect(screen.queryByTestId('powers-card-flip-rend')).not.toBeOnTheScreen();
      expect(
        StyleSheet.flatten(screen.getByTestId('powers-card-cell-flurry').props.style).borderColor,
      ).toBe(roles.gold);
      expect(focus).toHaveBeenCalledWith(expect.anything(), 'focus');

      await leave();
      await back();
      expect(screen.queryByTestId('powers-card-flip-flurry')).not.toBeOnTheScreen();
    } finally {
      focus.mockRestore();
    }
  });

  it('shows the hero of the ascent alone, his powers locked, and opens his tab (T6)', async () => {
    const setUp = ascentSetUp({
      shards: 0,
      powers: ['retaliation', 'holdFast'],
      saved: startAscent(3, {
        hero: 'sentinel',
        powers: ['bulwark', 'retaliation', 'holdFast'],
        kindled: [{ power: 'retaliation', habit: 1 }],
      }),
    });
    const onOpenPowers = jest.fn();
    await renderScreen(
      <TowerFootScreen
        session={setUp.session}
        camp={setUp.camp}
        onEnter={jest.fn()}
        onCamp={jest.fn()}
        onOpenPowers={onOpenPowers}
      />,
      setUp.dependencies,
    );

    await screen.findByTestId('equipped-powers-card');
    expect(screen.queryByTestId('powers-card-row-wanderer')).not.toBeOnTheScreen();
    expect(within(card()).getByText('Voir')).toBeOnTheScreen();
    expect(
      screen.getByTestId('powers-card-lock', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(
      StyleSheet.flatten(screen.getByTestId('powers-card-cell-retaliation').props.style)
        .borderColor,
    ).toBe(roles.ember);
    await fireEvent.press(card());
    expect(onOpenPowers).toHaveBeenCalledWith({ hero: 'sentinel', from: 'tower' });
  });

  it('shows a gray block and waits to start while the camp is read (T7)', async () => {
    const setUp = ascentSetUp({ shards: 0 });
    let read: () => void = () => undefined;
    const get = setUp.keyValueStore.get;
    setUp.keyValueStore.get = (key) =>
      key === CAMP_KEY
        ? new Promise((resolve) => (read = () => void get(key).then(resolve)))
        : get(key);
    await renderScreen(
      <TowerFootScreen
        session={setUp.session}
        camp={setUp.camp}
        onEnter={jest.fn()}
        onCamp={jest.fn()}
      />,
      setUp.dependencies,
    );
    await screen.findByTestId('gauge-card');

    expect(
      screen.getByTestId('powers-card-loading', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: "Commencer l'ascension" })).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ disabled: true }),
    );
    expect(screen.queryByTestId('tower-foot-shards')).not.toBeOnTheScreen();

    read();
    expect(await screen.findByTestId('equipped-powers-card')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: "Commencer l'ascension" })).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ disabled: false }),
    );
  });

  it('shows nothing of the tower foot before an ascent in progress while the camp is read', async () => {
    const setUp = ascentSetUp({ shards: 0, saved: startAscent(3) });
    const get = setUp.keyValueStore.get;
    setUp.keyValueStore.get = (key) => (key === CAMP_KEY ? new Promise(() => undefined) : get(key));
    await renderScreen(
      <TowerFootScreen
        session={setUp.session}
        camp={setUp.camp}
        onEnter={jest.fn()}
        onCamp={jest.fn()}
      />,
      setUp.dependencies,
    );
    await act(async () => {
      await setUp.session.load();
    });

    expect(screen.queryByRole('button', { name: "Commencer l'ascension" })).not.toBeOnTheScreen();
    expect(screen.queryByTestId('powers-card-loading')).not.toBeOnTheScreen();
  });

  it('says « attisé » for a kindled power of the preselection', async () => {
    const setUp = ascentSetUp({ shards: 0, powers: ['retaliation', 'holdFast'] });
    await setUp.dependencies.unitOfWork.run(async ({ habits, checkIns }) => {
      const habit = await habits.add(HabitName.parse('Courir'), Day.of(2026, 10, 1));
      await checkIns.save({
        habitId: habit.id,
        day: Day.of(2026, 10, 26),
        done: true,
        corrected: false,
      });
    });
    setUp.keyValueStore.values.set(
      OATHS_KEY,
      JSON.stringify({
        version: 1,
        oaths: [{ power: 'retaliation', habit: 1, since: '2026-10-20' }],
      }),
    );
    await renderScreen(
      <TowerFootScreen
        session={setUp.session}
        camp={setUp.camp}
        onEnter={jest.fn()}
        onCamp={jest.fn()}
      />,
      setUp.dependencies,
    );

    expect(
      await screen.findByLabelText(/La Sentinelle : Rempart, Représailles, attisé, Tenir bon\./u),
    ).toBeOnTheScreen();
  });
});
