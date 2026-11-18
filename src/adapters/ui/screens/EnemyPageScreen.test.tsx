// La page d'un ennemi (#283, maquette 278 F1 à F6) : la page remplie dans l'ordre de lecture, la page
// cachée, les deux phases d'un boss, « Page remplie » une seule fois (4 pas, ou un fondu en
// mouvement réduit, annoncé poliment), et aucun chiffre de jeu à l'écran ni au lecteur d'écran.
import { act, fireEvent, screen } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import {
  DISCOVERY_BOOK_KEY,
  DiscoveryBookSession,
} from '../../../application/useCases/DiscoveryBookSession';
import type { EnemyKind } from '../../../domain/battle/combatants';
import {
  EMPTY_DISCOVERY_BOOK,
  parseDiscoveryBook,
  serializeDiscoveryBook,
  type BestiaryRecord,
} from '../../../domain/discoveryBook/DiscoveryBook';
import { PHASE_2_PORTRAITS } from '../pixelArt/sprites/atelier/data/portraits';
import { ascentSetUp } from '../testing/ascent';
import { renderScreen } from '../testing/renderScreen';
import { EnemyPageScreen, FILL_STEP_MS } from './EnemyPageScreen';

async function show(
  kind: EnemyKind,
  record: BestiaryRecord = { state: 'defeated', pageSeen: true },
  { reduced = false }: { reduced?: boolean } = {},
) {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(reduced);
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  announce.mockClear();
  const { keyValueStore, dependencies } = ascentSetUp();
  keyValueStore.values.set(
    DISCOVERY_BOOK_KEY,
    serializeDiscoveryBook({ ...EMPTY_DISCOVERY_BOOK, enemies: { [kind]: record } }),
  );
  const book = new DiscoveryBookSession({ keyValueStore });
  await book.load();
  const onBack = jest.fn();
  const view = await renderScreen(
    <EnemyPageScreen book={book} kind={kind} onBack={onBack} />,
    dependencies,
  );
  return {
    announce,
    book,
    onBack,
    view,
    stored: () =>
      parseDiscoveryBook(keyValueStore.values.get(DISCOVERY_BOOK_KEY) ?? null).book.enemies[kind],
  };
}

/** La scène est décorative : le lecteur d'écran ne la lit pas. */
const HIDDEN = { includeHiddenElements: true } as const;

/** Les éléments lus d'un trait par le lecteur d'écran, dans l'ordre de la page. */
const read = () =>
  screen
    .getAllByRole('text')
    .map((element) => element.props.accessibilityLabel as string | undefined)
    .filter((label) => label !== undefined);

/**
 * Tout ce que la page montre ou fait lire : les textes, scène comprise, et les libellés du lecteur
 * d'écran ; hors des comptes de coups et de mécaniques, des nombres de choses visibles.
 */
function shownAndRead(root: TestInstance): string[] {
  const said: string[] = [];
  const visit = (node: TestInstance) => {
    if (typeof node.type === 'string') {
      const { props } = node;
      if (typeof props.accessibilityLabel === 'string') said.push(props.accessibilityLabel);
      const count = typeof props.testID === 'string' && props.testID.startsWith('enemy-page-count');
      if (node.type === 'Text' && !count) {
        said.push(node.children.filter((child) => typeof child === 'string').join(''));
      }
    }
    node.children.forEach((child) => {
      if (typeof child === 'object' && child !== null) visit(child);
    });
  };
  visit(root);
  return said;
}

/** Les nombres permis par B21 : les libellés du combat, et des nombres de choses visibles. */
const ALLOWED_NUMBERS = [
  /Aura \+\d+ %/gu,
  /Braises \d+/gu,
  /Brûlure ×\d+/gu,
  /jusqu'à 3/gu,
  /phase \d/giu,
  /Palier \d/gu,
];

