/**
 * @jest-environment ./test/setup/skiaEnvironment.js
 */
// Test de fumée de la scène du combat avec Skia : sous Jest, les tests d'écran la remplacent par
// `testing/fakeBattleCanvas.tsx`. La scène se monte avec ses atlas. Le setup de Skia vient d'abord.
import '@shopify/react-native-skia/jestSetup';

import { act, render, screen } from '@testing-library/react-native';

import {
  attackMotion,
  poseAnchors,
  type AttackMotions,
} from '../pixelArt/sprites/battle/battleCharacters';
import { BattleScene, prepareBattleScene, type BattleSceneProps } from './BattleCanvas';
import { enemyPose } from './scene/enemyPose';
import { GROUND_SHADOW_OPACITY } from '../pixelArt/sprites/battle/battleStage';
import { sceneGeometry, spriteOrigin } from './scene/sceneGeometry';
import type { SceneEnemy, SceneTimeline } from './sceneTypes';

// Les tampons de transformations de l'`Atlas`, remplacés dans le dernier bloc de tests : chaque
// tampon garde son worklet, appelé place par place pour lire ce que la scène y écrit.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- l'objet du module, pour l'espionner
const skia: { useRSXformBuffer: unknown } = require('@shopify/react-native-skia');

/** Les ennemis joués par ces tests : leurs atlas sont préparés à la demande (#38). */
const PLAYED = [
  'ghoul',
  'specter',
  'necromancer',
  'madVillager',
  'facelessPrior',
  'fallenKnight',
  'twins',
  'ossuaryWarden',
] as const;

const ENEMIES: SceneEnemy[] = (['ghoul', 'specter', 'necromancer'] as const).map((kind, index) => ({
  kind,
  standing: true,
  target: index === 0,
  dimmed: index !== 1,
  active: index === 1,
  down: index === 2,
  losingAction: false,
  rising: null,
  downSince: null,
}));

function props(change: Partial<BattleSceneProps> = {}): BattleSceneProps {
  return {
    width: 390,
    height: 440,
    geometry: sceneGeometry(390, 440, 3),
    enemies: ENEMIES,
    heroKind: 'sentinel',
    heroPose: 'idle',
    heroPoseSince: 0,
    strikeTarget: 0,
    strikeImpactAt: null,
    timeline: {
      enemy: 1,
      kind: 'attack',
      attack: 'perilous',
      stepInAt: 1_000,
      windUpAt: 1_000,
      windUpMs: 1_300,
      until: 2_460,
      impacts: [2_300],
      feintAt: null,
      glints: [{ at: 2_150, kind: 'red', impact: 0 }],
      hitStopAt: 0,
      hitStopUntil: 0,
    },
    spark: { kind: 'gold', at: 2_300 },
    hurtAt: null,
    reducedMotion: false,
    uiNow: () => {
      'worklet';
      return 2_200;
    },
    ...change,
  };
}

/** Les types des éléments Skia dessinés par la scène (`skCircle`, `skAtlas`…). */
function drawnTypes(): string[] {
  const types: string[] = [];
  const visit = (node: NonNullable<ReturnType<typeof screen.toJSON>> | string) => {
    if (typeof node === 'string') return;
    types.push(node.type);
    node.children?.forEach(visit);
  };
  const tree = screen.toJSON();
  if (tree !== null) visit(tree);
  return types;
}

describe('BattleScene with Skia: the rise of the second chance (#206)', () => {
  it('draws the veil, the golden halo and the grey hero only during a rise', async () => {
    await render(<BattleScene {...props()} />);
    expect(drawnTypes()).not.toContain('skCircle');
    const atlases = drawnTypes().filter((type) => type === 'skAtlas').length;

    await render(
      <BattleScene {...props({ heroPose: 'fallen', secondChance: { at: 2_000, until: 4_000 } })} />,
    );

    expect(drawnTypes()).toEqual(expect.arrayContaining(['skRect', 'skCircle']));
    expect(drawnTypes().filter((type) => type === 'skAtlas')).toHaveLength(atlases + 1);
  });
});

