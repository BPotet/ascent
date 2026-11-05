/**
 * « Le camp et le Gardien de la flamme » (#40) à l'écran : une vraie session d'ascension et une vraie
 * session du camp sur un Stockage clé-valeur en mémoire, puis les vrais écrans du camp, du pied de la
 * tour et de la fin de l'ascension. Quitter le camp ouvert depuis la fin d'une ascension passe par
 * les vraies routes de l'app, sur une vraie base SQLite (node:sqlite), dans le build de preview.
 */
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { router } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';
import path from 'node:path';
import type { ReactElement } from 'react';

import { openAscentDatabase } from '../../src/adapters/persistence/sqlite/openAscentDatabase';
import { prepareAscentDatabase } from '../../src/adapters/persistence/sqlite/prepareAscentDatabase';
import { SqliteKeyValueStore } from '../../src/adapters/persistence/sqlite/SqliteKeyValueStore';
import { openNodeSqliteDatabase } from '../../src/adapters/persistence/testing/nodeSqliteDatabase';
import { availableShardsText } from '../../src/adapters/ui/format/campText';
import { AscentScreen } from '../../src/adapters/ui/screens/AscentScreen';
import { CampScreen } from '../../src/adapters/ui/screens/CampScreen';
import { TowerFootScreen } from '../../src/adapters/ui/screens/TowerFootScreen';
import { ascentSetUp } from '../../src/adapters/ui/testing/ascent';
import { renderScreen } from '../../src/adapters/ui/testing/renderScreen';
import { ASCENT_KEY, SHARD_TOTAL_KEY } from '../../src/application/useCases/AscentSession';
import { abandonAscent, startAscent, type Ascent } from '../../src/domain/ascent/Ascent';
import type { Unlock } from '../../src/domain/ascent/unlocks';

jest.mock('../../src/adapters/persistence/sqlite/openAscentDatabase', () => ({
  openAscentDatabase: jest.fn(),
}));
jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => ({
    addListener: jest.fn(),
    seekTo: jest.fn(async () => undefined),
    play: jest.fn(),
    remove: jest.fn(),
  })),
  setAudioModeAsync: jest.fn(async () => undefined),
}));
jest.mock('../../src/adapters/ui/battle/BattleCanvas', () =>
  jest.requireActual('../../src/adapters/ui/battle/testing/fakeBattleCanvas'),
);

const appDirectory = path.resolve(__dirname, '../../src/app');
const HIDDEN = { includeHiddenElements: true } as const;

// Le canal du build, rendu après chaque scénario : seul le dernier se joue dans le build de preview.
const initialChannel = process.env.EXPO_PUBLIC_ASCENT_CHANNEL;
afterEach(() => {
  if (initialChannel === undefined) delete process.env.EXPO_PUBLIC_ASCENT_CHANNEL;
  else process.env.EXPO_PUBLIC_ASCENT_CHANNEL = initialChannel;
});

type SetUp = ReturnType<typeof ascentSetUp>;

/** Ce que montre l'écran de fin, puis ce que fait « Aller au camp », pour une fin d'ascension. */
interface EndSeen {
  readonly buttons: readonly string[];
  readonly campOpened: boolean;
  readonly ascentLeft: boolean;
  readonly campInProgress: boolean;
}

interface World {
  setUp: SetUp;
  ends: readonly Ascent[];
  seen: EndSeen[];
  left: { readonly foot: boolean; readonly end: boolean }[];
}

let world: World;
/** Le rendu du scénario en cours : un écran suivant le remplace, dans le même rendu. */
let rerender: ((element: ReactElement) => Promise<void>) | null = null;

function given(options: Parameters<typeof ascentSetUp>[0]): void {
  world = { setUp: ascentSetUp(options), ends: [], seen: [], left: [] };
  rerender = null;
}

async function show(element: ReactElement): Promise<void> {
  if (rerender !== null) {
    await rerender(element);
    return;
  }
  const rendered = await renderScreen(element, world.setUp.dependencies);
  rerender = async (next) => {
    await rendered.rerender(next);
  };
}

async function showCamp(): Promise<void> {
  await world.setUp.session.load();
  await show(<CampScreen camp={world.setUp.camp} onLeave={jest.fn()} />);
  await screen.findByTestId('camp-purse');
}

