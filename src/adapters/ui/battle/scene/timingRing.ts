import type { SceneTimeline } from '../sceneTypes';
import { sceneInstant } from './enemyPose';

/** Aides visuelles Légères (le défaut, seul niveau livré ici) : l'anneau paraît 450 ms avant l'impact. */
export const LIGHT_AIDS_RING_MS = 450;

/** L'anneau à une image : sa taille (1 à la fermeture), son opacité, celle du contour d'arrivée. */
export interface TimingRingLook {
  readonly scale: number;
  readonly opacity: number;
  readonly guideOpacity: number;
  /** Rouge, à quatre crans en losange : un coup imparable. */
  readonly perilous: boolean;
}

// Stryker disable all: valeurs de la maquette (`drawRing`), mutées seulement avec `mutation:ui`.
const FADE_MS = 120;
const GROWTH = 1.6;
const REDUCED_GROWTH = 0.8;
const GUIDE_OPACITY = 0.75;
// Stryker restore all

/**
 * L'anneau (`timingRing`) de l'attaque en cours, ou `null` quand il n'y en a pas : jamais pendant
 * l'avancée, ni pour une Garde, un Relever ou un ennemi étourdi. Il paraît au plus tard des instants
 * suivants : l'impact précédent, 450 ms avant l'impact, le sommet de la fausse amorce ; il se
 * resserre de 2,6 à 1 à vitesse constante et se ferme pile à l'impact nominal, puis s'efface en
 * 120 ms. Le second anneau d'une double frappe ne paraît qu'à la disparition du premier.
 */
export function timingRing(
  timeline: SceneTimeline | null,
  now: number,
  reduced: boolean,
): TimingRingLook | null {
  'worklet';
  if (timeline === null || timeline.kind !== 'attack') return null;
  const t = sceneInstant(timeline, now);
  const { impacts } = timeline;
  let j = -1;
  for (let n = 0; n < impacts.length; n += 1) {
    if (t < (impacts[n] ?? 0) + FADE_MS) {
      j = n;
      break;
    }
  }
  if (j < 0) return null;
  const impact = impacts[j] ?? 0;
  const previous = j === 0 ? timeline.windUpAt : (impacts[j - 1] ?? 0);
  let start = Math.max(previous, impact - LIGHT_AIDS_RING_MS);
  if (timeline.feintAt !== null && timeline.feintAt < impact) {
    start = Math.max(start, timeline.feintAt);
  }
  if (t < start) return null;
  const perilous = timeline.attack === 'perilous';
  if (t < impact) {
    const closing = (t - start) / Math.max(1, impact - start);
    const growth = reduced ? REDUCED_GROWTH : GROWTH;
    return {
      scale: 1 + growth * (1 - closing),
      opacity: 0.3 + 0.7 * closing,
      guideOpacity: GUIDE_OPACITY,
      perilous,
    };
  }
  const fade = (t - impact) / FADE_MS;
  return { scale: 1 - 0.12 * fade, opacity: 1 - fade, guideOpacity: 0, perilous };
}
