/**
 * @jest-environment ./test/setup/skiaEnvironment.js
 */
/*
 * « Ombre au sol à la place des socles sur l'écran de combat » (#184) : une vraie session
 * d'ascension sur un Stockage clé-valeur en mémoire, et le vrai écran de l'ascension, qui reçoit la
 * simulation de la scène (`battle/testing/fakeBattleCanvas.tsx`) et du fond de palier
 * (`battle/testing/fakeTierBackdrop.tsx`). La vraie scène est ensuite dessinée avec Skia sur les
 * entrées que l'écran lui donne, comme dans `goule-villageois-objets.ui.steps.tsx`.
 *
 * Correspondance des libellés :
 * - « aucun socle n'est dessiné » : avant les sprites, la scène ne dessine que des ombres au sol,
 *   une par personnage, et elle n'a plus d'image de socle ;
 * - « une ombre au sol sous ses pieds » : l'image de l'ombre au sol (`groundShadowImage`), le milieu
 *   de son bas à la place que donne `sceneGeometry` (`groundShadowAt`, `heroGroundShadowAt`), à
 *   2 dp par pixel d'art sous un ennemi (64 × 10 dp, maquette `.sock`) et à l'échelle du héros sous
 *   lui, à 55 % ;
 * - « plate et sombre », « aucun bord d'or » : une seule couleur, l'encre de la nuit, et la même
 *   image, à la même taille et à la même opacité, sous la cible et sous les autres ;
 * - « fixe, sans aucune animation » : les mêmes nombres, ni valeur partagée ni horloge, au repos,
 *   pendant le coup d'un ennemi et pendant la frappe du héros ;
 * - « marquée » : la colonne de l'ennemi (double cadre d'or de sa plaque, flèche, nom en gras,
 *   « cible » au lecteur d'écran) ;
 * - « la nuit de repli » : la vraie image du fond qui ne peut pas être faite (`toSkImage` rend
 *   `null` pour elle) : seul le voile est dessiné.
 */
import '@shopify/react-native-skia/jestSetup';

import { act, render, within, type RenderResult } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { InMemoryUnitOfWork } from '../../src/application/testing/InMemoryUnitOfWork';
import { settableClock } from '../../src/application/testing/settableClock';
import { ASCENT_KEY, type AscentSession } from '../../src/application/useCases/AscentSession';
import type { Ascent, Encounter } from '../../src/domain/ascent/Ascent';
import type { Tier } from '../../src/domain/ascent/tiers';
import { startBattle, type Battle } from '../../src/domain/battle/Battle';
import type { EnemyKind } from '../../src/domain/battle/combatants';
import { Day } from '../../src/domain/day/Day';
import type * as RealBattleCanvas from '../../src/adapters/ui/battle/BattleCanvas';
import { enemyGestureTestId } from '../../src/adapters/ui/battle/EnemyColumn';
import {
  sceneGeometry,
  type SceneGeometry,
} from '../../src/adapters/ui/battle/scene/sceneGeometry';
import type { SceneEnemy } from '../../src/adapters/ui/battle/sceneTypes';
import type * as RealTierBackdrop from '../../src/adapters/ui/battle/TierBackdrop';
import { ENEMY_NAMES } from '../../src/adapters/ui/format/battleText';
import { artPalette } from '../../src/adapters/ui/pixelArt/artPalette';
import { textFont } from '../../src/adapters/ui/pixelArt/pixelTypography';
import * as spriteCanvas from '../../src/adapters/ui/pixelArt/SpriteCanvas';
import {
  GROUND_SHADOW_OPACITY,
  groundShadowImage,
} from '../../src/adapters/ui/pixelArt/sprites/battle/battleStage';
import { AscentScreen, RESUME_COUNTDOWN_S } from '../../src/adapters/ui/screens/AscentScreen';
import type { Dependencies } from '../../src/adapters/ui/state/Dependencies';
import { renderScreen } from '../../src/adapters/ui/testing/renderScreen';
import { silentHaptics } from '../../src/adapters/ui/testing/silentHaptics';
import { ascentBefore, storySession, storyStore, type StoryStore } from '../support/tiersStory';

jest.mock('../../src/adapters/ui/battle/BattleCanvas', () =>
  jest.requireActual('../../src/adapters/ui/battle/testing/fakeBattleCanvas'),
);

