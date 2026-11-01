/**
 * @jest-environment ./test/setup/skiaEnvironment.js
 */
// #173 : l'ombre violette de Pas de l'ombre dans la scène Skia, derrière l'Errante. Le setup de
// Skia vient d'abord.
import '@shopify/react-native-skia/jestSetup';

import { render, screen } from '@testing-library/react-native';

import { BattleScene, prepareBattleScene, type BattleSceneProps } from './BattleCanvas';
import { SHADOW_STEP_MATRIX } from './scene/shadowStep';
import { sceneGeometry } from './scene/sceneGeometry';

function props(change: Partial<BattleSceneProps> = {}): BattleSceneProps {
  return {
    width: 390,
    height: 440,
    geometry: sceneGeometry(390, 440, 1),
    enemies: [
      {
        kind: 'ghoul',
        standing: true,
        target: true,
        dimmed: false,
        active: false,
        down: false,
        losingAction: false,
        rising: null,
        downSince: null,
      },
    ],
    heroKind: 'wanderer',
    heroPose: 'cast',
    heroPoseSince: 1_000,
    strikeTarget: 0,
    strikeImpactAt: null,
    timeline: null,
    spark: null,
    hurtAt: null,
    reducedMotion: false,
    uiNow: () => {
      'worklet';
      return 1_200;
    },
    ...change,
  };
}

type Node = NonNullable<ReturnType<typeof screen.toJSON>>;

/** Les atlas dessinés par la scène, chacun avec son image et ses matrices de couleur. */
function atlases(): { readonly image: unknown; readonly matrices: unknown[] }[] {
  const found: { readonly image: unknown; readonly matrices: unknown[] }[] = [];
  const visit = (node: Node | string) => {
    if (typeof node === 'string') return;
    if (node.type === 'skAtlas') {
      const matrices = (node.children ?? []).flatMap((child) =>
        typeof child !== 'string' && child.type === 'skMatrixColorFilter'
          ? [child.props.matrix]
          : [],
      );
      found.push({ image: node.props.image, matrices });
    }
    node.children?.forEach(visit);
  };
  const tree = screen.toJSON();
  if (tree !== null && !Array.isArray(tree)) visit(tree);
  return found;
}

describe('BattleScene: the shadow of the Shadow Step (#173)', () => {
  const { heroes } = prepareBattleScene(['ghoul']);

  it('draws the Wanderer twice while it is active: her violet shadow first, then herself', async () => {
    await render(<BattleScene {...props({ shadowStep: { castAt: 1_000 } })} />);

    const wanderer = atlases().filter((atlas) => atlas.image === heroes.wanderer.image);
    expect(wanderer).toHaveLength(2);
    expect(wanderer[0]!.matrices).toEqual([SHADOW_STEP_MATRIX]);
    expect(wanderer[1]!.matrices).toEqual([]);
  });

  it('draws no shadow while it is not active', async () => {
    await render(<BattleScene {...props({ shadowStep: null })} />);

    expect(atlases().filter((atlas) => atlas.image === heroes.wanderer.image)).toHaveLength(1);
  });

  it('mounts with reduced motion and an unknown cast', async () => {
    await render(<BattleScene {...props({ shadowStep: { castAt: null }, reducedMotion: true })} />);

    expect(atlases().filter((atlas) => atlas.image === heroes.wanderer.image)).toHaveLength(2);
  });
});