async function showTowerFoot(): Promise<void> {
  await show(
    <TowerFootScreen
      key="tower-foot"
      session={world.setUp.session}
      camp={world.setUp.camp}
      onEnter={jest.fn()}
      onCamp={jest.fn()}
    />,
  );
  await screen.findByTestId('tower-foot-shards');
}

const card = (unlock: Unlock) => within(screen.getByTestId(`camp-card-${unlock}`));

async function buy(name: string, price: number): Promise<void> {
  await fireEvent.press(screen.getByRole('button', { name: `Débloquer ${name}, ${price} Éclats` }));
  await fireEvent.press(screen.getByRole('button', { name: `Débloquer pour ${price} Éclats` }));
}

/** La base de l'app, avec une chute au palier 1 sauvegardée sur le bilan, 82 Éclats et l'Épieu. */
function appWithAFall(): void {
  jest.mocked(openAscentDatabase).mockImplementation(async () => {
    const database = await prepareAscentDatabase(openNodeSqliteDatabase());
    const store = new SqliteKeyValueStore(database);
    const fallen: Ascent = { ...startAscent(7), floor: 3, encounter: null, outcome: 'fall' };
    await store.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent: fallen, battle: null }));
    await store.set(
      SHARD_TOTAL_KEY,
      JSON.stringify({ version: 1, total: 82, seed: null, awarded: [] }),
    );
    return database;
  });
}

