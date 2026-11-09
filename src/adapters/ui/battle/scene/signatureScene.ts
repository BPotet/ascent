/**
 * Les effets des signatures de #259, faits en code (l'Atelier ne les fournit pas), sur le modèle de
 * `bulwarkShards` et `retaliationBurst` : des worklets purs, lus par la scène à chaque image.
 * - La piqûre des Épines (M2) : six pointes vert ronce qui jaillissent du héros, 300 ms en 3 pas.
 * - L'étincelle d'acier d'un coup amorti par le Sanctuaire (B2), sur le Bedeau, en 5 images.
 * - La rupture du Sanctuaire (B3) : des éclats d'acier projetés de 14 à 18 dp, 500 ms en 5 pas.
 * En mouvement réduit, les amplitudes sont au quart et l'étincelle sans zoom ; les durées gardées.
 */

// Stryker disable all: durées et amplitudes de la maquette 245, mutées seulement avec `mutation:ui`.
const PRICK_MS = 300;
const PRICK_STEPS = 3;
/** La portée des pointes au dernier pas, en dp du centre du héros (`.thornfx`, 64 dp de côté). */
const SPIKE_REACH = 30;
const SPIKES = 6;
const SPARK_FRAME_MS = 60;
const SPARK_FRAMES = 5;
/** L'image de l'étincelle gardée en mouvement réduit : sans zoom. */
const STILL_SPARK_FRAME = 2;
const SHARDS_MS = 500;
const SHARD_STEPS = 5;
/** Les 5 éclats d'acier (`.crackfx`) : leur écart final depuis le centre de l'ennemi, en dp. */
const SHARDS: readonly (readonly [number, number])[] = [
  [-14, -14],
  [16, -14],
  [-18, 10],
  [14, 12],
  [0, -16],
];
const REDUCED_AMPLITUDE = 0.25;
/** La secousse de la plaque du héros piqué (M2), en dp. */
export const THORN_SHAKE_DP = 3;
// Stryker restore all

/**
 * Les signatures de #259 sur la scène : la piqûre montrée des Épines (`from`, la fin de la frappe
 * plus 300 ms), l'étincelle d'acier du dernier coup amorti et les éclats de la dernière rupture.
 */
export interface SceneSignatures {
  readonly prick: { readonly from: number } | null;
  readonly wardSpark: { readonly at: number; readonly enemy: number } | null;
  readonly wardBroken: { readonly at: number; readonly enemy: number } | null;
}

export const NO_SCENE_SIGNATURES: SceneSignatures = {
  prick: null,
  wardSpark: null,
  wardBroken: null,
};

function amplitude(reducedMotion: boolean): number {
  'worklet';
  return reducedMotion ? REDUCED_AMPLITUDE : 1;
}

/**
 * Les six pointes de la piqûre des Épines (#259, M2), à partir de `prick.from` (la fin de la frappe,
 * plus 300 ms) : leurs places en dp depuis le centre du héros, une tous les 60°, qui s'éloignent en
 * 3 pas ; aucune hors de ce temps. En mouvement réduit, au quart de leur portée.
 */
export function thornSpikes(
  prick: { readonly from: number } | null,
  now: number,
  reducedMotion: boolean,
): (readonly [number, number])[] {
  'worklet';
  if (prick === null) return [];
  const since = now - prick.from;
  if (since < 0 || since >= PRICK_MS) return [];
  const step = Math.floor((since * PRICK_STEPS) / PRICK_MS) + 1;
  const reach = (SPIKE_REACH * amplitude(reducedMotion) * step) / PRICK_STEPS;
  const spikes: (readonly [number, number])[] = [];
  for (let spike = 0; spike < SPIKES; spike += 1) {
    const angle = ((spike * 2 + 1) * Math.PI) / SPIKES - Math.PI / 2;
    spikes.push([Math.round(reach * Math.cos(angle)), Math.round(reach * Math.sin(angle))]);
  }
  return spikes;
}

/**
 * La secousse de la plaque du héros piqué (#259, M2), pas à pas : 3 dp à droite, à gauche, puis au
 * repos ; aucune en mouvement réduit.
 */
export function thornShake(reducedMotion: boolean): readonly number[] {
  return reducedMotion ? [0, 0, 0] : [THORN_SHAKE_DP, -THORN_SHAKE_DP, 0];
}

/**
 * L'image (0 à 4) de l'étincelle d'acier d'un coup amorti par le Sanctuaire (#259, B2) : 5 images
 * de 60 ms ; `null` sans étincelle. En mouvement réduit, une seule image, sans zoom.
 */
export function wardSparkFrame(
  spark: { readonly at: number } | null,
  now: number,
  reducedMotion: boolean,
): number | null {
  'worklet';
  if (spark === null) return null;
  const since = now - spark.at;
  if (since < 0 || since >= SPARK_FRAME_MS * SPARK_FRAMES) return null;
  return reducedMotion ? STILL_SPARK_FRAME : Math.floor(since / SPARK_FRAME_MS);
}

/**
 * Les 5 éclats d'acier de la rupture du Sanctuaire (#259, B3) : ils s'écartent pendant 500 ms en
 * 5 pas. Leurs places en dp, depuis le centre du Bedeau ; aucune hors de ce temps. En mouvement
 * réduit, ils partent au quart.
 */
export function wardShards(
  broken: { readonly at: number } | null,
  now: number,
  reducedMotion: boolean,
): (readonly [number, number])[] {
  'worklet';
  if (broken === null) return [];
  const since = now - broken.at;
  if (since < 0 || since >= SHARDS_MS) return [];
  const spread =
    (amplitude(reducedMotion) * (Math.floor((since * SHARD_STEPS) / SHARDS_MS) + 1)) / SHARD_STEPS;
  return SHARDS.map(([dx, dy]) => [Math.round(dx * spread), Math.round(dy * spread)]);
}
