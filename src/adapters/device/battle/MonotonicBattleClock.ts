import type { BattleClock } from '../../../application/ports/BattleClock';

/**
 * Horloge de combat du téléphone : `performance.now()` du fil JS, la même base que les instants
 * de toucher datés sur le fil UI (méthode de datation (a), ADR 0005). Les échéances passent par
 * `setTimeout` : un minuteur en retard ne décale rien, les événements portent leur instant nominal.
 */
export class MonotonicBattleClock implements BattleClock {
  now(): number {
    return performance.now();
  }

  setTimer(at: number, callback: () => void): () => void {
    const timer = setTimeout(callback, Math.max(0, at - this.now()));
    return () => clearTimeout(timer);
  }
}
