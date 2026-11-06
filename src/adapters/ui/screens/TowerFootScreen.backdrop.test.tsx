// Le décor du palier derrière le pied de la tour (#233, maquette 208 section 6 : D1 à D3, J1, J2,
// T1). Le canevas Skia du décor est simulé (`battle/testing/fakeTierBackdrop.tsx`) : la
// simulation expose son palier et le bas de l'en-tête qu'elle reçoit. Ici, la simulation peut
// aussi être retirée, pour comparer ce que lit le lecteur d'écran avec et sans décor.
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { View } from 'react-native';

import type { InMemoryUnitOfWork } from '../../../application/testing/InMemoryUnitOfWork';
import { abandonAscent, startAscent, type Ascent } from '../../../domain/ascent/Ascent';
import { Day } from '../../../domain/day/Day';
import { HabitName } from '../../../domain/habit/HabitName';
import { artPalette } from '../pixelArt/artPalette';
import { ascentSetUp } from '../testing/ascent';
import { fakeLogExport } from '../testing/fakeLogExport';
import { renderScreen } from '../testing/renderScreen';
import { TowerFootScreen } from './TowerFootScreen';

let mockDecor = true;
jest.mock('../battle/TierBackdrop', () => {
  const fake = jest.requireActual('../battle/testing/fakeTierBackdrop');
  return {
    ...fake,
    TowerFootBackdrop: (props: object) => (mockDecor ? fake.TowerFootBackdrop(props) : null),
  };
});

type MeasureInWindow = (
  callback: (x: number, y: number, width: number, height: number) => void,
) => void;

const { roles } = artPalette;
const hidden = { includeHiddenElements: true } as const;
const YESTERDAY = Day.of(2026, 10, 26);
const CREATED = Day.of(2026, 10, 1);
/** Le nombre d'habitudes faites hier, sur 4 attendues, pour chaque valeur de la jauge. */
const DONE_FOR_GAUGE = { 2: 4, 1: 3, 0: 2, [-2]: 0 } as const;

/** Une ascension au palier `tier`, en cours ou finie (`outcome`). */
const at = (tier: Ascent['tier'], outcome: Ascent['outcome'] = null, keys = 0): Ascent => ({
  ...startAscent(3, { gauge: 1 }),
  tier,
  outcome,
  keys,
});

async function show({
  saved,
  gauge,
  logExport = false,
}: { saved?: Ascent; gauge?: keyof typeof DONE_FOR_GAUGE; logExport?: boolean } = {}) {
  const setUp = ascentSetUp(saved === undefined ? {} : { saved });
  if (gauge !== undefined) {
    const unitOfWork = setUp.dependencies.unitOfWork as InMemoryUnitOfWork;
    for (let index = 0; index < 4; index += 1) {
      await unitOfWork.run(async ({ habits, settingsChanges, checkIns }) => {
        const habit = await habits.add(HabitName.parse(`Habitude ${index + 1}`), CREATED);
        await settingsChanges.add(habit.id, CREATED, { difficulty: 'medium', weeklyTarget: 7 });
        if (index < DONE_FOR_GAUGE[gauge]) {
          await checkIns.save({ habitId: habit.id, day: YESTERDAY, done: true, corrected: false });
        }
      });
    }
  }
  await renderScreen(
    <TowerFootScreen
      session={setUp.session}
      camp={setUp.camp}
      onEnter={jest.fn()}
      onCamp={jest.fn()}
      logExport={logExport ? fakeLogExport({ count: 3, inProgress: false }).logExport : undefined}
    />,
    setUp.dependencies,
  );
  await screen.findByRole('button', { name: /Commencer l'ascension|Reprendre l'ascension/u });
  if (gauge !== undefined && saved?.outcome !== null) await screen.findByTestId('gauge-card');
  if (gauge !== undefined && saved?.outcome === null) {
    await screen.findByText(/prochaine ascension/u);
  }
  if (logExport) await screen.findByText('3 ascensions', hidden);
  // Les lectures en attente (l'expérience de l'en-tête) se terminent avant la suite du test.
  await act(async () => {});
  return setUp;
}

const backdrop = () => screen.getByTestId('tower-foot-backdrop', hidden);
const header = () => screen.getByTestId('tower-foot-header');

/** Ce que lit le lecteur d'écran, dans l'ordre : le rôle et le libellé (ou le texte) de chaque élément. */
function readOut(): string[] {
  const read: string[] = [];
  const visit = (node: NonNullable<typeof screen.root>) => {
    if (typeof node.type !== 'string') {
      node.children.forEach((child) => typeof child !== 'string' && visit(child));
      return;
    }
    const { props } = node;
    if (props.accessibilityElementsHidden === true) return;
    if (props.importantForAccessibility === 'no-hide-descendants') return;
    const role = (props.accessibilityRole ?? props.role) as string | undefined;
    const label = props.accessibilityLabel as string | undefined;
    if (props.accessible === true || role !== undefined || label !== undefined) {
      read.push(`${role ?? '-'}: ${label ?? ''}`);
    }
    if ((node.type as string) === 'Text') {
      read.push(`text: ${node.children.filter((child) => typeof child === 'string').join('')}`);
    }
    node.children.forEach((child) => typeof child !== 'string' && visit(child));
  };
  if (screen.root !== null) visit(screen.root);
  return read;
}

afterEach(() => {
  mockDecor = true;
});

