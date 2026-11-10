// Le menu des pouvoirs (#270, maquette 269, M1 à M13) : les deux héros en onglets, une ligne par
// pouvoir possédé, un seul « Valider » qui enregistre la mémoire des pouvoirs équipés des deux héros,
// le retour qui annule, les bandeaux, la lecture seule pendant une ascension et le chargement.
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import type { RefusalHaptics } from '../../../application/ports/RefusalHaptics';
import {
  CAMP_KEY,
  EQUIPPED_POWERS_KEY,
  NEW_POWERS_KEY,
  POWERS_MENU_SEEN_KEY,
} from '../../../application/useCases/CampSession';
import { OATHS_KEY } from '../../../application/useCases/oaths';
import type { HeroKind } from '../../../domain/battle/combatants';
import type { PowerKind } from '../../../domain/battle/powers';
import { Day } from '../../../domain/day/Day';
import { HabitName } from '../../../domain/habit/HabitName';
import { artPalette } from '../pixelArt/artPalette';
import { ascentSetUp } from '../testing/ascent';
import { reduceMotionInEachTest } from '../testing/motion';
import { renderScreen } from '../testing/renderScreen';
import { PowersMenuScreen } from './PowersMenuScreen';

const { roles } = artPalette;

reduceMotionInEachTest();

const ALL_WANDERER: readonly PowerKind[] = ['rend', 'mist', 'flurry', 'ambush'];
const ALL_SENTINEL: readonly PowerKind[] = [
  'retaliation',
  'holdFast',
  'shieldBash',
  'crushingBlow',
];

interface Options {
  readonly powers?: readonly PowerKind[];
  readonly remembered?: Partial<Record<HeroKind, readonly PowerKind[]>>;
  readonly hero?: HeroKind;
  readonly from?: 'tower' | 'choice';
  readonly menuSeen?: boolean;
  readonly newPowers?: readonly PowerKind[];
  readonly load?: boolean;
}

async function show({
  powers = ['retaliation', 'holdFast', ...ALL_WANDERER],
  remembered = { wanderer: ['shadowStep', 'rend', 'mist'] },
  hero = 'wanderer',
  from = 'tower',
  menuSeen = true,
  newPowers,
  load = true,
}: Options = {}) {
  const setUp = ascentSetUp({ shards: 200, powers });
  setUp.keyValueStore.values.set(
    EQUIPPED_POWERS_KEY,
    JSON.stringify({ version: 1, heroes: remembered }),
  );
  if (menuSeen) setUp.keyValueStore.values.set(POWERS_MENU_SEEN_KEY, '1');
  if (newPowers !== undefined) {
    setUp.keyValueStore.values.set(
      NEW_POWERS_KEY,
      JSON.stringify({ version: 1, powers: newPowers }),
    );
  }
  await setUp.session.load();
  let read: () => void = () => undefined;
  if (load) {
    await setUp.camp.load();
  } else {
    const get = setUp.keyValueStore.get;
    setUp.keyValueStore.get = (key) =>
      key === CAMP_KEY
        ? new Promise((resolve) => (read = () => void get(key).then(resolve)))
        : get(key);
  }
  const refusal: RefusalHaptics & { refusal: jest.Mock } = { refusal: jest.fn() };
  const onLeave = jest.fn();
  const onCamp = jest.fn();
  await renderScreen(
    <PowersMenuScreen
      camp={setUp.camp}
      session={setUp.session}
      hero={hero}
      from={from}
      refusal={refusal}
      onLeave={onLeave}
      onCamp={onCamp}
    />,
    setUp.dependencies,
  );
  if (load)
    await screen.findByTestId(`powers-menu-row-${hero === 'wanderer' ? 'shadowStep' : 'bulwark'}`);
  return { ...setUp, refusal, onLeave, onCamp, read: () => read() };
}

