/**
 * « La page d'un ennemi » (#283) à l'écran : une vraie session du carnet sur un Stockage clé-valeur
 * en mémoire, le vrai carnet et la vraie page d'un ennemi, poussée par-dessus le carnet resté monté
 * (comme la pile de l'app) : le carnet perd le focus pendant la page, et le reprend au retour.
 */
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';
import { useState } from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import type { TestInstance } from 'test-renderer';

import { ENEMY_PAGES } from '../../src/adapters/ui/format/codex/enemyPages';
import { runsOf } from '../../src/adapters/ui/pixelArt/PixelIcon';
import { HOUR_RINGER_ANIMATION } from '../../src/adapters/ui/pixelArt/sprites/atelier/data/hourRinger';
import { HOUR_RINGER_PHASE2 } from '../../src/adapters/ui/pixelArt/sprites/atelier/data/hourRingerPhase2';
import { PHASE_2_PORTRAITS } from '../../src/adapters/ui/pixelArt/sprites/atelier/data/portraits';
import { silhouetteOf } from '../../src/adapters/ui/pixelArt/sprites/silhouettes';
import { DiscoveryBookScreen } from '../../src/adapters/ui/screens/DiscoveryBookScreen';
import { EnemyPageScreen, FILL_STEP_MS } from '../../src/adapters/ui/screens/EnemyPageScreen';
import { ascentSetUp } from '../../src/adapters/ui/testing/ascent';
import { renderScreen } from '../../src/adapters/ui/testing/renderScreen';
import {
  DISCOVERY_BOOK_KEY,
  DiscoveryBookSession,
} from '../../src/application/useCases/DiscoveryBookSession';
import type { Tier } from '../../src/domain/ascent/tiers';
import { startBattle } from '../../src/domain/battle/Battle';
import type { EnemyKind } from '../../src/domain/battle/combatants';
import { withEnemyAt } from '../../src/domain/battle/testing/withEnemyAt';
import { battleDiscoveries } from '../../src/domain/discoveryBook/battleDiscoveries';
import { BESTIARY_CATALOG, catalogKinds } from '../../src/domain/discoveryBook/bestiary';
import {
  EMPTY_DISCOVERY_BOOK,
  parseDiscoveryBook,
  recordDiscoveries,
  serializeDiscoveryBook,
  type DiscoveryBook,
} from '../../src/domain/discoveryBook/DiscoveryBook';
import { bookStore, settle, type BookStore } from '../support/discoveryBookStory';

const HIDDEN = { includeHiddenElements: true } as const;

/** Les nombres permis par B21 : les libellés du combat, et des nombres de choses visibles. */
const ALLOWED_NUMBERS = [
  /Aura \+\d+ %/gu,
  /Braises \d+/gu,
  /Brûlure ×\d+/gu,
  /jusqu'à 3/gu,
  /phase \d/giu,
  /Palier \d/gu,
];

interface World {
  store: BookStore;
  book: DiscoveryBookSession;
  /** L'ennemi du scénario. */
  kind: EnemyKind;
  focus: jest.SpyInstance;
  announce: jest.SpyInstance;
  scroll: TestInstance | null;
}

let world: World;

/** Le carnet, et la page d'un ennemi poussée par-dessus ; le retour de la page y ramène. */
function BookAndPage({ book }: { readonly book: DiscoveryBookSession }) {
  const [page, setPage] = useState<EnemyKind | null>(null);
  return (
    <>
      <DiscoveryBookScreen
        book={book}
        currentTier={null}
        onLeave={() => undefined}
        focused={page === null}
        onOpenEntry={setPage}
      />
      {page !== null && <EnemyPageScreen book={book} kind={page} onBack={() => setPage(null)} />}
    </>
  );
}