const { roles } = artPalette;
const hidden = { includeHiddenElements: true } as const;
const WIDTH = 390;
const HEIGHT = 440;
/** Un groupe ordinaire de chaque palier ; aux paliers 1 et 2, le héros joue le premier. */
const GROUPS: Readonly<Record<Tier, readonly EnemyKind[]>> = {
  1: ['ghoul', 'madVillager', 'necromancer'],
  2: ['thornPilgrim', 'ashBramble', 'ashGleaner'],
  3: ['bronzeWarden', 'gargoyle', 'bellFounder'],
};
/** Le fond de chaque palier, nommé comme dans l'Atelier. */
const BACKDROPS: Readonly<Record<string, Tier>> = {
  'le puits des ossements': 1,
  'sous le jardin suspendu': 2,
  'la cloche tombée': 3,
};
/** La largeur d'une image de fond de palier, en pixels d'art : l'ombre au sol en fait 32. */
const BACKDROP_WIDTH = 96;

interface DrawnNode {
  readonly type: string;
  readonly props: Record<string, unknown>;
  readonly children: readonly DrawnNode[] | null;
}

/** Une scène dessinée avec Skia : ses éléments dans l'ordre, ses ombres au sol, sa géométrie. */
interface Drawing {
  readonly nodes: readonly DrawnNode[];
  readonly shadows: readonly DrawnNode[];
  readonly geometry: SceneGeometry;
  readonly enemies: readonly SceneEnemy[];
  readonly prepared: RealBattleCanvas.PreparedScene;
}

interface World {
  store: StoryStore;
  session: AscentSession;
  tier: Tier;
  encounter: Encounter['kind'];
  enemies: readonly EnemyKind[];
  /** Le combat sauvegardé à reprendre, sinon un combat neuf. */
  battle: ((battle: Battle) => Battle) | null;
  /** L'écran de l'ascension, gardé à part : la scène dessinée a son propre rendu. */
  view: RenderResult;
  /** Le palier du fond montré à chaque écran de combat rendu, dans l'ordre. */
  shown: Tier[];
  drawings: Drawing[];
  /** La cible avant le toucher, ou avant la pause. */
  target: number;
}

let world: World;

function dependencies(store: StoryStore): Dependencies {
  return {
    clock: settableClock(Day.of(2026, 11, 2)),
    unitOfWork: new InMemoryUnitOfWork(),
    keyValueStore: store,
    haptics: silentHaptics(),
  };
}

function flatten(tree: unknown): DrawnNode[] {
  const nodes: DrawnNode[] = [];
  const visit = (node: DrawnNode | string) => {
    if (typeof node === 'string') return;
    nodes.push(node);
    node.children?.forEach(visit);
  };
  for (const root of Array.isArray(tree) ? tree : tree === null ? [] : [tree]) visit(root);
  return nodes;
}

/** L'ascension du scénario sauvegardée devant son combat (neuf, ou en cours), puis chargée. */
async function loadAscent(): Promise<void> {
  const ascent: Ascent = ascentBefore(world.tier, world.encounter, world.enemies);
  let battle: Battle | null = null;
  if (world.battle !== null) {
    const started = startBattle({
      seed: 3,
      defenseHint: false,
      at: 0,
      heroHp: 50,
      enemies: world.enemies,
    });
    battle = world.battle(started.battle);
  }
  world.store.values.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent, battle }));
  const { session } = storySession(world.store);
  await session.load();
  world.session = session;
}

const backdropTier = () => world.view.getByTestId('tier-backdrop', hidden).props.tier as Tier;

/** Le vrai écran de l'ascension sur le combat du scénario ; un combat repris passe le compte à rebours. */
async function showBattle(): Promise<void> {
  await loadAscent();
  const resuming = world.session.resuming();
  if (resuming) jest.useFakeTimers();
  try {
    world.view = await renderScreen(
      <AscentScreen
        session={world.session}
        visibility={{ onChange: () => () => {} }}
        onLeave={() => undefined}
      />,
      dependencies(world.store),
    );
    if (resuming) {
      expect(world.view.getByTestId('ascent-countdown')).toBeOnTheScreen();
      world.shown.push(backdropTier());
      for (let second = 0; second < RESUME_COUNTDOWN_S; second += 1) {
        await act(async () => {
          jest.advanceTimersByTime(1_000);
        });
      }
    }
    expect(await world.view.findByTestId('battle-screen')).toBeOnTheScreen();
    world.shown.push(backdropTier());
  } finally {
    if (resuming) jest.useRealTimers();
  }
}

