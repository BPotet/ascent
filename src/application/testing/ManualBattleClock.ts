// Réservé aux tests : une horloge de combat qu'on avance à la main, et qui déclenche ses minuteurs.
import type { BattleClock } from '../ports/BattleClock';

interface Timer {
  readonly id: number;
  readonly at: number;
  readonly callback: () => void;
}

export class ManualBattleClock implements BattleClock {
  private current: number;
  private timers: Timer[] = [];
  private nextId = 0;

  constructor(start = 0) {
    this.current = start;
  }

  now(): number {
    return this.current;
  }

  setTimer(at: number, callback: () => void): () => void {
    const id = this.nextId;
    this.nextId += 1;
    this.timers.push({ id, at, callback });
    return () => {
      this.timers = this.timers.filter((timer) => timer.id !== id);
    };
  }

  /** Les instants des minuteurs en attente, dans l'ordre. */
  pending(): number[] {
    return this.timers.map((timer) => timer.at).sort((left, right) => left - right);
  }

  /**
   * Avance jusqu'à `until` : chaque minuteur échu est déclenché à son instant, dans l'ordre, y
   * compris ceux qu'un minuteur programme en route.
   */
  advanceTo(until: number): void {
    for (;;) {
      const due = this.timers
        .filter((timer) => timer.at <= until)
        .sort((left, right) => left.at - right.at || left.id - right.id)[0];
      if (due === undefined) break;
      this.timers = this.timers.filter((timer) => timer.id !== due.id);
      this.current = Math.max(this.current, due.at);
      due.callback();
    }
    this.current = Math.max(this.current, until);
  }

  /** Avance de `duration` ms. */
  advanceBy(duration: number): void {
    this.advanceTo(this.current + duration);
  }
}
