/**
 * @jest-environment ./test/setup/skiaEnvironment.js
 */
// #235 : les pouvoirs dans la scène Skia, dessinés en code (maquette 232, notes UX, K12) : le halo
// d'or de Tenir bon, le voile de Brume, la marque d'Entaille sur la cible. Le setup de Skia vient
// d'abord.
import '@shopify/react-native-skia/jestSetup';

import { render, screen } from '@testing-library/react-native';

import { artPalette } from '../pixelArt/artPalette';
import { BattleScene, type BattleSceneProps } from './BattleCanvas';
import { NO_SCENE_POWERS, type ScenePowers } from './scene/powerScene';
import { sceneGeometry } from './scene/sceneGeometry';

const ghoul = {
  kind: 'ghoul',
  standing: true,
  target: true,
  dimmed: false,
  active: false,
  down: false,
  losingAction: false,
  rising: null,
  downSince: null,
} as const;

function props(powers: Partial<ScenePowers> = {}): BattleSceneProps {
  return {
    width: 390,
    height: 440,
    geometry: sceneGeometry(390, 440, 2),
    enemies: [ghoul, { ...ghoul, target: false }],
    heroKind: 'sentinel',
    heroPose: 'cast',
    heroPoseSince: 1_000,
    strikeTarget: 0,
    strikeImpactAt: null,
    timeline: null,
    spark: null,
    hurtAt: null,
    powers: { ...NO_SCENE_POWERS, ...powers },
    reducedMotion: false,
    uiNow: () => {
      'worklet';
      return 1_200;
    },
  };
}

type Node = NonNullable<ReturnType<typeof screen.toJSON>>;

/** Les éléments Skia dessinés, avec leur type et leurs props. */
function drawn(): { readonly type: string; readonly props: Record<string, unknown> }[] {
  const found: { readonly type: string; readonly props: Record<string, unknown> }[] = [];
  const visit = (node: Node | string) => {
    if (typeof node === 'string') return;
    found.push({ type: node.type, props: node.props as Record<string, unknown> });
    node.children?.forEach(visit);
  };
  const tree = screen.toJSON();
  if (tree !== null && !Array.isArray(tree)) visit(tree);
  return found;
}

const count = (type: string, color?: string) =>
  drawn().filter(
    (node) => node.type === type && (color === undefined || node.props.color === color),
  ).length;

describe('BattleScene: the powers of #235', () => {
  it('draws nothing more without a power at work', async () => {
    await render(<BattleScene {...props()} />);

    expect(count('skCircle')).toBe(0);
    expect(count('skPath', artPalette.roles.ember)).toBe(0);
  });

  it('draws the golden halo of Hold Fast around the hero (K12)', async () => {
    await render(<BattleScene {...props({ healedAt: 1_000 })} />);

    expect(count('skCircle')).toBe(1);
    expect(count('skRadialGradient')).toBe(1);
  });

  it('veils the Wanderer while the Mist is active', async () => {
    await render(<BattleScene {...props({ mist: true })} />);

    expect(count('skCircle', artPalette.roles.blue)).toBe(1);
  });

  it('marks the target of the strike that consumes Rend', async () => {
    await render(<BattleScene {...props({ rendTarget: 1 })} />);

    expect(count('skPath', artPalette.roles.ember)).toBe(1);
  });

  it('mounts with a counter of Retaliation and reduced motion', async () => {
    await render(
      <BattleScene {...props({ retaliation: { at: 1_100, enemy: 0 } })} reducedMotion />,
    );

    expect(count('skAtlas')).toBeGreaterThan(0);
  });
});
