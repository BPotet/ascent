import { useWindowDimensions } from 'react-native';

/** La largeur d'une colonne de la Vue Semaine et de la Vue Mois, au plus : 48 dp. */
export const MAX_COLUMN_WIDTH = 48;

/**
 * La place autour des 7 colonnes d'une carte de la Vue Semaine : les marges de la liste (2 × 16),
 * le trait de la carte (2 × 2) et sa marge intérieure (2 × 2). Les colonnes font 48 dp à partir
 * d'un écran de 376 dp.
 */
export const WEEK_CARD_CHROME = 40;

/** La place autour des 7 colonnes de la grille de la Vue Mois : les marges de la liste (2 × 16). */
export const MONTH_CHROME = 32;

/**
 * La largeur d'une colonne pour 7 colonnes dans `innerWidth` dp : 48 dp au plus, moins sur un
 * écran étroit (environ 45,7 dp pour 320 dp, 40 dp pour 280 dp). Les colonnes ne dépassent jamais
 * la place : ni défilement horizontal, ni zone de toucher qui empiète sur le jour voisin (ADR 0007,
 * avenant de #73).
 */
export function weekColumnWidth(innerWidth: number): number {
  return Math.min(MAX_COLUMN_WIDTH, innerWidth / 7);
}

/**
 * La largeur des colonnes d'après la largeur de l'écran, moins la place `chrome` autour d'elles.
 * Les cases, l'en-tête des jours et le squelette s'alignent dessus.
 */
export function useWeekColumnWidth(chrome: number): number {
  const { width } = useWindowDimensions();
  return weekColumnWidth(width - chrome);
}
