/**
 * @jest-environment ./test/setup/skiaEnvironment.js
 */
// Test de fumée du seul module du pixel art qui importe Skia : sous Jest, les autres tests le
// remplacent par `testing/fakeSpriteCanvas.tsx` (jest.config.js). Le setup de Skia vient d'abord.
import '@shopify/react-native-skia/jestSetup';

import { FilterMode, MipmapMode, Skia } from '@shopify/react-native-skia';
import { render, screen } from '@testing-library/react-native';
import { PixelRatio } from 'react-native';

import { characterSprite } from './sprites/characterSprite';
import { toPixelImage } from './sprites/Sprite';
import { SpriteCanvas, skImageOf, toSkImage } from './SpriteCanvas';

describe('SpriteCanvas with Skia', () => {
  beforeEach(() =>
    jest.spyOn(PixelRatio, 'roundToNearestPixel').mockImplementation((size) => size),
  );
  afterEach(() => jest.restoreAllMocks());

  it('draws a sprite at a whole art pixel, hidden from the screen reader', async () => {
    await render(
      <SpriteCanvas
        sprite="character-0"
        draw={() => toPixelImage(characterSprite(0))}
        scale={3}
        testID="sprite"
      />,
    );

    const canvas = screen.getByTestId('sprite', { includeHiddenElements: true });
    expect(canvas).toHaveStyle({ width: 72, height: 96 });
    expect(canvas).toHaveProp('accessibilityElementsHidden', true);
  });

  it('draws a portrait at its exact size in dp, whatever the density (#175)', async () => {
    jest.spyOn(PixelRatio, 'roundToNearestPixel').mockImplementation((size) => size * 1.14);
    await render(
      <SpriteCanvas
        sprite="portrait-test"
        draw={() => toPixelImage(characterSprite(1))}
        size={24}
        testID="sprite"
      />,
    );

    const canvas = screen.getByTestId('sprite', { includeHiddenElements: true });
    expect(canvas).toHaveStyle({ width: 24, height: 32 });
    const [image] = canvas.children as { props: Record<string, unknown> }[];
    expect(image?.props).toMatchObject({ width: 24, height: 32 });
  });

  it('keeps an empty portrait at 0 dp when Skia makes no image', async () => {
    jest.spyOn(Skia.Image, 'MakeImage').mockReturnValue(null);
    await render(
      <SpriteCanvas
        sprite="portrait-without-image"
        draw={() => toPixelImage(characterSprite(1))}
        size={24}
        testID="sprite"
      />,
    );

    expect(screen.getByTestId('sprite', { includeHiddenElements: true })).toHaveStyle({
      width: 0,
      height: 0,
    });
  });

  it('draws the image without smoothing (nearest neighbour, no mipmap), on the whole canvas', async () => {
    await render(
      <SpriteCanvas
        sprite="character-2"
        draw={() => toPixelImage(characterSprite(2))}
        scale={2}
        testID="sprite"
      />,
    );

    const [image] = screen.getByTestId('sprite', { includeHiddenElements: true }).children as {
      props: Record<string, unknown>;
    }[];
    expect(image?.props).toMatchObject({
      sampling: { filter: FilterMode.Nearest, mipmap: MipmapMode.None },
      x: 0,
      y: 0,
      width: 48,
      height: 64,
      fit: 'fill',
    });
  });

  it('makes a Skia image of the pixels once per sprite name', () => {
    const draw = jest.fn(() => toPixelImage(characterSprite(1)));

    const image = skImageOf('character-1-smoke', draw);

    expect(image?.width()).toBe(24);
    expect(image?.height()).toBe(32);
    expect(skImageOf('character-1-smoke', draw)).toBe(image);
    expect(draw).toHaveBeenCalledTimes(1);
  });
});

describe('toSkImage', () => {
  it('makes a Skia image of a pixel image, without the cache of the sprites', () => {
    const pixels = toPixelImage(characterSprite(0));

    const first = toSkImage(pixels);

    expect(first?.width()).toBe(24);
    expect(first?.height()).toBe(32);
    expect(toSkImage(pixels)).not.toBe(first);
  });
});