describe('BattleScene with Skia, its enemies prepared on demand (#38)', () => {
  it('prepares the enemies asked for only, once each, the phase 2 aspect of a boss included', () => {
    const scene = prepareBattleScene(['ghoul']);
    expect(scene.characters.stoneSaint).toBeUndefined();

    const again = prepareBattleScene(['stoneSaint', 'hourRinger', 'ashBramble']);

    expect(again).toBe(scene);
    expect(again.characters.ghoul).toBeDefined();
    expect([
      again.characters.stoneSaint?.table.cellWidth,
      again.characters.stoneSaint?.table.cellHeight,
    ]).toEqual([48, 58]);
    expect(again.phase2.characters.hourRinger?.image).not.toBe(again.characters.hourRinger?.image);
    expect(again.phase2.characters.stoneSaint).toBeUndefined();
    expect(again.phase2.anchors.hourRinger?.idle0).toEqual(
      poseAnchors('hourRinger', 'idle0', null, true),
    );
    expect(again.phase2.motions.hourRinger).toBe(attackMotion('hourRinger', true));
    expect(again.extras.ashBramble).toEqual(['rise0', 'rise1']);
    expect(again.anchors.ashBramble?.rise0).toEqual(poseAnchors('ashBramble', 'rise0'));
  });

  it.each([
    ['bronzeWarden', false],
    ['stoneSaint', false],
    ['hourRinger', true],
    ['ashGleaner', false],
  ] as const)('mounts the %s alone, phase 2: %s', async (kind, phase2) => {
    await render(
      <BattleScene
        {...props({
          geometry: sceneGeometry(390, 440, 1),
          enemies: [{ ...ENEMIES[1]!, kind, phase2 }],
          timeline: { ...props().timeline!, enemy: 0 },
        })}
      />,
    );

    expect(drawnTypes()).toContain('skAtlas');
  });
});

describe('BattleScene with Skia: an escorted Elite (#257)', () => {
  it.each([
    [3, ['firstPilgrim', 'bronzeWarden', 'bellNovice']],
    [2, ['scarecrow', 'mothkin']],
  ] as const)('mounts an Elite escorted in the lead layout of %i columns', async (count, kinds) => {
    prepareBattleScene(kinds);
    await render(
      <BattleScene
        {...props({
          width: 360,
          geometry: sceneGeometry(360, 440, count, { lead: true }),
          enemies: kinds.map((kind, index) => ({ ...ENEMIES[0]!, kind, target: index === 0 })),
          timeline: { ...props().timeline!, enemy: 1 },
        })}
      />,
    );

    expect(drawnTypes()).toContain('skAtlas');
  });
});

