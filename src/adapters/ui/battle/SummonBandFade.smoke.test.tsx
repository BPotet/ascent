/**
 * @jest-environment ./test/setup/skiaEnvironment.js
 */
// Test de fumée de la bande de l'annonce de l'Invocation avec Skia (#172) : sous Jest, les tests
// d'écran la remplacent par `testing/fakeSummonBandFade.tsx` (jest.config.js).
import '@shopify/react-native-skia/jestSetup';

import { fireEvent, render, screen } from '@testing-library/react-native';

// Par `../battle/` : le chemin `./SummonBandFade` est simulé (jest.config.js).
import { SummonBandFade } from '../battle/SummonBandFade';

type Node = NonNullable<ReturnType<typeof screen.toJSON>>;

function drawn(type: string): Node[] {
  const found: Node[] = [];
  const visit = (node: Node | string) => {
    if (typeof node === 'string') return;
    if (node.type === type) found.push(node);
    node.children?.forEach(visit);
  };
  const tree = screen.toJSON();
  if (tree !== null && !Array.isArray(tree)) visit(tree);
  return found;
}

describe('SummonBandFade with Skia', () => {
  it('draws the band across its width, fading on the edges, hidden from the screen reader', async () => {
    await render(<SummonBandFade color="#100E14F0" />);
    const canvas = screen.getByTestId('summon-band-fade', { includeHiddenElements: true });
    expect(canvas).toHaveProp('accessibilityElementsHidden', true);

    await fireEvent(screen.getByTestId('summon-band', { includeHiddenElements: true }), 'layout', {
      nativeEvent: { layout: { width: 390, height: 60 } },
    });

    const [rect] = drawn('skRect');
    expect(rect!.props).toMatchObject({ width: 390, height: 60 });
    const [gradient] = drawn('skLinearGradient');
    expect(gradient!.props).toMatchObject({
      colors: ['#100E1400', '#100E14F0', '#100E14F0', '#100E1400'],
      positions: [0, 0.14, 0.86, 1],
    });
  });
});
