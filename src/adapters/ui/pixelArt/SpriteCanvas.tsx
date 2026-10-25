import {
  AlphaType,
  Canvas,
  ColorType,
  FilterMode,
  Image,
  MipmapMode,
  type SkImage,
  Skia,
} from '@shopify/react-native-skia';
import type { StyleProp, ViewStyle } from 'react-native';

import { type ArtScale, artPixelSize } from './artPixel';
import type { PixelImage } from './sprites/Sprite';

/** Ce que reçoit `SpriteCanvas` (et sa simulation sous Jest, `testing/fakeSpriteCanvas.tsx`). */
export interface SpriteCanvasProps {
  /**
   * Le nom du sprite, qui identifie son image : deux sprites de même nom ont la même image
   * (`character-0`, `day-sky:0.4:195x66`).
   */
  readonly sprite: string;
  /** Dessine l'image du sprite ; appelé une seule fois par nom. */
  readonly draw: () => PixelImage;
  /** L'échelle du pixel d'art : ×2, ou ×3 pour les grands moments. */
  readonly scale: ArtScale;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}

/** Le nombre d'images gardées en mémoire. */
const CACHE_SIZE = 48;
const cache = new Map<string, SkImage | null>();

/** L'image Skia du sprite `sprite`, faite une seule fois à partir de ses pixels RGBA. */
export function skImageOf(sprite: string, draw: () => PixelImage): SkImage | null {
  if (cache.has(sprite)) {
    return cache.get(sprite) ?? null;
  }
  const { width, height, rgba } = draw();
  const image = Skia.Image.MakeImage(
    { width, height, alphaType: AlphaType.Unpremul, colorType: ColorType.RGBA_8888 },
    Skia.Data.fromBytes(rgba),
    width * 4,
  );
  if (cache.size >= CACHE_SIZE) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) {
      cache.delete(oldest);
    }
  }
  cache.set(sprite, image);
  return image;
}

/**
 * Une grande image en pixels d'art (ciel, personnage, tour, étincelle, emblème), dessinée par Skia
 * sans lissage (plus proche voisin), à `artPixelSize(scale)` dp par pixel d'art. C'est le seul
 * module du pixel art qui importe Skia. Toujours décorative : le lecteur d'écran l'ignore.
 */
export function SpriteCanvas({ sprite, draw, scale, style, testID }: SpriteCanvasProps) {
  const image = skImageOf(sprite, draw);
  const size = artPixelSize(scale);
  const width = (image?.width() ?? 0) * size;
  const height = (image?.height() ?? 0) * size;
  return (
    <Canvas
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      testID={testID}
      style={[{ width, height }, style]}
    >
      <Image
        image={image}
        x={0}
        y={0}
        width={width}
        height={height}
        fit="fill"
        sampling={{ filter: FilterMode.Nearest, mipmap: MipmapMode.None }}
      />
    </Canvas>
  );
}