describe('BattleScene with Skia', () => {
  it('prepares the atlases of the scene once, as Skia images', () => {
    const prepared = prepareBattleScene(PLAYED);

    expect(prepared.characters.ghoul!.image?.width()).toBe(352);
    // La Sentinelle a 17 cases (ses 15 poses, dont `bash`, et 2 liserés), sur 3 lignes de 8 (#155).
    expect(prepared.heroes.sentinel.image?.height()).toBe(132);
    expect(prepared.heroes.wanderer.image?.height()).toBe(88);
    expect(prepared.heroes.wanderer.image).not.toBe(prepared.heroes.sentinel.image);
    expect(prepared.effects.image?.width()).toBeGreaterThan(0);
    expect(prepareBattleScene(PLAYED)).toBe(prepared);
  });

  it('prepares the anchors of each pose: those of the full animation, pose by pose', () => {
    const { anchors } = prepareBattleScene(PLAYED);

    expect(anchors.ghoul!.hurt).toEqual(poseAnchors('ghoul', 'hurt'));
    expect(anchors.madVillager!.lunge).toEqual(poseAnchors('madVillager', 'lunge'));
    // Les Jumeaux et la Gardienne ne sont plus dessinés par le code (#139) : leurs ancrages ne sont
    // plus ceux de `ant2` pour toute pose, mais ceux de chaque pose recopiée.
    expect(anchors.ossuaryWarden!.idle0).toEqual(poseAnchors('ossuaryWarden', 'idle0'));
    expect(anchors.ossuaryWarden!.idle0).not.toEqual(anchors.ossuaryWarden!.ant2);
    expect(anchors.twins!.down).toEqual(poseAnchors('twins', 'down'));
  });

  it('mounts the Ghoul and the Mad villager with their full animation, one of them stunned', async () => {
    const group: SceneEnemy[] = (['ghoul', 'madVillager'] as const).map((kind, index) => ({
      ...ENEMIES[index]!,
      kind,
      down: index === 1,
    }));
    await render(
      <BattleScene
        {...props({
          enemies: group,
          timeline: {
            enemy: 0,
            kind: 'attack',
            attack: 'double',
            stepInAt: 1_000,
            windUpAt: 1_000,
            windUpMs: 1_300,
            until: 2_700,
            impacts: [2_300, 2_500],
            feintAt: null,
            glints: [{ at: 2_150, kind: 'double', impact: 0 }],
            hitStopAt: 0,
            hitStopUntil: 0,
          },
        })}
      />,
    );

    expect(drawnTypes()).toContain('skAtlas');
  });

  it('prepares the atlas of each enemy at the size of its cell: 52 × 62 for the Faceless prior (#138)', () => {
    const { characters } = prepareBattleScene(PLAYED);

    expect(characters.facelessPrior!.image?.width()).toBe(8 * 52);
    expect([
      characters.facelessPrior!.table.cellWidth,
      characters.facelessPrior!.table.cellHeight,
    ]).toEqual([52, 62]);
    expect([
      characters.fallenKnight!.table.cellWidth,
      characters.fallenKnight!.table.cellHeight,
    ]).toEqual([44, 54]);
  });

  it('prepares the Twins in a cell of 54 × 54 and the Ossuary warden in one of 52 × 62, with their attack poses (#139)', () => {
    const { characters, attackAnchors, motions } = prepareBattleScene(PLAYED);

    expect([characters.twins!.table.cellWidth, characters.twins!.table.cellHeight]).toEqual([
      54, 54,
    ]);
    expect(characters.twins!.image?.width()).toBe(8 * 54);
    expect([
      characters.ossuaryWarden!.table.cellWidth,
      characters.ossuaryWarden!.table.cellHeight,
    ]).toEqual([52, 62]);
    expect(Object.keys(characters.twins!.table.attacks).sort()).toEqual([
      'basic',
      'delayedPerilous',
    ]);
    expect(attackAnchors.twins!.basic?.ant2).toEqual(poseAnchors('twins', 'ant2', 'basic'));
    expect(attackAnchors.ossuaryWarden!.perilous?.lunge).toEqual(
      poseAnchors('ossuaryWarden', 'lunge', 'perilous'),
    );
    expect(Object.keys(attackAnchors.twins!.delayedPerilous ?? {}).sort()).toEqual([
      'ant0',
      'ant1',
      'ant2',
      'hes',
      'impact',
      'lunge',
    ]);
    expect(attackAnchors.ghoul).toEqual({});
    expect(motions.twins).toBe(attackMotion('twins'));
    expect(motions.specter).toEqual({});
  });

  it.each(['facelessPrior', 'fallenKnight', 'twins', 'ossuaryWarden'] as const)(
    'mounts the %s alone, on its ground shadow, preparing its perilous attack',
    async (kind) => {
      await render(
        <BattleScene
          {...props({
            geometry: sceneGeometry(390, 440, 1),
            enemies: [{ ...ENEMIES[1]!, kind }],
            timeline: { ...props().timeline!, enemy: 0 },
          })}
        />,
      );

      expect(drawnTypes()).toContain('skAtlas');
    },
  );

  it('mounts the ground shadows, the enemies, the hero and the effects on a transparent scene, hidden from the screen reader', async () => {
    await render(<BattleScene {...props()} />);

    const canvas = screen.getByTestId('battle-canvas', { includeHiddenElements: true });
    expect(canvas).toHaveProp('accessibilityElementsHidden', true);
    expect(canvas).toHaveProp('pointerEvents', 'none');
    expect(drawnTypes()).toContain('skAtlas');
  });

  it.each(['wanderer', 'sentinel'] as const)(
    'draws the hero with the atlas of the %s, the heroine of the ascent (#140)',
    async (heroKind) => {
      const { heroes } = prepareBattleScene(PLAYED);
      await render(<BattleScene {...props({ heroKind })} />);

      const atlases: unknown[] = [];
      const visit = (node: NonNullable<ReturnType<typeof screen.toJSON>> | string) => {
        if (typeof node === 'string') return;
        if (node.type === 'skAtlas') atlases.push(node.props.image);
        node.children?.forEach(visit);
      };
      const tree = screen.toJSON();
      if (tree !== null && !Array.isArray(tree)) visit(tree);
      const other = heroKind === 'wanderer' ? 'sentinel' : 'wanderer';
      expect(atlases).toContain(heroes[heroKind].image);
      expect(atlases).not.toContain(heroes[other].image);
    },
  );

  it('draws no timing ring while an enemy prepares a perilous attack: the attack reads by its animation alone (#101)', async () => {
    await render(<BattleScene {...props()} />);

    expect(drawnTypes()).not.toContain('skCircle');
  });

  it('mounts at rest, without an enemy action, and for a fallen hero', async () => {
    await render(
      <BattleScene
        {...props({
          timeline: null,
          spark: null,
          hurtAt: 0,
          heroPose: 'fallen',
          reducedMotion: true,
        })}
      />,
    );

    expect(screen.getByTestId('battle-canvas', { includeHiddenElements: true })).toBeOnTheScreen();
  });
});

