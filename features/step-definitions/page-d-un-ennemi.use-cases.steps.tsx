/**
 * « La page d'un ennemi » (#283), par les sessions : de vraies sessions du carnet sur un Stockage
 * clé-valeur en mémoire (« fermeture de l'app » : une nouvelle session sur le même stockage), les
 * victoires d'un vrai combat, et la vraie page d'un ennemi à l'écran, pour voir ce qui joue et ce qui
 * ne joue pas.
 */
import { act, screen } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';
import { AccessibilityInfo } from 'react-native';

import { EnemyPageScreen, FILL_STEP_MS } from '../../src/adapters/ui/screens/EnemyPageScreen';
import { ascentSetUp } from '../../src/adapters/ui/testing/ascent';
import { renderScreen } from '../../src/adapters/ui/testing/renderScreen';
import {
  DISCOVERY_BOOK_KEY,
  DiscoveryBookSession,
} from '../../src/application/useCases/DiscoveryBookSession';
import { startBattle } from '../../src/domain/battle/Battle';
import type { EnemyKind } from '../../src/domain/battle/combatants';
import { withEnemyAt } from '../../src/domain/battle/testing/withEnemyAt';
import {
  EMPTY_DISCOVERY_BOOK,
  parseDiscoveryBook,
  serializeDiscoveryBook,
  type DiscoveryBook,
} from '../../src/domain/discoveryBook/DiscoveryBook';
import { bookStore, settle, type BookStore } from '../support/discoveryBookStory';

const HIDDEN = { includeHiddenElements: true } as const;

interface World {
  store: BookStore;
  book: DiscoveryBookSession;
  /** Les écritures du carnet avant les réouvertures. */
  writes: number;
  announce: jest.SpyInstance;
}

let world: World;

function prepare(enemies: DiscoveryBook['enemies']): void {
  const store = bookStore({
    [DISCOVERY_BOOK_KEY]: serializeDiscoveryBook({ ...EMPTY_DISCOVERY_BOOK, enemies }),
  });
  world = {
    store,
    book: new DiscoveryBookSession({ keyValueStore: store }),
    writes: 0,
    announce: jest.spyOn(AccessibilityInfo, 'announceForAccessibility'),
  };
  world.announce.mockClear();
}

const bookWrites = () => world.store.writes.filter(([key]) => key === DISCOVERY_BOOK_KEY).length;
const stored = (kind: EnemyKind) =>
  parseDiscoveryBook(world.store.values.get(DISCOVERY_BOOK_KEY) ?? null).book.enemies[kind];

/** Ouvre la page de `kind` avec la session `book`, et laisse passer les 4 pas du remplissage. */
async function openPage(book: DiscoveryBookSession, kind: EnemyKind) {
  const { dependencies } = ascentSetUp();
  const view = await renderScreen(
    <EnemyPageScreen book={book} kind={kind} onBack={() => undefined} />,
    dependencies,
  );
  return view;
}

async function playFill(): Promise<void> {
  await act(async () => {
    jest.advanceTimersByTime(4 * FILL_STEP_MS);
  });
  await settle();
}

/** Une victoire sur `kind` dans un vrai combat, enregistrée par la session `book`. */
function defeat(book: DiscoveryBookSession, kind: EnemyKind): void {
  const battle = startBattle({ seed: 3, defenseHint: false, at: 0, enemies: [kind] }).battle;
  book.record(null, battle, []);
  book.record(battle, withEnemyAt(battle, 0, { hp: 0 }), [
    { type: 'enemyDefeated', at: 1, enemy: 0 },
  ]);
}

/** La page de `kind` s'affiche remplie, sans animation ni « Page remplie ». */
function expectFilledWithoutFill(kind: EnemyKind): void {
  expect(screen.getByTestId(`enemy-page-image-${kind}`, HIDDEN)).toBeOnTheScreen();
  expect(screen.queryByTestId('enemy-page-fill', HIDDEN)).not.toBeOnTheScreen();
  expect(screen.queryByText('Page remplie', HIDDEN)).not.toBeOnTheScreen();
}

