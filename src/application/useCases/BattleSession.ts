import {
  advance,
  dismissDefenseHint,
  heroAction,
  nextDeadline,
  pressDefense,
  startTrialBattle,
  type Battle,
  type BattleUpdate,
  type HeroAction,
  type TrialBattleOptions,
} from '../../domain/battle/Battle';
import type { BattleEvent, DefenseButton } from '../../domain/battle/BattleEvent';
import { DEFAULT_TRIAL_TUNING } from '../../domain/battle/TrialTuning';
import type { BattleClock } from '../ports/BattleClock';
import type { BattleHaptics } from '../ports/BattleHaptics';
import type { BattleSound } from '../ports/BattleSound';
import type { KeyValueStore } from '../ports/KeyValueStore';
import type { SeedSource } from '../ports/SeedSource';
import { feedbackFor } from './battleFeedback';
import { dismissBattleHint, getBattleHint, type BattleHintKind } from './battleHints';
import { getTrialTuning } from './trialTuning';

/** La garde de réordonnancement (`ReorderGuard`) par défaut, en ms. */
export const REORDER_GUARD_MS = 32;

export interface BattleSessionDependencies {
  readonly clock: BattleClock;
  readonly seeds: SeedSource;
  readonly sound: BattleSound;
  readonly haptics: BattleHaptics;
  readonly keyValueStore: KeyValueStore;
}

/** Ce que l'interface affiche : l'état du combat, les derniers événements, la bulle du héros. */
export interface BattleSnapshot {
  readonly battle: Battle;
  /** Les événements de la dernière mise à jour, dans l'ordre. */
  readonly events: readonly BattleEvent[];
  /** La bulle d'aide de la phase du héros (première utilisation) est affichée. */
  readonly heroHint: boolean;
}

/** Les mesures du combat, pour le panneau Mesures du build de preview. */
export interface BattleMeasures {
  /** Les appuis reçus avec un instant antérieur à l'état du moteur, redatés à cet état. */
  readonly redatedPresses: number;
  /** L'écart de chaque appui jugé (parade ou esquive), en ms. */
  readonly deltas: readonly number[];
}

type Listener = (snapshot: BattleSnapshot) => void;

/** Crée un combat ; par défaut, le combat d'essai. */
export type BattleFactory = (options: TrialBattleOptions) => BattleUpdate;

export interface BattleSessionOptions {
  /** La garde de réordonnancement, en ms (32 par défaut). */
  readonly reorderGuardMs?: number;
  readonly createBattle?: BattleFactory;
}

/**
 * Session de combat (`BattleSession`) : le cas d'usage qui mène un combat d'essai. Il crée le
 * combat (graine de la source de graine, réglages d'essai et bulles déjà vues lus dans le
 * stockage), reçoit les appuis datés au toucher, fait avancer le moteur à chaque échéance par
 * l'horloge de combat, joue les sons et les vibrations dès le jugement, et publie l'état et les
 * événements aux abonnés.
 *
 * Garde de réordonnancement : une échéance « appui absent » (impact + 160 ms) n'est traitée que
 * 32 ms après, pour qu'un toucher daté juste avant, arrivé un peu après, soit encore jugé.
 */
export class BattleSession {
  private snapshot: BattleSnapshot | null = null;
  private readonly listeners = new Set<Listener>();
  private cancelTimer: (() => void) | null = null;
  private heroHintPending = false;
  private redatedPresses = 0;
  private deltas: number[] = [];
  private disposed = false;
  private readonly reorderGuardMs: number;
  private readonly createBattle: BattleFactory;

  constructor(
    private readonly dependencies: BattleSessionDependencies,
    {
      reorderGuardMs = REORDER_GUARD_MS,
      createBattle = startTrialBattle,
    }: BattleSessionOptions = {},
  ) {
    this.reorderGuardMs = reorderGuardMs;
    this.createBattle = createBattle;
  }

  /** Commence un nouveau combat (au montage de l'écran, ou « Rejouer »). */
  async start(): Promise<BattleSnapshot> {
    const [tuning, heroHint, defenseHint] = await Promise.all([
      this.read(getTrialTuning, DEFAULT_TRIAL_TUNING),
      this.read((dependencies) => getBattleHint(dependencies, 'hero'), true),
      this.read((dependencies) => getBattleHint(dependencies, 'defense'), true),
    ]);
    this.heroHintPending = heroHint;
    this.redatedPresses = 0;
    this.deltas = [];
    const update = this.createBattle({
      seed: this.dependencies.seeds.next(),
      tuning,
      defenseHint,
      at: this.dependencies.clock.now(),
    });
    this.apply(update);
    return this.snapshot!;
  }

