/**
 * @jest-environment ./test/setup/skiaEnvironment.js
 */
/*
 * Scénarios de « La Goule et le Villageois fou animés, et les images validées des objets » (#119,
 * chemin B). Correspondance :
 * - « s'affiche avec son image validée », « joue les poses », « pixel pour pixel » : la pose que la
 *   scène choisit à chaque instant (`enemyPose` sur une action construite ici, `restPose` au
 *   repos), puis son image (`battleSprite`) et sa case dans l'atlas que la scène dessine
 *   (`battleAtlas`), comparées aux lignes recopiées de l'Atelier ;
 * - « à 2 dp par pixel d'art » : la place d'un ennemi dans la scène (`sceneGeometry`), 88 × 104 dp
 *   pour la case de 44 × 52 pixels d'art ;
 * - « le reflet » et « les étoiles » : les ancrages de la pose affichée (`poseAnchors`), tels que la
 *   scène les place (`glintSprites`) ;
 * - « la cible, l'estompe, l'estompe désaturée » : la scène dessinée avec Skia (`BattleScene`) ;
 * - le combat, « Objet trouvé » et le lecteur d'écran : l'écran de l'ascension (`AscentScreen`),
 *   la scène y étant simulée ;
 * - « comme aujourd'hui » (le chiffre des dégâts, le son du reflet, le Saignement) : le code
 *   inchangé, vérifié par les scénarios de #32, #81 et #107.
 */
import '@shopify/react-native-skia/jestSetup';

import { cleanup, render, screen } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import type * as RealBattleCanvas from '../../src/adapters/ui/battle/BattleCanvas';
import { FRAME_MS, enemyPose, restPose } from '../../src/adapters/ui/battle/scene/enemyPose';
import { glintSprites } from '../../src/adapters/ui/battle/scene/sceneEffects';
import { sceneGeometry } from '../../src/adapters/ui/battle/scene/sceneGeometry';
import type { SceneEnemy, SceneTimeline } from '../../src/adapters/ui/battle/sceneTypes';
import { itemDescription, itemText } from '../../src/adapters/ui/format/ascentText';
import { ENEMY_NAMES } from '../../src/adapters/ui/format/battleText';
import { artPalette } from '../../src/adapters/ui/pixelArt/artPalette';
import { toRgba, type Sprite } from '../../src/adapters/ui/pixelArt/sprites/Sprite';
import { GHOUL_ANIMATION } from '../../src/adapters/ui/pixelArt/sprites/atelier/data/ghoul';
import { ITEM_IMAGES } from '../../src/adapters/ui/pixelArt/sprites/atelier/data/itemImages';
import { MAD_VILLAGER_ANIMATION } from '../../src/adapters/ui/pixelArt/sprites/atelier/data/madVillager';
import type { FullAnimation } from '../../src/adapters/ui/pixelArt/sprites/atelier/fullAnimation';
import { atlasRect, battleAtlas } from '../../src/adapters/ui/pixelArt/sprites/battle/battleAtlas';
import {
  ENEMY_FRAMES,
  battleSprite,
  poseAnchors,
  type EnemyFrame,
} from '../../src/adapters/ui/pixelArt/sprites/battle/battleCharacters';
import { AscentScreen } from '../../src/adapters/ui/screens/AscentScreen';
import { ascentSetUp } from '../../src/adapters/ui/testing/ascent';
import { renderScreen } from '../../src/adapters/ui/testing/renderScreen';
import { GLINT_CUES } from '../../src/application/useCases/battleFeedback';
import { startAscent, type Ascent } from '../../src/domain/ascent/Ascent';
import type { ItemKind } from '../../src/domain/ascent/items';
import type { AttackKind } from '../../src/domain/battle/attacks';
import type { AttackStep } from '../../src/domain/battle/Battle';
import {
  ENEMIES,
  type EnemyKind,
  type HeroKind,
  type Move,
} from '../../src/domain/battle/combatants';
import { glintsOf } from '../../src/domain/battle/glints';

jest.mock('../../src/adapters/ui/battle/BattleCanvas', () =>
  jest.requireActual('../../src/adapters/ui/battle/testing/fakeBattleCanvas'),
);

type Animated = 'ghoul' | 'madVillager';

const ANIMATIONS: Readonly<Record<Animated, FullAnimation<EnemyFrame>>> = {
  ghoul: GHOUL_ANIMATION,
  madVillager: MAD_VILLAGER_ANIMATION,
};
const ANIMATED: readonly Animated[] = ['ghoul', 'madVillager'];
const KIND_OF_NAME: Readonly<Record<string, EnemyKind>> = Object.fromEntries(
  Object.entries(ENEMY_NAMES).map(([kind, name]) => [name, kind as EnemyKind]),
);
const KIND_OF_ITEM: Readonly<Record<string, ItemKind>> = Object.fromEntries(
  (Object.keys(ITEM_IMAGES) as ItemKind[]).map((kind) => [itemText(kind).split(' · ')[0], kind]),
);
/** Le début de l'action et son premier impact, sur l'horloge de combat. */
const STEP_IN_AT = 0;
const WIND_UP_AT = 600;
const IMPACT = 2_000;