const steps: StepDefinitions = ({ given: givenStep, when, then, and }) => {
  givenStep(/^le joueur n'a encore rien débloqué et a gagné 22 Éclats$/u, () => {
    given({ shards: 22 });
  });

  when(/^il ouvre le camp depuis le pied de la tour$/u, async () => {
    const onCamp = jest.fn();
    await show(
      <TowerFootScreen
        session={world.setUp.session}
        camp={world.setUp.camp}
        onEnter={jest.fn()}
        onCamp={onCamp}
      />,
    );
    await fireEvent.press(await screen.findByRole('button', { name: 'Le camp' }));
    expect(onCamp).toHaveBeenCalledTimes(1);
    await show(<CampScreen camp={world.setUp.camp} onLeave={jest.fn()} />);
  });

  then(/^il voit le Gardien de la flamme et « 22 Éclats disponibles »$/u, async () => {
    expect(await screen.findByLabelText('22 Éclats disponibles')).toBeOnTheScreen();
    expect(screen.getByTestId('camp-flame-keeper', HIDDEN)).toBeOnTheScreen();
    expect(screen.getByText('Le Gardien de la flamme')).toBeOnTheScreen();
  });

  and(
    /^le catalogue montre, par prix croissant : Épieu de chasse \(20\), Clochette du guet \(40\), Cœur de braise \(80\) et Flamberge \(80\)$/u,
    () => {
      expect(
        screen.getAllByTestId(/^camp-card-/).map((element) => element.props.testID as string),
      ).toEqual([
        'camp-card-huntingSpear',
        'camp-card-watchBell',
        'camp-card-emberHeart',
        'camp-card-flamberge',
      ]);
      expect(
        card('huntingSpear').getByRole('button', { name: 'Débloquer Épieu de chasse, 20 Éclats' }),
      ).toBeOnTheScreen();
      expect(
        card('watchBell').getByRole('button', {
          name: 'Clochette du guet, 40 Éclats, il manque 18 Éclats.',
        }),
      ).toBeOnTheScreen();
      expect(
        card('emberHeart').getByRole('button', {
          name: 'Cœur de braise, 80 Éclats, il manque 58 Éclats.',
        }),
      ).toBeOnTheScreen();
      expect(
        card('flamberge').getByRole('button', {
          name: 'Flamberge, 80 Éclats, il manque 58 Éclats.',
        }),
      ).toBeOnTheScreen();
    },
  );

  givenStep(/^le joueur a (\d+) Éclats disponibles$/u, async (shards: string) => {
    given({ shards: Number(shards) });
    await showCamp();
  });

  when(/^il débloque la Clochette du guet$/u, async () => {
    await buy('Clochette du guet', 40);
  });

  then(/^il a (\d+) Éclats? disponibles?$/u, (shards: string) => {
    expect(screen.getByLabelText(availableShardsText(Number(shards)))).toBeOnTheScreen();
  });

  and(/^la carte de la Clochette du guet affiche « Déjà dans la tour »$/u, () => {
    expect(card('watchBell').getByText('Déjà dans la tour')).toBeOnTheScreen();
  });

  then(/^la carte de la Flamberge est affichée mais ne peut pas être achetée$/u, () => {
    expect(
      card('flamberge').getByRole('button', { name: 'Flamberge, 80 Éclats, il manque 20 Éclats.' }),
    ).toBeDisabled();
  });

  and(/^elle indique « Il manque 20 Éclats »$/u, () => {
    expect(card('flamberge').getByText('Il manque 20 Éclats')).toBeOnTheScreen();
  });

  givenStep(/^le joueur a déjà débloqué l'Épieu de chasse$/u, async () => {
    given({ shards: 100, unlocks: ['huntingSpear'] });
    await showCamp();
  });

  then(/^sa carte affiche « Déjà dans la tour », sans pouvoir le racheter$/u, () => {
    expect(card('huntingSpear').getByText('Déjà dans la tour')).toBeOnTheScreen();
    expect(card('huntingSpear').queryByRole('button')).not.toBeOnTheScreen();
  });

  givenStep(/^le joueur a gagné 220 Éclats en tout$/u, async () => {
    given({ shards: 220 });
    await showCamp();
  });

  when(/^il débloque les 4 contenus du Gardien de la flamme$/u, async () => {
    await buy('Épieu de chasse', 20);
    await buy('Clochette du guet', 40);
    await buy('Cœur de braise', 80);
    await buy('Flamberge', 80);
  });

  then(/^il a 0 Éclat disponible et toutes les cartes affichent « Déjà dans la tour »$/u, () => {
    expect(screen.getByLabelText('0 Éclat disponible')).toBeOnTheScreen();
    expect(screen.getAllByText('Déjà dans la tour')).toHaveLength(4);
    expect(screen.queryByRole('button', { name: /^Débloquer/ })).not.toBeOnTheScreen();
  });

  givenStep(/^l'enregistrement de l'achat échoue$/u, async () => {
    given({ shards: 20 });
    await showCamp();
    world.setUp.keyValueStore.failWrites();
  });

  when(/^le joueur débloque l'Épieu de chasse$/u, async () => {
    await buy('Épieu de chasse', 20);
  });

  then(/^un message dit que l'achat n'a pas pu être enregistré$/u, () => {
    expect(screen.getByRole('alert')).toHaveTextContent(
      "Le déblocage n'a pas pu être enregistré. Tes Éclats sont intacts.",
    );
  });

  and(
    /^les Éclats ne sont pas dépensés, l'Épieu de chasse n'est pas débloqué et le joueur peut réessayer$/u,
    async () => {
      expect(screen.getByLabelText('20 Éclats disponibles')).toBeOnTheScreen();
      expect(card('huntingSpear').queryByText('Déjà dans la tour')).not.toBeOnTheScreen();
      world.setUp.keyValueStore.failWrites(false);
      await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
      expect(card('huntingSpear').getByText('Déjà dans la tour')).toBeOnTheScreen();
      expect(screen.getByLabelText('0 Éclat disponible')).toBeOnTheScreen();
    },
  );

  givenStep(/^le joueur a gagné 82 Éclats en tout et a débloqué l'Épieu de chasse \(20\)$/u, () => {
    given({ shards: 82, unlocks: ['huntingSpear'] });
  });

  givenStep(/^le joueur a gagné 22 Éclats en tout et n'a rien débloqué$/u, () => {
    given({ shards: 22 });
  });

  when(/^il ouvre le pied de la tour$/u, async () => {
    await showTowerFoot();
  });

  then(/^il y voit 62 Éclats disponibles, le même nombre qu'au camp, et jamais 82$/u, () => {
    expect(screen.getByTestId('tower-foot-shards')).toHaveTextContent('62 Éclats');
    expect(world.setUp.camp.view().availableShards).toBe(62);
    expect(screen.queryByText('82 Éclats')).not.toBeOnTheScreen();
  });

  then(/^il y voit « 22 Éclats », comme aujourd'hui$/u, () => {
    expect(screen.getByTestId('tower-foot-shards')).toHaveTextContent('22 Éclats');
  });

  givenStep(/^le joueur a gagné 82 Éclats en tout et en a dépensé 20 au camp$/u, () => {
    given({
      shards: 82,
      unlocks: ['huntingSpear'],
      saved: { ...startAscent(42), encounter: null, outcome: 'fall' },
    });
  });

  when(/^son ascension se termine par une chute sans avoir gagné d'Éclat$/u, async () => {
    await world.setUp.session.load();
    await world.setUp.camp.load();
    await show(
      <AscentScreen
        session={world.setUp.session}
        visibility={{ onChange: () => () => {} }}
        onLeave={jest.fn()}
      />,
    );
  });

  then(/^le bilan de fin affiche « Total : 82 Éclats »$/u, () => {
    expect(screen.getByLabelText('0 Éclat gagné')).toBeOnTheScreen();
    expect(screen.getByText('Total : 82 Éclats')).toBeOnTheScreen();
  });

  and(/^le pied de la tour affiche ensuite 62 Éclats disponibles$/u, async () => {
    await fireEvent.press(screen.getByRole('button', { name: 'Retour au pied de la tour' }));
    await showTowerFoot();
    expect(screen.getByTestId('tower-foot-shards')).toHaveTextContent('62 Éclats');
  });

  givenStep(/^une ascension qui se termine par une chute, un abandon ou le Sommet$/u, () => {
    world = {
      setUp: ascentSetUp(),
      ends: [
        { ...startAscent(42), encounter: null, outcome: 'fall' },
        abandonAscent(startAscent(42)),
        { ...startAscent(42), tier: 3, floor: 6, encounter: null, outcome: 'victory' },
      ],
      seen: [],
      left: [],
    };
    rerender = null;
  });

  when(/^l'écran de fin s'affiche$/u, async () => {
    for (const [index, saved] of world.ends.entries()) {
      const setUp = ascentSetUp({ saved });
      await setUp.session.load();
      await setUp.camp.load();
      const onCamp = jest.fn();
      await show(
        <AscentScreen
          key={index}
          session={setUp.session}
          visibility={{ onChange: () => () => {} }}
          onLeave={jest.fn()}
          onCamp={onCamp}
        />,
      );
      const buttons = screen
        .getAllByRole('button')
        .map((button) => button.props.accessibilityLabel as string);
      await fireEvent.press(screen.getByRole('button', { name: 'Aller au camp' }));
      world.seen.push({
        buttons,
        campOpened: onCamp.mock.calls.length === 1,
        ascentLeft: setUp.session.current() === null,
        campInProgress: setUp.camp.view().ascentInProgress,
      });
    }
  });

  then(
    /^il propose « Retour au pied de la tour » et, dessous, le bouton secondaire « Aller au camp »$/u,
    () => {
      expect(world.seen).toHaveLength(3);
      for (const { buttons } of world.seen) {
        expect(buttons.indexOf('Aller au camp')).toBe(
          buttons.indexOf('Retour au pied de la tour') + 1,
        );
      }
    },
  );

  and(/^« Aller au camp » ouvre le camp, où aucune ascension n'est plus en cours$/u, () => {
    for (const seen of world.seen) {
      expect(seen).toMatchObject({ campOpened: true, ascentLeft: true, campInProgress: false });
    }
  });

  givenStep(/^le joueur a ouvert le camp avec « Aller au camp »$/u, () => {
    process.env.EXPO_PUBLIC_ASCENT_CHANNEL = 'preview';
    appWithAFall();
    world = { setUp: ascentSetUp(), ends: [], seen: [], left: [] };
  });

  when(/^il quitte le camp, par ‹ ou par le geste retour$/u, async () => {
    for (const way of ['‹', 'geste retour'] as const) {
      await renderRouter(appDirectory, { initialUrl: '/tower' });
      await screen.findByTestId('tower-foot-shards');
      await act(async () => {
        router.push('/ascent');
      });
      await fireEvent.press(await screen.findByRole('button', { name: 'Aller au camp' }));
      expect(await screen.findByRole('header', { name: 'Le camp' })).toBeOnTheScreen();
      if (way === '‹') {
        await fireEvent.press(screen.getByRole('button', { name: 'Retour au pied de la tour' }));
      } else {
        // Le geste retour suit la pile de navigation.
        await act(async () => {
          router.back();
        });
      }
      await screen.findByTestId('tower-foot');
      world.left.push({
        foot: screen.queryByTestId('tower-foot') !== null,
        end: screen.queryByTestId('ascent-end') !== null,
      });
      screen.unmount();
    }
  });

  then(/^il arrive au pied de la tour, jamais de nouveau sur l'écran de fin$/u, () => {
    expect(world.left).toEqual([
      { foot: true, end: false },
      { foot: true, end: false },
    ]);
  });
};

// Les scénarios `@ui` seuls.
const feature = loadFeature('features/camp-gardien-de-la-flamme.feature');
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
