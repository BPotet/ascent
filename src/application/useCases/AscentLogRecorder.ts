import type { Ascent } from '../../domain/ascent/Ascent';
import {
  beginAscentLog,
  recordAscentStep,
  recordBattlePlace,
  resumeAscentLog,
  type AnyAscentLog,
  type AscentLog,
  type AscentStep,
} from '../../domain/ascentLog/AscentLog';
import {
  ASCENT_LOG_KEPT,
  parseAscentLog,
  parseBattleLog,
} from '../../domain/ascentLog/AscentLogExport';
import {
  beginBattleLog,
  pauseBattleLog,
  recordBattleEvents,
  resumeBattleLog,
  type BattleLog,
  type BattlePlace,
  type FloorPlace,
} from '../../domain/ascentLog/BattleLog';
import type { Battle } from '../../domain/battle/Battle';
import type { BattleEvent } from '../../domain/battle/BattleEvent';
import type { AscentLogStore } from '../ports/AscentLogStore';
import type { Clock } from '../ports/Clock';

export interface AscentLogRecorderDependencies {
  readonly store: AscentLogStore;
  readonly clock: Clock;
}

/**
 * Une écriture : le journal et/ou le combat en cours (`null` quand il n'a pas changé), avec leurs
 * révisions, pour le journal de numéro `generation`.
 */
interface Write {
  readonly log: AnyAscentLog | null;
  readonly revision: number;
  readonly battle: BattleLog | null;
  readonly battleRevision: number;
  readonly generation: number;
}

const samePlace = (left: FloorPlace, right: FloorPlace) =>
  left.tier === right.tier && left.floor === right.floor;

/** Deux écritures du même journal se fondent, sauf si elles portent deux combats différents. */
const mergeable = (last: Write, next: Write) =>
  last.generation === next.generation &&
  (last.battle === null || next.battle === null || samePlace(last.battle, next.battle));

/**
 * L'enregistreur du Journal d'ascension (`AscentLogRecorder`, #196, ADR 0014) : il tient en mémoire
 * le journal de l'ascension en cours, et l'écrit par sa propre file, séparée de la sauvegarde de
 * l'ascension. Une seule écriture en cours, au plus une en attente par ascension (la dernière
 * gagne). Un échec d'écriture est avalé : l'ascension continue, la prochaine écriture réessaie.
 *
 * Il tient aussi le journal du combat en cours (#197, ADR 0016) : chaque mise à jour du combat n'y
 * fait que des ajouts en mémoire ; le combat s'écrit par la même file, après le parcours (dont
 * l'identifiant vient du stockage), et rien n'est sérialisé avant un `await`, hors de la pile du
 * combat. Un journal de version 1 encore en cours continue sans combats.
 */
export class AscentLogRecorder {
  private log: AnyAscentLog | null = null;
  /** Le numéro de la dernière modification du journal, et celui de la dernière écriture demandée. */
  private revision = 0;
  private queued = 0;
  private battle: BattleLog | null = null;
  private battleRevision = 0;
  private battleQueued = 0;
  /**
   * Les changements du combat reçus pendant que le combat en cours est relu à la reprise, appliqués
   * une fois lu ; `null` hors de cette lecture.
   */
  private whileReading: ((battle: BattleLog) => BattleLog)[] | null = null;
  private reading: Promise<void> = Promise.resolve();
  /** Le combat en cours a été relu après une fermeture : sa prochaine reprise est une réouverture. */
  private reopened = false;
  /** Le numéro du journal tenu (un par ascension commencée ou reprise). */
  private generation = 0;
  /** Le numéro du combat tenu : un combat commencé oublie celui qu'on relisait. */
  private battleGeneration = 0;
  /** Les identifiants attribués par le stockage, par numéro de journal. */
  private readonly ids = new Map<number, number>();
  private readonly pending: Write[] = [];
  private draining: Promise<void> = Promise.resolve();
  private running = false;

  constructor(private readonly dependencies: AscentLogRecorderDependencies) {}

  /** Le journal de l'ascension en cours, avec son identifiant s'il est déjà écrit. */
  current(): AnyAscentLog | null {
    return this.log === null ? null : this.withId(this.log, this.generation);
  }

  /** Le journal du combat en cours, `null` sans combat. */
  currentBattle(): BattleLog | null {
    return this.battle;
  }

  /** L'ascension en cours a un journal, pas encore fini. */
  inProgress(): boolean {
    return this.log?.status === 'inProgress';
  }