describe('TowerFootScreen on its tier backdrop', () => {
  it('sets the tower foot on the backdrop of the tier 1 without any ascent (D1)', async () => {
    await show();

    expect(backdrop()).toHaveProp('tier', 1);
    expect(screen.getByTestId('tower-foot')).toHaveStyle({ backgroundColor: 'transparent' });
  });

  it.each([
    ['a fall', at(3, 'fall')],
    ['an abandon', abandonAscent(at(3))],
    ['the Summit', at(3, 'victory')],
  ])(
    'sets it back on the tier 1 after an ascent ended at the tier 3 by %s',
    async (_end, saved) => {
      await show({ saved });

      expect(backdrop()).toHaveProp('tier', 1);
    },
  );

  it.each([1, 2, 3] as const)(
    'sets the tower foot on the backdrop of the tier %i of the ascent in progress (D2, T1)',
    async (tier) => {
      await show({ saved: at(tier) });

      expect(screen.getByTestId('tower-foot-ascent')).toBeOnTheScreen();
      expect(backdrop()).toHaveProp('tier', tier);
    },
  );

  it.each([2, 0, -2] as const)('keeps the tier 1 for a day gauge at %i (D3)', async (gauge) => {
    await show({ gauge });

    expect(backdrop()).toHaveProp('tier', 1);
    expect(backdrop()).toHaveProp('headerBottom', null);
  });

  it('veils the whole screen until the header is measured, then down to its measured bottom', async () => {
    const measure = jest
      .spyOn(
        (View as unknown as { prototype: { measureInWindow: MeasureInWindow } }).prototype,
        'measureInWindow',
      )
      .mockImplementation((callback) => callback(0, 40, 390, 116));
    try {
      await show();
      expect(backdrop()).toHaveProp('headerBottom', null);

      await fireEvent(header(), 'layout', {
        nativeEvent: { layout: { x: 0, y: 40, width: 390, height: 116 } },
      });
      expect(backdrop()).toHaveProp('headerBottom', 156);

      // Le contenu centré bouge (jauge, bande « jauge changée ») : l'en-tête est remesuré.
      measure.mockImplementation((callback) => callback(0, 90, 390, 116));
      await fireEvent(header(), 'layout', {
        nativeEvent: { layout: { x: 0, y: 90, width: 390, height: 116 } },
      });
      expect(backdrop()).toHaveProp('headerBottom', 206);
    } finally {
      measure.mockRestore();
    }
  });

  it('measures the header of the ascent in progress too', async () => {
    const measure = jest
      .spyOn(
        (View as unknown as { prototype: { measureInWindow: MeasureInWindow } }).prototype,
        'measureInWindow',
      )
      .mockImplementation((callback) => callback(0, 16, 390, 120));
    try {
      await show({ saved: at(2) });
      await fireEvent(header(), 'layout', {
        nativeEvent: { layout: { x: 0, y: 16, width: 390, height: 120 } },
      });
      expect(backdrop()).toHaveProp('headerBottom', 136);
    } finally {
      measure.mockRestore();
    }
  });

  it('keeps the title, the Shards and the tier line in the measured header', async () => {
    await show();

    const inHeader = within(header());
    expect(inHeader.getByRole('header', { name: 'La tour' })).toBeOnTheScreen();
    expect(inHeader.getByTestId('tower-foot-shards')).toBeOnTheScreen();
    expect(inHeader.getByText('Palier 1 · les Catacombes · 6 étages')).toBeOnTheScreen();
    expect(header()).toHaveStyle({ gap: 12 });
  });

  it('hides the backdrop from the screen reader and from the touches', async () => {
    await show({ saved: at(2) });

    expect(backdrop()).toHaveProp('accessibilityElementsHidden', true);
    expect(backdrop()).toHaveProp('importantForAccessibility', 'no-hide-descendants');
    expect(backdrop()).toHaveProp('pointerEvents', 'none');
    expect(screen.queryByTestId('tower-foot-backdrop')).toBeNull();
  });

  it('sets the texts out of the header on a plate of the readability veil', async () => {
    await show({ saved: at(3, 'fall'), gauge: 1, logExport: true });

    expect(screen.getByText(/^Ascension terminée/u)).toHaveStyle({
      backgroundColor: roles.backdropVeil,
    });
    expect(screen.getByTestId('tower-foot-log-export')).toHaveStyle({
      backgroundColor: roles.backdropVeil,
    });
  });

  it('sets the next ascent line and the abandon confirmation on a plate too', async () => {
    await show({ saved: at(2), gauge: 1 });

    expect(screen.getByText(/prochaine ascension/iu)).toHaveStyle({
      backgroundColor: roles.backdropVeil,
    });
    await fireEvent.press(screen.getByRole('button', { name: "Abandonner l'ascension" }));
    expect(screen.getByText(/^Abandonner \?/u)).toHaveStyle({
      backgroundColor: roles.backdropVeil,
    });
  });

  it.each([
    ['before the ascent at +1, with its key (J1)', { gauge: 1 as const }],
    ['before the ascent at +2, with its key (J2)', { gauge: 2 as const }],
    ['during the ascent, with its keys (T1)', { saved: at(2, null, 2), gauge: 0 as const }],
    ['after an ascent, with the log export', { saved: at(3, 'fall'), logExport: true }],
  ])('is read out exactly as without the backdrop %s', async (_screen, options) => {
    await show(options);
    const withDecor = readOut();
    expect(backdrop()).toBeTruthy();
    await act(async () => screen.unmount());

    mockDecor = false;
    await show(options);
    expect(screen.queryByTestId('tower-foot-backdrop', hidden)).toBeNull();
    expect(readOut()).toEqual(withDecor);
    expect(withDecor.length).toBeGreaterThan(5);
  });
});
