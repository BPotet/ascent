import {
  abandonAscent,
  acknowledgeBossVictory,
  chooseBoon,
  chooseBlessing,
  chooseExit,
  endFloorBattle,
  enterNextTier,
  equipItem,
  leaveItem,
  lootStream,
  startAscent,
  type Ascent,
  type AscentLaunch,
} from '../../domain/ascent/Ascent';
import { boonModifiers } from '../../domain/ascent/boons';
import { blessingModifiers, type BlessingFamily } from '../../domain/ascent/blessings';
import { STARTING_EQUIPMENT, itemModifiers } from '../../domain/ascent/items';
import {
  EMPTY_SHARD_TOTAL,
  creditShards,
  parseShardTotal,
  serializeShardTotal,
  type ShardTotal,
} from '../../domain/ascent/shards';
import { TIERS } from '../../domain/ascent/tiers';
import { resumeBattle, startBattle, type Battle } from '../../domain/battle/Battle';
import { combineModifiers } from '../../domain/battle/heroModifiers';
import type { BattleEvent } from '../../domain/battle/BattleEvent';
import { BattleSession, type BattleSessionDependencies } from './BattleSession';

/** La clé de l'ascension en cours dans le stockage clé-valeur (prototype #91). */
export const ASCENT_KEY = 'ascent.current';
const SAVE_VERSION = 1;
/** La clé du Total d'Éclats (#38, ADR 0012) : jamais effacée par l'application. */
export const SHARD_TOTAL_KEY = 'shards.total';
/** La copie d'un Total d'Éclats illisible, avant qu'il ne reparte de 0. */
export const UNREADABLE_SHARD_TOTAL_KEY = 'shards.total.unreadable';

/**
 * La fumée des flammes de la Brûlure à la fin du combat (#171, 3 images de 120 ms) : l'écran qui
 * suit le combat attend qu'elle soit partie.
 */
export const BURN_SMOKE_HOLD_MS = 360;

/**
 * La chute des invoqués avec leur boss (#172) : 300 ms, puis l'effet d'Invocation à l'envers (3
 * images de 160 ms). L'écran qui suit le combat attend qu'ils soient retombés en poussière.
 */
export const SUMMON_FALL_HOLD_MS = 780;

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
  'bulwarkCountered',
  'reinforcementEntered',
  'heroPhaseStarted',
  'stepInStarted',
  'battleEnded',
  'enemySelfRevived',
  // L'entrée des invoqués (#172) ; leur annonce est sauvée avec le coup qui l'a lancée.
  'summonEntered',
]);

type Listener = (ascent: Ascent | null) => void;
type ShardListener = (total: number) => void;

/** Égide (`aegis`), sauvegardée avant #105, est relue comme Protection. */
const protection = (family: BlessingFamily): BlessingFamily =>
  (family as string) === 'aegis' ? 'protection' : family;

