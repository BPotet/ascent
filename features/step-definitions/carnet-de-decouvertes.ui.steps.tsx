/**
 * « Le carnet de découvertes et son Bestiaire » (#282) à l'écran : une vraie session d'ascension, une
 * vraie session du carnet et une vraie session du camp sur un Stockage clé-valeur en mémoire, puis
 * les vrais écrans du pied de la tour, du carnet, de l'ascension et du camp. Le passage du pied de la
 * tour au carnet suit la touche « Le carnet » et le retour du carnet, comme les routes de l'app.
 */
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';
import { useState } from 'react';
import { AccessibilityInfo, Dimensions, StyleSheet } from 'react-native';

import { AscentScreen } from '../../src/adapters/ui/screens/AscentScreen';
import { CampScreen } from '../../src/adapters/ui/screens/CampScreen';
import { DiscoveryBookScreen } from '../../src/adapters/ui/screens/DiscoveryBookScreen';
import { TowerFootScreen } from '../../src/adapters/ui/screens/TowerFootScreen';
import { ascentSetUp } from '../../src/adapters/ui/testing/ascent';
import { renderScreen } from '../../src/adapters/ui/testing/renderScreen';
import { spyBattles, winShownBattle } from '../../src/adapters/ui/testing/winShownBattle';
import { ASCENT_KEY, SHARD_TOTAL_KEY } from '../../src/application/useCases/AscentSession';
import { DISCOVERY_BOOK_KEY } from '../../src/application/useCases/DiscoveryBookSession';
import { startAscent, type Ascent } from '../../src/domain/ascent/Ascent';
import type { Tier } from '../../src/domain/ascent/tiers';
import { startBattle } from '../../src/domain/battle/Battle';
import type { EnemyKind } from '../../src/domain/battle/combatants';
import { kindsAlong } from '../../src/domain/battle/enemyKinds';
import { BESTIARY_CATALOG, catalogKinds } from '../../src/domain/discoveryBook/bestiary';
import {
  EMPTY_DISCOVERY_BOOK,
  parseDiscoveryBook,
  serializeDiscoveryBook,
  type DiscoveryBook,
} from '../../src/domain/discoveryBook/DiscoveryBook';

jest.mock('../../src/adapters/ui/battle/BattleCanvas', () =>
  jest.requireActual('../../src/adapters/ui/battle/testing/fakeBattleCanvas'),
);

type SetUp = ReturnType<typeof ascentSetUp>;

interface World {
  setUp: SetUp;
  /** La valeur de l'ascension sauvegardée avant d'ouvrir le carnet. */
  savedAscent: string | undefined;
  /** Les noms de code tombés pour de bon, dans l'ordre de leur chute. */
  falls: EnemyKind[];
  announce: jest.SpyInstance;
  shards: string | undefined;
  reads: string[];
}

let world: World;

const HIDDEN = { includeHiddenElements: true } as const;

const TIER_ONE = catalogKinds({
  ...BESTIARY_CATALOG,
  2: { enemies: [], elites: [], bosses: [] },
  3: { enemies: [], elites: [], bosses: [] },
});

/** Le carnet B1 de la maquette : 9 pages remplies au palier 1, 2 rencontrés. */
const MIDWAY: DiscoveryBook = {
  ...EMPTY_DISCOVERY_BOOK,
  lastTier: 1,
  enemies: {
    ...Object.fromEntries(TIER_ONE.slice(0, 5).map((kind) => [kind, { state: 'defeated' }])),
    candleBearer: { state: 'encountered' },
    fallenKnight: { state: 'defeated' },
    twins: { state: 'defeated' },
    gravedigger: { state: 'encountered' },
    ossuaryWarden: { state: 'defeated' },
    cryptRat: { state: 'defeated' },
  },
};

