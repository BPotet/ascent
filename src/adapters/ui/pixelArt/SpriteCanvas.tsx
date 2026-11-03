import {
  AlphaType,
  Canvas,
  ColorMatrix,
  ColorType,
  FilterMode,
  Image,
  MipmapMode,
  type SkImage,
  Skia,
} from '@shopify/react-native-skia';
import type { StyleProp, ViewStyle } from 'react-native';

import { type ArtScale, artPixelSize } from './artPixel';
import { saturationMatrix } from './saturationMatrix';
import type { PixelImage } from './sprites/Sprite';

/**
 * La taille exacte d'un portrait de la Frise d'action, en dp (#175) : la seule image dessinée sans
 * arrondi au pixel physique (avenant à l'ADR 0010).
 */
export type PortraitSize = 24;

/** Ce que reçoivent tous les `SpriteCanvas`. */
interface SpriteCanvasBase {
  /**
   * Le nom du sprite, qui identifie son image : deux sprites de même nom ont la même image
   * (`character-0`, `day-sky:0.4:195x66`).
   */
  readonly sprite: string;
  /** Dessine l'image du sprite ; appelé une seule fois par nom. */
  readonly draw: () => PixelImage;
  /**
   * La saturation de l'image (1 : intacte, 0 : gris), par une matrice de couleur. Absente ou à 1,
   * l'image garde ses couleurs. Seuls les portraits de la Frise d'action l'utilisent, en phase
   * ennemie (#188).
   */
  readonly saturation?: number;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}

/**
 * Ce que reçoit `SpriteCanvas` (et sa simulation sous Jest, `testing/fakeSpriteCanvas.tsx`) : une
 * échelle, ou la taille exacte d'un portrait.
 */
export type SpriteCanvasProps = SpriteCanvasBase &
  (
    | {
        /**
         * L'échelle du pixel d'art : ×2, ×3 pour les grands moments, ×4 ou ×6 pour une icône à
         * 96 dp, ×1 pour une image de l'Atelier dans une ligne de texte.
         */
        readonly scale: ArtScale;
        readonly size?: never;
      }
    | {
        /**
         * Réservé au portrait des petites cases de la Frise d'action (#175) : la largeur de l'image
         * en dp, exacte, non arrondie au pixel physique. Jamais pour une autre image.
         */
        readonly size: PortraitSize;
        readonly scale?: never;
      }
  );

/** Le nombre d'images gardées en mémoire. */
const CACHE_SIZE = 48;
const cache = new Map<string, SkImage | null>();

/**
 * L'image Skia de pixels RGBA, faite à chaque appel, sans cache : le combat l'appelle pour ses
 * atlas, qui videraient le cache des sprites.
 */
export function toSkImage({ width, height, rgba }: PixelImage): SkImage | null {
  return Skia.Image.MakeImage(
    { width, height, alphaType: AlphaType.Unpremul, colorType: ColorType.RGBA_8888 },
    Skia.Data.fromBytes(rgba),
    width * 4,
  );
}

/** L'image Skia du sprite `sprite`, faite une seule fois à partir de ses pixels RGBA. */
export function skImageOf(sprite: string, draw: () => PixelImage): SkImage | null {
  if (cache.has(sprite)) {
    return cache.get(sprite) ?? null;
  }
  const image = toSkImage(draw());
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
 * sans lissage (plus proche voisin), à `artPixelSize(scale)` dp par pixel d'art, ou à la taille
 * exacte `size` d'un portrait de la Frise d'action. C'est le seul
 * module du pixel art qui importe Skia. Toujours décorative : le lecteur d'écran l'ignore.
 */
export function SpriteCanvas({
  sprite,
  draw,
  scale,
  size,
  saturation = 1,
  style,
  testID,
}: SpriteCanvasProps) {
  const image = skImageOf(sprite, draw);
  const imageWidth = image?.width() ?? 0;
  // Sans image (Skia n'a rien fait), un portrait reste à 0 dp : jamais `NaN`.
  const portraitPixel = imageWidth === 0 ? 0 : (size ?? 0) / imageWidth;
  const pixel = size === undefined ? artPixelSize(scale) : portraitPixel;
  const width = imageWidth * pixel;
  const height = (image?.height() ?? 0) * pixel;
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
      >
        {saturation < 1 ? <ColorMatrix matrix={saturationMatrix(saturation)} /> : null}
      </Image>
    </Canvas>
  );
}