async function prepare(
  enemies: DiscoveryBook['enemies'],
  { lastTier = 1, reduced = false }: { lastTier?: Tier; reduced?: boolean } = {},
): Promise<void> {
  jest.useFakeTimers();
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(reduced);
  const store = bookStore({
    [DISCOVERY_BOOK_KEY]: serializeDiscoveryBook({ ...EMPTY_DISCOVERY_BOOK, lastTier, enemies }),
  });
  world = {
    store,
    book: new DiscoveryBookSession({ keyValueStore: store }),
    kind: 'ghoul',
    focus: jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation(() => {}),
    announce: jest.spyOn(AccessibilityInfo, 'announceForAccessibility'),
    scroll: null,
  };
  world.focus.mockClear();
  world.announce.mockClear();
  await world.book.load();
  const { dependencies } = ascentSetUp();
  await renderScreen(<BookAndPage book={world.book} />, dependencies);
  await settle();
}

const stored = (kind: EnemyKind) =>
  parseDiscoveryBook(world.store.values.get(DISCOVERY_BOOK_KEY) ?? null).book.enemies[kind];

async function touch(kind: EnemyKind): Promise<void> {
  world.kind = kind;
  await fireEvent.press(screen.getByTestId(`book-entry-${kind}`));
  await settle();
}

async function play(steps = 4): Promise<void> {
  await act(async () => {
    jest.advanceTimersByTime(steps * FILL_STEP_MS);
  });
}

/** Les repères de la page, dans l'ordre de l'écran : identifiants, libellés et textes. */
function pageMarks(): string[] {
  const marks: string[] = [];
  const visit = (node: TestInstance) => {
    if (typeof node.type === 'string') {
      const { props } = node;
      if (typeof props.testID === 'string') marks.push(props.testID);
      if (typeof props.accessibilityLabel === 'string') marks.push(props.accessibilityLabel);
      if (node.type === 'Text') {
        marks.push(node.children.filter((child) => typeof child === 'string').join(''));
      }
    }
    node.children.forEach((child) => {
      if (typeof child === 'object' && child !== null) visit(child);
    });
  };
  visit(screen.getByTestId('enemy-page', HIDDEN));
  return marks;
}

/** Tout ce que la page montre ou fait lire, hors des comptes de coups (des choses visibles). */
function shownAndRead(): string[] {
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
  visit(screen.getByTestId('enemy-page', HIDDEN));
  return said;
}

const done = () => {
  jest.useRealTimers();
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false);
  world.focus.mockRestore();
};