function parse(raw: string | null): SavedAscent | null {
  if (raw === null) return null;
  try {
    const saved = JSON.parse(raw) as Partial<SavedAscent> | null;
    if (saved?.version !== SAVE_VERSION || typeof saved.ascent?.floor !== 'number') return null;
    // Une ascension sauvegardée avant #93 : Neutre, sans bénédiction, avec l'équipement de base ;
    // avant #92 : la Sentinelle, sans bienfait ni offre ; avant #105 : Égide au lieu de Protection ;
    // avant #38 : au palier 1, sans Éclat ni Passage de palier.
    const stored: Partial<Ascent> = saved.ascent;
    const storedHero: Partial<Ascent['hero']> = saved.ascent.hero;
    const ascent = {
      boonOffer: null,
      gauge: 0,
      blessings: [],
      blessingRarities: [],
      blessingOffer: null,
      equipment: STARTING_EQUIPMENT,
      foundItem: null,
      lootRandom: lootStream(saved.ascent.seed),
      tier: 1,
      shardAwards: [],
      passage: null,
      ...stored,
      hero: { kind: 'sentinel', boons: [], ...storedHero },
    } as Ascent;
    const renamed: Ascent = {
      ...ascent,
      blessings: ascent.blessings.map((blessing) => ({
        ...blessing,
        family: protection(blessing.family),
      })),
      blessingOffer: ascent.blessingOffer?.map(protection) ?? null,
    };
    return { version: SAVE_VERSION, ascent: renamed, battle: saved.battle ?? null };
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
 *
 * Elle tient aussi le Total d'Éclats (#38, ADR 0012), sous sa propre clé, jamais effacée : à une
 * victoire qui rapporte des Éclats, le total est écrit, l'écriture attendue, puis l'ascension est
 * sauvegardée et publiée. Un total qui n'a pas pu être écrit l'est à la sauvegarde suivante.
 */
export class AscentSession {
  private ascent: Ascent | null = null;
  private battle: Battle | null = null;
  private readonly listeners = new Set<Listener>();
  private readonly shardListeners = new Set<ShardListener>();
  private writing: Promise<void> = Promise.resolve();
  private shards: ShardTotal = EMPTY_SHARD_TOTAL;
  /** Le dernier Total d'Éclats écrit dans le stockage. */
  private storedShards: ShardTotal = EMPTY_SHARD_TOTAL;
  /** La fin d'un combat, le temps que ses Éclats soient écrits. */
  private settling = false;
  /** L'instant où les invoqués sont tombés avec leur boss dans ce combat (#172), `null` sinon. */
  private summonFellAt: number | null = null;
  /**
   * Faux quand un Total d'Éclats illisible n'a pas pu être gardé à part : la valeur stockée n'est
   * alors jamais écrasée pendant cette session (ADR 0012), les Éclats ne vivent qu'en mémoire, et
   * le chargement suivant réessaie.
   */
  private shardsWritable = true;

  constructor(private readonly dependencies: BattleSessionDependencies) {}

  /**
   * L'ascension en cours sauvegardée, `null` s'il n'y en a pas (une valeur illisible est effacée),
   * et le Total d'Éclats : les Éclats de l'ascension qu'il n'a pas encore sont crédités.
   */
  async load(): Promise<Ascent | null> {
    const { keyValueStore } = this.dependencies;
    const raw = await keyValueStore.get(ASCENT_KEY).catch(() => null);
    const saved = parse(raw);
    if (saved === null && raw !== null) await keyValueStore.remove(ASCENT_KEY).catch(() => null);
    this.ascent = saved?.ascent ?? null;
    this.battle = saved?.battle ?? null;
    await this.loadShards();
    if (this.ascent !== null) {
      this.shards = creditShards(this.shards, this.ascent.seed, this.ascent.shardAwards);
    }
    if (this.shards !== this.storedShards) await this.writeShards();
    this.publish();
    this.publishShards();
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

  /** Le Total d'Éclats du joueur (#38), gardé entre les ascensions. */
  shardTotal(): number {
    return this.shards.total;
  }

  /** Prévient `listener` du Total d'Éclats, à chaque crédit. */
  subscribeShards(listener: ShardListener): () => void {
    this.shardListeners.add(listener);
    return () => {
      this.shardListeners.delete(listener);
    };
  }

  /**
   * Commence une ascension, avec une graine au hasard, le héros choisi, la jauge scellée et les
   * bénédictions.
   */
  begin(launch: AscentLaunch = {}): Ascent {
    return this.update(startAscent(this.dependencies.seeds.next(), launch), null);
  }

  chooseBlessing(index: number): void {
    if (this.ascent === null) return;
    this.update(chooseBlessing(this.ascent, index), this.battle);
  }

  equipItem(): void {
    if (this.ascent === null) return;
    this.update(equipItem(this.ascent), this.battle);
  }

  leaveItem(): void {
    if (this.ascent === null) return;
    this.update(leaveItem(this.ascent), this.battle);
  }

  chooseBoon(index: number): void {
    if (this.ascent === null) return;
    this.update(chooseBoon(this.ascent, index), null);
  }

  chooseExit(index: number): void {
    if (this.ascent === null) return;
    this.update(chooseExit(this.ascent, index), null);
  }

  abandon(): void {
    if (this.ascent === null) return;
    this.update(abandonAscent(this.ascent), null);
  }

  /** L'écran du boss vaincu est passé : l'écran de transition vers le palier suivant (#38). */
  acknowledgeBossVictory(): void {
    if (this.ascent === null) return;
    this.update(acknowledgeBossVictory(this.ascent), null);
  }

  /** L'écran de transition est passé : l'étage 1 du palier suivant (#38). */
  enterNextTier(): void {
    if (this.ascent === null) return;
    this.update(enterNextTier(this.ascent), null);
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
    this.summonFellAt = null;
    const session = new BattleSession(this.dependencies, {
      createBattle: (options) => {
        if (this.battle !== null)
          return { battle: resumeBattle(this.battle, options.at), events: [] };
        const ascent = this.ascent!;
        const encounter = ascent.encounter!;
        return startBattle({
          ...options,
          seed: encounter.battleSeed,
          hero: ascent.hero.kind,
          heroHp: ascent.hero.hp,
          heroMaxHp: ascent.hero.maxHp,
          modifiers: combineModifiers(
            // Le premier combat : l'étage 1 du palier 1 seulement (#38).
            blessingModifiers(ascent.blessings, {
              firstBattle: ascent.tier === 1 && ascent.floor === 1,
            }),
            itemModifiers(ascent.equipment),
            boonModifiers(ascent.hero.boons),
          ),
          enemies: encounter.enemies,
          // Le multiplicateur de palier : les combats ordinaires seulement, jamais l'Élite ni le boss.
          ...(encounter.kind === 'combat' && { tierMultiplier: TIERS[ascent.tier].multiplier }),
          // Les ennemis invoqués ont les valeurs du palier, dans tout combat d'étage (#172).
          summonMultiplier: TIERS[ascent.tier].multiplier,
          // L'ordre d'action par Initiative (P13, P14), ajouté par #90.
          initiative: true,
        });
      },
    });
    session.subscribe(({ battle, events }) => this.onBattle(battle, events));
    return session;
  }

  private onBattle(battle: Battle, events: readonly BattleEvent[]): void {
    if (this.ascent === null || this.ascent.encounter === null || this.settling) return;
    this.battle = battle;
    const fell = events.find((event) => event.type === 'summonedFell');
    if (fell !== undefined) this.summonFellAt = fell.at;
    const ended = battle.phase.kind === 'over' ? battle.phase.outcome : null;
    if (ended !== null) {
      const next = endFloorBattle(this.ascent, { outcome: ended, heroHp: battle.hero.hp });
      const credited = creditShards(this.shards, next.seed, next.shardAwards);
      const waits: Promise<void>[] = [];
      // Les Éclats sont écrits avant l'écran qui suit la victoire (ADR 0012).
      if (credited !== this.shards) {
        this.shards = credited;
        waits.push(this.writeShards().then(() => this.publishShards()));
      }
      // Les flammes de la Brûlure partent en fumée avant l'écran qui suit le combat (#171).
      const { clock } = this.dependencies;
      if (events.some((event) => event.type === 'burnCleared')) {
        waits.push(this.heldUntil(clock.now() + BURN_SMOKE_HOLD_MS));
      }
      // Les invoqués retombent en poussière avant l'écran qui suit le combat (#172) : leur chute,
      // à celle du boss, peut précéder de peu la fin du combat (la fin de l'action du héros).
      if (this.summonFellAt !== null) {
        waits.push(this.heldUntil(this.summonFellAt + SUMMON_FALL_HOLD_MS));
        this.summonFellAt = null;
      }
      if (waits.length === 0) {
        this.update(next, null);
        return;
      }
      this.settling = true;
      void Promise.all(waits).then(() => {
        this.settling = false;
        this.update(next, null);
      });
      return;
    }
    if (events.some((event) => SAVED_ON.has(event.type))) this.save();
  }

  /**
   * La fin d'un effet de la fin du combat, à l'instant `at` de l'horloge de combat : la fumée de la
   * Brûlure (#171), la chute des invoqués (#172).
   */
  private heldUntil(at: number): Promise<void> {
    const { clock } = this.dependencies;
    return new Promise((resolve) => {
      clock.setTimer(at, resolve);
    });
  }

  /** Le Total d'Éclats stocké ; une valeur illisible est gardée à part, et le total repart de 0. */
  private async loadShards(): Promise<void> {
    const { keyValueStore } = this.dependencies;
    const raw = await keyValueStore.get(SHARD_TOTAL_KEY).catch(() => null);
    const { total, unreadable } = parseShardTotal(raw);
    this.shards = total;
    this.storedShards = total;
    this.shardsWritable = true;
    if (!unreadable || raw === null) return;
    // La valeur illisible est d'abord gardée à part ; seulement alors le total stocké repart de 0.
    const kept = await keyValueStore.set(UNREADABLE_SHARD_TOTAL_KEY, raw).then(
      () => true,
      () => false,
    );
    if (kept) this.storedShards = { ...EMPTY_SHARD_TOTAL };
    else this.shardsWritable = false;
  }

  /** Écrit le Total d'Éclats, après les écritures en attente ; un échec sera réessayé. */
  private writeShards(): Promise<void> {
    const { keyValueStore } = this.dependencies;
    const total = this.shards;
    if (!this.shardsWritable) return this.writing;
    const write = this.writing.then(async () => {
      await keyValueStore.set(SHARD_TOTAL_KEY, serializeShardTotal(total));
      this.storedShards = total;
    });
    this.writing = write.catch(() => undefined);
    return this.writing;
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
    if (this.shardsWritable && this.shards !== this.storedShards) void this.writeShards();
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

  private publishShards(): void {
    for (const listener of [...this.shardListeners]) listener(this.shards.total);
  }
}