/** Un stockage pour le pied de la tour : `book` déjà écrit, `saved` en cours. */
function prepare({
  book,
  saved,
  battle = false,
}: { book?: DiscoveryBook; saved?: Ascent; battle?: boolean } = {}): SetUp {
  const setUp = ascentSetUp({
    shards: 36,
    book: true,
    ...(saved !== undefined && { saved }),
    ...(saved !== undefined &&
      battle && {
        battle: startBattle({
          seed: 3,
          defenseHint: false,
          at: 500,
          initiative: true,
          enemies: saved.encounter!.enemies,
        }).battle,
      }),
  });
  if (book !== undefined) {
    setUp.keyValueStore.values.set(DISCOVERY_BOOK_KEY, serializeDiscoveryBook(book));
  }
  const reads: string[] = [];
  const get = setUp.keyValueStore.get;
  setUp.keyValueStore.get = (key) => {
    reads.push(key);
    return get(key);
  };
  world = {
    setUp,
    savedAscent: setUp.keyValueStore.values.get(ASCENT_KEY),
    falls: [],
    announce: jest.spyOn(AccessibilityInfo, 'announceForAccessibility'),
    shards: setUp.keyValueStore.values.get(SHARD_TOTAL_KEY),
    reads,
  };
  world.announce.mockClear();
  return setUp;
}

/** Le pied de la tour, et le carnet qu'ouvre « Le carnet » ; son retour ramène au pied de la tour. */
function TowerAndBook({ setUp, opened }: { readonly setUp: SetUp; readonly opened: boolean }) {
  const [book, setBook] = useState(opened);
  if (book) {
    const ascent = setUp.session.current();
    return (
      <DiscoveryBookScreen
        book={setUp.discoveryBook}
        currentTier={ascent !== null && ascent.outcome === null ? ascent.tier : null}
        onLeave={() => setBook(false)}
      />
    );
  }
  return (
    <TowerFootScreen
      session={setUp.session}
      camp={setUp.camp}
      onEnter={() => undefined}
      onCamp={() => undefined}
      book={setUp.discoveryBook}
      onBook={() => setBook(true)}
    />
  );
}

async function showTower(setUp: SetUp, opened = false): Promise<void> {
  if (opened) await setUp.session.load();
  await renderScreen(<TowerAndBook setUp={setUp} opened={opened} />, setUp.dependencies);
  if (!opened) await screen.findByTestId('tower-foot-camp-book');
}

const buttonLabels = () =>
  screen.getAllByRole('button').map((button) => String(button.props.accessibilityLabel));

const storedBook = () =>
  parseDiscoveryBook(world.setUp.keyValueStore.values.get(DISCOVERY_BOOK_KEY) ?? null).book;

const chip = (tier: Tier) => screen.getByTestId(`book-tier-chip-${tier}`);
const selected = (tier: Tier) =>
  expect(chip(tier)).toHaveProp('accessibilityState', expect.objectContaining({ selected: true }));

/** Une ascension au palier `tier`, devant `enemies` à l'étage 3, le héros solide. */
const before = (tier: Tier, enemies: readonly EnemyKind[]): Ascent => {
  const ascent = startAscent(42);
  return {
    ...ascent,
    tier,
    floor: 3,
    encounter: { kind: 'combat', enemies, battleSeed: 7 },
    hero: { ...ascent.hero, hp: 999, maxHp: 999 },
  };
};

/** L'écran de l'ascension devant `enemies`, le combat suivi chute par chute. */
async function showBattle(enemies: readonly EnemyKind[], tier: Tier): Promise<void> {
  const setUp = prepare({ saved: before(tier, enemies) });
  await setUp.session.load();
  const battles = spyBattles(setUp.session);
  await renderScreen(
    <AscentScreen
      session={setUp.session}
      visibility={{ onChange: () => () => {} }}
      onLeave={jest.fn()}
    />,
    setUp.dependencies,
  );
  const battle = battles.mock.results.at(-1)!.value as ReturnType<
    SetUp['session']['battleSession']
  >;
  let previous = battle.current()!.battle;
  battle.subscribe(({ battle: next, events }) => {
    const kinds = kindsAlong(previous, events);
    events.forEach((event, index) => {
      if (event.type === 'enemyDefeated' || event.type === 'summonedFell') {
        world.falls.push(kinds[index]!);
      }
    });
    // Pendant les manches, aucune ligne du carnet, aucune annonce du carnet.
    if (next.phase.kind !== 'over') {
      expect(screen.queryByTestId('book-line', HIDDEN)).not.toBeOnTheScreen();
    }
    previous = next;
  });
  await winShownBattle(battles, setUp.clock);
  await act(async () => {
    for (let index = 0; index < 20; index += 1) await Promise.resolve();
  });
}