describe('BattleScene: a ground shadow under each character, no pedestal (#184)', () => {
  interface DrawnNode {
    readonly type: string;
    readonly props: Record<string, unknown>;
  }
  /** Les éléments Skia dessinés, dans l'ordre du dessin. */
  function drawnNodes(): DrawnNode[] {
    const nodes: DrawnNode[] = [];
    const visit = (node: NonNullable<ReturnType<typeof screen.toJSON>> | string) => {
      if (typeof node === 'string') return;
      nodes.push({ type: node.type, props: node.props });
      node.children?.forEach(visit);
    };
    const tree = screen.toJSON();
    if (tree !== null && !Array.isArray(tree)) visit(tree);
    return nodes;
  }

  it('prepares one ground shadow image for the whole launch, and no pedestal', () => {
    const scene = prepareBattleScene(PLAYED);

    expect([scene.groundShadow?.width(), scene.groundShadow?.height()]).toEqual([32, 5]);
    expect(scene).not.toHaveProperty('pedestals');
    expect(prepareBattleScene(PLAYED).groundShadow).toBe(scene.groundShadow);
  });

  it.each([
    ['at 3 dp', 390, 3],
    ['at 2 dp, on a narrow screen', 320, 2],
  ] as const)(
    'draws the same shadow under each enemy, standing or fallen, target or not, and under the hero %s, before the sprites',
    async (_, width, scale) => {
      const geometry = sceneGeometry(width, 440, 3);
      const enemies = ENEMIES.map((enemy, index) => ({ ...enemy, standing: index !== 2 }));
      await render(<BattleScene {...props({ width, geometry, enemies })} />);
      const { groundShadow } = prepareBattleScene(PLAYED);

      const nodes = drawnNodes();
      const shadows = nodes.filter((node) => node.props.image === groundShadow);
      const at = [
        ...geometry.enemies.map((slot) => slot.groundShadowAt),
        geometry.heroGroundShadowAt,
      ];
      const sizes = [2, 2, 2, scale];
      expect(
        shadows.map(({ type, props: drawn }) => [
          type,
          drawn.x,
          drawn.y,
          drawn.width,
          drawn.height,
        ]),
      ).toEqual(
        at.map((point, index) => [
          'skImage',
          point.x - 16 * sizes[index]!,
          point.y - 5 * sizes[index]!,
          32 * sizes[index]!,
          5 * sizes[index]!,
        ]),
      );
      expect(shadows.map((node) => node.props.opacity)).toEqual(
        Array(4).fill(GROUND_SHADOW_OPACITY),
      );
      const lastShadow = nodes.lastIndexOf(shadows.at(-1)!);
      expect(nodes.findIndex((node) => node.type === 'skAtlas')).toBeGreaterThan(lastShadow);
      // Aucune autre image sous les personnages : plus de socle, doré ou non.
      expect(
        nodes
          .slice(0, lastShadow)
          .filter((node) => node.type === 'skImage' && !shadows.includes(node)),
      ).toEqual([]);
    },
  );

  it('keeps the same shadows when the target changes, and draws them for a boss alone', async () => {
    const shadowsOf = () =>
      drawnNodes()
        .filter((node) => node.props.image === prepareBattleScene(PLAYED).groundShadow)
        .map((node) => node.props);

    await render(<BattleScene {...props()} />);
    const before = shadowsOf();
    await render(
      <BattleScene
        {...props({ enemies: ENEMIES.map((enemy, index) => ({ ...enemy, target: index === 2 })) })}
      />,
    );
    expect(shadowsOf()).toEqual(before);

    const single = sceneGeometry(390, 440, 1);
    await render(
      <BattleScene
        {...props({
          geometry: single,
          enemies: [{ ...ENEMIES[1]!, kind: 'facelessPrior' }],
          timeline: null,
        })}
      />,
    );
    expect(shadowsOf().map((drawn) => [drawn.x, drawn.width])).toEqual([
      [single.enemies[0]!.groundShadowAt.x - 32, 64],
      [single.heroGroundShadowAt.x - 48, 96],
    ]);
  });
});