/** La vraie scène, dessinée avec Skia sur les entrées que l'écran donne à la sienne. */
async function draw(change: Partial<RealBattleCanvas.BattleSceneProps> = {}): Promise<Drawing> {
  const shown = world.view.getByTestId('battle-scene', hidden)
    .props as RealBattleCanvas.BattleSceneProps;
  const { BattleScene, prepareBattleScene } = jest.requireActual<typeof RealBattleCanvas>(
    '../../src/adapters/ui/battle/BattleCanvas',
  );
  const enemies = change.enemies ?? shown.enemies;
  const geometry = sceneGeometry(WIDTH, HEIGHT, enemies.length);
  const prepared = prepareBattleScene(enemies.map((enemy) => enemy.kind));
  const scene = await render(
    <BattleScene
      width={WIDTH}
      height={HEIGHT}
      geometry={geometry}
      heroKind={shown.heroKind}
      heroPose={shown.heroPose}
      heroPoseSince={shown.heroPoseSince}
      strikeTarget={0}
      strikeImpactAt={null}
      timeline={shown.timeline}
      spark={shown.spark}
      hurtAt={shown.hurtAt}
      reducedMotion={shown.reducedMotion}
      uiNow={() => {
        'worklet';
        return 1_000;
      }}
      {...change}
      enemies={enemies}
    />,
  );
  const nodes = flatten(scene.toJSON());
  await scene.unmount();
  const drawing = {
    nodes,
    shadows: nodes.filter((node) => node.props.image === prepared.groundShadow),
    geometry,
    enemies,
    prepared,
  };
  world.drawings.push(drawing);
  return drawing;
}

/** Ce qu'on voit d'une ombre au sol : sa place, sa taille, son opacité. */
const look = ({ props }: DrawnNode) => ({
  x: props.x,
  y: props.y,
  width: props.width,
  height: props.height,
  opacity: props.opacity,
});

/** L'ombre au sol attendue, le milieu de son bas en `at`, à `scale` dp par pixel d'art. */
const shadowAt = (at: { readonly x: number; readonly y: number }, scale: number) => ({
  x: at.x - 16 * scale,
  y: at.y - 5 * scale,
  width: 32 * scale,
  height: 5 * scale,
  opacity: GROUND_SHADOW_OPACITY,
});

/** Aucun socle : avant les sprites, rien que les ombres au sol, et plus d'image de socle. */
function expectNoPedestal({ nodes, shadows, prepared }: Drawing): void {
  expect(prepared).not.toHaveProperty('pedestals');
  const sprites = nodes.findIndex((node) => node.type === 'skAtlas');
  expect(sprites).toBeGreaterThan(0);
  expect(nodes.slice(0, sprites).filter((node) => node.type === 'skImage')).toEqual(shadows);
}

/** Une ombre au sol sous chaque ennemi de la première ligne, puis sous le héros, à sa taille. */
function expectShadowUnderEach({ shadows, geometry }: Drawing): void {
  expect(shadows.map(look)).toEqual([
    ...geometry.enemies.map((slot) => shadowAt(slot.groundShadowAt, 2)),
    shadowAt(geometry.heroGroundShadowAt, geometry.hero.scale),
  ]);
}

const lastDrawing = () => world.drawings.at(-1)!;
const style = (testID: string) =>
  StyleSheet.flatten(world.view.getByTestId(testID, hidden).props.style);

/** Un toucher complet sur la colonne de l'ennemi `index`. */
async function tapColumn(index: number): Promise<void> {
  await act(async () => {
    fireGestureHandler(getByGestureTestId(enemyGestureTestId(index)), [
      { state: State.BEGAN },
      { state: State.ACTIVE },
      { state: State.END },
    ]);
    await Promise.resolve();
  });
}

/** La colonne de l'ennemi `kind` est la cible : double cadre d'or, flèche, nom en gras, « cible ». */
function expectMarked(kind: EnemyKind): void {
  const column = world.view.getByTestId(`enemy-${kind}`);
  expect(column.props.accessibilityState).toMatchObject({ selected: true });
  expect(style(`enemy-${kind}-plate`).borderColor).toBe(roles.gold);
  expect(style(`enemy-${kind}-ring`).borderColor).toBe(roles.gold);
  expect(world.view.getByTestId(`enemy-${kind}-target-arrow`, hidden)).toBeTruthy();
  expect(within(column).getByText(ENEMY_NAMES[kind])).toHaveStyle({
    fontFamily: textFont.bold,
  });
}

