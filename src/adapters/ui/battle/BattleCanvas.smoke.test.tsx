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
  const shared = (value: number) => ({ value, get: () => value, set: jest.fn() });
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
    frameMeter: { frames: shared(0), dropped: shared(0), worstGap: shared(0) },
    ...change,
  };
}

describe('BattleScene with Skia', () => {
  it('prepares the atlases of the scene once, as Skia images', () => {
    const prepared = prepareBattleScene();

    expect(prepared.characters.ghoul.image?.width()).toBe(352);
    expect(prepared.hero.image?.height()).toBeGreaterThan(0);
    expect(prepared.effects.image?.width()).toBeGreaterThan(0);
    expect(prepareBattleScene()).toBe(prepared);
  });

  it('mounts the stage, the pedestals, the enemies, the hero, the effects and the ring, hidden from the screen reader', async () => {
    await render(<BattleScene {...props()} />);

    const canvas = screen.getByTestId('battle-canvas', { includeHiddenElements: true });
    expect(canvas).toHaveProp('accessibilityElementsHidden', true);
    expect(canvas).toHaveProp('pointerEvents', 'none');
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