function largeText(fontScale: number) {
  Dimensions.set({
    window: { ...Dimensions.get('window'), width: 360, fontScale },
    screen: { ...Dimensions.get('screen'), width: 360, fontScale },
  });
}

const steps: StepDefinitions = ({ given, when, then, and }) => {
  // --- Accès ---

  given(/^le Pied de la tour, sans ascension en cours$/u, async () => {
    await showTower(prepare({ book: MIDWAY }));
  });

  then(
    /^une touche « Le carnet » est sur la même ligne que « Le camp », sous « Commencer l'ascension »$/u,
    () => {
      const row = screen.getByTestId('tower-foot-camp-book');
      expect(StyleSheet.flatten(row.props.style).flexDirection).toBe('row');
      expect(
        within(row)
          .getAllByRole('button')
          .map((button) => button.props.accessibilityLabel),
      ).toEqual(['Le camp', 'Le carnet']);
      const labels = buttonLabels();
      expect(labels.indexOf('Le camp')).toBe(labels.indexOf("Commencer l'ascension") + 1);
    },
  );

  when(/^le joueur touche « Le carnet »$/u, async () => {
    await fireEvent.press(screen.getByRole('button', { name: 'Le carnet' }));
  });

  then(/^le carnet s'ouvre sur le Bestiaire$/u, async () => {
    expect(await screen.findByRole('header', { name: 'Le carnet' })).toBeOnTheScreen();
    expect(screen.getByTestId('book-tier-chips')).toHaveProp('accessibilityRole', 'tablist');
    expect(screen.getByTestId('book-section-enemy')).toBeOnTheScreen();
    expect(screen.queryByTestId('tower-foot-camp-book')).not.toBeOnTheScreen();
  });

  given(/^une ascension en pause, au Pied de la tour$/u, async () => {
    await showTower(
      prepare({ book: MIDWAY, saved: before(2, ['burningHusk', 'thornPilgrim']), battle: true }),
    );
  });

  then(
    /^« Le carnet » est sur la même ligne que « Le camp », sous « Reprendre l'ascension »$/u,
    () => {
      const row = screen.getByTestId('tower-foot-camp-book');
      expect(
        within(row)
          .getAllByRole('button')
          .map((button) => button.props.accessibilityLabel),
      ).toEqual(['Le camp', 'Le carnet']);
      const labels = buttonLabels();
      expect(labels.indexOf('Le camp')).toBe(labels.indexOf("Reprendre l'ascension") + 1);
      expect(labels.indexOf("Abandonner l'ascension")).toBe(labels.indexOf('Le carnet') + 1);
    },
  );

  when(/^le joueur ouvre le carnet puis en sort$/u, async () => {
    await fireEvent.press(screen.getByRole('button', { name: 'Le carnet' }));
    expect(await screen.findByRole('header', { name: 'Le carnet' })).toBeOnTheScreen();
    // Ouvert pendant l'ascension : au palier de l'ascension en cours (D8).
    selected(2);
    await fireEvent.press(screen.getByRole('button', { name: 'Retour au pied de la tour' }));
  });

  then(/^il revient au Pied de la tour et l'ascension est inchangée$/u, async () => {
    expect(await screen.findByRole('button', { name: "Reprendre l'ascension" })).toBeOnTheScreen();
    expect(screen.queryByTestId('discovery-book')).not.toBeOnTheScreen();
    expect(world.setUp.keyValueStore.values.get(ASCENT_KEY)).toBe(world.savedAscent);
    expect(world.setUp.session.resuming()).toBe(true);
  });

  given(/^le Camp, l'écran de combat ou un écran de l'ascension$/u, () => {
    world = { ...world };
  });

  then(/^aucun lien n'y ouvre le carnet$/u, async () => {
    const noBook = () => {
      expect(buttonLabels().filter((label) => /carnet/iu.test(label))).toEqual([]);
      expect(screen.queryByText('Le carnet')).not.toBeOnTheScreen();
    };
    // Le Camp.
    const camp = prepare({ book: MIDWAY });
    const shownCamp = await renderScreen(
      <CampScreen camp={camp.camp} onLeave={jest.fn()} />,
      camp.dependencies,
    );
    await screen.findByRole('header', { name: 'Le camp' });
    noBook();
    shownCamp.unmount();
    // L'écran de combat, puis l'écran des sorties qui le suit (la ligne du carnet ne se touche pas).
    await showBattle(['ghoul'], 1);
    noBook();
    expect(screen.getByTestId('book-line')).not.toHaveProp('accessibilityRole', 'button');
  });

  // --- Démarrage ---

  given(/^un joueur qui a déjà fait des ascensions avant la mise à jour$/u, () => {
    const setUp = prepare();
    setUp.keyValueStore.values.set('ascent.log.index', JSON.stringify({ version: 1, ids: [1] }));
    setUp.keyValueStore.values.set(
      'ascent.log.1',
      JSON.stringify({ id: 1, steps: [{ kind: 'battleStarted', enemies: ['ghoul'] }] }),
    );
  });

  and(/^aucune ascension en cours$/u, () => {
    expect(world.setUp.keyValueStore.values.has(ASCENT_KEY)).toBe(false);
    expect(world.setUp.keyValueStore.values.has(DISCOVERY_BOOK_KEY)).toBe(false);
  });

  when(/^il ouvre le carnet pour la première fois$/u, async () => {
    await showTower(world.setUp);
    await fireEvent.press(screen.getByRole('button', { name: 'Le carnet' }));
    await screen.findByTestId('book-tier-frame');
  });

  then(/^toutes les entrées du Bestiaire sont « \?\?\? »$/u, async () => {
    for (const tier of [1, 2, 3] as const) {
      await fireEvent.press(chip(tier));
      const total = tier === 3 ? 13 : 12;
      expect(screen.getAllByText('???')).toHaveLength(total);
      expect(within(chip(tier)).getByText(`0/${total}`)).toBeOnTheScreen();
    }
    expect(screen.getByText('0 découverte sur 48')).toBeOnTheScreen();
  });

  and(/^le bandeau de première utilisation explique comment le carnet se remplit$/u, () => {
    expect(screen.getByTestId('book-first-use')).toHaveTextContent(
      "Ton carnet commence aujourd'hui. Chaque ennemi que tu croises dans la tour s'y inscrit ; vaincs-le pour remplir sa page.",
    );
  });

  and(/^les ascensions passées ne sont pas relues$/u, () => {
    expect(world.reads.filter((key) => key.startsWith('ascent.log'))).toEqual([]);
    expect(world.reads).toContain(DISCOVERY_BOOK_KEY);
  });

  // --- Bestiaire et compteurs ---

  given(/^le carnet ouvert$/u, () => undefined);

  then(
    /^le Bestiaire est au palier de l'ascension en cours ou de la dernière ascension, au palier 1 s'il n'y en a pas$/u,
    async () => {
      // Une ascension en cours au palier 2, le dernier combat au palier 3.
      await showTower(
        prepare({ book: { ...MIDWAY, lastTier: 3 }, saved: before(2, ['ghoul']) }),
        true,
      );
      await screen.findByTestId('book-tier-frame');
      selected(2);
      screen.unmount();
      // Sans ascension en cours : le palier du dernier combat.
      await showTower(prepare({ book: { ...MIDWAY, lastTier: 3 } }), true);
      await screen.findByTestId('book-tier-frame');
      selected(3);
      screen.unmount();
      // Sans ascension du tout : le palier 1.
      await showTower(prepare({ book: { ...MIDWAY, lastTier: null } }), true);
      await screen.findByTestId('book-tier-frame');
      selected(1);
    },
  );

  and(/^une puce par palier donne ses pages remplies : « Palier 1 · 9\/12 »$/u, () => {
    expect(within(screen.getByTestId('book-tier-chips')).getAllByRole('tab')).toHaveLength(3);
    expect(within(chip(1)).getByText('Palier 1')).toBeOnTheScreen();
    expect(within(chip(1)).getByText('9/12')).toBeOnTheScreen();
    expect(within(chip(2)).getByText('0/12')).toBeOnTheScreen();
    expect(within(chip(3)).getByText('0/13')).toBeOnTheScreen();
  });

  and(/^le palier montre ses sections Ennemis, Élites et Boss, chacune avec son compte$/u, () => {
    expect(screen.getByTestId('book-section-enemy')).toHaveProp('accessibilityLabel', 'Ennemis');
    expect(screen.getByTestId('book-section-elite')).toHaveProp('accessibilityLabel', 'Élites');
    expect(screen.getByTestId('book-section-boss')).toHaveProp('accessibilityLabel', 'Boss');
    expect(screen.getByTestId('book-section-count-enemy')).toHaveTextContent('6/7');
    expect(screen.getByTestId('book-section-count-elite')).toHaveTextContent('2/3');
    expect(screen.getByTestId('book-section-count-boss')).toHaveTextContent('1/2');
    // Un palier à la fois : aucune entrée d'un autre palier.
    expect(screen.queryByTestId('book-entry-burningHusk')).not.toBeOnTheScreen();
  });

  given(/^une entrée « \?\?\? »$/u, async () => {
    await showTower(prepare({ book: { ...MIDWAY, lastTier: 2 } }), true);
    await screen.findByTestId('book-tier-frame');
  });

  then(
    /^elle ne se touche pas et le lecteur d'écran la lit « Élite inconnue, Palier 2 »$/u,
    async () => {
      const elite = screen.getByTestId('book-entry-scarecrow');
      expect(elite).toHaveProp('accessibilityLabel', 'Élite inconnue, Palier 2');
      expect(elite).not.toHaveProp('accessibilityRole', 'button');
      expect(
        screen.queryByRole('button', { name: 'Élite inconnue, Palier 2' }),
      ).not.toBeOnTheScreen();
      await fireEvent.press(elite);
      expect(screen.getByTestId('book-entry-scarecrow')).toBeOnTheScreen();
      expect(screen.getByRole('header', { name: 'Le carnet' })).toBeOnTheScreen();
    },
  );

  given(/^tous les ennemis du palier 1 vaincus$/u, async () => {
    await showTower(
      prepare({
        book: {
          ...EMPTY_DISCOVERY_BOOK,
          lastTier: 1,
          enemies: Object.fromEntries(TIER_ONE.map((kind) => [kind, { state: 'defeated' }])),
        },
      }),
      true,
    );
    await screen.findByTestId('book-tier-frame');
  });

  then(
    /^la puce et le cadre du palier passent à l'or avec « Toutes les pages du palier sont remplies. »$/u,
    () => {
      expect(screen.getByText('Toutes les pages du palier sont remplies.')).toBeOnTheScreen();
      expect(
        StyleSheet.flatten(screen.getByTestId('book-tier-frame').props.style).borderColor,
      ).toBe('#F2D49B');
      expect(StyleSheet.flatten(chip(1).props.style).borderColor).toBe('#F2D49B');
      expect(StyleSheet.flatten(within(chip(1)).getByText('12/12').props.style).color).toBe(
        '#F2D49B',
      );
      expect(chip(1)).toHaveProp('accessibilityLabel', expect.stringMatching(/, complet$/u));
    },
  );

  and(/^rien n'est gagné$/u, async () => {
    await fireEvent.press(screen.getByRole('button', { name: 'Retour au pied de la tour' }));
    await screen.findByTestId('tower-foot-camp-book');
    expect(world.setUp.keyValueStore.values.get(SHARD_TOTAL_KEY)).toBe(world.shards);
    expect(screen.getByLabelText('36 Éclats')).toBeOnTheScreen();
    expect(world.setUp.camp.view().availableShards).toBe(36);
  });

  // --- Nouveau ---

  given(
    /^l'Embrasé vaincu et la Phalénide rencontrée depuis la dernière sortie du carnet$/u,
    async () => {
      await showTower(
        prepare({
          book: {
            ...MIDWAY,
            lastTier: 2,
            enemies: {
              ...MIDWAY.enemies,
              burningHusk: { state: 'defeated', isNew: true },
              mothkin: { state: 'encountered', isNew: true },
            },
          },
        }),
      );
    },
  );

  then(/^la touche « Le carnet » porte le compteur 2$/u, () => {
    expect(screen.getByTestId('tower-foot-book-count')).toHaveTextContent('2');
    expect(screen.getByRole('button', { name: 'Le carnet, 2 nouvelles pages' })).toBeOnTheScreen();
  });

  when(/^le joueur ouvre le carnet$/u, async () => {
    await fireEvent.press(screen.getByRole('button', { name: 'Le carnet, 2 nouvelles pages' }));
    await screen.findByTestId('book-tier-frame');
  });

  then(
    /^l'Embrasé et la Phalénide portent « nouveau » et la puce du palier 2 son losange d'or$/u,
    () => {
      selected(2);
      expect(
        within(screen.getByTestId('book-entry-burningHusk')).getByText('nouveau'),
      ).toBeOnTheScreen();
      expect(
        within(screen.getByTestId('book-entry-mothkin')).getByText('nouveau'),
      ).toBeOnTheScreen();
      expect(screen.getAllByText('nouveau')).toHaveLength(2);
      expect(screen.getByTestId('book-chip-new-2')).toBeOnTheScreen();
      expect(screen.queryByTestId('book-chip-new-1')).not.toBeOnTheScreen();
      expect(screen.getByLabelText('Embrasé, vaincu, nouveau')).toBeOnTheScreen();
    },
  );

  when(/^il sort du carnet$/u, async () => {
    await fireEvent.press(screen.getByRole('button', { name: 'Retour au pied de la tour' }));
    await screen.findByTestId('tower-foot-camp-book');
  });

  then(
    /^les marques « nouveau » sont effacées et la touche « Le carnet » n'a plus de compteur$/u,
    async () => {
      expect(await screen.findByRole('button', { name: 'Le carnet' })).toBeOnTheScreen();
      expect(screen.queryByTestId('tower-foot-book-count')).not.toBeOnTheScreen();
      await act(async () => {
        for (let index = 0; index < 10; index += 1) await Promise.resolve();
      });
      expect(storedBook().enemies.burningHusk).toEqual({ state: 'defeated' });
      expect(storedBook().enemies.mothkin).toEqual({ state: 'encountered' });
      await fireEvent.press(screen.getByRole('button', { name: 'Le carnet' }));
      await screen.findByTestId('book-tier-frame');
      expect(screen.queryByText('nouveau')).not.toBeOnTheScreen();
    },
  );

  given(/^aucune entrée nouvelle$/u, async () => {
    await showTower(prepare({ book: MIDWAY }));
  });

  then(
    /^la touche « Le carnet » n'a pas de compteur et le lecteur d'écran la lit « Le carnet, bouton »$/u,
    () => {
      const book = screen.getByTestId('tower-foot-book');
      expect(book).toHaveProp('accessibilityRole', 'button');
      expect(book).toHaveProp('accessibilityLabel', 'Le carnet');
      expect(screen.queryByTestId('tower-foot-book-count')).not.toBeOnTheScreen();
    },
  );

  // --- Ligne du carnet après un combat ---

  given(/^un Embrasé jamais vaincu$/u, () => undefined);

  when(/^le joueur gagne le combat où l'Embrasé tombe$/u, async () => {
    await showBattle(['burningHusk'], 2);
    expect(world.falls).toEqual(['burningHusk']);
  });

  then(
    /^l'écran qui suit le combat montre, sous « Étage franchi », la ligne « Nouvelle page : Embrasé »$/u,
    async () => {
      const banner = await screen.findByTestId('ascent-floor-banner');
      const children = banner.children as unknown as { props: { testID?: string } }[];
      expect(within(banner).getByText(/^Étage franchi · \+\d+ Or$/u)).toBeOnTheScreen();
      expect(children.at(-1)?.props.testID).toBe('book-line');
      expect(within(banner).getByText(/Nouvelle page :/u)).toHaveTextContent(
        'Nouvelle page : Embrasé',
      );
    },
  );

  and(/^le lecteur d'écran l'annonce poliment$/u, async () => {
    const line = screen.getByTestId('book-line');
    expect(line).toHaveProp('accessibilityLiveRegion', 'polite');
    expect(line).toHaveProp('accessibilityLabel', 'Carnet : nouvelle page, Embrasé.');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 800));
    });
    expect(world.announce).toHaveBeenCalledWith('Carnet : nouvelle page, Embrasé.');
  });

  and(/^rien ne s'affiche pendant les manches$/u, () => {
    // Vérifié à chaque mise à jour du combat, jusqu'à sa fin (`showBattle`).
    expect(
      world.announce.mock.calls.filter(([text]) => String(text).startsWith('Carnet')),
    ).toHaveLength(1);
  });

  given(/^quatre ennemis jamais vaincus qui tombent dans un même combat gagné$/u, async () => {
    await showBattle(['ghoul', 'specter', 'madVillager', 'cryptRat'], 1);
    expect(new Set(world.falls).size).toBe(4);
  });

  then(
    /^une seule ligne donne leur nombre puis les noms dans l'ordre de leur chute$/u,
    async () => {
      expect(await screen.findAllByTestId('book-line')).toHaveLength(1);
      const names = {
        ghoul: 'Goule',
        specter: 'Spectre',
        madVillager: 'Villageois fou',
        cryptRat: 'Rat de crypte',
      };
      const first = world.falls.slice(0, 3).map((kind) => names[kind as keyof typeof names]);
      expect(screen.getByTestId('book-line')).toHaveTextContent(
        `4 nouvelles pages : ${first.join(', ')} … et 1 autre`,
      );
    },
  );

  and(/^au-delà de 3 noms, elle finit par « … et n autres »$/u, () => {
    expect(screen.getByTestId('book-line')).toHaveTextContent(/… et 1 autre$/u);
  });

  // --- États de l'écran ---

  given(/^une lecture du carnet qui échoue$/u, async () => {
    const setUp = prepare({ book: MIDWAY });
    const get = setUp.keyValueStore.get;
    let failing = true;
    setUp.keyValueStore.get = async (key) => {
      if (failing && key === DISCOVERY_BOOK_KEY) throw new Error('read failed');
      return get(key);
    };
    world.reads = [];
    (world as World & { heal: () => void }).heal = () => {
      failing = false;
    };
    await showTower(setUp, true);
  });

  then(
    /^l'écran dit « Le carnet n'a pas pu s'ouvrir. Tes découvertes ne sont pas perdues. » et propose de réessayer$/u,
    async () => {
      expect(await screen.findByRole('alert')).toHaveTextContent(
        "Le carnet n'a pas pu s'ouvrir. Tes découvertes ne sont pas perdues.",
      );
      expect(screen.getByRole('button', { name: 'Réessayer' })).toBeOnTheScreen();
    },
  );

  and(/^aucune découverte n'est effacée$/u, async () => {
    expect(storedBook()).toEqual(MIDWAY);
    (world as World & { heal: () => void }).heal();
    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByText('9/12')).toBeOnTheScreen();
    expect(storedBook()).toEqual(MIDWAY);
  });

  given(/^la police du système agrandie$/u, async () => {
    largeText(1.3);
    await showTower(prepare({ book: MIDWAY }), true);
    await screen.findByTestId('book-tier-frame');
  });

  then(/^la grille du Bestiaire passe à 2 colonnes, sans défilement horizontal à 360 dp$/u, () => {
    const width = StyleSheet.flatten(screen.getByTestId('book-entry-ghoul').props.style)
      .width as number;
    expect(width).toBe(160);
    // 2 cases et leur écart tiennent dans la largeur utile (360 dp moins les marges de 16 dp).
    expect(2 * width + 8).toBeLessThanOrEqual(328);
    expect(3 * width + 16).toBeGreaterThan(328);
  });
};

// Les scénarios `@ui` seuls.
const feature = loadFeature('features/carnet-de-decouvertes.feature');
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
