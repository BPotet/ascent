/**
 * @jest-environment ./test/setup/skiaEnvironment.js
 */
// Test de fumée de la scène du combat avec Skia : sous Jest, les tests d'écran la remplacent par
// `testing/fakeBattleCanvas.tsx`. La scène se monte avec ses atlas. Le setup de Skia vient d'abord.
import '@shopify/react-native-skia/jestSetup';

import { act, render, screen } from '@testing-library/react-native';

import { poseAnchors } from '../pixelArt/sprites/battle/battleCharacters';
import { BattleScene, prepareBattleScene, type BattleSceneProps } from './BattleCanvas';
import { enemyPose } from './scene/enemyPose';
import { sceneGeometry } from './scene/sceneGeometry';
import type { SceneEnemy, SceneTimeline } from './sceneTypes';

// Les tampons de transformations de l'`Atlas`, remplacés dans le dernier bloc de tests : chaque
// tampon garde son worklet, appelé place par place pour lire ce que la scène y écrit.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- l'objet du module, pour l'espionner
const skia: { useRSXformBuffer: unknown } = require('@shopify/react-native-skia');

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

describe('BattleScene with Skia', () => {
  it('prepares the atlases of the scene once, as Skia images', () => {
    const prepared = prepareBattleScene();

    expect(prepared.characters.ghoul.image?.width()).toBe(352);
    expect(prepared.hero.image?.height()).toBeGreaterThan(0);
    expect(prepared.effects.image?.width()).toBeGreaterThan(0);
    expect(prepareBattleScene()).toBe(prepared);
  });

  it('prepares the anchors of each pose: those of the full animation, or those of today', () => {
    const { anchors } = prepareBattleScene();

    expect(anchors.ghoul.hurt).toEqual(poseAnchors('ghoul', 'hurt'));
    expect(anchors.madVillager.lunge).toEqual(poseAnchors('madVillager', 'lunge'));
    expect(anchors.ossuaryWarden.idle0).toEqual(anchors.ossuaryWarden.ant2);
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

  it('mounts the stage, the pedestals, the enemies, the hero and the effects, hidden from the screen reader', async () => {
    await render(<BattleScene {...props()} />);

    const canvas = screen.getByTestId('battle-canvas', { includeHiddenElements: true });
    expect(canvas).toHaveProp('accessibilityElementsHidden', true);
    expect(canvas).toHaveProp('pointerEvents', 'none');
    expect(drawnTypes()).toContain('skAtlas');
  });

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
  const { table } = prepareBattleScene().effects;

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
});
