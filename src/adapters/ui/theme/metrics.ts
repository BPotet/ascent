// Stryker disable all: valeurs purement visuelles, vérifiées par la conformité aux maquettes (barrière 10 bis).
/** Formes et espacements de la maquette (« Formes et mouvement »). */
export const radii = {
  field: 14,
  button: 14,
  row: 18,
  sheet: 24,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

/** Zone tactile minimale (44 × 44 pt). */
export const MIN_TOUCH_SIZE = 44;
// Stryker restore all