function expectNotMarked(kind: EnemyKind): void {
  expect(world.view.getByTestId(`enemy-${kind}`).props.accessibilityState).toMatchObject({
    selected: false,
  });
  expect(style(`enemy-${kind}-ring`).borderColor).not.toBe(roles.gold);
  expect(world.view.queryByTestId(`enemy-${kind}-target-arrow`, hidden)).toBeNull();
}

const steps: StepDefinitions = ({ given, when, then, and }) => {
  beforeEach(() => {
    world = {
      store: storyStore(),
      tier: 1,
      encounter: 'combat',
      enemies: GROUPS[1],
      battle: null,
      shown: [],
      drawings: [],
      target: 0,
    } as unknown as World;
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false);
  });

  // --- Contexte ---

  given(/^une ascension en cours$/u, () => {
    world.store = storyStore();
  });

  and(/^un combat contre un groupe d'ennemis$/u, () => {
    world.enemies = GROUPS[world.tier];
    expect(world.enemies).toHaveLength(3);
  });

  // --- Plus aucun socle ; une ombre au sol sous chaque personnage ---

  when(/^l'écran de combat s'affiche$/u, async () => {
    await showBattle();
    await draw();
  });

  then(/^aucun socle n'est dessiné sous le héros$/u, () => {
    const drawing = lastDrawing();
    expectNoPedestal(drawing);
    // La dernière ombre, sous le héros, est la seule à son échelle quand il est à 3 dp.
    expect(look(drawing.shadows.at(-1)!)).toEqual(
      shadowAt(drawing.geometry.heroGroundShadowAt, drawing.geometry.hero.scale),
    );
  });

  and(
    /^aucun socle n'est dessiné sous aucun ennemi, qu'il y en ait un seul ou plusieurs$/u,
    async () => {
      expect(lastDrawing().enemies).toHaveLength(3);
      const alone = await draw({ enemies: [lastDrawing().enemies[0]!] });
      for (const drawing of world.drawings) {
        expectNoPedestal(drawing);
        expectShadowUnderEach(drawing);
      }
      // La même ombre sous un ennemi seul que dans un groupe : plus de socle plus large (#184).
      expect(look(alone.shadows[0]!).width).toBe(look(world.drawings[0]!.shadows[0]!).width);
    },
  );

  then(
    /^chaque ennemi a une ombre au sol sous ses pieds, plate et sombre, comme dans la maquette validée$/u,
    () => {
      const drawing = lastDrawing();
      expectShadowUnderEach(drawing);
      // Plate et sombre : une seule couleur, l'encre de la nuit, à 55 % (maquette, `.sock`).
      const { width, height, rgba } = groundShadowImage();
      const colors = new Set<string>();
      for (let at = 0; at < width * height; at += 1) {
        if (rgba[at * 4 + 3] !== 0) colors.add(Array.from(rgba.slice(at * 4, at * 4 + 3)).join());
      }
      const ink = [1, 3, 5].map((at) => parseInt(roles.ink.slice(at, at + 2), 16)).join();
      expect([...colors]).toEqual([ink]);
      expect(
        drawing.shadows
          .slice(0, 3)
          .map(look)
          .map(({ width: w, height: h }) => [w, h]),
      ).toEqual([
        [64, 10],
        [64, 10],
        [64, 10],
      ]);
    },
  );

  and(/^le héros a une ombre au sol sous ses pieds, du même aspect, à sa taille$/u, () => {
    const { shadows, geometry } = lastDrawing();
    const hero = shadows.at(-1)!;
    expect(hero.props.image).toBe(shadows[0]!.props.image);
    expect(look(hero)).toEqual(shadowAt(geometry.heroGroundShadowAt, geometry.hero.scale));
    expect(look(hero).width).toBe(32 * 3);
  });

  and(/^l'ombre au sol ne porte aucun bord d'or ni aucune couleur qui distingue la cible$/u, () => {
    const { shadows, enemies } = lastDrawing();
    expect(enemies.map((enemy) => enemy.target)).toEqual([true, false, false]);
    const [target, ...others] = shadows.slice(0, 3);
    for (const other of others) {
      expect(other.props.image).toBe(target!.props.image);
      expect([other.props.width, other.props.height, other.props.opacity]).toEqual([
        target!.props.width,
        target!.props.height,
        target!.props.opacity,
      ]);
    }
  });

  // --- La cible reste marquée sans le socle ---

  given(/^la cible sur l'ennemi le plus à gauche$/u, async () => {
    await showBattle();
    expectMarked(world.enemies[0]!);
    world.target = 0;
  });

  when(/^le joueur touche la colonne d'un autre ennemi debout$/u, async () => {
    await tapColumn(1);
  });

  then(/^ce nouvel ennemi est la cible$/u, async () => {
    const shown = world.view.getByTestId('battle-scene', hidden)
      .props as RealBattleCanvas.BattleSceneProps;
    expect(shown.enemies.map((enemy) => enemy.target)).toEqual([false, true, false]);
    // Et rien ne la marque sous ses pieds : la même ombre au sol pour tous.
    const drawing = await draw();
    expectNoPedestal(drawing);
    expectShadowUnderEach(drawing);
  });

  and(
    /^sa plaque a le double cadre d'or, une flèche au-dessus de son intention et son nom en gras$/u,
    () => {
      expectMarked(world.enemies[1]!);
    },
  );

  and(/^l'ancien ennemi visé n'a plus ni double cadre d'or ni flèche$/u, () => {
    expectNotMarked(world.enemies[0]!);
  });

  and(/^le lecteur d'écran annonce toujours « cible » pour le nouvel ennemi$/u, () => {
    const [first, second] = world.enemies;
    expect(world.view.getByTestId(`enemy-${second}`).props.accessibilityLabel).toContain(
      `${ENEMY_NAMES[second!]}, cible,`,
    );
    expect(world.view.getByTestId(`enemy-${first}`).props.accessibilityLabel).not.toContain(
      'cible',
    );
  });

  // --- Les trois fonds de palier ---

  given(/^un combat au palier (\d)$/u, (tier: string) => {
    world.tier = Number(tier) as Tier;
    world.enemies = GROUPS[world.tier];
  });

  when(/^l'écran de combat s'affiche sur le fond de palier « (.+) »$/u, async (name: string) => {
    await showBattle();
    expect(world.shown).toEqual([BACKDROPS[name]]);
    await draw();
  });

  then(/^aucun socle n'est dessiné$/u, () => {
    expect(world.drawings.length).toBeGreaterThan(0);
    world.drawings.forEach(expectNoPedestal);
  });

  and(/^l'ombre au sol de chaque personnage se voit sur le fond, comme dans la maquette$/u, () => {
    expectShadowUnderEach(lastDrawing());
    // Sur le fond : la scène est transparente, le fond de palier dessous, hors de la scène.
    const container = world.view.getByTestId('ascent-battle-backdrop', hidden);
    const [first] = container.children as unknown as { props: { testID?: string } }[];
    expect(first?.props.testID).toBe('tier-backdrop');
    expect(backdropTier()).toBe(world.tier);
  });

  // --- Boss seul ---

  given(/^un combat contre un boss seul$/u, () => {
    world.tier = 2;
    world.encounter = 'boss';
    world.enemies = ['ashGardener'];
  });

  then(/^aucun socle n'est dessiné sous le boss$/u, () => {
    const drawing = lastDrawing();
    expect(drawing.enemies.map((enemy) => enemy.kind)).toEqual(['ashGardener']);
    expectNoPedestal(drawing);
  });

  and(/^le boss a une ombre au sol sous ses pieds$/u, () => {
    const drawing = lastDrawing();
    expectShadowUnderEach(drawing);
    const { sprite, groundShadowAt } = drawing.geometry.enemies[0]!;
    expect(groundShadowAt.x).toBe(sprite.x + sprite.width / 2);
    expect(look(drawing.shadows[0]!)).toMatchObject({ width: 64, height: 10 });
  });

  // --- Ennemi étourdi, tombé ou relevé ---

  given(/^un ennemi étourdi, puis un ennemi tombé, puis un ennemi relevé$/u, () => {
    world.enemies = ['ghoul', 'madVillager', 'skeleton'];
    world.battle = (battle) => ({
      ...battle,
      enemies: battle.enemies.map((enemy, index) => {
        if (index === 0) return { ...enemy, guard: 0, stun: { actionLost: true, heroAction: 1 } };
        if (index === 1) return { ...enemy, hp: 0 };
        return { ...enemy, raised: true, raisedRound: battle.round };
      }),
    });
  });

  then(/^aucun socle n'apparaît sous eux, dans aucun de ces états$/u, () => {
    const drawing = lastDrawing();
    expect(drawing.enemies.map(({ standing, down }) => ({ standing, down }))).toEqual([
      { standing: true, down: true },
      { standing: false, down: false },
      { standing: true, down: false },
    ]);
    expectNoPedestal(drawing);
  });

  and(/^l'ombre au sol reste à sa place sous chacun$/u, () => {
    // Tombé compris : l'ombre ne change avec aucun état, ni estompée, ni désaturée.
    expectShadowUnderEach(lastDrawing());
  });

  // --- Mouvement réduit ---

  given(/^le mouvement réduit actif$/u, () => {
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(true);
  });

  when(/^un ennemi frappe le héros et que le héros attaque sa cible$/u, async () => {
    await showBattle();
    const shown = world.view.getByTestId('battle-scene', hidden)
      .props as RealBattleCanvas.BattleSceneProps;
    expect(shown.reducedMotion).toBe(true);
    await draw({ timeline: null, heroPose: 'idle' });
    // Le coup d'un ennemi, à son impact.
    await draw({
      timeline: {
        enemy: 1,
        kind: 'attack',
        attack: 'basic',
        stepInAt: 500,
        windUpAt: 500,
        windUpMs: 400,
        until: 1_200,
        impacts: [1_000],
        feintAt: null,
        glints: [],
        hitStopAt: 0,
        hitStopUntil: 0,
      },
      hurtAt: 1_000,
    });
    // La frappe du héros sur sa cible, à son impact.
    await draw({ timeline: null, heroPose: 'strike', heroPoseSince: 800, strikeImpactAt: 1_000 });
  });

  and(/^l'ombre au sol reste fixe sous chaque personnage, sans aucune animation$/u, () => {
    const [rest, ...actions] = world.drawings;
    expectShadowUnderEach(rest!);
    for (const drawing of actions) {
      expect(drawing.shadows.map(look)).toEqual(rest!.shadows.map(look));
    }
    // Des nombres fixes : ni valeur partagée ni horloge.
    for (const shadow of rest!.shadows) {
      expect(Object.values(look(shadow)).every((value) => typeof value === 'number')).toBe(true);
    }
  });

  // --- Combat repris sans régression ---

  given(/^un combat mis en pause au milieu d'une manche$/u, () => {
    world.tier = 2;
    world.enemies = GROUPS[2];
    world.target = 1;
    world.battle = (battle) => ({ ...battle, target: 1 });
  });

  when(
    /^le joueur reprend l'ascension et que le compte à rebours de reprise se termine$/u,
    async () => {
      await showBattle();
      await draw();
    },
  );

  then(/^le combat reprend sur le même fond de palier$/u, () => {
    expect(world.shown).toEqual([2, 2]);
  });

  and(/^chaque personnage a son ombre au sol$/u, () => {
    expectShadowUnderEach(lastDrawing());
  });

  and(
    /^la cible est la même qu'avant la pause, toujours marquée par le double cadre d'or et la flèche$/u,
    () => {
      expect(lastDrawing().enemies.map((enemy) => enemy.target)).toEqual([false, true, false]);
      expectMarked(world.enemies[world.target]!);
      expectNotMarked(world.enemies[0]!);
    },
  );

  // --- Repli sans fond de palier ---

  given(/^un fond de palier qui ne peut pas être dessiné$/u, () => {
    world.tier = 3;
    world.enemies = GROUPS[3];
    const toSkImage = spriteCanvas.toSkImage;
    jest
      .spyOn(spriteCanvas, 'toSkImage')
      .mockImplementation((image) => (image.width === BACKDROP_WIDTH ? null : toSkImage(image)));
  });

  when(/^l'écran de combat s'affiche sur la nuit de repli$/u, async () => {
    await showBattle();
    // Le vrai fond du palier, qui ne peut pas être fait : seul le voile, sur la nuit de l'écran.
    const { TierBackdrop } = jest.requireActual<typeof RealTierBackdrop>(
      '../../src/adapters/ui/battle/TierBackdrop.tsx',
    );
    const backdrop = await render(<TierBackdrop tier={backdropTier()} scene={null} />);
    const types = flatten(backdrop.toJSON()).map((node) => node.type);
    expect(types).not.toContain('skImage');
    expect(types).toContain('skRect');
    await backdrop.unmount();
    expect(spriteCanvas.toSkImage).toHaveReturnedWith(null);
    await draw();
  });

  and(/^l'ombre au sol de chaque personnage reste dessinée$/u, () => {
    const drawing = lastDrawing();
    expect(drawing.prepared.groundShadow).not.toBeNull();
    expectShadowUnderEach(drawing);
  });
};

autoBindSteps([loadFeature('features/ombre-au-sol.feature')], [steps]);
