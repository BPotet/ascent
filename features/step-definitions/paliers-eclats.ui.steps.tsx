/**
 * « Trois paliers jusqu'au sommet, et les premiers Éclats » (#38) à l'écran : une vraie session
 * d'ascension sur un Stockage clé-valeur en mémoire qui peut retenir l'écriture des Éclats, puis le
 * vrai écran de l'ascension et le vrai pied de la tour. Les poses en plus et les grandes silhouettes
 * se vérifient par les fonctions de la scène (le canevas Skia est simulé sous Jest).
 */
import { act, fireEvent, screen } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { InMemoryUnitOfWork } from '../../src/application/testing/InMemoryUnitOfWork';
import { settableClock } from '../../src/application/testing/settableClock';
import {
  ASCENT_KEY,
  SHARD_TOTAL_KEY,
  type AscentSession,
} from '../../src/application/useCases/AscentSession';
import type { Ascent } from '../../src/domain/ascent/Ascent';
import { TIERS, type Tier } from '../../src/domain/ascent/tiers';
import { startBattle, heroAction, pressStrike, type Battle } from '../../src/domain/battle/Battle';
import type { BattleEvent } from '../../src/domain/battle/BattleEvent';
import type { EnemyKind } from '../../src/domain/battle/combatants';
import { Day } from '../../src/domain/day/Day';
import { enemyPose, restPose } from '../../src/adapters/ui/battle/scene/enemyPose';
import { sceneGeometry, spriteOrigin } from '../../src/adapters/ui/battle/scene/sceneGeometry';
import { sceneTimeline } from '../../src/adapters/ui/battle/scene/sceneTimeline';
import { feedbackText } from '../../src/adapters/ui/format/battleText';
import { battleAtlas } from '../../src/adapters/ui/pixelArt/sprites/battle/battleAtlas';
import {
  attackMotion,
  enemyExtraFrames,
} from '../../src/adapters/ui/pixelArt/sprites/battle/battleCharacters';
import { AscentScreen } from '../../src/adapters/ui/screens/AscentScreen';
import { TowerFootScreen } from '../../src/adapters/ui/screens/TowerFootScreen';
import type { Dependencies } from '../../src/adapters/ui/state/Dependencies';
import { battleView } from '../../src/adapters/ui/state/battleView';
import { renderScreen } from '../../src/adapters/ui/testing/renderScreen';
import { silentHaptics } from '../../src/adapters/ui/testing/silentHaptics';
import {
  ascentBefore,
  playToTheEnd,
  saveBefore,
  settleStore,
  storySession,
  storyStore,
  type StoryStore,
} from '../support/tiersStory';

jest.mock('../../src/adapters/ui/battle/BattleCanvas', () =>
  jest.requireActual('../../src/adapters/ui/battle/testing/fakeBattleCanvas'),
);

const BOSSES: Readonly<Record<Tier, EnemyKind>> = {
  1: 'ossuaryWarden',
  2: 'ashGardener',
  3: 'wishGranter',
};

interface World {
  store: StoryStore;
  session: AscentSession;
  published: (Ascent | null)[];
  events: BattleEvent[];
  shardsBefore: number;
}

let world: World;

const storedShards = (store: StoryStore) =>
  store.values.has(SHARD_TOTAL_KEY)
    ? (JSON.parse(store.values.get(SHARD_TOTAL_KEY)!) as { total: number }).total
    : null;

function dependencies(store: StoryStore): Dependencies {
  return {
    clock: settableClock(Day.of(2026, 11, 1)),
    unitOfWork: new InMemoryUnitOfWork(),
    keyValueStore: store,
    haptics: silentHaptics(),
  };
}

async function showAscent(): Promise<void> {
  await renderScreen(
    <AscentScreen
      session={world.session}
      visibility={{ onChange: () => () => {} }}
      onLeave={() => undefined}
    />,
    dependencies(world.store),
  );
}