interface World {
  kinds: readonly EnemyKind[];
  reduced: boolean;
  /** Les poses montrées, dans l'ordre, et leur liseré et leur rouge. */
  shown: { frame: EnemyFrame; tier: 0 | 1 | 2; red: boolean }[];
  move: Move | null;
  item: ItemKind | null;
  scene: SceneEnemy[];
  heroes: HeroKind[];
  /** Ce que lit le lecteur d'écran, et les images cachées. */
  read: { labels: string[]; hidden: boolean[] };
}

let world: World;

beforeEach(() => {
  world = {
    kinds: [],
    reduced: false,
    shown: [],
    move: null,
    item: null,
    scene: [],
    heroes: [],
    read: { labels: [], hidden: [] },
  };
});

/** Le code `artPalette` d'une teinte recopiée. */
const codeOf = (tint: string) =>
  artPalette.tints.findIndex((known) => known?.toLowerCase() === tint.toLowerCase());

/** La pose recopiée de l'Atelier, dans la case de 44 × 52 : centrée en largeur, calée en bas. */
function copied(kind: Animated, frame: EnemyFrame): Sprite {
  const { w, h, pal, frames } = ANIMATIONS[kind];
  const pixels = new Uint8Array(44 * 52);
  frames[frame].forEach((row, y) =>
    Array.from(row).forEach((char, x) => {
      if (char !== '.')
        pixels[(y + 52 - h) * 44 + x + (44 - w) / 2] = codeOf(pal[parseInt(char, 36)]!);
    }),
  );
  return { width: 44, height: 52, pixels };
}

/** Les ancrages recopiés d'une pose, dans la case de 44 × 52. */
function copiedAnchors(kind: Animated, frame: EnemyFrame) {
  const { w, h, anchors } = ANIMATIONS[kind];
  const moved = ([x, y]: readonly [number, number]) => [x + (44 - w) / 2, y + 52 - h];
  const { eye, head, tips } = anchors[frame];
  return { eye: moved(eye), head: moved(head), tips: tips.map(moved) };
}

/** Les pixels de la case d'une variante dans l'atlas que la scène dessine. */
function atlasCell(kind: EnemyKind, frame: EnemyFrame, tier: number, red: boolean): Uint8Array {
  const atlas = battleAtlas(kind);
  const rect = atlasRect(atlas.table, frame, tier, red);
  const cell = new Uint8Array(rect.width * rect.height * 4);
  for (let row = 0; row < rect.height; row += 1) {
    const start = ((rect.y + row) * atlas.width + rect.x) * 4;
    cell.set(atlas.rgba.subarray(start, start + rect.width * 4), row * rect.width * 4);
  }
  return cell;
}

/** Le coup `move` d'un ennemi, comme le domaine le pose, impacts compris. */
function attackStep(move: Move, impacts: readonly number[], feintAt: number | null): AttackStep {
  return {
    kind: 'attack',
    enemy: 0,
    attack: move.attack,
    damage: move.damage,
    startedAt: STEP_IN_AT,
    feintAt,
    feintShown: false,
    impacts: impacts.map((at) => ({ at, landed: false, lost: false, outcome: null })),
    resolvedAt: impacts[impacts.length - 1]! + 160,
    counter: null,
    ...(move.bleed === undefined ? {} : { bleed: move.bleed }),
  };
}

/** L'action d'un ennemi, telle que la scène la reçoit. */
function attackTimeline(attack: AttackKind, move?: Move): SceneTimeline {
  const impacts = attack === 'double' ? [IMPACT, IMPACT + 420] : [IMPACT];
  const feintAt = attack === 'feint' ? IMPACT - 500 : null;
  return {
    enemy: 0,
    kind: 'attack',
    attack,
    stepInAt: STEP_IN_AT,
    windUpAt: WIND_UP_AT,
    windUpMs: IMPACT - WIND_UP_AT,
    until: impacts[impacts.length - 1]! + 600,
    impacts,
    feintAt,
    glints: glintsOf(attackStep(move ?? { attack, damage: 5 }, impacts, feintAt)),
    hitStopAt: 0,
    hitStopUntil: 0,
  };
}

const STEP_IN: SceneTimeline = {
  ...attackTimeline('basic'),
  kind: 'stepIn',
  attack: null,
  until: WIND_UP_AT,
  impacts: [],
  glints: [],
};

