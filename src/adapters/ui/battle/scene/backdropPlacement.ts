/** La hauteur d'un fond de palier, en pixels d'art. */
const BACKDROP_HEIGHT = 160;
/** La largeur d'un fond de palier, en pixels d'art. */
const BACKDROP_WIDTH = 96;

/** La place du fond de palier à l'écran, en dp, et la taille d'un de ses pixels d'art. */
export interface BackdropPlacement {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** La taille d'un pixel d'art, en dp : un nombre entier de pixels physiques. */
  readonly artPixel: number;
}

/**
 * La place du fond de palier (`backdropPlacement`, #176) sur une fenêtre de `window` dp, à
 * `pixelRatio` pixels physiques par dp. Le fond remplit la hauteur et se centre ; ses côtés sont
 * rognés. Un pixel d'art vaut un nombre entier de pixels physiques, arrondi au-dessus, pour rester
 * net (ADR 0007 § 3) et couvrir toute la hauteur ; le surplus est rogné à parts égales en haut et en
 * bas. Sur un écran plus large que l'image, la nuit apparaît sur les côtés.
 */
export function backdropPlacement(
  window: { readonly width: number; readonly height: number },
  pixelRatio: number,
): BackdropPlacement {
  // Le millionième absorbe l'erreur des flottants : 320 dp à ×2 font juste 4 pixels physiques.
  const physical = Math.ceil((window.height * pixelRatio) / BACKDROP_HEIGHT - 1e-6);
  const artPixel = physical / pixelRatio;
  const width = BACKDROP_WIDTH * artPixel;
  const height = BACKDROP_HEIGHT * artPixel;
  return {
    x: (window.width - width) / 2,
    y: (window.height - height) / 2,
    width,
    height,
    artPixel,
  };
}