describe('BattleScene: the glint and the stars follow the displayed pose', () => {
  /** Un tampon de transformations : son nombre de places et son worklet. */
  interface TransformBuffer {
    readonly count: number;
    readonly fill: (transform: { set: (...values: number[]) => void }, place: number) => void;
  }
  let buffers: TransformBuffer[] = [];
  const DOUBLE: SceneTimeline = {
    enemy: 0,
    kind: 'attack',
    attack: 'double',
    stepInAt: 1_000,
    windUpAt: 1_000,
    windUpMs: 1_300,
    until: 2_700,
    impacts: [2_300, 2_500],
    feintAt: null,
    glints: [{ at: 2_150, kind: 'double', impact: 0 }],
    hitStopAt: 0,
    hitStopUntil: 0,
  };
  /** Dans la fenêtre de 90 ms du reflet double, déjà dans la ruée : l'image `lunge`, pas `ant2`. */
  const NOW = 2_225;
  const geometry = sceneGeometry(390, 440, 2);
  // Préparée avant les tests, jamais à la collecte : un mutant qui fait échouer la préparation des
  // atlas fait échouer les tests (il est tué), au lieu d'une erreur d'exécution hors du score (#149).
  let table: ReturnType<typeof prepareBattleScene>['effects']['table'];
  beforeAll(() => {
    ({ table } = prepareBattleScene(PLAYED).effects);
  });

  beforeEach(() => {
    buffers = [];
    jest.spyOn(skia, 'useRSXformBuffer' as never).mockImplementation(((
      count: number,
      fill: TransformBuffer['fill'],
    ) => {
      buffers.push({ count, fill });
      return { value: [] };
    }) as never);
  });

  afterEach(() => jest.restoreAllMocks());

  /** Monte la scène avec la Goule (place 0) et le Villageois fou (place 1), le temps d'images. */
  async function mount(villager: Partial<SceneEnemy>, timeline: SceneTimeline | null) {
    const enemy = (kind: SceneEnemy['kind'], change: Partial<SceneEnemy>): SceneEnemy => ({
      ...ENEMIES[0]!,
      kind,
      target: false,
      dimmed: false,
      active: false,
      down: false,
      ...change,
    });
    await render(
      <BattleScene
        {...props({
          geometry,
          enemies: [enemy('ghoul', { active: true }), enemy('madVillager', villager)],
          timeline,
          spark: null,
          uiNow: () => NOW,
        })}
      />,
    );
    // Quelques images : l'horloge de la scène lit `uiNow`.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
  }

  /** Les transformations écrites par un tampon, place par place. */
  function written(buffer: TransformBuffer | undefined): number[][] {
    const placed: number[][] = [];
    for (let place = 0; place < (buffer?.count ?? 0); place += 1) {
      buffer?.fill({ set: (...values) => placed.push(values) }, place);
    }
    return placed;
  }

  /** Les effets placés : le tampon des effets, le seul à plusieurs places. */
  const effectsPlaced = () =>
    written(buffers.filter((buffer) => buffer.count > 1).at(-1)).filter(([scale]) => scale !== 0);

  it('places the double glint on the tips of the pose the Ghoul displays, where its body is', async () => {
    await mount({}, DOUBLE);

    const pose = enemyPose(DOUBLE, NOW, false);
    // Le dernier rendu : les effets, le Villageois fou, la Goule (active, en dernier), le héros.
    const [, , ghoul] = buffers.slice(-4);
    const [[, , bodyX, bodyY]] = written(ghoul) as [number[]];
    const side = table.glintWhite[2];
    const { tips } = poseAnchors('ghoul', pose.frame);
    expect(tips).toHaveLength(2);
    expect(pose.frame).toBe('lunge');
    expect(tips).not.toEqual(poseAnchors('ghoul', 'ant2').tips);
    expect(tips).not.toEqual(poseAnchors('ghoul', 'down').tips);
    expect(effectsPlaced()).toEqual(
      tips.map(([x, y]) => [2, 0, bodyX! + 2 * x + 1 - side, bodyY! + 2 * y + 1 - side]),
    );
  });

  it('holds the Bulwark shield in front of the Sentinel, at her scale, and bursts silver shards on the struck enemy (#128)', async () => {
    const { hero } = geometry;
    const scene = async (change: Partial<BattleSceneProps>) => {
      await render(
        <BattleScene
          {...props({
            geometry,
            enemies: ENEMIES.slice(0, 2),
            timeline: null,
            spark: null,
            uiNow: () => NOW,
            ...change,
          })}
        />,
      );
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
    };

    await scene({ bulwark: true });
    // La case de l'écu (15 pixels d'art) part de (27, 12) dans celle du héros, sur des pixels entiers.
    expect(table.shield[2]).toBe(15);
    expect(effectsPlaced()).toEqual([[3, 0, hero.x + 81, hero.y + 36]]);

    await scene({ riposte: { at: NOW, enemy: 1 } });
    const { sprite } = geometry.enemies[1]!;
    const [x, y] = [sprite.x + 44, sprite.y + Math.round(104 * 0.55)];
    const side = table.silverShard[2];
    expect(effectsPlaced()).toEqual(
      [
        [0, -12],
        [12, 0],
        [0, 12],
        [-12, 0],
      ].map(([dx, dy]) => [2, 0, x + dx! - side, y + dy! - side]),
    );
    expect(drawnTypes()).toContain('skPath');
  });

  it('sets the Faceless prior whole on its place, feet on its ground shadow, and its stars on its head (#138)', async () => {
    const single = sceneGeometry(390, 440, 1);
    const { sprite } = single.enemies[0]!;
    const origin = spriteOrigin(sprite, 52, 62);
    const prior = (change: Partial<SceneEnemy>): SceneEnemy => ({
      ...ENEMIES[0]!,
      kind: 'facelessPrior',
      target: false,
      dimmed: false,
      ...change,
    });
    const show = async (change: Partial<SceneEnemy>) => {
      await render(
        <BattleScene
          {...props({
            geometry: single,
            enemies: [prior(change)],
            timeline: null,
            spark: null,
            uiNow: () => NOW,
          })}
        />,
      );
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
    };

    await show({});
    // Le dernier rendu : les effets, le Prieur, le héros.
    const [, body] = buffers.slice(-3);
    expect(written(body)).toEqual([[2, 0, origin.x, origin.y]]);
    expect(origin).toEqual({ x: sprite.x - 8, y: sprite.y - 20 });

    await show({ down: true, downSince: NOW - 1_000 });
    const side = table.stars[2];
    const [x, y] = poseAnchors('facelessPrior', 'down').head;
    expect(effectsPlaced()).toEqual([
      [2, 0, origin.x + 2 * x - side, origin.y + 2 * (y - 4) - side],
    ]);
  });

  describe('the Twins alone, with their attack poses (#139)', () => {
    const single = sceneGeometry(390, 440, 1);
    const { sprite, reach } = single.enemies[0]!;
    const origin = spriteOrigin(sprite, 54, 54);
    // Lue avant les tests, jamais à la collecte (#149), comme la table des effets.
    let motion: AttackMotions;
    beforeAll(() => {
      motion = attackMotion('twins');
    });

    /** L'action des Jumeaux : le Carreau d'arbalète ou l'Onde de choc, préparés à 1 000 ms. */
    function twinsAttack(attack: 'basic' | 'delayedPerilous'): SceneTimeline {
      const impact = attack === 'basic' ? 2_300 : 2_700;
      return {
        enemy: 0,
        kind: 'attack',
        attack,
        stepInAt: 1_000,
        windUpAt: 1_000,
        windUpMs: impact - 1_000,
        until: impact + 160,
        impacts: [impact],
        feintAt: null,
        glints: [{ at: impact - 150, kind: attack === 'basic' ? 'white' : 'red', impact: 0 }],
        hitStopAt: 0,
        hitStopUntil: 0,
      };
    }

    async function show(timeline: SceneTimeline, now: number) {
      await render(
        <BattleScene
          {...props({
            geometry: single,
            enemies: [
              {
                ...ENEMIES[0]!,
                kind: 'twins',
                target: false,
                dimmed: false,
                active: true,
                down: false,
              },
            ],
            timeline,
            spark: null,
            uiNow: () => now,
          })}
        />,
      );
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
      // Le dernier rendu : les effets, les Jumeaux, le héros.
      const [, body] = buffers.slice(-3);
      return written(body)[0]!;
    }

    /** La place des Jumeaux à une image : leur case, leur ruée et leur élévation, en dp. */
    function placed(timeline: SceneTimeline, now: number) {
      const pose = enemyPose(timeline, now, false, motion);
      return {
        pose,
        x: origin.x + Math.round((reach.x * pose.reach + pose.jitter) / 2) * 2,
        y: origin.y + Math.round((reach.y * pose.reach) / 2) * 2 - pose.lift * 2,
      };
    }

    it('lifts the Twins by the lift of the shown pose of the shockwave, 2 dp per art pixel', async () => {
      const shockwave = twinsAttack('delayedPerilous');
      // L'hésitation, puis la ruée : élevés de 15, puis de 5 pixels d'art.
      for (const now of [1_000 + 9 * 83 + 1, 2_650]) {
        const { pose, x, y } = placed(shockwave, now);
        expect(pose.poses).toBe('delayedPerilous');
        expect(pose.lift).toBeGreaterThan(0);
        expect(await show(shockwave, now)).toEqual([2, 0, x, y]);
      }
    });

    it('places the glint of the crossbow bolt on the crossbow, from the anchors of the attack pose', async () => {
      const bolt = twinsAttack('basic');
      const now = bolt.glints[0]!.at + 10;
      const { pose, x, y } = placed(bolt, now);
      expect([pose.frame, pose.poses, pose.lift]).toEqual(['ant2', 'basic', 0]);
      expect(await show(bolt, now)).toEqual([2, 0, x, y]);
      const [eyeX, eyeY] = poseAnchors('twins', 'ant2', 'basic').eye!;
      expect([eyeX, eyeY]).not.toEqual(poseAnchors('twins', 'ant2').eye);
      const side = table.glintWhite[2];
      expect(effectsPlaced()).toEqual([[2, 0, x + 2 * eyeX + 1 - side, y + 2 * eyeY + 1 - side]]);
    });

    it('lifts the red glint of the shockwave with the Twins', async () => {
      const shockwave = twinsAttack('delayedPerilous');
      const now = shockwave.glints[0]!.at + 10;
      const { pose, x, y } = placed(shockwave, now);
      expect([pose.frame, pose.poses, pose.lift]).toEqual(['ant2', 'delayedPerilous', 14]);
      expect(await show(shockwave, now)).toEqual([2, 0, x, y]);
      const [eyeX, eyeY] = poseAnchors('twins', 'ant2', 'delayedPerilous').eye!;
      const side = table.glintRed[2];
      expect(effectsPlaced()).toEqual([[2, 0, x + 2 * eyeX + 1 - side, y + 2 * eyeY + 1 - side]]);
    });
  });

  it('places the stars on the head of the stunned Mad villager: hurt for 200 ms, then down', async () => {
    const side = table.stars[2];
    const { sprite } = geometry.enemies[1]!;
    const starsOn = ([x, y]: readonly [number, number]) => [
      2,
      0,
      sprite.x + 2 * x - side,
      sprite.y + 2 * (y - 4) - side,
    ];

    await mount({ down: true, downSince: NOW - 100 }, null);
    const hurt = effectsPlaced();
    await mount({ down: true, downSince: NOW - 1_000 }, null);
    const down = effectsPlaced();

    expect(hurt).toEqual([starsOn(poseAnchors('madVillager', 'hurt').head)]);
    expect(down).toEqual([starsOn(poseAnchors('madVillager', 'down').head)]);
    expect(hurt).not.toEqual(down);
  });

  it('lays the dust of the Summon on the two empty slots right of the Moth queen (#172)', async () => {
    prepareBattleScene(['mothQueen']);
    const boss = sceneGeometry(412, 440, 3, { lead: true });
    const queen: SceneEnemy = { ...ENEMIES[0]!, kind: 'mothQueen', dimmed: false, down: false };
    await render(
      <BattleScene
        {...props({
          geometry: boss,
          enemies: [queen],
          timeline: null,
          spark: null,
          summon: { pending: [1, 2], calledAt: null, entered: {}, fell: {} },
          uiNow: () => NOW,
        })}
      />,
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Le carré de 52 de l'effet, centré sur la case de 44 × 52 de la place : 4 pixels d'art à gauche.
    const side = table.summon[2];
    expect(side).toBe(52);
    expect(effectsPlaced()).toEqual(
      [1, 2].map((slot) => {
        const { sprite } = boss.enemies[slot]!;
        return [2, 0, sprite.x + 44 - side, sprite.y + 52 - side];
      }),
    );
  });
});

describe('BattleScene with Skia: the Gravedigger and his exhumed Skeleton (#258)', () => {
  const EXHUMING: SceneTimeline = {
    enemy: 0,
    kind: 'support',
    attack: null,
    support: 'exhume',
    stepInAt: 2_000,
    windUpAt: 2_000,
    windUpMs: 0,
    until: 2_400,
    impacts: [],
    feintAt: null,
    glints: [],
    hitStopAt: 0,
    hitStopUntil: 0,
  };

  it.each([false, true])(
    'mounts him in his exhume pose, his Skeleton rising from its bone pile (reduced motion: %s)',
    async (reducedMotion) => {
      prepareBattleScene(['gravedigger', 'skeleton']);
      await render(
        <BattleScene
          {...props({
            geometry: sceneGeometry(390, 440, 3, { lead: true }),
            enemies: [
              { ...ENEMIES[0]!, kind: 'gravedigger', down: false, dimmed: false },
              { ...ENEMIES[0]!, kind: 'skeleton', target: false, down: false, exhumedAt: 2_000 },
            ],
            timeline: EXHUMING,
            spark: null,
            reducedMotion,
          })}
        />,
      );

      expect(drawnTypes()).toContain('skAtlas');
    },
  );
});

describe('BattleScene with Skia: the Bramble mother and the Beadle (#259)', () => {
  it.each([false, true])(
    'mounts them with the spikes of the Thorns, the steel spark and the shards (reduced motion: %s)',
    async (reducedMotion) => {
      prepareBattleScene(['brambleMother', 'beadle']);
      await render(
        <BattleScene
          {...props({
            geometry: sceneGeometry(390, 440, 3, { lead: true }),
            enemies: [
              { ...ENEMIES[0]!, kind: 'brambleMother', down: false, dimmed: false },
              { ...ENEMIES[0]!, kind: 'beadle', target: false, down: true, dimmed: false },
            ],
            signatures: {
              prick: { from: 0 },
              wardSpark: { at: 0, enemy: 1 },
              wardBroken: { at: 0, enemy: 1 },
            },
            reducedMotion,
          })}
        />,
      );

      expect(drawnTypes()).toContain('skAtlas');
    },
  );
});
