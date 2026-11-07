import type { VeilBand } from './backdropVeil';

/** Le fondu du voile du pied de la tour sous l'en-tête, en dp (maquette #208, section 6). */
export const TOWER_FOOT_FADE = 24;

/** La géométrie du voile du pied de la tour : sa bande forte, son fondu et sa bande légère. */
export interface TowerFootVeil {
  readonly strong: VeilBand;
  readonly fade: VeilBand;
  readonly light: VeilBand;
}

/**
 * Le voile du pied de la tour (`towerFootVeil`, #233) d'une fenêtre de `window` dp : la nuit à 75 %
 * de `0` jusqu'au bas mesuré de l'en-tête (`headerBottom` : titre « La tour », Éclats, ligne du
 * palier), un fondu de 24 dp, puis la nuit à 12 % jusqu'en bas. On mesure l'en-tête plutôt que de
 * fixer 156 dp : il ne tombe pas au même endroit sur chaque écran. Tant qu'il n'est pas mesuré
 * (`null`), le voile fort couvre tout l'écran : la lisibilité passe avant tout.
 */
export function towerFootVeil(
  window: { readonly height: number },
  headerBottom: number | null,
): TowerFootVeil {
  const { height } = window;
  const bottom = Math.min(height, Math.max(0, headerBottom ?? height));
  const fade = Math.min(TOWER_FOOT_FADE, height - bottom);
  return {
    strong: { y: 0, height: bottom },
    fade: { y: bottom, height: fade },
    light: { y: bottom + fade, height: height - bottom - fade },
  };
}