/** Le boss du palier `tier` battu, l'écriture des Éclats retenue. */
async function beatBoss(tier: Tier): Promise<void> {
  world.store.hold(SHARD_TOTAL_KEY);
  saveBefore(world.store, ascentBefore(tier, 'boss', [BOSSES[tier]]));
  const { session, clock } = storySession(world.store);
  await session.load();
  world.session = session;
  world.published = [];
  session.subscribe((ascent) => world.published.push(ascent));
  world.events = (await playToTheEnd(session.battleSession(), clock)).events;
}

/** Les Éclats crédités et sauvegardés avant que l'écran qui suit la victoire ne soit publié. */
async function creditedBeforeTheScreen(shards: number): Promise<void> {
  expect(world.published).toEqual([]);
  expect(storedShards(world.store)).toBeNull();
  world.store.release(SHARD_TOTAL_KEY);
  await act(async () => {
    await settleStore();
  });
  expect(storedShards(world.store)).toBe(world.shardsBefore + shards);
  expect(world.published).toHaveLength(1);
}

/** Le héros frappe sa cible, appui à l'impact. */
function strike(battle: Battle) {
  const attacked = heroAction(battle, {
    action: { kind: 'attack' },
    touchStartedAt: 950,
    releasedAt: 1_000,
  });
  const struck = pressStrike(attacked.battle, { at: 1_700 });
  return { battle: struck.battle, events: [...attacked.events, ...struck.events] };
}

