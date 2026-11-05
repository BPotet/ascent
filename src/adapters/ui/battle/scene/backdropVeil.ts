/** Le fondu du voile sous l'en-tête, en dp (maquette #174, `.screen.bd::after`). */
export const TOP_FADE = 24;
/** Le fondu du voile au-dessus de la zone du pouce, en dp (maquette #174, `.pzone::before`). */
export const BOTTOM_FADE = 28;

/** Le cadre de la scène du combat, mesuré dans la fenêtre : son haut et son bas, en dp. */
export interface SceneArea {
  readonly top: number;
  readonly bottom: number;
}

/** Une bande du voile, sur toute la largeur : son haut et sa hauteur, en dp. */
export interface VeilBand {
  readonly y: number;
  readonly height: number;
}

/** Un fondu du voile : opaque du côté `opaque`, transparent de l'autre. */
export interface VeilFade extends VeilBand {
  readonly opaque: 'top' | 'bottom';
}

/** La géométrie du voile de lisibilité : ses bandes pleines et ses fondus. */
export interface BackdropVeil {
  readonly bands: readonly VeilBand[];
  readonly fades: readonly VeilFade[];
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/**
 * Le voile de lisibilité (`backdropVeil`, #176) d'une fenêtre de `window` dp : la nuit à 90 % sur
 * tout ce qui est au-dessus du cadre de la scène (en-tête, titre, Frise d'action) et en dessous
 * (barre du héros, zone d'action), avec un fondu de 24 dp sous le haut de la scène et de 28 dp
 * au-dessus de son bas ; le fond reste entier sur la scène. Tant que la scène n'est pas mesurée
 * (`null`), le voile couvre tout l'écran : la lisibilité passe avant tout.
 */
export function backdropVeil(
  window: { readonly height: number },
  scene: SceneArea | null,
): BackdropVeil {
  if (scene === null) return { bands: [{ y: 0, height: window.height }], fades: [] };
  const top = clamp(scene.top, 0, window.height);
  const bottom = clamp(scene.bottom, top, window.height);
  const half = (bottom - top) / 2;
  const topFade = Math.min(TOP_FADE, half);
  const bottomFade = Math.min(BOTTOM_FADE, half);
  return {
    bands: [
      { y: 0, height: top },
      { y: bottom, height: window.height - bottom },
    ],
    fades: [
      { y: top, height: topFade, opaque: 'top' },
      { y: bottom - bottomFade, height: bottomFade, opaque: 'bottom' },
    ],
  };
}
