/**
 * La poussière de l'Invocation sur la scène (#172, maquette 170, I2, I3, I5) : l'effet `summon` de
 * l'aspect de phase 2 du boss (4 images), posé à la place de chaque ennemi appelé. Images 1 et 2 à
 * l'annonce, tenue sur la 2 ; images 3 et 4 à la sortie, puis l'invoqué au repos ; à la chute du
 * boss, 300 ms plus tard, l'effet à l'envers (4, 3, 2) et l'invoqué s'efface. Un combat repris
 * n'a pas d'annonce : la poussière est là, sur l'image 2. Fonctions pures, lues sur le fil UI.
 */

/** L'Invocation telle que la scène la dessine. */
export interface SceneSummon {
  /** Les places réservées d'une Invocation annoncée, pas encore entrée. */
  readonly pending: readonly number[];
  /** L'instant de l'annonce ; `null` dans un combat repris (la poussière est déjà là). */
  readonly calledAt: number | null;
  /** L'instant où l'invoqué de chaque place sort de la poussière. */
  readonly entered: Readonly<Record<number, number>>;
  /** L'instant où l'invoqué de chaque place tombe avec son boss. */
  readonly fell: Readonly<Record<number, number>>;
}

// Stryker disable all: durées de la maquette (barrière 10 bis), mutées avec `mutation:ui`.
/** Les images 1 et 2 à l'annonce : 160 ms chacune. */
const CALL_FRAME_MS = 160;
/** Les images 3 et 4 à la sortie : 200 ms chacune. */
const ENTRY_FRAME_MS = 200;
/** La chute avec le boss : 300 ms, puis les images 4, 3 et 2, 160 ms chacune. */
const FALL_DELAY_MS = 300;
const FALL_FRAME_MS = 160;
/** Mouvement réduit : l'invoqué paraît en fondu de 300 ms et s'efface en fondu de 400 ms. */
const REDUCED_ENTRY_MS = 300;
const REDUCED_FALL_MS = 400;
// Stryker restore all

/** L'image 2 de l'effet, tenue jusqu'à la sortie (indice 1). */
const HELD = 1;
const FALL_FRAMES = [3, 2, 1] as const;

/** L'image de l'effet `summon` (0 à 3) à la place `slot` à l'instant `now`, `null` sans poussière. */
export function summonDustFrame(
  summon: SceneSummon,
  slot: number,
  now: number,
  reducedMotion: boolean,
): number | null {
  'worklet';
  const fell = summon.fell[slot];
  if (fell !== undefined) {
    if (reducedMotion) return null;
    const step = Math.floor((now - fell - FALL_DELAY_MS) / FALL_FRAME_MS);
    return step < 0 ? null : (FALL_FRAMES[step] ?? null);
  }
  const entered = summon.entered[slot];
  if (entered !== undefined) {
    if (now < entered) return HELD;
    if (reducedMotion) return null;
    const step = Math.floor((now - entered) / ENTRY_FRAME_MS);
    return step < 2 ? 2 + step : null;
  }
  if (!summon.pending.includes(slot)) return null;
  const { calledAt } = summon;
  if (reducedMotion || calledAt === null) return HELD;
  return now - calledAt < CALL_FRAME_MS ? 0 : HELD;
}

/**
 * L'opacité de l'ennemi de la place `slot` : 1 pour un ennemi qui n'est pas invoqué ; un invoqué
 * paraît une fois la poussière levée et s'efface à sa chute avec son boss.
 */
export function summonedOpacity(
  summon: SceneSummon,
  slot: number,
  now: number,
  reducedMotion: boolean,
): number {
  'worklet';
  const fell = summon.fell[slot];
  if (fell !== undefined) {
    if (reducedMotion) return Math.max(0, 1 - Math.max(0, now - fell) / REDUCED_FALL_MS);
    return now - fell < FALL_DELAY_MS ? 1 : 0;
  }
  const entered = summon.entered[slot];
  if (entered === undefined) return 1;
  if (reducedMotion) return Math.min(1, Math.max(0, now - entered) / REDUCED_ENTRY_MS);
  return now - entered < 2 * ENTRY_FRAME_MS ? 0 : 1;
}
