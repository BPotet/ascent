/**
 * @jest-environment ./test/setup/skiaEnvironment.js
 */
// Test de fumée de Skia sous Jest. Skia reste hors des setups communs (jest.config.js) : son
// environnement (skiaEnvironment.js) charge CanvasKit (WebAssembly), coûteux, et seul ce fichier le
// demande, par son en-tête. Le setup de Skia est importé avant Skia lui-même.
import '@shopify/react-native-skia/jestSetup';

import { Canvas, Circle, Skia } from '@shopify/react-native-skia';
import { render, screen } from '@testing-library/react-native';

describe('Skia under Jest', () => {
  it('renders a canvas with a circle', async () => {
    await render(
      <Canvas testID="smoke-canvas" style={{ width: 64, height: 64 }}>
        <Circle cx={32} cy={32} r={16} color="#FF0000" />
      </Canvas>,
    );

    const canvas = screen.getByTestId('smoke-canvas');
    expect(canvas).toBeOnTheScreen();
    expect(canvas.children).toHaveLength(1);
  });

  it('draws with the real Skia engine', () => {
    const surface = Skia.Surface.Make(64, 64);
    if (surface === null) {
      throw new Error('Skia could not create a surface');
    }
    const paint = Skia.Paint();
    paint.setColor(Skia.Color('#FF0000'));
    surface.getCanvas().drawCircle(32, 32, 16, paint);
    surface.flush();

    const pixels = surface.makeImageSnapshot().readPixels(32, 32, {
      width: 1,
      height: 1,
      colorType: 4, // RGBA_8888
      alphaType: 1, // Opaque
    });
    expect(Array.from(pixels ?? [])).toEqual([255, 0, 0, 255]);
  });
});