describe('EnemyPageScreen', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false);
  });

  it('heads the page with a back to the bestiary of 48 dp, its name and its tier', async () => {
    const { onBack } = await show('gravedigger');

    const back = screen.getByRole('button', { name: 'Retour au Bestiaire' });
    const style = StyleSheet.flatten(back.props.style);
    expect(style.minWidth).toBeGreaterThanOrEqual(48);
    expect(style.minHeight).toBeGreaterThanOrEqual(48);
    expect(screen.getByRole('header', { name: 'Fossoyeur' })).toBeOnTheScreen();
    expect(screen.getByText('Bestiaire · Palier 1')).toBeOnTheScreen();
    await fireEvent.press(back);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('shows a defeated Elite in order: its battle image on its tier, name, category, tier, lore, mechanics, moves (F1, F2)', async () => {
    await show('gravedigger');

    expect(screen.getByTestId('enemy-page-image-gravedigger', HIDDEN)).toBeOnTheScreen();
    expect(screen.getByTestId('enemy-page-backdrop-1', HIDDEN)).toBeOnTheScreen();
    expect(screen.queryByTestId('enemy-page-silhouette-gravedigger', HIDDEN)).not.toBeOnTheScreen();
    expect(screen.getByText('Élite', HIDDEN)).toBeOnTheScreen();
    expect(screen.getByText('Vaincu', HIDDEN)).toBeOnTheScreen();
    expect(screen.getByText('Palier 1 · les Catacombes')).toBeOnTheScreen();
    expect(read()).toEqual([
      'Fossoyeur, Élite, vaincu.',
      "Histoire : Il a creusé toutes les tombes des Catacombes, une à une, pendant des siècles. Il creuse encore, mais à l'envers : ce qu'il sort de terre se relève et marche.",
      "Exhumer. Aux manches paires, il exhume un Squelette, s'il n'en a pas un debout. Brise sa garde avant pour l'en empêcher.",
      "Coup de pelle, Coup simple. Il lève sa pelle et l'abat à plat, d'un seul coup. Un reflet blanc, un seul impact.",
      'Terre jetée, Double frappe. Il charge sa pelle de terre et la lance deux fois au visage du héros. Le reflet se dédouble : deux impacts, deux parades.',
      "Fosse ouverte, Coup imparable. Il frappe le sol et la terre s'ouvre sous le héros ; sa silhouette rougit et le sceau pulse. Ce coup-là ne se pare pas : esquivez quand il tombe.",
    ]);
    expect(screen.getByText('Coups')).toBeOnTheScreen();
    expect(screen.getByTestId('enemy-page-count-moves', HIDDEN)).toHaveTextContent('3');
  });

  it('shows the chips of a move: its Burn, its Bleeding, its Charge, the seal of a perilous move', async () => {
    await show('brambleBurner');

    expect(screen.getByText('Brûlure ×2')).toBeOnTheScreen();
    expect(screen.getByText('Saignement')).toBeOnTheScreen();
    expect(screen.getByText('Coup retardé imparable')).toBeOnTheScreen();
    expect(screen.getByTestId('enemy-page-seal-2')).toBeOnTheScreen();
    expect(screen.queryByTestId('enemy-page-seal-0')).not.toBeOnTheScreen();
  });

  it('says « Aucune mécanique propre » for an enemy without one', async () => {
    await show('ghoul');

    expect(
      screen.getByText('Aucune mécanique propre : tout est dans ses coups.'),
    ).toBeOnTheScreen();
  });

  it('hides the lore, the mechanics and the moves of an encountered enemy, and says it in one sentence (F4)', async () => {
    const { stored } = await show('brambleMother', { state: 'encountered' });

    expect(screen.getByTestId('enemy-page-silhouette-brambleMother', HIDDEN)).toBeOnTheScreen();
    expect(screen.queryByTestId('enemy-page-image-brambleMother', HIDDEN)).not.toBeOnTheScreen();
    expect(screen.getByText('Rencontrée', HIDDEN)).toBeOnTheScreen();
    expect(read()).toEqual([
      'Mère-ronce, Élite, rencontrée.',
      'Histoire cachée',
      "Son histoire, ses mécaniques et ses coups restent cachés tant que tu ne l'as pas vaincue.",
    ]);
    expect(screen.queryAllByTestId(/^enemy-page-move-/u)).toEqual([]);
    expect(screen.queryAllByTestId(/^enemy-page-mechanic-/u)).toEqual([]);
    expect(screen.queryByText('Page remplie', HIDDEN)).not.toBeOnTheScreen();
    await act(async () => undefined);
    expect(stored()).toEqual({ state: 'encountered' });
  });

  it('shows the hidden boss with the silhouette of its phase 1', async () => {
    await show('hourRinger', { state: 'encountered' });

    expect(screen.getByTestId('enemy-page-silhouette-hourRinger', HIDDEN)).toBeOnTheScreen();
    expect(screen.queryByTestId('enemy-page-phase2-portrait', HIDDEN)).not.toBeOnTheScreen();
  });

  it('gives a boss its phase 1, then what phase 2 adds with its description and its portrait (F3)', async () => {
    await show('mothQueen');

    expect(screen.getByText('Phase 1')).toBeOnTheScreen();
    expect(screen.getByText('Phase 2 · sous la moitié de ses PV')).toBeOnTheScreen();
    expect(screen.getByText('Nouveau visage en phase 2')).toBeOnTheScreen();
    expect(screen.getByTestId('enemy-page-phase2-portrait', HIDDEN)).toBeOnTheScreen();
    expect(
      screen.getByText(/^Sous la moitié de ses PV, elle appelle : deux Phalénides/u),
    ).toBeOnTheScreen();
    expect(screen.getAllByTestId(/^enemy-page-move-/u)).toHaveLength(3);
    expect(read()).toContain(
      'Invocation. Quand ses PV descendent à la moitié, elle appelle deux Phalénides à ses côtés. Elles retombent en cendre avec elle.',
    );
  });

  it.each(
    (['ossuaryWarden', 'facelessPrior', 'ashGardener', 'hourRinger', 'wishGranter'] as const).map(
      (kind) => [kind, PHASE_2_PORTRAITS[kind] !== undefined] as const,
    ),
  )('shows the phase 2 portrait of %s only when it exists (%s)', async (kind, exists) => {
    await show(kind);

    expect(screen.queryByTestId('enemy-page-phase2-portrait', HIDDEN) !== null).toBe(exists);
  });

  it('fills the page from the bottom in 4 steps of 120 ms the first time, then says « Page remplie » (F5)', async () => {
    jest.useFakeTimers();
    const { announce, stored } = await show('burningHusk', { state: 'defeated', isNew: true });

    expect(FILL_STEP_MS).toBe(120);
    expect(screen.getByTestId('enemy-page-silhouette-burningHusk', HIDDEN)).toBeOnTheScreen();
    const colors = () =>
      StyleSheet.flatten(screen.getByTestId('enemy-page-fill', HIDDEN).props.style);
    const height = colors().height as number;
    expect(height).toBeGreaterThan(0);
    expect(colors()).toMatchObject({ opacity: 1 });
    const steps: number[] = [];
    for (let step = 0; step <= 4; step += 1) {
      steps.push(
        StyleSheet.flatten(screen.getByTestId('enemy-page-fill-clip', HIDDEN).props.style).height,
      );
      if (step < 4) {
        expect(screen.queryByText('Page remplie', HIDDEN)).not.toBeOnTheScreen();
        await act(async () => {
          jest.advanceTimersByTime(FILL_STEP_MS);
        });
      }
    }
    expect(steps).toEqual([0, height / 4, height / 2, (3 * height) / 4, height]);
    expect(screen.getByText('Page remplie', HIDDEN)).toBeOnTheScreen();
    expect(screen.getByText('Page remplie : Embrasé.')).toHaveProp(
      'accessibilityLiveRegion',
      'polite',
    );
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith('Page remplie : Embrasé.');
    expect(stored()).toEqual({ state: 'defeated', isNew: true, pageSeen: true });
  });

  it('fades the colours in with a reduced motion, without sliding, with the same durations', async () => {
    jest.useFakeTimers();
    await show('burningHusk', { state: 'defeated' }, { reduced: true });
    await act(async () => undefined);

    const fill = () =>
      StyleSheet.flatten(screen.getByTestId('enemy-page-fill', HIDDEN).props.style);
    const clip = () =>
      StyleSheet.flatten(screen.getByTestId('enemy-page-fill-clip', HIDDEN).props.style);
    const height = fill().height as number;
    const opacities: number[] = [];
    for (let step = 0; step <= 4; step += 1) {
      opacities.push(fill().opacity as number);
      expect(clip().height).toBe(height);
      if (step < 4) {
        await act(async () => {
          jest.advanceTimersByTime(FILL_STEP_MS);
        });
      }
    }
    expect(opacities).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(screen.getByText('Page remplie', HIDDEN)).toBeOnTheScreen();
  });

  it('shows a page already seen filled at once, without the animation nor « Page remplie »', async () => {
    jest.useFakeTimers();
    const { announce } = await show('burningHusk');
    await act(async () => {
      jest.advanceTimersByTime(4 * FILL_STEP_MS);
    });

    expect(screen.getByTestId('enemy-page-image-burningHusk', HIDDEN)).toBeOnTheScreen();
    expect(screen.queryByTestId('enemy-page-fill', HIDDEN)).not.toBeOnTheScreen();
    expect(screen.queryByText('Page remplie', HIDDEN)).not.toBeOnTheScreen();
    expect(announce).not.toHaveBeenCalled();
  });

  it('plays « Page remplie » once, however many times the screen renders', async () => {
    jest.useFakeTimers();
    const { announce, book, onBack, view, stored } = await show('burningHusk', {
      state: 'defeated',
    });
    await act(async () => {
      jest.advanceTimersByTime(4 * FILL_STEP_MS);
    });
    await act(async () => {
      await view.rerender(<EnemyPageScreen book={book} kind="burningHusk" onBack={onBack} />);
    });
    await act(async () => {
      jest.advanceTimersByTime(4 * FILL_STEP_MS);
    });
    expect(screen.getByText('Page remplie', HIDDEN)).toBeOnTheScreen();
    expect(announce).toHaveBeenCalledTimes(1);
    expect(stored()).toEqual({ state: 'defeated', pageSeen: true });
  });

  it.each<EnemyKind>([
    'candleBearer',
    'emberPod',
    'cryptRat',
    'thievingMoth',
    'brambleBurner',
    'mothQueen',
    'beadle',
    'brambleMother',
  ])('shows and reads no game number on the filled page of %s (B21)', async (kind) => {
    const { view } = await show(kind);

    const said = shownAndRead(view.container);
    expect(said.length).toBeGreaterThan(5);
    said.forEach((text) => {
      const words = ALLOWED_NUMBERS.reduce((rest, allowed) => rest.replace(allowed, ''), text);
      expect(words).not.toMatch(/\d/u);
    });
  });
});