/** Les poses de l'action, de `from` à `to`, chacune notée une fois quand elle change. */
function posesOf(timeline: SceneTimeline, from: number, to: number, reduced = false) {
  const shown: World['shown'] = [];
  for (let now = from; now < to; now += 1) {
    const { frame, tier, red } = enemyPose(timeline, now, reduced);
    const last = shown[shown.length - 1];
    if (last?.frame !== frame || last.tier !== tier) shown.push({ frame, tier, red });
  }
  return shown;
}

/** Les poses au repos de 0 à 1 s : debout, étourdi depuis 0, ou tombé. */
function restPoses(state: 'standing' | 'stunned' | 'fallen') {
  const enemy = {
    standing: state !== 'fallen',
    down: state === 'stunned',
    losingAction: false,
    rising: null,
    downSince: 0,
  };
  const shown: World['shown'] = [];
  for (let now = 0; now < 1_000; now += 1) {
    const { frame } = restPose(enemy, 0, now);
    if (shown[shown.length - 1]?.frame !== frame) shown.push({ frame, tier: 0, red: false });
  }
  return shown;
}

/** `wanted` apparaît dans `shown`, dans l'ordre. */
function inOrder(shown: readonly EnemyFrame[], wanted: readonly EnemyFrame[]): boolean {
  let next = 0;
  for (const frame of shown) if (frame === wanted[next]) next += 1;
  return next === wanted.length;
}

const between = (ascent: Ascent): Ascent => ({
  ...ascent,
  encounter: null,
  exits: [{ kind: 'combat', groupSize: 2 }],
  lastGold: 0,
});

async function show(saved: Ascent) {
  const setUp = ascentSetUp({ saved });
  await setUp.session.load();
  await renderScreen(
    <AscentScreen
      session={setUp.session}
      visibility={{ onChange: () => () => undefined }}
      onLeave={() => undefined}
    />,
    setUp.dependencies,
  );
}

/** Un combat d'étage contre `enemies`. */
async function showBattle(enemies: readonly EnemyKind[], hero: HeroKind = 'sentinel') {
  await show({
    ...startAscent(42, { hero }),
    encounter: { kind: 'combat', enemies, battleSeed: 7 },
  });
  return (await screen.findByTestId('battle-scene', { includeHiddenElements: true })).props
    .enemies as SceneEnemy[];
}

async function showItem(item: ItemKind) {
  world.item = item;
  await show({ ...between(startAscent(42)), foundItem: item });
}

const isHidden = (element: ReturnType<typeof screen.getByTestId>) =>
  element.props.accessibilityElementsHidden === true &&
  element.props.importantForAccessibility === 'no-hide-descendants';

/** Un nœud dessiné par la scène Skia (`skAtlas`, `skImage`…). */
interface DrawnNode {
  readonly type: string;
  readonly props: Record<string, unknown>;
  readonly children: readonly DrawnNode[] | null;
}

/** Les nœuds dessinés par la scène Skia, en profondeur. */
function drawn(): DrawnNode[] {
  const nodes: DrawnNode[] = [];
  const visit = (node: DrawnNode | string) => {
    if (typeof node === 'string') return;
    nodes.push(node);
    node.children?.forEach(visit);
  };
  const tree = screen.toJSON() as DrawnNode | null;
  if (tree !== null) visit(tree);
  return nodes;
}

/** La scène dessinée avec Skia, sans action en cours. */
async function renderScene(enemies: SceneEnemy[]) {
  const { BattleScene, prepareBattleScene } = jest.requireActual<typeof RealBattleCanvas>(
    '../../src/adapters/ui/battle/BattleCanvas',
  );
  const shared = (value: number) => ({ value, get: () => value, set: jest.fn() });
  const geometry = sceneGeometry(390, 440, enemies.length);
  await cleanup();
  await render(
    <BattleScene
      width={390}
      height={440}
      geometry={geometry}
      enemies={enemies}
      heroPose="idle"
      heroPoseSince={0}
      strikeTarget={0}
      strikeImpactAt={null}
      timeline={null}
      spark={null}
      hurtAt={null}
      reducedMotion={false}
      uiNow={() => {
        'worklet';
        return 1_000;
      }}
      frameMeter={{ frames: shared(0), dropped: shared(0), worstGap: shared(0) }}
    />,
  );
  return { scene: prepareBattleScene(), geometry };
}

const sceneEnemy = (kind: EnemyKind, change: Partial<SceneEnemy>): SceneEnemy => ({
  kind,
  standing: true,
  target: false,
  dimmed: false,
  active: false,
  down: false,
  losingAction: false,
  rising: null,
  downSince: null,
  ...change,
});

/** Chaque pose montrée est la pose recopiée, dans la case que la scène dessine. */
function expectCopied(kind: Animated, shown: World['shown']) {
  for (const { frame, tier, red } of shown) {
    const pose = copied(kind, frame);
    expect([kind, frame, battleSprite(kind, frame, { tier, red }).sprite]).toEqual([
      kind,
      frame,
      pose,
    ]);
    expect(atlasCell(kind, frame, tier, red)).toEqual(toRgba(pose));
  }
}

