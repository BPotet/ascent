import {
  advance,
  dismissDefenseHint,
  heroAction,
  nextDeadline,
  pressDefense,
  pressStrike,
  type AttackStep,
  type Battle,
  type BattleStartOptions,
  type BattleUpdate,
  type HeroAction,
} from '../../domain/battle/Battle';
import type { BattleEvent, DefenseButton } from '../../domain/battle/BattleEvent';
import { glintsOf } from '../../domain/battle/glints';
import type { BattleClock } from '../ports/BattleClock';
import type { BattleHaptics } from '../ports/BattleHaptics';
import type { BattleSound } from '../ports/BattleSound';
import type { KeyValueStore } from '../ports/KeyValueStore';
import type { SeedSource } from '../ports/SeedSource';
import { GLINT_CUES, feedbackFor } from './battleFeedback';
import { dismissBattleHint, getBattleHint, type BattleHintKind } from './battleHints';

/** La garde de réordonnancement (`ReorderGuard`) par défaut, en ms. */
export const REORDER_GUARD_MS = 32;

/** Un son de reflet qui partirait plus de 60 ms après son instant prévu n'est pas joué. */
export const GLINT_SOUND_LATE_MS = 60;

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

type Listener = (snapshot: BattleSnapshot) => void;

/** Crée le combat, par exemple celui d'un étage de l'ascension. */
export type BattleFactory = (options: BattleStartOptions) => BattleUpdate;

export interface BattleSessionOptions {
  /** La garde de réordonnancement, en ms (32 par défaut). */
  readonly reorderGuardMs?: number;
  readonly createBattle: BattleFactory;
}

/**
 * Session de combat (`BattleSession`) : le cas d'usage qui mène un combat. Il crée le combat
 * (graine de la source de graine, bulles déjà vues lues dans le stockage), reçoit les appuis datés au toucher, fait avancer le moteur à chaque échéance par
 * l'horloge de combat, joue les sons et les vibrations dès le jugement, et publie l'état et les
 * événements aux abonnés.
 *
 * Garde de réordonnancement : une échéance « appui absent » (impact + 160 ms) n'est traitée que
 * 32 ms après, pour qu'un toucher daté juste avant, arrivé un peu après, soit encore jugé.
 *
 * Reflet (C2.10) : un second minuteur demande le son du prochain reflet de l'attaque en cours en
 * avance de la latence attendue du son. Un reflet n'est joué qu'une fois, même après un arrêt sur
 * image, et jamais plus de 60 ms en retard.
 */
export class BattleSession {
  private snapshot: BattleSnapshot | null = null;
  private readonly listeners = new Set<Listener>();
  private cancelTimer: (() => void) | null = null;
  private cancelGlintTimer: (() => void) | null = null;
  /** Les reflets déjà joués ou passés, par attaque (`startedAt:index`). */
  private readonly doneGlints = new Set<string>();
  private heroHintPending = false;
  private disposed = false;
  private readonly reorderGuardMs: number;
  private readonly createBattle: BattleFactory;

  constructor(
    private readonly dependencies: BattleSessionDependencies,
    { reorderGuardMs = REORDER_GUARD_MS, createBattle }: BattleSessionOptions,
  ) {
    this.reorderGuardMs = reorderGuardMs;
    this.createBattle = createBattle;
  }

  /** Commence un nouveau combat (au montage de l'écran), même après `dispose`. */
  async start(): Promise<BattleSnapshot> {
    // Un écran remonté (l'ascension reprise après une pause) reprend une session arrêtée.
    this.disposed = false;
    const [heroHint, defenseHint] = await Promise.all([
      this.read((dependencies) => getBattleHint(dependencies, 'hero'), true),
      this.read((dependencies) => getBattleHint(dependencies, 'defense'), true),
    ]);
    this.heroHintPending = heroHint;
    this.doneGlints.clear();
    const update = this.createBattle({
      seed: this.dependencies.seeds.next(),
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
    this.apply(pressDefense(battle, { button, at: touchedAt }));
  }

  /** Un appui sur « Frapper », daté à l'instant où le doigt s'est posé. */
  pressStrike(touchedAt: number): void {
    const battle = this.snapshot?.battle;
    if (battle === undefined) return;
    this.apply(pressStrike(battle, { at: touchedAt }));
  }

  /** Une action de la phase du héros, validée au relâcher, avec le début du toucher. */
  heroAction(action: HeroAction, touchStartedAt: number, releasedAt: number): void {
    const battle = this.snapshot?.battle;
    if (battle === undefined) return;
    const update = heroAction(battle, { action, touchStartedAt, releasedAt });
    const acted = update.events.some(
      (event) => event.type === 'strikeStarted' || event.type === 'powerUsed',
    );
    if (acted) {
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

  /** Arrête le combat : plus aucune échéance, plus aucun abonné. */
  dispose(): void {
    this.disposed = true;
    this.cancelTimer?.();
    this.cancelTimer = null;
    this.cancelGlintTimer?.();
    this.cancelGlintTimer = null;
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
    }
    this.snapshot = { battle, events, heroHint: this.heroHintShown(battle) };
    this.schedule(battle);
    this.scheduleGlint(battle);
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

  /** Programme le son du prochain reflet pas encore joué de l'attaque en cours, s'il y en a un. */
  private scheduleGlint(battle: Battle): void {
    this.cancelGlintTimer?.();
    this.cancelGlintTimer = null;
    const { phase } = battle;
    if (phase.kind !== 'enemy' || phase.step.kind !== 'attack') return;
    const { step } = phase;
    const glints = glintsOf(step);
    const index = glints.findIndex((_, position) => !this.doneGlints.has(glintKey(step, position)));
    const glint = glints[index];
    if (glint === undefined) return;
    const { clock, sound } = this.dependencies;
    const at = glint.at - sound.expectedLatency();
    this.cancelGlintTimer = clock.setTimer(at, () => {
      this.cancelGlintTimer = null;
      this.doneGlints.add(glintKey(step, index));
      if (clock.now() - at <= GLINT_SOUND_LATE_MS) sound.play(GLINT_CUES[glint.kind]);
      const current = this.snapshot?.battle;
      if (current !== undefined) this.scheduleGlint(current);
    });
  }
}

/** La clé d'un reflet : son attaque (son début) et sa place dans l'attaque. */
function glintKey(step: AttackStep, index: number): string {
  return `${step.startedAt}:${index}`;
}
