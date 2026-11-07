/**
 * « Le décor du palier derrière le pied de la tour » (#233) à l'écran : une vraie session
 * d'ascension sur un Stockage clé-valeur en mémoire (`ascentSetUp`, aujourd'hui le mardi 27 octobre
 * 2026), et le vrai écran du pied de la tour. Le canevas Skia du décor est remplacé par sa
 * simulation (`battle/testing/fakeTierBackdrop.tsx`), qui expose son palier et le bas de l'en-tête
 * qu'elle reçoit ; ici, elle peut aussi être retirée, pour l'écran « sans le décor ».
 *
 * Correspondance des libellés :
 * - « le fond du palier 1, les Catacombes » : `tower-foot-backdrop` au palier 1, dont l'image est
 *   celle du combat (`TIER_BACKDROPS`, même registre, même placement : `backdropPlacement`) ;
 * - « la jauge du jour vaut +2, 0 ou −2 » : 4, 2 ou 0 habitudes « fait » hier sur 4 attendues ;
 * - « un voile de la nuit […] puis s'allège » : le voile fort (`roles.towerFootVeil`) jusqu'au bas
 *   mesuré de l'en-tête (titre, Éclats, ligne du palier), puis le voile léger ;
 * - « au pire pixel » : chaque teinte de chaque fond sous le voile, avec chaque couleur de texte de
 *   l'en-tête et de la barre d'état ; les textes hors de l'en-tête sont sur une plaque du Voile de
 *   lisibilité ;
 * - « leur fond plein » : un fond opaque (`#RRGGBB`) sur le cadre et le bouton ; la barre d'onglets
 *   n'est pas dans l'écran, qui ne la touche pas ;
 * - « ne défile pas et ne s'anime pas » : le décor ne reçoit que son palier et le bas de l'en-tête,
 *   sans style ni valeur animée, hors du défilement ;
 * - « lu exactement comme aujourd'hui » : les rôles, libellés et textes accessibles, dans l'ordre,
 *   les mêmes que sans le décor ;
 * - « la même graine qu'en v0.4.0 » : la graine 42, 22 Éclats et une jauge à +1 ; « ceux qu'il aurait
 *   eus » : tout le stockage après le lancement, le même que sans le décor.
 */
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';
import { AccessibilityInfo, PixelRatio, StyleSheet, View } from 'react-native';

import type { InMemoryUnitOfWork } from '../../src/application/testing/InMemoryUnitOfWork';
import { startAscent, type Ascent } from '../../src/domain/ascent/Ascent';
import type { Tier } from '../../src/domain/ascent/tiers';
import { Day } from '../../src/domain/day/Day';
import { HabitName } from '../../src/domain/habit/HabitName';
import { backdropPlacement } from '../../src/adapters/ui/battle/scene/backdropPlacement';
import { towerFootVeil } from '../../src/adapters/ui/battle/scene/towerFootVeil';
import { TIER_NAMES, tierLine } from '../../src/adapters/ui/format/ascentText';
import { artPalette } from '../../src/adapters/ui/pixelArt/artPalette';
import { TIER_BACKDROPS } from '../../src/adapters/ui/pixelArt/sprites/battle/tierBackdrops';
import { TowerFootScreen } from '../../src/adapters/ui/screens/TowerFootScreen';
import { ascentSetUp } from '../../src/adapters/ui/testing/ascent';
import { contrast, underVeil } from '../../src/adapters/ui/testing/contrast';
import { renderScreen } from '../../src/adapters/ui/testing/renderScreen';

