import {
  advance,
  dismissDefenseHint,
  equippedOf,
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
import { enemySignature, type EnemyKind } from '../../domain/battle/combatants';
import { ATTACKS } from '../../domain/battle/attacks';
import { glintsOf } from '../../domain/battle/glints';
import type { BattleClock } from '../ports/BattleClock';
import type { BattleHaptics } from '../ports/BattleHaptics';
import type { BattleSound } from '../ports/BattleSound';
import type { KeyValueStore } from '../ports/KeyValueStore';
import type { SeedSource } from '../ports/SeedSource';
import { GLINT_CUES, feedbacksFor, strikeUnderway, type BattleFeedback } from './battleFeedback';
import {
  dismissBattleHint,
  dismissEncounterHint,
  getBattleHint,
  getEncounterHint,
  type BattleHintKind,
} from './battleHints';

/** La garde de réordonnancement (`ReorderGuard`) par défaut, en ms. */
export const REORDER_GUARD_MS = 32;

/** Un son de reflet qui partirait plus de 60 ms après son instant prévu n'est pas joué. */
export const GLINT_SOUND_LATE_MS = 60;

/** La ruée d'un coup part 80 ms avant son impact (maquette, `pxAct`) : la vibration du Balayage. */
export const SWEEP_RUSH_LEAD_MS = 80;

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
  /** La bulle d'aide des pouvoirs (#235, K11) est affichée : premier combat à 2 pouvoirs ou plus. */
  readonly powersHint: boolean;
  /**
   * La bulle de première rencontre (#258, D8) : l'Élite à signature qu'elle présente, une fois par
   * Élite ; absente, aucune bulle. Elle ne bloque rien ; le premier toucher la ferme.
   */
  readonly encounterHint?: EnemyKind;
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
  /** Les sons différés en attente (#171), annulés à `dispose`. */
  private readonly delayedSounds = new Set<() => void>();
  /** Les retours différés d'une frappe en cours, qui attendent sa fin (#259). */
  private heldFeedbacks: BattleFeedback[] = [];
  /** Les reflets déjà joués ou passés, par attaque (`startedAt:index`). */
  private readonly doneGlints = new Set<string>();
  /** Les ruées de Balayage déjà vibrées (#266), par la clé de leur impact. */
  private readonly doneRushes = new Set<string>();
  private cancelRushTimer: (() => void) | null = null;
  private heroHintPending = false;
  private powersHintPending = false;
  private encounterHintPending: EnemyKind | null = null;
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
    const [heroHint, defenseHint, powersHint] = await Promise.all([
      this.read((dependencies) => getBattleHint(dependencies, 'hero'), true),
      this.read((dependencies) => getBattleHint(dependencies, 'defense'), true),
      this.read((dependencies) => getBattleHint(dependencies, 'powers'), true),
    ]);
    this.heroHintPending = heroHint;
    this.powersHintPending = powersHint;
    this.doneGlints.clear();
    this.doneRushes.clear();
    const update = this.createBattle({
      seed: this.dependencies.seeds.next(),
      defenseHint,
      at: this.dependencies.clock.now(),
    });
    this.encounterHintPending = await this.encounterOf(update.battle);
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
      // La bulle de la phase du héros a servi : elle n'apparaît plus, celle des pouvoirs non plus,
      // ni celle de la première rencontre (#258).
      this.dismissPowersHintIfShown(battle);
      this.dismissEncounterHintIfShown(battle);
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
    if (kind === 'powers') {
      this.dismissPowersHintIfShown(battle);
      this.apply({ battle, events: [] });
      return;
    }
    if (battle.phase.kind !== 'defenseHint') return;
    this.save('defense');
    this.apply(dismissDefenseHint(battle, this.dependencies.clock.now()));
  }

  /** Ferme la bulle de première rencontre (#258) au premier toucher : elle ne revient pas. */
  dismissEncounterHint(): void {
    const battle = this.snapshot?.battle;
    if (battle === undefined || !this.encounterHintShown(battle)) return;
    this.dismissEncounterHintIfShown(battle);
    this.apply({ battle, events: [] });
  }

  /** L'effet d'un pouvoir s'ouvre au toucher maintenu (#235, K10) : une vibration très courte. */
  feelPowerTip(): void {
    this.dependencies.haptics.play('powerTip');
  }

  /** Arrête le combat : plus aucune échéance, plus aucun abonné. */
  dispose(): void {
    this.disposed = true;
    this.cancelTimer?.();
    this.cancelTimer = null;
    this.cancelGlintTimer?.();
    this.cancelGlintTimer = null;
    this.cancelRushTimer?.();
    this.cancelRushTimer = null;
    for (const cancel of this.delayedSounds) cancel();
    this.delayedSounds.clear();
    this.heldFeedbacks = [];
    this.listeners.clear();
  }

  private dismissHeroHintIfShown(): void {
    if (!this.heroHintPending) return;
    this.heroHintPending = false;
    this.save('hero');
  }

  private dismissPowersHintIfShown(battle: Battle): void {
    if (!this.powersHintShown(battle)) return;
    this.powersHintPending = false;
    this.save('powers');
  }

  private dismissEncounterHintIfShown(battle: Battle): void {
    const enemy = this.encounterHintPending;
    if (enemy === null || !this.encounterHintShown(battle)) return;
    this.encounterHintPending = null;
    dismissEncounterHint(this.dependencies, enemy).catch(() => undefined);
  }

  /**
   * Le premier ennemi à signature de la première ligne, de gauche à droite, dont la bulle n'a pas
   * encore été vue (#266, D6) : une seule bulle par combat ; une préférence illisible, aucune. Un
   * ennemi de la réserve n'est pas présenté dans ce combat.
   */
  private async encounterOf(battle: Battle): Promise<EnemyKind | null> {
    const candidates = battle.enemies
      .map(({ kind }) => kind)
      .filter(
        (kind, index, kinds) => enemySignature(kind) !== null && kinds.indexOf(kind) === index,
      );
    for (const kind of candidates) {
      const unseen = await this.read((dependencies) => getEncounterHint(dependencies, kind), false);
      if (unseen) return kind;
    }
    return null;
  }

  /** La bulle de première rencontre, après celle de la première ascension et celle des pouvoirs. */
  private encounterHintShown(battle: Battle): boolean {
    return (
      this.encounterHintPending !== null &&
      !this.heroHintShown(battle) &&
      !this.powersHintShown(battle)
    );
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

  /** La bulle des pouvoirs, une seule fois, après celle de la première ascension (#235, K11). */
  private powersHintShown(battle: Battle): boolean {
    return (
      this.powersHintPending &&
      !this.heroHintShown(battle) &&
      battle.phase.kind === 'hero' &&
      equippedOf(battle).length >= 2
    );
  }

  /**
   * Un son ou une vibration différés (#171, #259) : joués `delayMs` ms plus tard par l'horloge de
   * combat, annulés à la fin du combat.
   */
  private playLater({ sound, haptic }: BattleFeedback, delayMs: number): void {
    const { clock } = this.dependencies;
    const cancel = clock.setTimer(clock.now() + delayMs, () => {
      this.delayedSounds.delete(cancel);
      if (sound !== null) this.dependencies.sound.play(sound);
      if (haptic !== null) this.dependencies.haptics.play(haptic);
    });
    this.delayedSounds.add(cancel);
  }

  /**
   * Les retours d'une mise à jour : aussitôt, ou différés. Un retour différé né pendant une frappe
   * du héros attend sa fin (la piqûre d'une Rafale après son dernier coup, #259).
   */
  private feedback(battle: Battle, events: readonly BattleEvent[]): void {
    for (const feedback of feedbacksFor(events)) {
      if (feedback.delayMs !== undefined) {
        this.heldFeedbacks.push(feedback);
        continue;
      }
      if (feedback.sound !== null) this.dependencies.sound.play(feedback.sound);
      if (feedback.haptic !== null) this.dependencies.haptics.play(feedback.haptic);
    }
    if (strikeUnderway(battle)) return;
    for (const held of this.heldFeedbacks) this.playLater(held, held.delayMs!);
    this.heldFeedbacks = [];
  }

  private apply(update: BattleUpdate): void {
    if (this.disposed) return;
    const { battle, events } = update;
    this.feedback(battle, events);
    this.snapshot = {
      battle,
      events,
      heroHint: this.heroHintShown(battle),
      powersHint: this.powersHintShown(battle),
      ...(this.encounterHintShown(battle) && { encounterHint: this.encounterHintPending! }),
    };
    this.schedule(battle);
    this.scheduleGlint(battle);
    this.scheduleSweepRush(battle);
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

  /**
   * Programme la vibration longue et basse de la ruée d'un Balayage (#266, A3), 80 ms avant son
   * impact, sur l'horloge de combat : jamais avancée de la latence du son, jamais perdue quand le
   * minuteur est en retard, une fois par impact, même son coupé.
   */
  private scheduleSweepRush(battle: Battle): void {
    this.cancelRushTimer?.();
    this.cancelRushTimer = null;
    const { phase } = battle;
    if (phase.kind !== 'enemy' || phase.step.kind !== 'attack') return;
    const { step } = phase;
    if (!ATTACKS[step.attack].sweep) return;
    const index = step.impacts.findIndex(
      (_, position) => !this.doneRushes.has(glintKey(step, position)),
    );
    const impact = step.impacts[index];
    if (impact === undefined) return;
    const { clock, haptics } = this.dependencies;
    this.cancelRushTimer = clock.setTimer(impact.at - SWEEP_RUSH_LEAD_MS, () => {
      this.cancelRushTimer = null;
      this.doneRushes.add(glintKey(step, index));
      haptics.play('sweep');
      const current = this.snapshot?.battle;
      if (current !== undefined) this.scheduleSweepRush(current);
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
