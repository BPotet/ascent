/** Les poids de luminance Rec. 709, ceux de l'ennemi atténué de la scène (`FADED`). */
const LUMINANCE = [0.2126, 0.7152, 0.0722] as const;

/**
 * La matrice de couleur Skia (4 × 5, lignes rouge, vert, bleu, alpha) qui ramène la saturation d'une
 * image à `saturation` (1 : intacte, 0 : gris), sans changer sa luminance ni son alpha (#188).
 */
export function saturationMatrix(saturation: number): number[] {
  const rgb = [0, 1, 2].flatMap((row) => [
    ...LUMINANCE.map(
      (weight, column) => weight * (1 - saturation) + (row === column ? saturation : 0),
    ),
    0,
    0,
  ]);
  return [...rgb, 0, 0, 0, 1, 0];
}
