/**
 * @jest-environment ./test/setup/skiaEnvironment.js
 */
// Le repli du fond de palier (#176) : si son image ne peut pas être faite, seul le voile est
// dessiné, et la nuit du conteneur reste visible ; jamais d'écran vide. Dans son propre fichier :
// le cache des images du module y est vide.
import '@shopify/react-native-skia/jestSetup';

import { render, screen } from '@testing-library/react-native';

import * as spriteCanvas from '../pixelArt/SpriteCanvas';
import { TierBackdrop, TowerFootBackdrop, tierBackdropImage } from './TierBackdrop';

type Node = NonNullable<ReturnType<typeof screen.toJSON>>;

function drawnTypes(): string[] {
  const types: string[] = [];
  const visit = (node: Node | string) => {
    if (typeof node === 'string') return;
    types.push(node.type);
    node.children?.forEach(visit);
  };
  const tree = screen.toJSON();
  if (tree !== null && !Array.isArray(tree)) visit(tree);
  return types;
}

it('draws nothing but the veil when the image of the backdrop cannot be made', async () => {
  const toSkImage = jest.spyOn(spriteCanvas, 'toSkImage').mockReturnValue(null);

  await render(<TierBackdrop tier={3} scene={null} />);

  expect(toSkImage).toHaveBeenCalledTimes(1);
  expect(tierBackdropImage(3)).toBeNull();
  expect(drawnTypes()).not.toContain('skImage');
  expect(drawnTypes()).toContain('skRect');
  expect(screen.getByTestId('tier-backdrop', { includeHiddenElements: true })).toBeTruthy();
});

it('draws nothing but the veil at the tower foot too, with the same cache (#233)', async () => {
  const toSkImage = jest.spyOn(spriteCanvas, 'toSkImage').mockReturnValue(null);
  toSkImage.mockClear();

  await render(<TowerFootBackdrop tier={2} headerBottom={156} />);

  expect(toSkImage).toHaveBeenCalledTimes(1);
  expect(tierBackdropImage(2)).toBeNull();
  expect(drawnTypes()).not.toContain('skImage');
  expect(drawnTypes()).toContain('skRect');
  expect(screen.getByTestId('tower-foot-backdrop', { includeHiddenElements: true })).toBeTruthy();
});