const steps: StepDefinitions = ({ given, when, then, and }) => {
  // --- Contexte ---

  given(
    "l'image et l'animation complète de la Goule (ghoul) et du Villageois fou (madVillager) sont validées dans l'Atelier de l'ascension au 29/10/2026",
    () => {
      for (const kind of ANIMATED) {
        expect(Object.keys(ANIMATIONS[kind].frames).sort()).toEqual([...ENEMY_FRAMES].sort());
      }
    },
  );

  and(
    "l'image de la Hache rouillée, des Mailles, du Cuir, du Marteau, du Bouclier du veilleur, de l'Amulette de Hâte et de l'Arbalète est validée dans l'Atelier au 29/10/2026",
    () => {
      expect(Object.keys(KIND_OF_ITEM).sort()).toEqual([
        'Amulette de Hâte',
        'Arbalète',
        'Bouclier du veilleur',
        'Cuir',
        'Hache rouillée',
        'Mailles',
        'Marteau',
      ]);
    },
  );

  and("l'animation complète et les images sont recopiées telles quelles dans le code", () => {
    expect([GHOUL_ANIMATION.w, GHOUL_ANIMATION.h]).toEqual([44, 52]);
    expect([MAD_VILLAGER_ANIMATION.w, MAD_VILLAGER_ANIMATION.h]).toEqual([40, 50]);
  });

  // --- Les sujets ---

  given('une ascension en cours', () => undefined);

  given(/^une Goule ou un Villageois fou en combat$/, () => {
    world.kinds = ANIMATED;
  });

  given('un combat où apparaît une Goule', () => {
    world.kinds = ['ghoul'];
  });

  given('un combat contre un Villageois fou', () => {
    world.kinds = ['madVillager'];
  });

  given('le mouvement réduit est actif', () => {
    world.reduced = true;
  });

  given('un combat gagné', () => undefined);

  // --- La Goule et le Villageois fou en combat ---

  when(
    'le joueur entre dans un combat dont le groupe compte une Goule et un Villageois fou',
    async () => {
      world.scene = await showBattle(['ghoul', 'madVillager']);
    },
  );

  then(
    /^(la Goule|le Villageois fou) s'affiche avec son image validée \((\d+) × (\d+) pixels d'art\), à 2 dp par pixel d'art$/,
    (name: string, width: string, height: string) => {
      const kind: Animated = name === 'la Goule' ? 'ghoul' : 'madVillager';
      const index = world.scene.findIndex((enemy) => enemy.kind === kind);
      expect(index).toBeGreaterThanOrEqual(0);
      expect([ANIMATIONS[kind].w, ANIMATIONS[kind].h]).toEqual([Number(width), Number(height)]);
      expectCopied(
        kind,
        ENEMY_FRAMES.map((frame) => ({ frame, tier: 0, red: false })),
      );
      const slot = sceneGeometry(390, 440, world.scene.length).enemies[index]!;
      expect([slot.sprite.width, slot.sprite.height]).toEqual([44 * 2, 52 * 2]);
    },
  );

  and("le Villageois fou n'est plus dessiné comme une Goule", () => {
    for (const frame of ENEMY_FRAMES) {
      expect(battleSprite('madVillager', frame).sprite).not.toEqual(
        battleSprite('ghoul', frame).sprite,
      );
    }
  });

  // --- La Goule validée remplace l'ancien dessin ---

  when("le combat s'affiche", async () => {
    if (world.heroes.length > 0) {
      for (const hero of world.heroes) {
        await showBattle(['ghoul'], hero);
        await cleanup();
      }
      return;
    }
    world.scene = await showBattle(['ghoul', 'specter']);
  });

  then('la Goule joue les poses de son animation complète validée', () => {
    expect(world.scene.map((enemy) => enemy.kind)).toContain('ghoul');
    world.shown = [
      ...restPoses('standing'),
      ...posesOf(STEP_IN, STEP_IN_AT, WIND_UP_AT),
      ...posesOf(attackTimeline('double'), WIND_UP_AT, IMPACT + 1_100),
      ...restPoses('stunned'),
    ];
    expectCopied('ghoul', world.shown);
  });

  and("la Goule n'est plus dessinée nulle part avec son ancien dessin", () => {
    const ghoul = battleSprite('ghoul', 'idle0').sprite;
    expect(ghoul).toEqual(copied('ghoul', 'idle0'));
    // L'ancien dessin ne sert plus qu'aux sprites provisoires, aucun ne s'appelle Goule.
    expect(battleAtlas('ghoul').rgba).not.toEqual(battleAtlas('fallenKnight').rgba);
  });

  // --- Chaque moment du combat ---

  when(
    /^il (attend son tour|avance vers le héros puis revient|prépare un coup simple|prépare un coup retardé|fait une fausse amorce|est touché|est étourdi|tombe)$/,
    (moment: string) => {
      const timelines: Record<string, () => World['shown']> = {
        'attend son tour': () => restPoses('standing'),
        'avance vers le héros puis revient': () => [
          ...posesOf(STEP_IN, STEP_IN_AT, WIND_UP_AT),
          ...posesOf(attackTimeline('basic'), IMPACT, IMPACT + 600),
        ],
        'prépare un coup simple': () =>
          posesOf(attackTimeline('basic'), WIND_UP_AT, IMPACT + 600, world.reduced),
        'prépare un coup retardé': () =>
          posesOf(attackTimeline('delayed'), WIND_UP_AT, IMPACT + 600),
        'fait une fausse amorce': () => posesOf(attackTimeline('feint'), WIND_UP_AT, IMPACT),
        // Touché, il garde sa pose : la scène ne la change pas, seul le chiffre s'envole.
        'est touché': () => restPoses('standing'),
        'est étourdi': () => restPoses('stunned'),
        tombe: () => restPoses('fallen'),
      };
      world.shown = timelines[moment]!();
    },
  );

  then(
    /^il joue les poses (.+) de son animation complète, à 12 images par seconde \(83 ms par image\)$/,
    (poses: string) => {
      const wanted = poses.match(new RegExp(`\\b(${ENEMY_FRAMES.join('|')})\\b`, 'g'))!;
      const shown = world.shown.map(({ frame }) => frame);
      expect([shown, inOrder(shown, wanted as EnemyFrame[])]).toEqual([shown, true]);
      expect(Math.round(FRAME_MS)).toBe(83);
      for (const kind of world.kinds) expectCopied(kind as Animated, world.shown);
    },
  );

  and("aucune pose n'est obtenue en déplaçant ou en étirant une autre", () => {
    for (const kind of world.kinds) {
      for (const { frame } of world.shown) {
        const { sprite } = battleSprite(kind, frame);
        expect([sprite.width, sprite.height]).toEqual([44, 52]);
        expect(sprite).toEqual(copied(kind as Animated, frame));
      }
      expect(battleSprite(kind, 'hes').sprite).not.toEqual(battleSprite(kind, 'ant2').sprite);
    }
  });

  // --- La Fourche ---

  when('il prépare la Fourche', () => {
    world.move = ENEMIES.madVillager.moves[0]!;
    world.shown = posesOf(attackTimeline('basic', world.move), WIND_UP_AT, IMPACT - 80);
  });

  then(
    "il joue les poses d'anticipation de son animation complète, avec le reflet et le son d'aujourd'hui",
    () => {
      const shown = world.shown.map(({ frame }) => frame);
      expect(inOrder(shown, ['ant0', 'ant1', 'ant2'])).toBe(true);
      expectCopied('madVillager', world.shown);
      const timeline = attackTimeline('basic', world.move!);
      expect(timeline.glints).toEqual([{ at: IMPACT - 150, kind: 'white', impact: 0 }]);
      expect(GLINT_CUES.white).toBe('glint');
      const now = IMPACT - 150 + 10;
      const { frame } = enemyPose(timeline, now, false);
      const glints = glintSprites(timeline.glints, now, poseAnchors('madVillager', frame));
      expect(glints.map(({ x, y }) => [x, y])).toEqual([copiedAnchors('madVillager', 'ant2').eye]);
    },
  );

  and("la Fourche fait saigner comme aujourd'hui (2 PV pendant 3 manches)", () => {
    expect(world.move).toEqual({ attack: 'basic', damage: 5, bleed: { damage: 2, rounds: 3 } });
  });

  // --- Le reflet et les étoiles ---

  when("le reflet de son coup s'allume, ou quand il est étourdi", () => undefined);

  then(
    'le reflet part de son œil ou de la pointe de son arme, selon les ancrages de la pose affichée',
    () => {
      for (const kind of world.kinds as Animated[]) {
        const basic = attackTimeline('basic');
        // Pendant les 70 ms où la pose reste pleine (`ant2`), puis pendant la ruée (`lunge`).
        for (const [delay, pose] of [
          [10, 'ant2'],
          [80, 'lunge'],
        ] as const) {
          const now = IMPACT - 150 + delay;
          const { frame } = enemyPose(basic, now, false);
          expect(frame).toBe(pose);
          const glints = glintSprites(basic.glints, now, poseAnchors(kind, frame));
          expect(glints.map(({ x, y }) => [x, y])).toEqual([copiedAnchors(kind, pose).eye]);
        }
      }
      // La double frappe de la Goule (Pelletées) : un reflet à chacune de ses deux pointes.
      const double = attackTimeline('double');
      const now = IMPACT - 150 + 10;
      const { frame } = enemyPose(double, now, false);
      const glints = glintSprites(double.glints, now, poseAnchors('ghoul', frame));
      expect(glints.map(({ x, y }) => [x, y])).toEqual(copiedAnchors('ghoul', frame).tips);
    },
  );

  and("les étoiles tournent au-dessus de sa tête, selon l'ancrage de la pose affichée", () => {
    for (const kind of world.kinds as Animated[]) {
      const stunned = { standing: true, down: true, losingAction: false, rising: null };
      for (const [now, pose] of [
        [100, 'hurt'],
        [500, 'down'],
      ] as const) {
        const rest = restPose({ ...stunned, downSince: 0 }, 0, now);
        expect([rest.frame, rest.stars !== null]).toEqual([pose, true]);
        expect(poseAnchors(kind, rest.frame).head).toEqual(copiedAnchors(kind, pose).head);
      }
    }
  });

  // --- Les états qui ne sont pas des poses ---

  when('il est visé, estompé (ennemi non actif) ou tombé', async () => {
    world.scene = [
      sceneEnemy('ghoul', { target: true }),
      sceneEnemy('madVillager', { dimmed: true }),
    ];
  });

  then(
    "la pose affichée est marquée comme aujourd'hui : la cible, l'estompe, ou l'estompe désaturée d'un ennemi tombé",
    async () => {
      const check = async (enemies: SceneEnemy[]) => {
        const { scene, geometry } = await renderScene(enemies);
        const nodes = drawn();
        // Les socles des ennemis debout, dans l'ordre : doré pour la cible.
        const pedestals = enemies.map((_, index) => geometry.enemies[index]!.pedestal);
        const selected = nodes
          .filter((node) =>
            pedestals.some((kind) =>
              [0, 1].some((on) => node.props.image === scene.pedestals[`${kind}-${on}`]),
            ),
          )
          .map((node) =>
            pedestals.some((kind) => node.props.image === scene.pedestals[`${kind}-1`]),
          );
        expect(selected).toEqual(
          enemies.filter((enemy) => enemy.standing).map((enemy) => enemy.target),
        );
        enemies.forEach((enemy) => {
          const atlas = nodes.find(
            (node) =>
              node.type === 'skAtlas' && node.props.image === scene.characters[enemy.kind].image,
          )!;
          const faded = enemy.dimmed || !enemy.standing;
          expect([enemy.kind, atlas.props.opacity]).toEqual([enemy.kind, faded ? 0.3 : 1]);
          expect(atlas.children?.length ?? 0).toBe(faded ? 1 : 0);
        });
        return nodes;
      };
      await check(world.scene);
      // Tombée, la Goule est estompée et désaturée ; le Villageois fou est visé.
      world.scene = [
        sceneEnemy('madVillager', { target: true }),
        sceneEnemy('ghoul', { standing: false }),
      ];
      await check(world.scene);
    },
  );

  and("aucun éclair blanc ni effacement ne s'ajoute", () => {
    const atlases = drawn().filter((node) => node.type === 'skAtlas');
    // Les deux ennemis, le héros et les effets : aucune couche de plus.
    expect(atlases).toHaveLength(4);
    for (const kind of ANIMATED) {
      expect(Object.keys(battleAtlas(kind).table.frames)).toEqual(ENEMY_FRAMES);
      for (const frame of ENEMY_FRAMES) {
        for (const tier of [0, 1, 2]) {
          expect(atlasCell(kind, frame, tier, false)).toEqual(toRgba(copied(kind, frame)));
        }
      }
    }
  });

  // --- Ni liseré ni traînée ---

  when('il prépare un coup ou avance vers le héros', () => {
    world.shown = [
      ...posesOf(STEP_IN, STEP_IN_AT, WIND_UP_AT),
      ...posesOf(attackTimeline('basic'), WIND_UP_AT, IMPACT + 600),
      ...posesOf(attackTimeline('delayed'), WIND_UP_AT, IMPACT + 600),
      ...posesOf(attackTimeline('double'), WIND_UP_AT, IMPACT + 1_000),
    ];
  });

  then("chaque pose s'affiche telle que validée dans l'Atelier, pixel pour pixel", () => {
    for (const kind of world.kinds as Animated[]) expectCopied(kind, world.shown);
  });

  and("elle ne s'entoure d'aucun liseré d'or et ne laisse aucune traînée", () => {
    // La scène demande bien un liseré plein et la ruée : l'image reste la pose recopiée.
    expect(world.shown.some(({ tier }) => tier === 2)).toBe(true);
    expect(world.shown.some(({ frame }) => frame === 'lunge')).toBe(true);
    for (const kind of world.kinds as Animated[]) {
      expect(battleSprite(kind, 'lunge', { tier: 2 }).sprite).toEqual(copied(kind, 'lunge'));
    }
  });

  and(
    "les ennemis sans animation complète validée gardent leur liseré et leur traînée d'aujourd'hui",
    () => {
      const count = (sprite: Sprite, ...codes: number[]) =>
        Array.from(sprite.pixels).filter((code) => codes.includes(code)).length;
      const gold = (tier: 0 | 2) => count(battleSprite('specter', 'ant1', { tier }).sprite, 7, 8);
      expect(gold(2)).toBeGreaterThan(gold(0));
      const lunge = battleSprite('specter', 'lunge', { tier: 2 }).sprite;
      const still = battleSprite('specter', 'ant2', { tier: 2 }).sprite;
      expect(count(lunge, 17)).toBeGreaterThan(count(still, 17) + 20);
    },
  );

  // --- « Objet trouvé » ---

  when(/^l'objet trouvé est ([^,]+)$/, async (name: string) => {
    await showItem(KIND_OF_ITEM[name]!);
  });

  when(
    "l'objet trouvé est l'Armure de chevalier noir, dont l'image n'est pas validée dans l'Atelier",
    async () => {
      await showItem('blackKnightArmor');
    },
  );

  then(
    /^l'écran « Objet trouvé » montre l'image validée de (.+) \(24 × 24 pixels d'art\), à 3 dp par pixel d'art, soit 72 dp$/,
    (name: string) => {
      expect(screen.getByRole('header', { name: 'Objet trouvé' })).toBeOnTheScreen();
      const image = screen.getByTestId('item-image', { includeHiddenElements: true });
      expect(image).toHaveProp('sprite', `item-${KIND_OF_ITEM[name]}`);
      const { scale, pixelWidth, pixelHeight } = image.props;
      expect([pixelWidth, pixelHeight, scale, pixelWidth * scale]).toEqual([24, 24, 3, 72]);
    },
  );

  and("la silhouette provisoire de son emplacement n'apparaît plus", () => {
    expect(screen.queryByTestId('item-silhouette', { includeHiddenElements: true })).toBeNull();
  });

  and("le nom, les chiffres et le texte de l'objet ne changent pas", () => {
    expect(screen.getByText(itemText(world.item!))).toBeOnTheScreen();
    expect(itemDescription(world.item!)).toBeNull();
  });

  then(
    "l'écran « Objet trouvé » montre toujours la silhouette provisoire de l'emplacement armure",
    () => {
      expect(screen.getByTestId('item-silhouette', { includeHiddenElements: true })).toHaveProp(
        'sprite',
        'item-silhouette-armor',
      );
      expect(screen.queryByTestId('item-image', { includeHiddenElements: true })).toBeNull();
    },
  );

  and(
    'son nom, ses chiffres et son libellé provisoire « Lourde et lente. » restent affichés',
    () => {
      expect(screen.getByText(itemText('blackKnightArmor'))).toBeOnTheScreen();
      expect(screen.getByText('Lourde et lente.')).toBeOnTheScreen();
    },
  );

  // --- Les ennemis sans animation complète ---

  given(
    /^un ennemi, une Élite ou un boss dont l'animation complète n'est pas validée \((.+)\)$/,
    (names: string) => {
      world.kinds = names.split(', ').map((name) => KIND_OF_NAME[name.replace(/^(le|la) /, '')]!);
      expect(world.kinds).toHaveLength(7);
    },
  );

  when('il apparaît dans la tour', async () => {
    const labels: string[] = [];
    for (let start = 0; start < world.kinds.length; start += 3) {
      const group = world.kinds.slice(start, start + 3);
      await showBattle(group);
      for (const kind of group) {
        labels.push(screen.getByTestId(`enemy-${kind}`).props.accessibilityLabel as string);
      }
      await cleanup();
    }
    world.read.labels = labels;
  });

  then('il garde son sprite actuel ou sa silhouette provisoire', () => {
    for (const kind of world.kinds) {
      // Dessiné par le code : il garde son liseré, absent des poses recopiées.
      expect(battleSprite(kind, 'ant1', { tier: 2 }).sprite).not.toEqual(
        battleSprite(kind, 'ant1').sprite,
      );
    }
  });

  and("le Chevalier déchu garde l'ancien dessin de la Goule comme sprite provisoire", () => {
    const shape = (kind: EnemyKind, frame: EnemyFrame) =>
      Array.from(battleSprite(kind, frame).sprite.pixels, (code) => (code === 0 ? 0 : 1));
    for (const frame of ENEMY_FRAMES) {
      // Les silhouettes provisoires du Squelette et des Jumeaux sont celles de l'ancien dessin.
      expect(shape('fallenKnight', frame)).toEqual(shape('skeleton', frame));
      expect(shape('fallenKnight', frame)).toEqual(shape('twins', frame));
      expect(shape('fallenKnight', frame)).not.toEqual(shape('ghoul', frame));
    }
  });

  and('son nom et ses chiffres restent affichés', () => {
    world.kinds.forEach((kind, index) => {
      const { maxHp } = ENEMIES[kind];
      expect(world.read.labels[index]).toContain(ENEMY_NAMES[kind]);
      expect(world.read.labels[index]).toContain(`${maxHp} PV sur ${maxHp}`);
    });
  });

  // --- Les héros ---

  given("une ascension avec la Sentinelle ou l'Errante", () => {
    world.heroes = ['sentinel', 'wanderer'];
  });

  then('le héros garde son sprite actuel ou sa silhouette provisoire', () => {
    const raise = battleSprite('hero', 'raise').sprite;
    expect([raise.width, raise.height]).toEqual([36, 44]);
    expect(battleSprite('hero', 'raise', { tier: 1 }).sprite).not.toEqual(raise);
  });

  // --- Jamais d'échelle fractionnaire ---

  given('la Goule, le Villageois fou ou un objet affiché avec son image validée', () => undefined);

  when("il s'affiche, dans n'importe quelle pose", async () => {
    await showItem('crossbow');
  });

  then("il est à 2 dp par pixel d'art en scène, 3 dp sur l'écran « Objet trouvé »", () => {
    for (const kind of ANIMATED) {
      for (const frame of ENEMY_FRAMES) {
        const { sprite } = battleSprite(kind, frame);
        expect([sprite.width, sprite.height]).toEqual([44, 52]);
      }
    }
    for (const count of [1, 2, 3]) {
      for (const slot of sceneGeometry(390, 440, count).enemies) {
        expect([slot.sprite.width, slot.sprite.height]).toEqual([44 * 2, 52 * 2]);
      }
    }
    expect(screen.getByTestId('item-image', { includeHiddenElements: true })).toHaveProp(
      'scale',
      3,
    );
  });

  and("il n'est jamais mis à une autre échelle", () => {
    for (const image of Object.values(ITEM_IMAGES)) expect([image.w, image.h]).toEqual([24, 24]);
  });

  // --- Mouvement réduit ---

  when('la Goule ou le Villageois fou prépare un coup', () => {
    world.kinds = ANIMATED;
  });

  then("il parcourt seulement le quart du chemin, comme aujourd'hui, avec les mêmes durées", () => {
    const basic = attackTimeline('basic');
    for (let now = WIND_UP_AT; now < IMPACT + 600; now += 5) {
      const full = enemyPose(basic, now, false);
      const reduced = enemyPose(basic, now, true);
      expect([now, reduced.frame]).toEqual([now, full.frame]);
      expect(reduced.reach).toBeCloseTo(full.reach * 0.25, 6);
    }
  });

  and('le reflet reste affiché', () => {
    const basic = attackTimeline('basic');
    const now = IMPACT - 150 + 10;
    for (const kind of world.kinds) {
      const { frame } = enemyPose(basic, now, true);
      expect(glintSprites(basic.glints, now, poseAnchors(kind, frame))).toHaveLength(1);
    }
  });

  // --- Lecteur d'écran ---

  given("le lecteur d'écran est actif", () => undefined);

  when(
    "le joueur parcourt un combat contre la Goule ou le Villageois fou, ou l'écran « Objet trouvé »",
    async () => {
      await showBattle(['ghoul', 'madVillager']);
      world.read.hidden.push(
        isHidden(screen.getByTestId('battle-scene', { includeHiddenElements: true })),
      );
      expect(screen.queryByTestId('battle-scene')).toBeNull();
      for (const kind of ANIMATED) {
        world.read.labels.push(screen.getByTestId(`enemy-${kind}`).props.accessibilityLabel);
      }
      await cleanup();
      await showItem('axe');
      world.read.hidden.push(
        isHidden(screen.getByTestId('item-image', { includeHiddenElements: true })),
      );
      expect(screen.queryByTestId('item-image')).toBeNull();
    },
  );

  then("l'image et ses poses ne sont pas lues : elles sont décoratives", () => {
    expect(world.read.hidden).toEqual([true, true]);
  });

  and(
    "le lecteur d'écran lit toujours le nom, les PV, la garde et l'intention de l'ennemi, ou le nom et les chiffres de l'objet",
    () => {
      ANIMATED.forEach((kind, index) => {
        const { maxHp, maxGuard } = ENEMIES[kind];
        expect(world.read.labels[index]).toContain(ENEMY_NAMES[kind]);
        expect(world.read.labels[index]).toContain(`${maxHp} PV sur ${maxHp}`);
        expect(world.read.labels[index]).toContain(`garde ${maxGuard} sur ${maxGuard}`);
        expect(world.read.labels[index]).toMatch(/intention/);
      });
      expect(screen.getByText(itemText('axe'))).toBeOnTheScreen();
    },
  );
};

const feature = loadFeature('features/goule-villageois-objets.feature');
autoBindSteps([feature], [steps]);