const steps: StepDefinitions = ({ given, when, then, and, but }) => {
  // --- Ouvrir une page ---

  given(/^le Fossoyeur vaincu$/u, async () => {
    await prepare({
      gravedigger: { state: 'defeated', pageSeen: true },
      ghoul: { state: 'encountered', isNew: true },
    });
  });

  when(/^le joueur touche son entrée dans le Bestiaire$/u, async () => {
    expect(
      screen.getByRole('button', { name: 'Fossoyeur, Élite, vaincu. Ouvrir sa page' }),
    ).toBeOnTheScreen();
    await touch('gravedigger');
  });

  then(/^sa page s'ouvre sur un écran poussé$/u, () => {
    expect(screen.getByRole('header', { name: 'Fossoyeur' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Retour au Bestiaire' })).toBeOnTheScreen();
    // Le carnet reste dessous, ses marques « nouveau » gardées : ouvrir une page n'est pas sortir.
    expect(screen.getByTestId('discovery-book')).toBeOnTheScreen();
    expect(world.book.newEntryCount()).toBe(1);
    expect(stored('ghoul')).toEqual({ state: 'encountered', isNew: true });
  });

  and(
    /^elle montre, dans l'ordre, son image de combat sur le fond de son palier, son nom, sa catégorie Élite, son palier, son histoire du Codex, ses mécaniques, puis ses coups$/u,
    () => {
      const marks = pageMarks();
      const at = (mark: string) => {
        const index = marks.indexOf(mark);
        expect(index).toBeGreaterThanOrEqual(0);
        return index;
      };
      const order = [
        at('enemy-page-backdrop-1'),
        at('enemy-page-image-gravedigger'),
        at('Élite'),
        at('Fossoyeur, Élite, vaincu.'),
        at('Palier 1 · les Catacombes'),
        at(`Histoire : ${ENEMY_PAGES.gravedigger.lore}`),
        at('enemy-page-mechanic-exhume'),
        at('enemy-page-move-0'),
      ];
      expect([...order].sort((a, b) => a - b)).toEqual(order);
      expect(screen.getByText(ENEMY_PAGES.gravedigger.lore)).toBeOnTheScreen();
    },
  );

  and(/^chaque coup a son nom, son type de coup et sa description$/u, () => {
    const types = ['Coup simple', 'Double frappe', 'Coup imparable'];
    ENEMY_PAGES.gravedigger.phases[0]!.moves.forEach(({ name, description }, index) => {
      const move = screen.getByTestId(`enemy-page-move-${index}`);
      expect(within(move).getByText(name)).toBeOnTheScreen();
      expect(within(move).getByText(types[index]!)).toBeOnTheScreen();
      expect(within(move).getByText(description)).toBeOnTheScreen();
      expect(move).toHaveProp('accessibilityLabel', `${name}, ${types[index]}. ${description}`);
    });
    expect(screen.queryByTestId('enemy-page-move-3')).not.toBeOnTheScreen();
    done();
  });

  given(/^la Mère-ronce rencontrée, pas encore vaincue$/u, async () => {
    await prepare({ brambleMother: { state: 'encountered' } }, { lastTier: 2 });
  });

  when(/^le joueur touche son entrée$/u, async () => {
    await touch('brambleMother');
  });

  then(/^sa page montre sa silhouette, son nom, sa catégorie et son palier$/u, () => {
    expect(screen.getByTestId('enemy-page-silhouette-brambleMother', HIDDEN)).toBeOnTheScreen();
    expect(screen.queryByTestId('enemy-page-image-brambleMother', HIDDEN)).not.toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Mère-ronce' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Mère-ronce, Élite, rencontrée.')).toBeOnTheScreen();
    expect(screen.getByText('Palier 2 · les Jardins de cendre')).toBeOnTheScreen();
  });

  and(/^son histoire, ses mécaniques et ses coups restent cachés$/u, () => {
    const { lore, mechanics, phases } = ENEMY_PAGES.brambleMother;
    expect(screen.queryByText(lore, HIDDEN)).not.toBeOnTheScreen();
    Object.values(mechanics).forEach((sentence) =>
      expect(screen.queryByText(sentence, HIDDEN)).not.toBeOnTheScreen(),
    );
    phases[0]!.moves.forEach(({ name }) =>
      expect(screen.queryByText(name, HIDDEN)).not.toBeOnTheScreen(),
    );
    expect(screen.queryAllByTestId(/^enemy-page-(move|mechanic)-/u, HIDDEN)).toEqual([]);
    expect(screen.getByLabelText('Histoire cachée')).toBeOnTheScreen();
  });

  and(/^la page cachée le dit en une phrase$/u, async () => {
    const sentence =
      "Son histoire, ses mécaniques et ses coups restent cachés tant que tu ne l'as pas vaincue.";
    expect(screen.getByLabelText(sentence)).toBeOnTheScreen();
    expect(screen.getAllByText(sentence)).toHaveLength(1);
    await play();
    expect(stored('brambleMother')).toEqual({ state: 'encountered' });
    done();
  });

  given(/^une entrée « \?\?\? »$/u, async () => {
    await prepare({ ghoul: { state: 'defeated' } });
    const prior = screen.getByTestId('book-entry-facelessPrior');
    expect(within(prior).getByText('???')).toBeOnTheScreen();
    expect(prior).toHaveProp('accessibilityRole', 'text');
  });

  when(/^le joueur la touche$/u, async () => {
    await touch('facelessPrior');
  });

  then(/^aucune page ne s'ouvre$/u, () => {
    expect(screen.queryByTestId('enemy-page', HIDDEN)).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^Boss inconnu/u })).not.toBeOnTheScreen();
    expect(screen.getByTestId('discovery-book')).toBeOnTheScreen();
    done();
  });

  // --- Le retour ---

  given(/^la page de l'Embrasé ouverte depuis le palier 2, défilé jusqu'aux Élites$/u, async () => {
    await prepare({
      burningHusk: { state: 'defeated', isNew: true },
      ghoul: { state: 'defeated' },
    });
    await fireEvent.press(screen.getByTestId('book-tier-chip-2'));
    const scroll = screen.getByTestId('book-scroll');
    await fireEvent.scroll(scroll, { nativeEvent: { contentOffset: { x: 0, y: 420 } } });
    world.scroll = scroll;
    await touch('burningHusk');
    expect(screen.getByRole('header', { name: 'Embrasé' })).toBeOnTheScreen();
    expect(world.focus).not.toHaveBeenCalled();
  });

  when(/^le joueur revient en arrière$/u, async () => {
    await fireEvent.press(screen.getByRole('button', { name: 'Retour au Bestiaire' }));
    await settle();
  });

  then(/^le Bestiaire est au palier 2, au même défilement$/u, () => {
    expect(screen.queryByTestId('enemy-page', HIDDEN)).not.toBeOnTheScreen();
    expect(screen.getByTestId('book-tier-chip-2')).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ selected: true }),
    );
    // Le même défilement : le carnet est resté monté, sa liste n'a pas été recréée.
    expect(screen.getByTestId('book-scroll')).toBe(world.scroll);
    // Le retour d'une page n'est pas une sortie : « nouveau » reste.
    expect(stored('burningHusk')).toMatchObject({ isNew: true });
    expect(world.book.newEntryCount()).toBe(1);
  });

  and(/^le focus du lecteur d'écran revient sur l'entrée de l'Embrasé$/u, () => {
    expect(world.focus).toHaveBeenCalledTimes(1);
    const [tile, event] = world.focus.mock.calls[0]! as [{ props: { testID: string } }, string];
    expect(event).toBe('focus');
    expect(tile.props.testID).toBe('book-entry-burningHusk');
    done();
  });

  // --- « Page remplie » ---

  given(/^l'Embrasé vaincu dont la page n'a jamais été vue remplie$/u, async () => {
    await prepare({ burningHusk: { state: 'defeated', isNew: true } }, { lastTier: 2 });
  });

  when(/^le joueur ouvre sa page$/u, async () => {
    await touch(world.kind === 'ghoul' ? 'burningHusk' : world.kind);
  });

  then(
    /^ses couleurs remplacent la silhouette de bas en haut, puis « Page remplie » s'affiche$/u,
    async () => {
      expect(screen.getByTestId('enemy-page-silhouette-burningHusk', HIDDEN)).toBeOnTheScreen();
      const clip = () =>
        StyleSheet.flatten(screen.getByTestId('enemy-page-fill-clip', HIDDEN).props.style);
      const height = StyleSheet.flatten(screen.getByTestId('enemy-page-fill', HIDDEN).props.style)
        .height as number;
      const heights: number[] = [clip().height as number];
      for (let step = 0; step < 4; step += 1) {
        expect(screen.queryByText('Page remplie', HIDDEN)).not.toBeOnTheScreen();
        await play(1);
        heights.push(clip().height as number);
      }
      expect(heights).toEqual([0, height / 4, height / 2, (3 * height) / 4, height]);
      // Les couleurs montent depuis le bas : la bande colorée est calée en bas de l'image.
      expect(clip()).toMatchObject({ position: 'absolute', bottom: 0 });
      expect(screen.getByText('Page remplie', HIDDEN)).toBeOnTheScreen();
    },
  );

  and(/^le lecteur d'écran annonce poliment « Page remplie : Embrasé\. »$/u, async () => {
    expect(screen.getByText('Page remplie : Embrasé.')).toHaveProp(
      'accessibilityLiveRegion',
      'polite',
    );
    expect(world.announce).toHaveBeenCalledTimes(1);
    expect(world.announce).toHaveBeenCalledWith('Page remplie : Embrasé.');
    await settle();
    expect(stored('burningHusk')).toEqual({ state: 'defeated', isNew: true, pageSeen: true });
    done();
  });

  given(/^le mouvement réduit activé$/u, async () => {
    await prepare({ emberPod: { state: 'defeated' } }, { lastTier: 2, reduced: true });
  });

  when(/^une page s'ouvre remplie pour la première fois$/u, async () => {
    await touch('emberPod');
  });

  then(/^elle passe en fondu, sans glisser, avec les mêmes durées$/u, async () => {
    const fill = () =>
      StyleSheet.flatten(screen.getByTestId('enemy-page-fill', HIDDEN).props.style);
    const clip = () =>
      StyleSheet.flatten(screen.getByTestId('enemy-page-fill-clip', HIDDEN).props.style);
    const opacities: number[] = [fill().opacity as number];
    for (let step = 0; step < 4; step += 1) {
      expect(clip().height).toBe(fill().height);
      await play(1);
      opacities.push(fill().opacity as number);
    }
    expect(opacities).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(screen.getByText('Page remplie', HIDDEN)).toBeOnTheScreen();
    done();
  });

  // --- Les boss ---

  given(/^la Reine des phalènes vaincue$/u, async () => {
    await prepare({ mothQueen: { state: 'defeated', pageSeen: true } }, { lastTier: 2 });
    world.kind = 'mothQueen';
  });

  then(
    /^ses coups vont par phase : la phase 1, puis ce que la phase 2 ajoute avec sa description de phase$/u,
    () => {
      const marks = pageMarks();
      const [first, second] = ENEMY_PAGES.mothQueen.phases;
      const order = [
        marks.indexOf('Phase 1'),
        ...first!.moves.map(({ name }) => marks.indexOf(name)),
        marks.indexOf('Phase 2 · sous la moitié de ses PV'),
        marks.indexOf(second!.description!),
        ...second!.moves.map(({ name }) => marks.indexOf(name)),
      ];
      order.forEach((index) => expect(index).toBeGreaterThanOrEqual(0));
      expect([...order].sort((a, b) => a - b)).toEqual(order);
      // La phase 2 ne redit pas les coups de la phase 1.
      expect(screen.getAllByText('Voile de poussière')).toHaveLength(1);
      expect(screen.getAllByTestId(/^enemy-page-move-/u)).toHaveLength(3);
    },
  );

  and(/^son Invocation est dite parmi ses mécaniques$/u, () => {
    expect(
      within(screen.getByTestId('enemy-page-mechanic-summon')).getByText('Invocation'),
    ).toBeOnTheScreen();
  });

  and(/^son portrait de phase 2 est montré quand il existe$/u, () => {
    expect(PHASE_2_PORTRAITS.mothQueen).toBeDefined();
    expect(screen.getByTestId('enemy-page-phase2-portrait', HIDDEN)).toBeOnTheScreen();
    expect(screen.getByText('Nouveau visage en phase 2')).toBeOnTheScreen();
    done();
  });

  given(/^un boss rencontré en phase 2, pas vaincu$/u, async () => {
    const battle = startBattle({
      seed: 3,
      defenseHint: false,
      at: 0,
      enemies: ['hourRinger'],
    }).battle;
    const inPhase2 = withEnemyAt(battle, 0, { phase2: true });
    const { book } = recordDiscoveries(EMPTY_DISCOVERY_BOOK, battleDiscoveries(null, inPhase2, []));
    expect(book.enemies.hourRinger).toMatchObject({ state: 'encountered' });
    await prepare(book.enemies, { lastTier: 3 });
    world.kind = 'hourRinger';
  });

  then(/^la silhouette est celle de sa phase 1$/u, () => {
    const shown = screen.getByTestId('enemy-page-silhouette-hourRinger', HIDDEN);
    const runs = (rows: readonly string[]) =>
      runsOf(
        silhouetteOf({ ...HOUR_RINGER_ANIMATION, palette: HOUR_RINGER_ANIMATION.pal, rows }).rows,
      );
    const phase1 = runs(HOUR_RINGER_ANIMATION.frames.idle0);
    const phase2 = runs(HOUR_RINGER_PHASE2.frames.idle0);
    expect(phase2).not.toEqual(phase1);
    expect(shown.children).toHaveLength(phase1.length);
    expect(screen.queryByTestId('enemy-page-phase2-portrait', HIDDEN)).not.toBeOnTheScreen();
    done();
  });

  // --- Aucun chiffre ---

  given(/^la page remplie de n'importe quel ennemi du jeu$/u, async () => {
    await prepare({});
  });

  then(
    /^elle ne montre ni PV, ni garde, ni dégâts, ni Initiative, ni poids ou plafond de tirage, ni durée$/u,
    async () => {
      const { dependencies } = ascentSetUp();
      for (const kind of catalogKinds(BESTIARY_CATALOG)) {
        const store = bookStore({
          [DISCOVERY_BOOK_KEY]: serializeDiscoveryBook({
            ...EMPTY_DISCOVERY_BOOK,
            enemies: { [kind]: { state: 'defeated', pageSeen: true } },
          }),
        });
        const book = new DiscoveryBookSession({ keyValueStore: store });
        await book.load();
        const view = await renderScreen(
          <EnemyPageScreen book={book} kind={kind} onBack={() => undefined} />,
          dependencies,
        );
        const said = shownAndRead();
        expect(said.length).toBeGreaterThan(5);
        said.forEach((text) => {
          const words = ALLOWED_NUMBERS.reduce((rest, allowed) => rest.replace(allowed, ''), text);
          expect(words).not.toMatch(/\d|Initiative/u);
        });
        await act(async () => view.unmount());
      }
    },
  );

  and(
    /^une mécanique qui donne plus de dégâts le dit sans nombre : « frappe plus fort pour chaque autre Rat de crypte debout »$/u,
    async () => {
      const { dependencies } = ascentSetUp();
      const store = bookStore({
        [DISCOVERY_BOOK_KEY]: serializeDiscoveryBook({
          ...EMPTY_DISCOVERY_BOOK,
          enemies: { cryptRat: { state: 'defeated', pageSeen: true } },
        }),
      });
      const book = new DiscoveryBookSession({ keyValueStore: store });
      await book.load();
      await renderScreen(
        <EnemyPageScreen book={book} kind="cryptRat" onBack={() => undefined} />,
        dependencies,
      );
      const swarm = screen.getByTestId('enemy-page-mechanic-swarm');
      expect(within(swarm).getByText('Meute')).toBeOnTheScreen();
      const sentence = ENEMY_PAGES.cryptRat.mechanics.swarm!;
      expect(within(swarm).getByText(sentence)).toBeOnTheScreen();
      // Plus fort pour chaque autre Rat de crypte debout, sans dire de combien.
      expect(sentence).toMatch(/plus fort quand d'autres Rats de crypte sont debout/u);
      expect(sentence.replace(/jusqu'à 3/gu, '')).not.toMatch(/\d|dégât/u);
    },
  );

  but(
    /^les libellés de combat que le joueur voit en combat restent tels quels, même avec un nombre : « Aura \+20 % », « Braises 2 »$/u,
    async () => {
      const { dependencies } = ascentSetUp();
      for (const [kind, label] of [
        ['candleBearer', 'Aura +20 %'],
        ['emberPod', 'Braises 2'],
      ] as const) {
        const store = bookStore({
          [DISCOVERY_BOOK_KEY]: serializeDiscoveryBook({
            ...EMPTY_DISCOVERY_BOOK,
            enemies: { [kind]: { state: 'defeated', pageSeen: true } },
          }),
        });
        const book = new DiscoveryBookSession({ keyValueStore: store });
        await book.load();
        const view = await renderScreen(
          <EnemyPageScreen book={book} kind={kind} onBack={() => undefined} />,
          dependencies,
        );
        expect(screen.getByText(label)).toBeOnTheScreen();
        await act(async () => view.unmount());
      }
      done();
    },
  );
};

// Les scénarios `@ui` seuls.
const feature = loadFeature('features/page-d-un-ennemi.feature');
const ofUi = ({ tags }: { readonly tags: readonly string[] }) => tags.includes('@ui');
autoBindSteps(
  [
    {
      ...feature,
      scenarios: feature.scenarios.filter(ofUi),
      scenarioOutlines: feature.scenarioOutlines.filter(ofUi),
    },
  ],
  [steps],
);
