import type { Ascent } from '../../domain/ascent/Ascent';
import {
  beginAscentLog,
  recordAscentStep,
  resumeAscentLog,
  type AscentLog,
  type AscentStep,
} from '../../domain/ascentLog/AscentLog';
import { ASCENT_LOG_KEPT, parseAscentLog } from '../../domain/ascentLog/AscentLogExport';
import type { AscentLogStore } from '../ports/AscentLogStore';
import type { Clock } from '../ports/Clock';

export interface AscentLogRecorderDependencies {
  readonly store: AscentLogStore;
  readonly clock: Clock;
}

/** Une écriture du journal : l'instantané et sa révision. */
interface Write {
  readonly log: AscentLog;
  readonly revision: number;
  readonly generation: number;
}

/**
 * L'enregistreur du Journal d'ascension (`AscentLogRecorder`, #196, ADR 0014) : il tient en mémoire
 * le journal de l'ascension en cours, et l'écrit par sa propre file, séparée de la sauvegarde de
 * l'ascension. Une seule écriture en cours, au plus une en attente par ascension (la dernière
 * gagne). Un échec d'écriture est avalé : l'ascension continue, la prochaine écriture réessaie.
 */
export class AscentLogRecorder {
  private log: AscentLog | null = null;
  /** Le numéro de la dernière modification du journal, et celui de la dernière écriture demandée. */
  private revision = 0;
  private queued = 0;
  /** Le numéro du journal tenu (un par ascension commencée ou reprise). */
  private generation = 0;
  /** Les identifiants attribués par le stockage, par numéro de journal. */
  private readonly ids = new Map<number, number>();
  private readonly pending: Write[] = [];
  private draining: Promise<void> = Promise.resolve();
  private running = false;

  constructor(private readonly dependencies: AscentLogRecorderDependencies) {}

  /** Le journal de l'ascension en cours, avec son identifiant s'il est déjà écrit. */
  current(): AscentLog | null {
    return this.log === null ? null : this.withId(this.log, this.generation);
  }

  /** L'ascension en cours a un journal, pas encore fini. */
  inProgress(): boolean {
    return this.log?.status === 'inProgress';
  }

  /** Commence le journal d'une ascension. */
  begin(ascent: Ascent): void {
    this.generation += 1;
    this.change(beginAscentLog(ascent, this.dependencies.clock.today()));
  }

  /** Enregistre une transition de l'ascension, sans rien écrire. */
  record(step: AscentStep): void {
    if (this.log === null) return;
    const next = recordAscentStep(this.log, step);
    if (next !== this.log) this.change(next);
  }

  /**
   * Reprend le dernier journal s'il est celui de l'ascension `ascent` et n'est pas fini ; sinon,
   * pas de journal (une ascension commencée avant cette version n'en a pas).
   */
  async resume(ascent: Ascent): Promise<void> {
    const raw = await this.dependencies.store.latest().catch(() => null);
    const log = raw === null ? null : parseAscentLog(raw);
    this.log = null;
    this.generation += 1;
    if (log === null || log.ascentSeed !== ascent.seed || log.status !== 'inProgress') return;
    if (log.id !== null) this.ids.set(this.generation, log.id);
    this.log = log;
    this.queued = this.revision;
    const resumed = resumeAscentLog(log, ascent);
    if (resumed !== log) this.change(resumed);
  }

  /** Écrit le journal s'il a changé depuis la dernière écriture demandée. */
  flush(): void {
    if (this.log === null || this.queued === this.revision) return;
    this.queued = this.revision;
    const write = { log: this.log, revision: this.revision, generation: this.generation };
    const last = this.pending.at(-1);
    // Au plus une écriture en attente par ascension : la dernière gagne.
    if (last?.generation === write.generation) this.pending[this.pending.length - 1] = write;
    else this.pending.push(write);
    if (!this.running) this.draining = this.drain();
  }

  /** Attend que les écritures demandées soient faites (ou aient échoué). */
  settled(): Promise<void> {
    return this.draining;
  }

  private change(log: AscentLog): void {
    this.log = log;
    this.revision += 1;
  }

  private withId(log: AscentLog, generation: number): AscentLog {
    const id = this.ids.get(generation);
    return id === undefined ? log : { ...log, id };
  }

  private async drain(): Promise<void> {
    this.running = true;
    for (let write = this.pending.shift(); write !== undefined; write = this.pending.shift()) {
      try {
        await this.write(write);
      } catch {
        // L'échec est avalé : la prochaine écriture demandée réessaie.
        if (this.queued === write.revision) this.queued = -1;
      }
    }
    this.running = false;
  }

  private async write({ log, generation }: Write): Promise<void> {
    const { store } = this.dependencies;
    const known = this.withId(log, generation);
    if (known.id !== null) return store.save(known);
    const started = await store.start(log, ASCENT_LOG_KEPT);
    if (started.id !== null) this.ids.set(generation, started.id);
  }
}