  /** Le dernier état publié, `null` avant le premier combat. */
  current(): BattleSnapshot | null {
    return this.snapshot;
  }

  /** Abonne `listener` à chaque mise à jour ; renvoie le désabonnement. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Un appui sur « Parade » ou « Esquive », daté à l'instant où le doigt s'est posé. */
  pressDefense(button: DefenseButton, touchedAt: number): void {
    const battle = this.snapshot?.battle;
    if (battle === undefined) return;
    if (touchedAt < battle.now && !isInHitStop(battle, touchedAt)) this.redatedPresses += 1;
    this.apply(pressDefense(battle, { button, at: touchedAt }));
  }

  /** Une action de la phase du héros, validée au relâcher, avec le début du toucher. */
  heroAction(action: HeroAction, touchStartedAt: number, releasedAt: number): void {
    const battle = this.snapshot?.battle;
    if (battle === undefined) return;
    const update = heroAction(battle, { action, touchStartedAt, releasedAt });
    if (update.events.some((event) => event.type === 'heroAttacked')) {
      // La bulle de la phase du héros a servi : elle n'apparaît plus.
      this.dismissHeroHintIfShown();
    }
    this.apply(update);
  }

  /** Ferme la bulle d'aide affichée : celle de la phase du héros, ou celle de la phase ennemie. */
  dismissHint(kind: BattleHintKind): void {
    const battle = this.snapshot?.battle;
    if (battle === undefined) return;
    if (kind === 'hero') {
      this.dismissHeroHintIfShown();
      this.apply({ battle, events: [] });
      return;
    }
    if (battle.phase.kind !== 'defenseHint') return;
    this.save('defense');
    this.apply(dismissDefenseHint(battle, this.dependencies.clock.now()));
  }

  measures(): BattleMeasures {
    return { redatedPresses: this.redatedPresses, deltas: [...this.deltas] };
  }

  /** Arrête le combat : plus aucune échéance, plus aucun abonné. */
  dispose(): void {
    this.disposed = true;
    this.cancelTimer?.();
    this.cancelTimer = null;
    this.listeners.clear();
  }

  private dismissHeroHintIfShown(): void {
    if (!this.heroHintPending) return;
    this.heroHintPending = false;
    this.save('hero');
  }

  private save(kind: BattleHintKind): void {
    // Un échec d'écriture n'empêche pas de jouer : la bulle reviendra au combat suivant.
    dismissBattleHint(this.dependencies, kind).catch(() => undefined);
  }

  private async read<Value>(
    load: (dependencies: BattleSessionDependencies) => Promise<Value>,
    fallback: Value,
  ): Promise<Value> {
    try {
      return await load(this.dependencies);
    } catch {
      return fallback;
    }
  }

  private heroHintShown(battle: Battle): boolean {
    return this.heroHintPending && battle.phase.kind === 'hero' && battle.round === 1;
  }

  private apply(update: BattleUpdate): void {
    if (this.disposed) return;
    const { battle, events } = update;
    for (const event of events) {
      const { sound, haptic } = feedbackFor(event);
      if (sound !== null) this.dependencies.sound.play(sound);
      if (haptic !== null) this.dependencies.haptics.play(haptic);
      if (event.type === 'blowResolved' && event.delta !== null) this.deltas.push(event.delta);
    }
    this.snapshot = { battle, events, heroHint: this.heroHintShown(battle) };
    this.schedule(battle);
    for (const listener of [...this.listeners]) listener(this.snapshot);
  }

  private schedule(battle: Battle): void {
    this.cancelTimer?.();
    this.cancelTimer = null;
    const deadline = nextDeadline(battle);
    if (deadline === null) return;
    const at = deadline.at + (deadline.awaitsPress ? this.reorderGuardMs : 0);
    this.cancelTimer = this.dependencies.clock.setTimer(at, () => {
      this.cancelTimer = null;
      const current = this.snapshot?.battle;
      if (current === undefined) return;
      this.apply(advance(current, Math.max(this.dependencies.clock.now(), at)));
    });
  }
}

function isInHitStop(battle: Battle, at: number): boolean {
  return battle.hitStop !== null && at >= battle.hitStop.at && at < battle.hitStop.until;
}
