import {
  abandonAscent,
  chooseExit,
  endFloorBattle,
  startAscent,
  type Ascent,
} from '../../domain/ascent/Ascent';
import { resumeBattle, startBattle, type Battle } from '../../domain/battle/Battle';
import type { BattleEvent } from '../../domain/battle/BattleEvent';
import { BattleSession, type BattleSessionDependencies } from './BattleSession';

/** La clé de l'ascension en cours dans le stockage clé-valeur (prototype #91). */
export const ASCENT_KEY = 'ascent.current';
const SAVE_VERSION = 1;

/** Ce qui est sauvegardé : l'ascension et le combat en cours (P31). */
interface SavedAscent {
  readonly version: typeof SAVE_VERSION;
  readonly ascent: Ascent;
  readonly battle: Battle | null;
}

/** Après ces événements (impact jugé, action résolue, fin), le combat est sauvegardé (P31). */
const SAVED_ON: ReadonlySet<BattleEvent['type']> = new Set([
  'blowResolved',
  'strikeResolved',
  'powerUsed',
  'guardRaised',
  'allyRaised',
  'counterAttacked',
  'reinforcementEntered',
  'heroPhaseStarted',
  'stepInStarted',
  'battleEnded',
]);

type Listener = (ascent: Ascent | null) => void;

function parse(raw: string | null): SavedAscent | null {
  if (raw === null) return null;
  try {
    const saved = JSON.parse(raw) as Partial<SavedAscent> | null;
    if (saved?.version !== SAVE_VERSION || typeof saved.ascent?.floor !== 'number') return null;
    return { version: SAVE_VERSION, ascent: saved.ascent, battle: saved.battle ?? null };
  } catch {
    return null;
  }
}

/**
 * Session d'ascension (`AscentSession`, prototype #91) : commence, reprend, choisit une sortie,
 * abandonne, et crée pour chaque combat d'étage une session de combat (nouveau combat, ou reprise
 * à l'action en cours). Elle sauvegarde l'ascension en JSON dans le stockage clé-valeur après
 * chaque choix et à chaque impact jugé ou action résolue ; les écritures passent l'une après
 * l'autre, la dernière gagne. Une seule ascension en cours (P33) ; elle est effacée à la fin.
 */
export class AscentSession {
  private ascent: Ascent | null = null;
  private battle: Battle | null = null;
  private readonly listeners = new Set<Listener>();
  private writing: Promise<void> = Promise.resolve();

  constructor(private readonly dependencies: BattleSessionDependencies) {}

  /** L'ascension en cours sauvegardée, `null` s'il n'y en a pas (une valeur illisible est effacée). */
  async load(): Promise<Ascent | null> {
    const { keyValueStore } = this.dependencies;
    const raw = await keyValueStore.get(ASCENT_KEY).catch(() => null);
    const saved = parse(raw);
    if (saved === null && raw !== null) await keyValueStore.remove(ASCENT_KEY).catch(() => null);
    this.ascent = saved?.ascent ?? null;
    this.battle = saved?.battle ?? null;
    this.publish();
    return this.ascent;
  }

  current(): Ascent | null {
    return this.ascent;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Commence une ascension, avec une graine au hasard. */
  begin(): Ascent {
    return this.update(startAscent(this.dependencies.seeds.next()), null);
  }

  chooseExit(index: number): void {
    if (this.ascent === null) return;
    this.update(chooseExit(this.ascent, index), null);
  }

  abandon(): void {
    if (this.ascent === null) return;
    this.update(abandonAscent(this.ascent), null);
  }

  /** Un combat est à reprendre : sa reprise commence par le compte à rebours (P32). */
  resuming(): boolean {
    return this.battle !== null && this.battle.phase.kind !== 'over';
  }

  /** La pause (`Pause`, P33) : l'ascension et le combat en cours sont sauvegardés. */
  pause(): void {
    if (this.ascent !== null) this.save();
  }

  /** Quitter le bilan de fin : retour au pied de la tour. */
  leave(): void {
    this.ascent = null;
    this.battle = null;
    this.publish();
  }

  /**
   * La session du combat de l'étage. Elle reprend le combat sauvegardé à l'action en cours (P32),
   * ou commence le combat de l'étage ; elle peut être démarrée de nouveau après une pause.
   */
  battleSession(): BattleSession {
    const session = new BattleSession(this.dependencies, {
      createBattle: (options) => {
        if (this.battle !== null)
          return { battle: resumeBattle(this.battle, options.at), events: [] };
        const encounter = this.ascent!.encounter!;
        return startBattle({
          ...options,
          seed: encounter.battleSeed,
          heroHp: this.ascent!.hero.hp,
          enemies: encounter.enemies,
          // L'ordre d'action par Initiative (P13, P14), comme le combat d'essai de #90.
          initiative: true,
        });
      },
    });
    session.subscribe(({ battle, events }) => this.onBattle(battle, events));
    return session;
  }

  private onBattle(battle: Battle, events: readonly BattleEvent[]): void {
    if (this.ascent === null || this.ascent.encounter === null) return;
    this.battle = battle;
    const ended = battle.phase.kind === 'over' ? battle.phase.outcome : null;
    if (ended !== null) {
      this.update(endFloorBattle(this.ascent, { outcome: ended, heroHp: battle.hero.hp }), null);
      return;
    }
    if (events.some((event) => SAVED_ON.has(event.type))) this.save();
  }

  private update(ascent: Ascent, battle: Battle | null): Ascent {
    this.ascent = ascent;
    this.battle = battle;
    this.save();
    this.publish();
    return ascent;
  }

  private save(): void {
    const { keyValueStore } = this.dependencies;
    const { ascent, battle } = this;
    const write =
      ascent === null || ascent.outcome !== null
        ? () => keyValueStore.remove(ASCENT_KEY)
        : () =>
            keyValueStore.set(
              ASCENT_KEY,
              JSON.stringify({ version: SAVE_VERSION, ascent, battle } satisfies SavedAscent),
            );
    // Un échec d'écriture n'arrête pas l'ascension : la suivante réessaie.
    this.writing = this.writing.then(write).catch(() => undefined);
  }

  private publish(): void {
    for (const listener of [...this.listeners]) listener(this.ascent);
  }
}