const steps: StepDefinitions = ({ given, when, then, and }) => {
  given(
    /^les fiches, images et animations complètes des 10 entrées de cette story sont recopiées de l'export de l'Atelier du 01\/11\/2026$/u,
    () => {
      world = { store: storyStore(), shardsBefore: 0 } as World;
      expect(battleAtlas('stoneSaint').table.cellHeight).toBe(58);
    },
  );

  and(/^l'Initiative d'un ennemi n'est jamais multipliée par le palier$/u, () => {
    expect(TIERS[2].multiplier).not.toHaveProperty('initiative');
  });

  // --- Passage de palier ---

  given(/^un héros qui affronte le boss du palier 1$/u, () => undefined);

  when(/^le boss tombe$/u, async () => {
    await beatBoss(1);
  });

  then(
    /^le joueur gagne (\d+) Éclats, crédités et sauvegardés avant l'écran du boss vaincu$/u,
    async (shards: string) => {
      await creditedBeforeTheScreen(Number(shards));
    },
  );

  and(/^le héros reçoit son Répit$/u, () => {
    expect(world.events).toContainEqual(expect.objectContaining({ type: 'respite' }));
  });

  and(/^le Passage de palier rend au héros 30 % de ses PV max$/u, () => {
    const respite = world.events.find((event) => event.type === 'respite')!;
    const { heroHp } = respite as Extract<BattleEvent, { type: 'respite' }>;
    expect(world.session.current()!.hero.hp).toBe(Math.min(80, heroHp + 24));
  });

  and(/^l'écran de transition annonce « Palier 2 » et « Les Jardins de cendre »$/u, async () => {
    await showAscent();
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Continuer vers le palier 2' }));
    });
    expect(screen.getByText('Palier 2')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Les Jardins de cendre' })).toBeOnTheScreen();
  });

  and(/^l'ascension continue à l'étage 1 du palier 2, sur un combat imposé$/u, async () => {
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Entrer' }));
    });
    expect(world.session.current()).toMatchObject({
      tier: 2,
      floor: 1,
      encounter: { kind: 'combat' },
    });
    expect(await screen.findByTestId('ascent-status')).toHaveTextContent(
      /^Palier 2 · Étage 1 sur 6/,
    );
  });

  // --- Éclats et Sommet ---

  when(/^le joueur bat le boss du palier (\d)$/u, async (tier: string) => {
    await beatBoss(Number(tier) as Tier);
  });

  then(
    /^il gagne (\d+) Éclats, crédités et sauvegardés avant l'écran du boss vaincu$/u,
    async (shards: string) => {
      await creditedBeforeTheScreen(Number(shards));
    },
  );

  and(/^l'écran du boss vaincu les montre en grand$/u, async () => {
    await showAscent();
    const shards = world.session.current()!.shardAwards.at(-1)!.amount;
    expect(
      screen.getByLabelText(`${shards} Éclats gagnés, gardés pour toujours`),
    ).toHaveTextContent(`+${shards}`);
  });

  given(/^le boss du palier 3 vaincu$/u, async () => {
    await beatBoss(3);
    await creditedBeforeTheScreen(28);
  });

  then(
    /^le joueur gagne (\d+) Éclats pour le boss et (\d+) Éclats pour le Sommet, (\d+) d'un coup$/u,
    (boss: string, summit: string, total: string) => {
      expect(world.session.current()!.shardAwards.slice(-2)).toEqual([
        { id: '3:3:6:boss', amount: Number(boss) },
        { id: '3:summit', amount: Number(summit) },
      ]);
      expect(world.session.shardTotal()).toBe(Number(total));
    },
  );

  and(/^l'écran « Sommet atteint » s'affiche$/u, async () => {
    await showAscent();
    expect(screen.getByRole('header', { name: 'Sommet atteint' })).toBeOnTheScreen();
  });

  and(/^l'ascension est terminée, réussie$/u, () => {
    expect(world.session.current()?.outcome).toBe('victory');
    expect(world.store.values.has(ASCENT_KEY)).toBe(false);
  });

  given(
    /^le joueur a gagné 10 Éclats pendant l'ascension \(boss du palier 1 et une Élite\)$/u,
    () => {
      const awards = [
        { id: '3:1:6:boss', amount: 8 },
        { id: '3:2:3:elite', amount: 2 },
      ];
      const ascent: Ascent = {
        ...ascentBefore(2, 'combat', ['thornPilgrim']),
        floor: 4,
        shardAwards: awards,
      };
      const { battle } = startBattle({
        seed: 3,
        defenseHint: false,
        at: 0,
        heroHp: 1,
        enemies: ['thornPilgrim'],
        tierMultiplier: TIERS[2].multiplier,
      });
      world.store.values.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent, battle }));
      world.store.values.set(
        SHARD_TOTAL_KEY,
        JSON.stringify({ version: 1, total: 10, seed: 3, awarded: awards.map((each) => each.id) }),
      );
    },
  );

  when(/^le héros tombe au palier 2$/u, async () => {
    const { session, clock } = storySession(world.store);
    await session.load();
    world.session = session;
    await playToTheEnd(session.battleSession(), clock);
    expect(session.current()).toMatchObject({ outcome: 'fall', tier: 2 });
  });

  then(/^le bilan montre les 10 Éclats dans ce qui reste$/u, async () => {
    await showAscent();
    expect(screen.getByLabelText('10 Éclats gagnés')).toHaveTextContent('+10');
    expect(screen.getByTestId('ascent-end-kept')).toHaveTextContent('Tu gardes tes Éclats.');
  });

  and(/^le total d'Éclats du joueur a augmenté de 10$/u, () => {
    expect(world.session.shardTotal()).toBe(10);
    expect(screen.getByText('Total : 10 Éclats')).toBeOnTheScreen();
  });

  given(/^le joueur a (\d+) Éclats$/u, (shards: string) => {
    world.store.values.set(
      SHARD_TOTAL_KEY,
      JSON.stringify({ version: 1, total: Number(shards), seed: null, awarded: [] }),
    );
  });

  given(/^un joueur qui n'a jamais gagné d'Éclat$/u, () => {
    expect(world.store.values.has(SHARD_TOTAL_KEY)).toBe(false);
  });

  when(/^il ouvre le pied de la tour$/u, async () => {
    world.session = storySession(world.store).session;
    await renderScreen(
      <TowerFootScreen session={world.session} onEnter={() => undefined} />,
      dependencies(world.store),
    );
  });

  then(/^il voit « (.+) »$/u, async (text: string) => {
    expect(await screen.findByTestId('tower-foot-shards')).toHaveTextContent(text);
  });

  // --- Images ---

  let revived: { kind: EnemyKind; battle: Battle; events: BattleEvent[] }[] = [];
  given(/^une Ronce de cendre ou l'Épouvantail qui se relève seul$/u, () => {
    revived = (['ashBramble', 'scarecrow'] as const).map((kind) => {
      const { battle } = startBattle({
        seed: 7,
        defenseHint: false,
        at: 0,
        enemies: [kind, 'ghoul'],
      });
      return {
        kind,
        ...strike({ ...battle, enemies: [{ ...battle.enemies[0]!, hp: 1 }, battle.enemies[1]!] }),
      };
    });
  });

  then(
    /^il joue ses poses rise0 puis rise1, avec l'annonce « Il se relève » d'aujourd'hui$/u,
    () => {
      for (const { kind, battle, events } of revived) {
        const [enemy] = battleView(battle).enemies;
        const scene = { ...enemy!, down: enemy!.stunned, downSince: null };
        const { since } = enemy!.rising!;
        const frames = [50, 200, 300, 420].map(
          (after) => restPose(scene, 0, since + after, enemyExtraFrames(kind)).frame,
        );
        expect([kind, frames]).toEqual([kind, ['down', 'rise0', 'rise1', 'idle0']]);
        const revival = events.find((event) => event.type === 'enemySelfRevived')!;
        expect(feedbackText(revival)).toEqual({ tone: 'rise', title: 'Il se relève' });
      }
    },
  );

  and(
    /^quand la Glaneuse de cendre garde, elle joue sa pose guard ; quand elle relève un allié, sa pose raiseAlly$/u,
    () => {
      const { battle } = startBattle({
        seed: 7,
        defenseHint: false,
        at: 0,
        enemies: ['ashGleaner'],
      });
      const extras = enemyExtraFrames('ashGleaner');
      for (const [intent, pose] of [
        [{ category: 'guard', gain: 4 }, 'guard'],
        [{ category: 'raise', ally: 1 }, 'raiseAlly'],
      ] as const) {
        const timeline = sceneTimeline({
          ...battle,
          phase: {
            kind: 'enemy',
            step: { kind: 'support', enemy: 0, intent, since: 1_000, until: 1_400 },
          },
        })!;
        expect(enemyPose(timeline, 1_200, false, attackMotion('ashGleaner'), extras).frame).toBe(
          pose,
        );
      }
    },
  );

  given(/^le Veilleur d'airain \(48 × 54\) ou le Saint de pierre \(48 × 58\) en combat$/u, () => {
    expect(
      (['bronzeWarden', 'stoneSaint'] as const).map((kind) => {
        const { cellWidth, cellHeight } = battleAtlas(kind).table;
        return [cellWidth, cellHeight];
      }),
    ).toEqual([
      [48, 54],
      [48, 58],
    ]);
  });

  then(
    /^il s'affiche à sa taille, sans mise à l'échelle, calé en bas de sa case, à 2 dp par pixel d'art$/u,
    () => {
      const { sprite } = sceneGeometry(390, 440, 3).enemies[0]!;
      for (const kind of ['bronzeWarden', 'stoneSaint'] as const) {
        const { cellWidth, cellHeight } = battleAtlas(kind).table;
        const origin = spriteOrigin(sprite, cellWidth, cellHeight);
        expect(origin.y + cellHeight * 2).toBe(sprite.y + sprite.height);
        expect(origin.x + cellWidth).toBe(sprite.x + sprite.width / 2);
      }
    },
  );
};

const feature = loadFeature('features/paliers-eclats.feature');
const onScreen = ({ tags }: { readonly tags: readonly string[] }) => tags.includes('@ui');
autoBindSteps(
  [
    {
      ...feature,
      scenarios: feature.scenarios.filter(onScreen),
      scenarioOutlines: feature.scenarioOutlines.filter(onScreen),
    },
  ],
  [steps],
);
