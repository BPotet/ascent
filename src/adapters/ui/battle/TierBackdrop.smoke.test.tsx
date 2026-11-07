/**
 * @jest-environment ./test/setup/skiaEnvironment.js
 */
// Test de fumée du fond de palier avec Skia (#176), au combat et au pied de la tour (#233) : sous Jest, les tests d'écran le remplacent par
// `testing/fakeTierBackdrop.tsx` (jest.config.js). Le setup de Skia vient d'abord.
import '@shopify/react-native-skia/jestSetup';

import { FilterMode, MipmapMode } from '@shopify/react-native-skia';
import { render, screen } from '@testing-library/react-native';
import { PixelRatio, useWindowDimensions } from 'react-native';

import { artPalette } from '../pixelArt/artPalette';
import { backdropPlacement } from './scene/backdropPlacement';
import { TierBackdrop, TowerFootBackdrop, tierBackdropImage } from './TierBackdrop';

type Node = NonNullable<ReturnType<typeof screen.toJSON>>;
const hidden = { includeHiddenElements: true } as const;

/** Les nœuds dessinés de type `type`, dans l'ordre. */
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

/** Le dessin du canevas, dans l'ordre : le fond d'abord, le voile par-dessus. */
function drawOrder(): string[] {
  const order: string[] = [];
  const visit = (node: Node | string) => {
    if (typeof node === 'string') return;
    if (node.type === 'skImage' || node.type === 'skRect') order.push(node.type);
    node.children?.forEach(visit);
  };
  const tree = screen.toJSON();
  if (tree !== null && !Array.isArray(tree)) visit(tree);
  return order;
}

describe('TierBackdrop with Skia', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([1, 2, 3] as const)(
    'mounts the backdrop of tier %i, hidden from the screen reader and from the touches',
    async (tier) => {
      await render(<TierBackdrop tier={tier} scene={null} />);

      const canvas = screen.getByTestId('tier-backdrop', hidden);
      expect(canvas).toHaveProp('accessibilityElementsHidden', true);
      expect(canvas).toHaveProp('importantForAccessibility', 'no-hide-descendants');
      expect(canvas).toHaveProp('pointerEvents', 'none');
      expect(drawn('skImage')).toHaveLength(1);
    },
  );

  it('makes the image of a tier once, the same for every battle of this tier', () => {
    expect(tierBackdropImage(2)).not.toBeNull();
    expect(tierBackdropImage(2)).toBe(tierBackdropImage(2));
    expect(tierBackdropImage(3)).not.toBe(tierBackdropImage(2));
  });

  it('draws the backdrop at its placement, without smoothing (nearest neighbour, no mipmap)', async () => {
    let window = { width: 0, height: 0 };
    function Probe() {
      const { width, height } = useWindowDimensions();
      window = { width, height };
      return null;
    }
    await render(
      <>
        <Probe />
        <TierBackdrop tier={1} scene={null} />
      </>,
    );

    const placement = backdropPlacement(window, PixelRatio.get());
    const [image] = drawn('skImage');
    expect(image?.props.image).toBe(tierBackdropImage(1));
    expect(image?.props).toMatchObject({
      x: placement.x,
      y: placement.y,
      width: placement.width,
      height: placement.height,
      fit: 'fill',
      sampling: { filter: FilterMode.Nearest, mipmap: MipmapMode.None },
    });
  });

  it('veils the whole screen while the scene is not measured', async () => {
    await render(<TierBackdrop tier={1} scene={null} />);

    const rects = drawn('skRect');
    expect(rects).toHaveLength(1);
    expect(rects[0]?.props).toMatchObject({ x: 0, y: 0, color: artPalette.roles.backdropVeil });
    expect(drawn('skLinearGradient')).toHaveLength(0);
    expect(drawOrder()).toEqual(['skImage', 'skRect']);
  });

  it('veils above and under the scene frame, with a fade on each side of the scene', async () => {
    await render(<TierBackdrop tier={2} scene={{ top: 160, bottom: 600 }} />);

    const rects = drawn('skRect');
    expect(rects.map(({ props }) => [props.y, props.height])).toEqual([
      [0, 160],
      [600, expect.any(Number)],
      [160, 24],
      [572, 28],
    ]);
    const gradients = drawn('skLinearGradient');
    expect(gradients).toHaveLength(2);
    expect(gradients[0]?.props.colors[0]).toBe(artPalette.roles.backdropVeil);
    expect(gradients[1]?.props.colors[1]).toBe(artPalette.roles.backdropVeil);
    expect(drawOrder()[0]).toBe('skImage');
  });
});

describe('TowerFootBackdrop with Skia', () => {
  /** La fenêtre de l'écran rendu, et le fond du pied de la tour du palier `tier`. */
  async function show(tier: 1 | 2 | 3, headerBottom: number | null) {
    let window = { width: 0, height: 0 };
    function Probe() {
      const { width, height } = useWindowDimensions();
      window = { width, height };
      return null;
    }
    await render(
      <>
        <Probe />
        <TowerFootBackdrop tier={tier} headerBottom={headerBottom} />
      </>,
    );
    return window;
  }

  it.each([1, 2, 3] as const)(
    'mounts the tower foot backdrop of tier %i, hidden from the screen reader and from the touches',
    async (tier) => {
      await show(tier, null);

      const canvas = screen.getByTestId('tower-foot-backdrop', hidden);
      expect(canvas).toHaveProp('accessibilityElementsHidden', true);
      expect(canvas).toHaveProp('importantForAccessibility', 'no-hide-descendants');
      expect(canvas).toHaveProp('pointerEvents', 'none');
      expect(screen.queryByTestId('tier-backdrop', hidden)).toBeNull();
    },
  );

  it('draws the same image as the battle, at the same placement, without smoothing', async () => {
    const window = await show(2, null);

    const placement = backdropPlacement(window, PixelRatio.get());
    const [image] = drawn('skImage');
    expect(image?.props.image).toBe(tierBackdropImage(2));
    expect(image?.props).toMatchObject({
      x: placement.x,
      y: placement.y,
      width: placement.width,
      height: placement.height,
      fit: 'fill',
      sampling: { filter: FilterMode.Nearest, mipmap: MipmapMode.None },
    });
  });

  it('veils the whole screen with the strong veil while the header is not measured', async () => {
    const window = await show(1, null);

    const rects = drawn('skRect');
    expect(rects.map(({ props }) => [props.y, props.height, props.color])).toEqual([
      [0, window.height, artPalette.roles.towerFootVeil],
      [window.height, 0, undefined],
      [window.height, 0, artPalette.roles.towerFootVeilLight],
    ]);
    expect(drawOrder()[0]).toBe('skImage');
  });

  it('veils strongly down to the header, fades over 24 dp, then veils lightly', async () => {
    const window = await show(3, 156);

    const rects = drawn('skRect');
    expect(rects.map(({ props }) => [props.y, props.height, props.color])).toEqual([
      [0, 156, artPalette.roles.towerFootVeil],
      [156, 24, undefined],
      [180, window.height - 180, artPalette.roles.towerFootVeilLight],
    ]);
    const [gradient] = drawn('skLinearGradient');
    expect(gradient?.props.colors).toEqual([
      artPalette.roles.towerFootVeil,
      artPalette.roles.towerFootVeilLight,
    ]);
    expect(drawOrder()).toEqual(['skImage', 'skRect', 'skRect', 'skRect']);
  });
});
