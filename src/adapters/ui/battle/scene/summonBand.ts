/**
 * Le fond de l'annonce de l'Invocation (#172, maquette 170, `.announce`) : un dégradé horizontal,
 * transparent sur les bords, la couleur de la bande de 14 % à 86 % de la largeur.
 */
export const SUMMON_BAND_POSITIONS = [0, 0.14, 0.86, 1] as const;

/** La couleur `#RRGGBBAA` d'une teinte `#RRGGBB` ou `#RRGGBBAA`, rendue transparente. */
function clear(color: string): string {
  return `${color.slice(0, 7)}00`;
}

/** Le dégradé de la bande, sur une largeur de `width` dp. */
export function summonBandGradient(width: number, band: string) {
  return {
    start: { x: 0, y: 0 },
    end: { x: width, y: 0 },
    colors: [clear(band), band, band, clear(band)],
    positions: [...SUMMON_BAND_POSITIONS],
  };
}