let mockDecor = true;
jest.mock('../../src/adapters/ui/battle/TierBackdrop', () => {
  const fake = jest.requireActual('../../src/adapters/ui/battle/testing/fakeTierBackdrop');
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
const TIERS = [1, 2, 3] as const;
const YESTERDAY = Day.of(2026, 10, 26);
const CREATED = Day.of(2026, 10, 1);
/** Le haut et la hauteur de l'en-tête mesuré dans la fenêtre (écran de 360 × 780 de la maquette). */
const HEADER = { top: 40, height: 116 };
const WINDOW = { width: 360, height: 780 };
/** Les textes de l'en-tête, et la barre d'état. */
const HEADER_TEXTS = [roles.light, roles.parchment, roles.gold, '#FFFFFF'];
/** Les textes posés sur une plaque hors de l'en-tête. */
const PLATE_TEXTS = [roles.light, roles.muted, roles.parchment, roles.gold, roles.error];

interface Options {
  saved?: Ascent;
  /** Habitudes « fait » hier, sur 4 attendues ; absent, aucune habitude. */
  done?: number;
  shards?: number;
}

let options: Options;
let setUp: ReturnType<typeof ascentSetUp>;
/** Les paliers du décor montrés, dans l'ordre. */
let shown: Tier[];
let measure: jest.SpyInstance | null = null;

/** Le vrai pied de la tour, sur une session neuve selon `options`, chargé. */
async function showTowerFoot(extra: Options = {}): Promise<void> {
  setUp = ascentSetUp({
    seed: 42,
    ...((extra.saved ?? options.saved) ? { saved: extra.saved ?? options.saved } : {}),
    ...(options.shards === undefined ? {} : { shards: options.shards }),
  });
  const done = extra.done ?? options.done;
  if (done !== undefined) {
    const unitOfWork = setUp.dependencies.unitOfWork as InMemoryUnitOfWork;
    for (let index = 0; index < 4; index += 1) {
      await unitOfWork.run(async ({ habits, settingsChanges, checkIns }) => {
        const habit = await habits.add(HabitName.parse(`Habitude ${index + 1}`), CREATED);
        await settingsChanges.add(habit.id, CREATED, { difficulty: 'medium', weeklyTarget: 7 });
        if (index < done) {
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
    />,
    setUp.dependencies,
  );
  await screen.findByRole('button', { name: /Commencer l'ascension|Reprendre l'ascension/u });
  if (done !== undefined) await screen.findAllByText(/D'après hier|prochaine ascension/u);
  await act(async () => {});
  if (mockDecor) shown.push(backdrop().props.tier as Tier);
}

async function unmount(): Promise<void> {
  await act(async () => screen.unmount());
}

const backdrop = () => screen.getByTestId('tower-foot-backdrop', hidden);
const header = () => screen.getByTestId('tower-foot-header');

/** L'en-tête mis en page et mesuré dans la fenêtre. */
async function layOutHeader(): Promise<void> {
  await fireEvent(header(), 'layout', {
    nativeEvent: { layout: { x: 0, y: HEADER.top, width: WINDOW.width, height: HEADER.height } },
  });
}

/** Ce que lit le lecteur d'écran, dans l'ordre : rôle et libellé, ou texte, de chaque élément. */
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

/** Le fond `backgroundColor` d'un élément, opaque (`#RRGGBB`). */
function expectSolid(element: ReturnType<typeof screen.getByTestId>): void {
  const { backgroundColor } = StyleSheet.flatten(element.props.style) as {
    backgroundColor?: string;
  };
  expect(backgroundColor).toMatch(/^#[0-9A-F]{6}$/iu);
}

/** Tout le stockage clé-valeur, trié. */
const storage = () => [...setUp.keyValueStore.values.entries()].sort();

async function launch(): Promise<void> {
  await act(async () => {
    fireEvent.press(await screen.findByRole('button', { name: "Commencer l'ascension" }));
  });
  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name: 'Continuer avec la Sentinelle' }));
  });
}

const at = (tier: Tier, outcome: Ascent['outcome'] = null): Ascent => ({
  ...startAscent(42, { gauge: 1 }),
  tier,
  outcome,
});

const steps: StepDefinitions = ({ given, when, then, and }) => {
  beforeEach(() => {
    options = {};
    shown = [];
    mockDecor = true;
    measure = jest
      .spyOn(
        (View as unknown as { prototype: { measureInWindow: MeasureInWindow } }).prototype,
        'measureInWindow',
      )
      .mockImplementation((callback) => callback(0, HEADER.top, WINDOW.width, HEADER.height));
  });
  afterEach(() => {
    measure?.mockRestore();
    mockDecor = true;
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false);
    jest.mocked(AccessibilityInfo.isScreenReaderEnabled).mockResolvedValue(false);
  });

  // --- Le palier de départ ---

  given(/^aucune ascension n'est en cours$/u, () => {
    options = { done: 3 };
  });

  when(/^le joueur ouvre l'onglet Tour$/u, async () => {
    await showTowerFoot();
  });

  then(
    /^le pied de la tour s'affiche sur le fond du palier 1, les Catacombes \(« le puits des ossements »\), le même que ses combats$/u,
    () => {
      expect(setUp.session.current()).toBeNull();
      expect(shown).toEqual([1]);
      expect(TIER_NAMES[1]).toBe('Les Catacombes');
      expect(screen.getByTestId('tower-foot')).toHaveStyle({ backgroundColor: 'transparent' });
    },
  );

  and(
    /^l'image est remplie en hauteur, centrée, ses côtés rognés, comme à l'écran de combat$/u,
    () => {
      // Le vrai décor dessine le même registre au même placement que le combat (test de fumée).
      expect(TIER_BACKDROPS[1].palette.length).toBeGreaterThan(0);
      const placement = backdropPlacement(WINDOW, 2);
      expect(placement.height).toBeGreaterThanOrEqual(WINDOW.height);
      expect(placement.width).toBeGreaterThan(WINDOW.width);
      expect(placement.x).toBe((WINDOW.width - placement.width) / 2);
      expect([placement.width, placement.height]).toEqual([480, 800]);
      expect(PixelRatio.get()).toBeGreaterThan(0);
    },
  );

  and(
    /^les cadres, les libellés et les boutons du pied de la tour sont ceux d'aujourd'hui$/u,
    async () => {
      const withDecor = readOut();
      expect(within(header()).getByRole('header', { name: 'La tour' })).toBeOnTheScreen();
      expect(within(header()).getByText(tierLine(1))).toBeOnTheScreen();
      expect(screen.getByTestId('gauge-card')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Le camp' })).toBeOnTheScreen();
      // J1 : la clé de la faveur, telle quelle.
      expect(within(screen.getByTestId('gauge-card')).getByText('1 clé')).toBeOnTheScreen();
      await unmount();
      mockDecor = false;
      await showTowerFoot();
      expect(readOut()).toEqual(withDecor);
    },
  );

  // --- La jauge ---

  when(/^la jauge du jour vaut \+2, 0 ou −2$/u, async () => {
    for (const done of [4, 2, 0]) {
      await showTowerFoot({ done });
      await layOutHeader();
      expect(backdrop()).toHaveProp('headerBottom', HEADER.top + HEADER.height);
      await unmount();
    }
  });

  then(/^le pied de la tour montre le même fond du palier 1, sous le même voile$/u, () => {
    expect(shown).toEqual([1, 1, 1]);
  });

  // --- Le palier en cours ---

  given(/^une ascension en cours au palier (\d)$/u, (tier: string) => {
    options = { saved: at(Number(tier) as Tier) };
  });

  then(
    /^le pied de la tour s'affiche sur le fond des Jardins de cendre \(« sous le jardin suspendu »\)$/u,
    () => {
      expect(screen.getByTestId('tower-foot-ascent')).toBeOnTheScreen();
      expect(shown).toEqual([2]);
      expect(TIER_NAMES[2]).toBe('Les Jardins de cendre');
    },
  );

  and(/^au palier 3, sur celui du Beffroi \(« la cloche tombée »\)$/u, async () => {
    await unmount();
    await showTowerFoot({ saved: at(3) });
    expect(shown.at(-1)).toBe(3);
    expect(TIER_NAMES[3]).toBe('Le Beffroi');
  });

  and(/^au palier 1, sur celui des Catacombes$/u, async () => {
    await unmount();
    await showTowerFoot({ saved: at(1) });
    expect(screen.getByTestId('tower-foot-ascent')).toBeOnTheScreen();
    expect(shown).toEqual([2, 3, 1]);
  });

  // --- La fin de l'ascension ---

  given(/^une ascension au palier 3$/u, () => {
    options = { saved: at(3) };
  });

  when(/^elle se termine, par une chute, un abandon ou le Sommet$/u, async () => {
    for (const outcome of ['fall', 'victory'] as const) {
      await showTowerFoot({ saved: at(3, outcome) });
      await unmount();
    }
    await showTowerFoot();
    expect(shown.at(-1)).toBe(3);
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: "Abandonner l'ascension" }));
    });
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Abandonner' }));
    });
    expect(setUp.session.current()?.outcome).toBe('fall');
    await screen.findByRole('button', { name: "Commencer l'ascension" });
    shown.push(backdrop().props.tier as Tier);
  });

  then(/^le pied de la tour s'affiche de nouveau sur le fond du palier 1$/u, () => {
    expect(shown).toEqual([1, 1, 3, 1]);
  });

  // --- Le voile ---

  when(/^le pied de la tour s'affiche sur un fond de palier, quel qu'il soit$/u, async () => {
    for (const tier of TIERS) {
      await showTowerFoot({ saved: at(tier), done: 3 });
      await layOutHeader();
      await unmount();
    }
    await showTowerFoot({ done: 3 });
    await layOutHeader();
  });

  then(
    /^un voile de la nuit couvre le haut de l'écran, sous la barre d'état, le titre « La tour », les Éclats et la ligne du palier, puis s'allège vers le bas$/u,
    () => {
      expect(shown).toEqual([1, 2, 3, 1]);
      const bottom = HEADER.top + HEADER.height;
      expect(backdrop()).toHaveProp('headerBottom', bottom);
      const inHeader = within(header());
      expect(inHeader.getByRole('header', { name: 'La tour' })).toBeOnTheScreen();
      expect(inHeader.getByTestId('tower-foot-shards')).toBeOnTheScreen();
      expect(inHeader.getByText(tierLine(1))).toBeOnTheScreen();
      const veil = towerFootVeil(WINDOW, bottom);
      expect(veil.strong).toEqual({ y: 0, height: bottom });
      expect(veil.light.y + veil.light.height).toBe(WINDOW.height);
      expect(roles.towerFootVeil).toBe('rgba(14,17,32,0.75)');
      expect(roles.towerFootVeilLight).toBe('rgba(14,17,32,0.12)');
    },
  );

  and(/^chaque texte posé sur le décor garde un contraste d'au moins 4,5:1 au pire pixel$/u, () => {
    const failing = TIERS.flatMap((tier) =>
      TIER_BACKDROPS[tier].palette.flatMap((tint) => [
        ...HEADER_TEXTS.filter(
          (text) => contrast(text, underVeil(tint, roles.towerFootVeil)) < 4.5,
        ),
        ...PLATE_TEXTS.filter((text) => contrast(text, underVeil(tint)) < 4.5),
      ]),
    );
    expect(failing).toEqual([]);
  });

  and(
    /^la jauge, le cadre de l'ascension en cours, « Commencer l'ascension », « Le camp » et la barre d'onglets gardent leur fond plein et leurs contrastes d'aujourd'hui$/u,
    async () => {
      const gauge = within(screen.getByTestId('gauge-card')).getAllByTestId('pixel-frame-light')[0]!
        .parent!;
      expectSolid(gauge);
      expectSolid(screen.getByRole('button', { name: "Commencer l'ascension" }));
      expectSolid(screen.getByRole('button', { name: 'Le camp' }));
      await unmount();
      await showTowerFoot({ saved: at(2) });
      expectSolid(screen.getByTestId('tower-foot-ascent'));
    },
  );

  // --- Immobile ---

  given(/^le mouvement réduit est activé, ou non$/u, () => {
    options = { done: 3 };
  });

  when(/^le pied de la tour s'affiche$/u, async () => {
    for (const reduced of [true, false]) {
      jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(reduced);
      await showTowerFoot();
      await layOutHeader();
      const { tier, headerBottom, style } = backdrop().props as Record<string, unknown>;
      expect([tier, headerBottom, style]).toEqual([1, HEADER.top + HEADER.height, undefined]);
      await unmount();
    }
    await showTowerFoot({ saved: at(2) });
  });

  then(/^le décor ne défile pas et ne s'anime pas$/u, () => {
    expect(
      within(screen.getByTestId('tower-foot-scroll')).queryByTestId('tower-foot-backdrop', hidden),
    ).toBeNull();
    const props = backdrop().props as Record<string, unknown>;
    expect(props.children).toBeUndefined();
    expect(Object.keys(props).sort()).toEqual([
      'accessibilityElementsHidden',
      'children',
      'headerBottom',
      'importantForAccessibility',
      'pointerEvents',
      'testID',
      'tier',
    ]);
  });

  // --- Lecteur d'écran et toucher ---

  when(/^le pied de la tour s'affiche avec le lecteur d'écran$/u, async () => {
    jest.mocked(AccessibilityInfo.isScreenReaderEnabled).mockResolvedValue(true);
    options = { saved: { ...at(2), keys: 2 }, done: 3 };
    await showTowerFoot();
  });

  then(/^il est lu exactement comme aujourd'hui, sans rien sur le décor$/u, async () => {
    expect(screen.queryByTestId('tower-foot-backdrop')).toBeNull();
    expect(backdrop().props.accessibilityLabel).toBeUndefined();
    const withDecor = readOut();
    expect(withDecor).toContain('text: 2 clés');
    await unmount();
    mockDecor = false;
    await showTowerFoot();
    expect(readOut()).toEqual(withDecor);
    mockDecor = true;
    await unmount();
    await showTowerFoot();
  });

  and(/^toucher le décor, hors des cadres et des boutons, ne fait rien$/u, () => {
    expect(backdrop()).toHaveProp('pointerEvents', 'none');
    expect(backdrop().props.onPress).toBeUndefined();
    const before = setUp.session.current();
    fireEvent.press(backdrop());
    expect(setUp.session.current()).toBe(before);
  });

  // --- Aucune règle ne change ---

  given(
    /^un joueur avec la même jauge, les mêmes Éclats et la même graine qu'en v0\.4\.0$/u,
    () => {
      options = { done: 3, shards: 22 };
    },
  );

  when(/^il commence l'ascension depuis le pied de la tour décoré$/u, async () => {
    await showTowerFoot();
    await launch();
  });

  then(
    /^la jauge, les Éclats, le lancement et l'ascension sont ceux qu'il aurait eus sans le décor$/u,
    async () => {
      const withDecor = { ascent: setUp.session.current(), storage: storage() };
      expect(withDecor.ascent?.gauge).toBe(1);
      expect(withDecor.ascent?.keys).toBe(1);
      await unmount();
      mockDecor = false;
      await showTowerFoot();
      await launch();
      expect({ ascent: setUp.session.current(), storage: storage() }).toEqual(withDecor);
    },
  );
};

autoBindSteps([loadFeature('features/decor-du-pied-de-la-tour.feature')], [steps]);