const row = (power: PowerKind) => screen.getByTestId(`powers-menu-row-${power}`);
const checked = (power: PowerKind) => row(power).props.accessibilityState?.checked as boolean;
const tab = (hero: HeroKind) => screen.getByTestId(`powers-menu-tab-${hero}`);
const band = () => screen.queryByTestId('powers-menu-band');
const valider = () => screen.getByTestId('powers-menu-validate');

async function toggle(...powers: PowerKind[]) {
  for (const power of powers) await fireEvent.press(row(power));
}

describe('PowersMenuScreen (#270)', () => {
  let announce: jest.SpyInstance;
  let focus: jest.SpyInstance;
  beforeEach(() => {
    announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
  });
  afterEach(() => {
    announce.mockRestore();
    focus.mockRestore();
  });

  it('presents both heroes in tabs and the powers of the open one, in the order of the tree (M1)', async () => {
    await show();

    expect(screen.getByRole('header', { name: 'Pouvoirs équipés' })).toBeOnTheScreen();
    expect(screen.getByText('Pour ta prochaine ascension')).toBeOnTheScreen();
    expect(within(tab('sentinel')).getByText('3/3')).toBeOnTheScreen();
    expect(within(tab('wanderer')).getByText('3/3')).toBeOnTheScreen();
    expect(tab('wanderer').props.accessibilityState).toEqual({ selected: true });
    expect(
      screen.getAllByTestId(/^powers-menu-row-[a-zA-Z]+$/u).map((each) => each.props.testID),
    ).toEqual([
      'powers-menu-row-shadowStep',
      'powers-menu-row-rend',
      'powers-menu-row-flurry',
      'powers-menu-row-mist',
      'powers-menu-row-ambush',
    ]);
    expect(checked('shadowStep')).toBe(true);
    expect(checked('flurry')).toBe(false);
    expect(screen.getByText("L'Errante · dans l'ordre de l'arbre")).toBeOnTheScreen();
    expect(screen.getByText('3 sur 3')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Retour au pied de la tour' })).toBeOnTheScreen();
  });

  it('checks and unchecks on a touch of the row, and announces the count', async () => {
    await show();

    await toggle('shadowStep');
    expect(checked('shadowStep')).toBe(false);
    expect(screen.getByText('2 sur 3')).toBeOnTheScreen();
    expect(screen.getByText('2 sur 3').props.accessibilityLiveRegion).toBe('polite');
    await toggle('flurry');
    expect(checked('flurry')).toBe(true);
  });

  it('refuses a 4th power, says what to do, vibrates and changes nothing (M2)', async () => {
    const { refusal } = await show();

    await toggle('flurry');

    expect(checked('flurry')).toBe(false);
    expect(['shadowStep', 'rend', 'mist'].map((power) => checked(power as PowerKind))).toEqual([
      true,
      true,
      true,
    ]);
    expect(
      within(band()!).getByText("3 sur 3 : retire d'abord un pouvoir pour équiper Rafale."),
    ).toBeOnTheScreen();
    expect(band()!.props.accessibilityLiveRegion).toBe('polite');
    expect(refusal.refusal).toHaveBeenCalledTimes(1);
  });

  it('waits for min(3, owned) powers on this tab, the count in gold (M3)', async () => {
    await show();

    await toggle('shadowStep');

    expect(within(tab('wanderer')).getByText('2/3')).toBeOnTheScreen();
    expect(
      StyleSheet.flatten(screen.getByTestId('powers-menu-tab-wanderer-badge').props.style)
        .backgroundColor,
    ).toBe(roles.gold);
    expect(valider()).toHaveTextContent('Choisis encore 1 pouvoir');
    expect(valider().props.accessibilityLabel).toBe(
      "Valider, indisponible : choisis encore 1 pouvoir pour l'Errante",
    );
    expect(valider().props.accessibilityState).toEqual({ disabled: true });
  });

  it('waits for the other hero too', async () => {
    await show({ powers: [...ALL_SENTINEL, ...ALL_WANDERER], hero: 'sentinel' });

    await toggle('bulwark');
    await fireEvent.press(tab('wanderer'));

    expect(valider()).toHaveTextContent('Sentinelle : choisis encore 1');
    expect(valider().props.accessibilityLabel).toBe(
      'Valider, indisponible : choisis encore 1 pouvoir pour la Sentinelle',
    );
    expect(valider().props.accessibilityState).toEqual({ disabled: true });
  });

  it('saves the choice of both heroes with one « Valider », announces each change, then leaves', async () => {
    const { keyValueStore, onLeave } = await show({
      powers: [...ALL_SENTINEL, ...ALL_WANDERER],
      hero: 'sentinel',
    });

    await toggle('bulwark', 'holdFast');
    await fireEvent.press(tab('wanderer'));
    await toggle('shadowStep', 'flurry');
    await fireEvent.press(valider());
    await act(async () => undefined);

    expect(JSON.parse(keyValueStore.values.get(EQUIPPED_POWERS_KEY)!).heroes).toEqual({
      sentinel: ['shieldBash', 'crushingBlow', 'holdFast'],
      wanderer: ['rend', 'flurry', 'mist'],
    });
    expect(announce).toHaveBeenCalledWith(
      '3 pouvoirs équipés pour la Sentinelle : Coup de bouclier, Fracas, Tenir bon.',
    );
    expect(announce).toHaveBeenCalledWith(
      "3 pouvoirs équipés pour l'Errante : Entaille, Rafale, Brume.",
    );
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('leaves without any write on the back, the draft dropped', async () => {
    const { keyValueStore, onLeave } = await show();
    const before = keyValueStore.values.get(EQUIPPED_POWERS_KEY);

    await toggle('shadowStep', 'flurry');
    await fireEvent.press(screen.getByRole('button', { name: 'Retour au pied de la tour' }));

    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(keyValueStore.values.get(EQUIPPED_POWERS_KEY)).toBe(before);
  });

  it('names its back after the Hero choice when opened from it (M13)', async () => {
    await show({ from: 'choice' });

    expect(screen.getByRole('button', { name: 'Retour au Choix du héros' })).toBeOnTheScreen();
  });

  it('keeps the choice on a failed save, alerts and focuses the band, then retries (M7)', async () => {
    const { keyValueStore, onLeave } = await show();
    const set = keyValueStore.set;
    keyValueStore.set = (key, value) =>
      key === EQUIPPED_POWERS_KEY ? Promise.reject(new Error('disk full')) : set(key, value);

    await toggle('shadowStep', 'flurry');
    await fireEvent.press(valider());
    await act(async () => undefined);

    const alert = screen.getByTestId('powers-menu-band');
    expect(alert.props.role).toBe('alert');
    expect(
      within(alert).getByText("Ton choix n'a pas pu être enregistré. Il est gardé ici : réessaie."),
    ).toBeOnTheScreen();
    expect(focus).toHaveBeenCalledWith(expect.anything(), 'focus');
    expect(checked('flurry')).toBe(true);
    expect(checked('shadowStep')).toBe(false);
    expect(valider()).toHaveTextContent('Réessayer');
    expect(onLeave).not.toHaveBeenCalled();

    keyValueStore.set = set;
    await fireEvent.press(valider());
    await act(async () => undefined);
    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(JSON.parse(keyValueStore.values.get(EQUIPPED_POWERS_KEY)!).heroes.wanderer).toEqual([
      'rend',
      'flurry',
      'mist',
    ]);
  });

  it('shows the powers of a hero with 3 or fewer as equipped by default, and « Le camp » (M4)', async () => {
    const { onCamp } = await show({
      powers: ['retaliation', 'rend', 'mist'],
      remembered: {},
      hero: 'sentinel',
    });

    expect(row('bulwark').props.accessibilityRole).toBeUndefined();
    expect(within(row('retaliation')).getByText('Équipé')).toBeOnTheScreen();
    expect(
      within(band()!).getByText(
        "Tes 2 pouvoirs sont équipés d'office : rien à choisir. À partir de 4, tu choisis tes 3.",
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('powers-menu-validate')).not.toBeOnTheScreen();
    expect(screen.getByText("D'autres pouvoirs se débloquent au camp.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Le camp' }));
    expect(onCamp).toHaveBeenCalledTimes(1);
  });

  it('keeps « Valider » when the other hero has 4 powers or more', async () => {
    await show({ powers: ['retaliation', ...ALL_WANDERER], hero: 'sentinel' });

    expect(screen.queryByRole('button', { name: 'Le camp' })).not.toBeOnTheScreen();
    expect(valider()).toHaveTextContent('Valider');
  });

  describe('with Oaths (M5, M6)', () => {
    async function withOaths() {
      const setUp = ascentSetUp({ shards: 0, powers: [...ALL_SENTINEL] });
      await setUp.dependencies.unitOfWork.run(async ({ habits, checkIns }) => {
        const run = await habits.add(HabitName.parse('Courir'), Day.of(2026, 10, 1));
        await habits.add(HabitName.parse('Lire'), Day.of(2026, 10, 1));
        await checkIns.save({
          habitId: run.id,
          day: Day.of(2026, 10, 26),
          done: true,
          corrected: false,
        });
      });
      setUp.keyValueStore.values.set(
        OATHS_KEY,
        JSON.stringify({
          version: 1,
          oaths: [
            { power: 'retaliation', habit: 1, since: '2026-10-20' },
            { power: 'holdFast', habit: 2, since: '2026-10-20' },
          ],
        }),
      );
      setUp.keyValueStore.values.set(
        EQUIPPED_POWERS_KEY,
        JSON.stringify({
          version: 1,
          heroes: { sentinel: ['bulwark', 'retaliation', 'holdFast'] },
        }),
      );
      setUp.keyValueStore.values.set(POWERS_MENU_SEEN_KEY, '1');
      await setUp.session.load();
      await setUp.camp.load();
      await renderScreen(
        <PowersMenuScreen
          camp={setUp.camp}
          session={setUp.session}
          hero="sentinel"
          from="tower"
          refusal={{ refusal: jest.fn() }}
          onLeave={jest.fn()}
          onCamp={jest.fn()}
        />,
        setUp.dependencies,
      );
      await screen.findByText("Attisé : « Courir » faite hier. 1 Élan pour toute l'ascension.");
    }

    it('shows the kindled power in ember, and a neutral line for an Oath not kept', async () => {
      await withOaths();

      expect(StyleSheet.flatten(row('retaliation').props.style).borderColor).toBe(roles.ember);
      expect(
        within(row('retaliation')).getByText('Attisé · 2 → 1 Élan · Instantané'),
      ).toBeOnTheScreen();
      expect(
        within(row('holdFast')).getByText(
          "Serment : « Lire » pas faite hier. Fais-la aujourd'hui, il sera attisé demain.",
        ),
      ).toBeOnTheScreen();
    });

    it('does not kindle an Oath power left aside, and says it in blue', async () => {
      await withOaths();

      await toggle('retaliation');

      expect(within(row('retaliation')).queryByText(/^Attisé/u)).not.toBeOnTheScreen();
      expect(
        within(row('retaliation')).getByText(
          'Serment tenu hier : équipé, il sera attisé (1 Élan).',
        ),
      ).toBeOnTheScreen();
    });
  });

  it('shows a new power that equipped itself in gold, with « nouveau » and a band (M8)', async () => {
    await show({
      powers: ['retaliation', 'holdFast', ...ALL_WANDERER],
      remembered: {
        sentinel: ['bulwark', 'retaliation'],
        wanderer: ['shadowStep', 'rend', 'mist'],
      },
      hero: 'sentinel',
      newPowers: ['holdFast'],
    });

    expect(within(row('holdFast')).getByText('Équipé')).toBeOnTheScreen();
    expect(within(row('holdFast')).getByText('nouveau')).toBeOnTheScreen();
    expect(StyleSheet.flatten(row('holdFast').props.style).borderColor).toBe(roles.gold);
    expect(
      within(band()!).getByText("Tenir bon s'est équipé tout seul : il restait une place."),
    ).toBeOnTheScreen();
  });

  it('shows a new power without a slot unchecked, with « nouveau », kept while the menu is open (M9)', async () => {
    const { camp, keyValueStore } = await show({ newPowers: ['flurry'] });

    expect(checked('flurry')).toBe(false);
    expect(within(row('flurry')).getByText('nouveau')).toBeOnTheScreen();
    expect(
      within(band()!).getByText(
        'Rafale est à toi, pas encore équipé : retire un pouvoir pour lui faire une place.',
      ),
    ).toBeOnTheScreen();
    expect(camp.view().newPowers.wanderer.waiting).toEqual([]);
    expect(JSON.parse(keyValueStore.values.get(NEW_POWERS_KEY)!).powers).toEqual([]);
  });

  it('opens once with the band of the first opening (M12)', async () => {
    const { camp, keyValueStore } = await show({ menuSeen: false });

    expect(
      within(band()!).getByText(
        "Nouveau : tes pouvoirs se préparent ici, avant chaque ascension. Ils sont gardés d'une fois sur l'autre.",
      ),
    ).toBeOnTheScreen();
    expect(camp.view().powersMenuSeen).toBe(true);
    expect(keyValueStore.values.get(POWERS_MENU_SEEN_KEY)).toBe('1');
  });

  it('shows no band of the first opening once it has been opened', async () => {
    await show();

    expect(band()).not.toBeOnTheScreen();
  });

  it('is read-only during an ascent, in both tabs (M10)', async () => {
    const setUp = ascentSetUp({ shards: 0, powers: [...ALL_SENTINEL, ...ALL_WANDERER] });
    await setUp.session.load();
    await setUp.camp.load();
    await setUp.camp.launchAscent({ hero: 'sentinel' });
    await renderScreen(
      <PowersMenuScreen
        camp={setUp.camp}
        session={setUp.session}
        hero="sentinel"
        from="tower"
        refusal={{ refusal: jest.fn() }}
        onLeave={jest.fn()}
        onCamp={jest.fn()}
      />,
      setUp.dependencies,
    );
    await screen.findByTestId('powers-menu-row-bulwark');

    expect(screen.getByText('Ascension en cours')).toBeOnTheScreen();
    expect(
      within(band()!).getByText(
        "Ascension en cours. La Sentinelle garde ces pouvoirs jusqu'à sa fin. Tu pourras les changer pour la prochaine.",
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByTestId('powers-menu-tab-sentinel-lock', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(within(row('bulwark')).getByText('Fixé')).toBeOnTheScreen();
    expect(screen.queryAllByRole('checkbox')).toEqual([]);
    expect(screen.getByText("Ils sont aussi dans l'Équipement de l'ascension.")).toBeOnTheScreen();
    expect(screen.queryByTestId('powers-menu-validate')).not.toBeOnTheScreen();

    await fireEvent.press(tab('wanderer'));
    expect(screen.queryAllByRole('checkbox')).toEqual([]);
    expect(within(row('shadowStep')).getByText('Fixé')).toBeOnTheScreen();
    expect(setUp.camp.view().powersMenuSeen).toBe(false);
  });

  it('shows gray blocks and waits while the camp is read (M11)', async () => {
    const { read } = await show({ load: false });

    expect(
      screen.getAllByTestId('powers-menu-skeleton', { includeHiddenElements: true }),
    ).toHaveLength(4);
    expect(valider()).toHaveTextContent('Valider');
    expect(valider().props.accessibilityState).toEqual({ disabled: true });
    read();
    expect(await screen.findByTestId('powers-menu-row-shadowStep')).toBeOnTheScreen();
  });
});