  /** Commence le journal d'une ascension. */
  begin(ascent: Ascent): void {
    this.generation += 1;
    this.forgetBattle();
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
   * pas de journal (une ascension commencée avant cette version n'en a pas). Le combat en cours,
   * s'il est le dernier du journal et à l'étage de `ascent`, est relu sans être attendu.
   */
  async resume(ascent: Ascent): Promise<void> {
    const raw = await this.dependencies.store.latest().catch(() => null);
    const log = raw === null ? null : parseAscentLog(raw);
    this.log = null;
    this.generation += 1;
    this.forgetBattle();
    if (log === null || log.ascentSeed !== ascent.seed || log.status !== 'inProgress') return;
    if (log.id !== null) this.ids.set(this.generation, log.id);
    this.log = log;
    this.queued = this.revision;
    const resumed = resumeAscentLog(log, ascent);
    if (resumed !== log) this.change(resumed);
    const place = log.formatVersion === 2 ? log.battles.at(-1) : undefined;
    if (log.id !== null && place !== undefined && samePlace(place, ascent)) {
      // La reprise ne l'attend pas : les changements reçus d'ici là sont appliqués ensuite.
      this.whileReading = [];
      this.reading = this.readBattle(log.id, place, this.battleGeneration);
    }
  }

  /** Commence le journal du combat de `place` (un journal de version 2 en cours seulement). */
  beginBattle(place: BattlePlace, battle: Battle, at: number): void {
    const log = this.log;
    if (log?.formatVersion !== 2 || log.status !== 'inProgress') return;
    this.forgetBattle();
    this.changeBattle(beginBattleLog(place, battle, at));
    const listed = recordBattlePlace(log, place);
    if (listed !== log) this.change(listed);
  }

  /** Enregistre une mise à jour du combat en mémoire : rien n'est sérialisé ni attendu. */
  recordBattle(battle: Battle, events: readonly BattleEvent[]): void {
    if (events.length === 0) return;
    this.updateBattle((log) => recordBattleEvents(log, battle, events));
  }

  /** La pause du combat en cours, à l'instant `at`. */
  pauseBattle(at: number): void {
    this.updateBattle((log) => pauseBattleLog(log, at));
  }

  /** La reprise du combat en cours, à l'instant `at` : après une pause, ou une réouverture. */
  resumeBattle(at: number): void {
    this.updateBattle((log) => {
      const cause = this.reopened ? 'reopen' : 'pause';
      this.reopened = false;
      return resumeBattleLog(log, at, cause);
    });
  }

  /** Écrit le journal et le combat en cours s'ils ont changé depuis la dernière écriture demandée. */
  flush(): void {
    if (this.log === null) return;
    const logChanged = this.queued !== this.revision;
    const battleChanged = this.battle !== null && this.battleQueued !== this.battleRevision;
    if (!logChanged && !battleChanged) return;
    this.queued = this.revision;
    this.battleQueued = this.battleRevision;
    const write: Write = {
      log: logChanged ? this.log : null,
      revision: this.revision,
      battle: battleChanged ? this.battle : null,
      battleRevision: this.battleRevision,
      generation: this.generation,
    };
    const last = this.pending.at(-1);
    // Au plus une écriture en attente par ascension et par combat : la dernière gagne.
    if (last !== undefined && mergeable(last, write)) {
      this.pending[this.pending.length - 1] = {
        ...write,
        log: write.log ?? last.log,
        battle: write.battle ?? last.battle,
      };
    } else {
      this.pending.push(write);
    }
    if (!this.running) this.draining = this.drain();
  }

  /** Attend la relecture du combat en cours et les écritures demandées (faites ou échouées). */
  async settled(): Promise<void> {
    await this.reading;
    await this.draining;
  }

  private change(log: AnyAscentLog): void {
    this.log = log;
    this.revision += 1;
  }

  private changeBattle(battle: BattleLog): void {
    this.battle = battle;
    this.battleRevision += 1;
  }

  /** Applique `change` au combat en cours, ou l'applique après sa relecture. */
  private updateBattle(change: (battle: BattleLog) => BattleLog): void {
    if (this.whileReading !== null) {
      this.whileReading.push(change);
      return;
    }
    if (this.battle === null) return;
    const next = change(this.battle);
    if (next !== this.battle) this.changeBattle(next);
  }

  private forgetBattle(): void {
    this.battle = null;
    this.whileReading = null;
    this.reopened = false;
    this.battleGeneration += 1;
  }

  private async readBattle(logId: number, place: FloorPlace, generation: number): Promise<void> {
    const raws = await this.dependencies.store
      .readBattles(logId, [place])
      .catch((): readonly string[] => []);
    if (generation !== this.battleGeneration) return;
    const changes = this.whileReading ?? [];
    this.whileReading = null;
    const battle = raws[0] === undefined ? null : parseBattleLog(raws[0]);
    if (battle === null) return;
    // Le combat relu est celui déjà écrit : seuls ses changements d'ici la reprise sont à écrire.
    this.battle = battle;
    this.battleQueued = this.battleRevision;
    this.reopened = true;
    for (const change of changes) this.updateBattle(change);
  }

  private withId<Log extends AnyAscentLog>(log: Log, generation: number): Log {
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
        if (write.log !== null && this.queued === write.revision) this.queued = -1;
        if (write.battle !== null && this.battleQueued === write.battleRevision) {
          this.battleQueued = -1;
        }
      }
    }
    this.running = false;
  }

  private async write({ log, battle, generation }: Write): Promise<void> {
    // Rien n'est sérialisé dans la pile de l'appelant (la mise à jour du combat) : après un await.
    await Promise.resolve();
    if (log !== null) await this.writeLog(log, generation);
    if (battle === null) return;
    // Le combat s'écrit sous l'identifiant du journal : jamais avant que le journal l'ait reçu.
    const id = this.ids.get(generation);
    if (id === undefined) throw new Error('The ascent log has no id yet');
    await this.dependencies.store.saveBattle(id, battle);
  }

  private async writeLog(log: AnyAscentLog, generation: number): Promise<void> {
    const { store } = this.dependencies;
    const known = this.withId(log, generation);
    if (known.id !== null) return store.save(known);
    // Seul un journal de version 2 commence : celui de version 1 a toujours son identifiant.
    const started = await store.start(log as AscentLog, ASCENT_LOG_KEPT);
    if (started.id !== null) this.ids.set(generation, started.id);
  }
}