const steps: StepDefinitions = ({ given, when, then }) => {
  given(/^la page de l'Embrasé déjà vue remplie$/u, async () => {
    jest.useFakeTimers();
    prepare({ burningHusk: { state: 'defeated', isNew: true } });
    await world.book.load();
    const first = await openPage(world.book, 'burningHusk');
    await playFill();
    expect(screen.getByText('Page remplie', HIDDEN)).toBeOnTheScreen();
    await act(async () => first.unmount());
    expect(stored('burningHusk')).toMatchObject({ pageSeen: true });
    world.writes = bookWrites();
    world.announce.mockClear();
  });

  when(
    /^le joueur la rouvre, dans la même visite du carnet, après avoir fermé l'app ou après avoir de nouveau vaincu un Embrasé$/u,
    async () => {
      // La même visite du carnet : la même session.
      const again = await openPage(world.book, 'burningHusk');
      await playFill();
      expectFilledWithoutFill('burningHusk');
      await act(async () => again.unmount());

      // Après avoir fermé l'app : une nouvelle session sur le même stockage.
      const reopened = new DiscoveryBookSession({ keyValueStore: world.store });
      await reopened.load();
      const afterClose = await openPage(reopened, 'burningHusk');
      await playFill();
      expectFilledWithoutFill('burningHusk');
      await act(async () => afterClose.unmount());

      // Après une nouvelle victoire, dont la découverte attend la lecture du carnet.
      const next = new DiscoveryBookSession({ keyValueStore: world.store });
      defeat(next, 'burningHusk');
      await next.load();
      await next.flush();
      expect(next.page('burningHusk')).toMatchObject({ state: 'defeated', firstFill: false });
      await openPage(next, 'burningHusk');
      await playFill();
    },
  );

  then(/^la page s'affiche remplie, sans animation ni « Page remplie »$/u, () => {
    expectFilledWithoutFill('burningHusk');
    expect(world.announce).not.toHaveBeenCalled();
    expect(stored('burningHusk')).toMatchObject({ state: 'defeated', pageSeen: true });
    // Aucune nouvelle marque à écrire : la page vue ne s'écrit qu'une fois.
    expect(bookWrites()).toBe(world.writes);
    jest.useRealTimers();
  });

  given(/^la page cachée de la Mère-ronce déjà ouverte$/u, async () => {
    jest.useFakeTimers();
    prepare({ brambleMother: { state: 'encountered' } });
    await world.book.load();
    const hidden = await openPage(world.book, 'brambleMother');
    await playFill();
    expect(screen.getByTestId('enemy-page-silhouette-brambleMother', HIDDEN)).toBeOnTheScreen();
    expect(screen.queryByText('Page remplie', HIDDEN)).not.toBeOnTheScreen();
    await act(async () => hidden.unmount());
    // La page cachée ne marque rien.
    expect(stored('brambleMother')).toEqual({ state: 'encountered' });
    expect(bookWrites()).toBe(0);
  });

  when(
    /^la Mère-ronce est vaincue dans une ascension suivante, puis que le joueur ouvre sa page$/u,
    async () => {
      const next = new DiscoveryBookSession({ keyValueStore: world.store });
      await next.load();
      defeat(next, 'brambleMother');
      await next.flush();
      expect(stored('brambleMother')).toEqual({ state: 'defeated', isNew: true });
      await openPage(next, 'brambleMother');
    },
  );

  then(/^la page se colore et « Page remplie » s'affiche$/u, async () => {
    expect(screen.getByTestId('enemy-page-fill', HIDDEN)).toBeOnTheScreen();
    expect(screen.queryByText('Page remplie', HIDDEN)).not.toBeOnTheScreen();
    await playFill();
    expect(screen.getByText('Page remplie', HIDDEN)).toBeOnTheScreen();
    expect(world.announce).toHaveBeenCalledWith('Page remplie : Mère-ronce.');
    expect(stored('brambleMother')).toEqual({ state: 'defeated', isNew: true, pageSeen: true });
    jest.useRealTimers();
  });
};

// Les scénarios `@session` seuls.
const feature = loadFeature('features/page-d-un-ennemi.feature');
const ofSession = ({ tags }: { readonly tags: readonly string[] }) => tags.includes('@session');
autoBindSteps(
  [
    {
      ...feature,
      scenarios: feature.scenarios.filter(ofSession),
      scenarioOutlines: feature.scenarioOutlines.filter(ofSession),
    },
  ],
  [steps],
);
