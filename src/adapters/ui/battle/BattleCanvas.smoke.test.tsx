/**
 * @jest-environment ./test/setup/skiaEnvironment.js
 */
// Test de fumée de la scène du combat avec Skia : sous Jest, les tests d'écran la remplacent par
// `testing/fakeBattleCanvas.tsx`. La scène se monte avec ses atlas. Le setup de Skia vient d'abord.
import '@shopify/react-native-skia/jestSetup';

import { render, screen } from '@testing-library/react-native';

import { BattleScene, prepareBattleScene, type BattleSceneProps } from './BattleCanvas';
import { sceneGeometry } from './scene/sceneGeometry';
import type { SceneEnemy } from './sceneTypes';

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
