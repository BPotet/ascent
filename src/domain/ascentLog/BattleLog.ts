/**
 * Le journal d'un combat (`BattleLog`, #197, ADR 0016) : le récit d'un combat d'étage, manche par
 * manche, puis action par action dans l'ordre d'action, avec chaque appui, son écart et son
 * jugement. Il observe les événements de combat que le moteur publie déjà : il ne rappelle aucune
 * règle, ne rejuge aucun appui et ne tire aucun hasard. Immuable et sérialisable en JSON.
 *
 * Les instants du moteur ne sont pas comparables d'une reprise à l'autre (la base monotone peut
 * changer au redémarrage) : seul `t`, le temps de combat écoulé hors pause, est noté.
 */
import type { Encounter } from '../ascent/Ascent';
import type { Tier } from '../ascent/tiers';
import type { Actor } from '../battle/actionOrder';
import type { AttackKind } from '../battle/attacks';
import { enemyInitiative, type Battle } from '../battle/Battle';
import type {
  BattleEvent,
  BlowOutcome,
  DefenseButton,
  IgnoredReason,
  PlayerButton,
  WhiffReason,
} from '../battle/BattleEvent';
import type { Bleed, EnemyKind, HeroKind } from '../battle/combatants';
import type { GuardIntent, Intent, RaiseIntent } from '../battle/intents';
import type { PressJudgement } from '../battle/rules';
import type { TierMultiplier } from '../battle/tierMultiplier';

/** La version du format où les combats sont apparus dans le Journal d'ascension. */
export const BATTLE_LOG_FORMAT_VERSION = 2;

/**
 * Au-delà de ce nombre d'entrées (appuis et effets) dans un combat, les manches suivantes sont
 * notées sans détail : la clé du combat reste bien sous la limite d'une ligne de SQLite.
 */
export const BATTLE_LOG_MAX_ENTRIES = 3000;

/** Un étage, par son palier et son numéro. */
export interface FloorPlace {
  readonly tier: Tier;
  readonly floor: number;
}

/** Le combat d'un étage : son palier, son numéro et son type. */
export interface BattlePlace extends FloorPlace {
  readonly encounterKind: Encounter['kind'];
}

export interface HeroAtStart {
  readonly kind: HeroKind;
  readonly hp: number;
  readonly maxHp: number;
  /** L'Élan. */
  readonly momentum: number;
  /** La seconde chance de la faveur, prête au début du combat (#206) ; absente, aucune. */
  readonly secondChance?: true;
}

/** Un ennemi de la première ligne au début du combat, avec son Initiative. */
export interface EnemyAtStart {
  readonly place: number;
  readonly kind: EnemyKind;
  readonly tier: Tier;
  readonly hp: number;
  readonly maxHp: number;
  readonly guard: number;
  readonly maxGuard: number;
  readonly initiative: number;
}

/** L'intention tirée : catégorie, coup, dégâts, préparation, Saignement, Brûlure. */
export type IntentRecord =
  | {
      readonly category: 'attack';
      readonly attack: AttackKind;
      readonly damage: number;
      readonly windUpMs: number;
      readonly bleed?: Bleed;
      readonly burn?: number;
    }
  | GuardIntent
  | RaiseIntent;

/** Une frappe en rythme, identifiée par la manche, le rang de l'action du héros et le coup. */
export interface StrikePressRecord {
  readonly kind: 'strike';
  readonly t: number;
  readonly button: 'strike';
  readonly heroAction: number;
  readonly hit: number;
  readonly enemy: number;
  /** `null` sans appui. */
  readonly delta: number | null;
  /** Frappe parfaite, bonne frappe, sans bonus (`miss`, ou `null` sans appui). */
  readonly judgement: PressJudgement | null;
  readonly damage: number;
  readonly guardDamage: number;
}

/** Un impact jugé, identifié par la manche, l'ennemi et l'index de l'impact. */
export interface DefensePressRecord {
  readonly kind: 'defense';
  readonly t: number;
  /** `null` pour un coup subi sans appui. */
  readonly button: DefenseButton | null;
  readonly enemy: number;
  readonly index: number;
  readonly delta: number | null;
  readonly judgement: BlowOutcome;
  readonly damage: number;
  readonly heroHp: number;
}

/** Un appui raté : trop tôt, trop tard (avec son écart) ou dans le vide (sans écart). */
export interface WhiffRecord {
  readonly kind: 'whiff';
  readonly t: number;
  readonly button: DefenseButton;
  readonly delta: number | null;
  readonly judgement: WhiffReason;
}

export type PressRecord = StrikePressRecord | DefensePressRecord | WhiffRecord;

/** Les événements notés comme effets. */
const EFFECT_TYPES = [
  'powerUsed',
  'momentumChanged',
  'guardBroken',
  'actionLost',
  'guardRestored',
  'guardRaised',
  'allyRaised',
  'respite',
  'enemyDefeated',
  'counterAttacked',
  'bulwarkWorn',
  'bulwarkCountered',
  'battleEnded',
  'reinforcementEntered',
  'bossPhaseShifted',
  'enemySelfRevived',
  'heroBleeding',
  'bleedTicked',
  'heroBurning',
  'burnTicked',
  'burnExtinguished',
  'burnCleared',
  'summonCalled',
  'summonEntered',
  'summonedFell',
  'secondChanceUsed',
] as const satisfies readonly BattleEvent['type'][];

type EffectType = (typeof EFFECT_TYPES)[number];
type EffectEvent = Extract<BattleEvent, { readonly type: EffectType }>;
type WithoutInstants<Event> = Event extends unknown
  ? Omit<Event, 'at' | 'until'> & { readonly t: number }
  : never;

/** Un effet : l'événement de combat tel quel, daté de `t`, sans ses instants du moteur. */
export type EffectRecord = WithoutInstants<EffectEvent>;

const EFFECTS: ReadonlySet<BattleEvent['type']> = new Set(EFFECT_TYPES);

/** Les effets du début d'une manche, avant son `roundStarted` : ils vont dans la manche qui commence. */
const ROUND_OPENING: ReadonlySet<BattleEvent['type']> = new Set([
  'bleedTicked',
  'burnTicked',
  'summonEntered',
  'reinforcementEntered',
]);

export type ActionKind =
  'strike' | 'power' | 'attack' | 'guard' | 'raise' | 'lostAction' | 'guardRestored';

const KIND_OF_INTENT: Readonly<Record<IntentRecord['category'], ActionKind>> = {
  attack: 'attack',
  guard: 'guard',
  raise: 'raise',
};

/** Les effets du début d'une manche, Brûlure éteinte au début de la manche comprise. */
const opensRound = (event: BattleEvent) =>
  ROUND_OPENING.has(event.type) || (event.type === 'burnExtinguished' && event.cause === 'round');

/** Une action, identifiée par sa manche et son acteur. */
export interface ActionRecord {
  readonly actor: Actor;
  readonly t: number;
  readonly kind: ActionKind;
  /** Le coup d'une attaque, ses impacts et sa fausse amorce, en ms depuis le début de la préparation. */
  readonly attack?: {
    readonly attack: AttackKind;
    readonly impactOffsets: readonly number[];
    readonly feintOffset: number | null;
  };
  readonly presses: readonly PressRecord[];
  readonly effects: readonly EffectRecord[];
}

/** Les appuis ignorés d'une manche, comptés par bouton et par cause. */
export interface IgnoredCount {
  readonly button: PlayerButton;
  readonly reason: IgnoredReason;
  readonly count: number;
}

export interface RoundRecord {
  readonly round: number;
  readonly t: number;
  /** Jusqu'à la manche suivante ou à la fin du combat, hors pause ; `null` en cours. */
  readonly durationMs: number | null;
  readonly order: readonly Actor[];
  readonly intents: readonly (IntentRecord | null)[];
  /** Faux au-delà du garde-fou : ni actions, ni effets, ni appuis ignorés. */
  readonly detailed: boolean;
  readonly actions: readonly ActionRecord[];
  /** Les effets hors de toute action (début de manche, fin du combat entre deux actions). */
  readonly effects: readonly EffectRecord[];
  readonly ignored: readonly IgnoredCount[];
}

export type ResumeCause = 'pause' | 'reopen';

export interface BattleLog {
  readonly formatVersion: typeof BATTLE_LOG_FORMAT_VERSION;
  readonly tier: Tier;
  readonly floor: number;
  readonly encounterKind: Encounter['kind'];
  readonly status: 'inProgress' | 'won' | 'lost';
  readonly hero: HeroAtStart;
  readonly enemies: readonly EnemyAtStart[];
  readonly reserve: readonly EnemyKind[];
  readonly tierMultiplier: TierMultiplier | null;
  readonly summonMultiplier: TierMultiplier | null;
  /** La durée du combat hors pause, jusqu'au dernier instant noté. */
  readonly elapsedMs: number;
  readonly resumes: readonly { readonly t: number; readonly cause: ResumeCause }[];
  /** Le garde-fou a joué : des manches sont notées sans détail. */
  readonly truncated: boolean;
  /** Le nombre d'entrées notées (appuis et effets). */
  readonly entries: number;
  /** Le segment de temps en cours (`t = base + at − segmentAt`), `null` en pause. */
  readonly segment: { readonly base: number; readonly at: number } | null;
  readonly rounds: readonly RoundRecord[];
}

/** Le journal d'un combat qui commence à l'instant `at`. */
export function beginBattleLog(place: BattlePlace, battle: Battle, at: number): BattleLog {
  return {
    formatVersion: BATTLE_LOG_FORMAT_VERSION,
    tier: place.tier,
    floor: place.floor,
    encounterKind: place.encounterKind,
    status: 'inProgress',
    hero: {
      kind: battle.heroKind,
      hp: battle.hero.hp,
      maxHp: battle.hero.maxHp,
      momentum: battle.hero.momentum,
      ...(battle.hero.secondChance === 'ready' && { secondChance: true as const }),
    },
    enemies: battle.enemies.map((enemy, index) => ({
      place: index,
      kind: enemy.kind,
      tier: place.tier,
      hp: enemy.hp,
      maxHp: enemy.maxHp,
      guard: enemy.guard,
      maxGuard: enemy.maxGuard,
      initiative: enemyInitiative(enemy),
    })),
    reserve: battle.reserve,
    tierMultiplier: battle.tierMultiplier ?? null,
    summonMultiplier: battle.summonMultiplier ?? null,
    elapsedMs: 0,
    resumes: [],
    truncated: false,
    entries: 0,
    segment: { base: 0, at },
    rounds: [],
  };
}

/** Le temps de combat écoulé hors pause à l'instant `at`, jamais avant le début du segment. */
function elapsedAt(log: BattleLog, at: number): number {
  if (log.segment === null) return log.elapsedMs;
  return log.segment.base + Math.max(0, at - log.segment.at);
}

/** La pause : le segment se ferme à `at`. */
export function pauseBattleLog(log: BattleLog, at: number): BattleLog {
  if (log.status !== 'inProgress' || log.segment === null) return log;
  return { ...log, elapsedMs: Math.max(log.elapsedMs, elapsedAt(log, at)), segment: null };
}

/**
 * La reprise à l'instant `at`, après une pause ou une réouverture : le temps repart du dernier
 * instant noté, sans le temps de la pause ni celui passé app fermée.
 */
export function resumeBattleLog(log: BattleLog, at: number, cause: ResumeCause): BattleLog {
  if (log.status !== 'inProgress') return log;
  const base = log.elapsedMs;
  return { ...log, segment: { base, at }, resumes: [...log.resumes, { t: base, cause }] };
}

function intentRecord(intent: Intent | null): IntentRecord | null {
  if (intent === null || intent.category !== 'attack') return intent;
  const { attack, damage, windUpMs, bleed, burn } = intent;
  return {
    category: 'attack',
    attack,
    damage,
    windUpMs,
    ...(bleed !== undefined && { bleed }),
    ...(burn !== undefined && { burn }),
  };
}

function effectOf(event: EffectEvent, t: number): EffectRecord {
  const { at: _at, until: _until, ...fields } = event as EffectEvent & { readonly until?: number };
  return { ...fields, t } as EffectRecord;
}

/** Une manche en cours d'écriture : seules elle et ses actions sont recopiées. */
interface Draft {
  round: RoundRecord;
  actions: ActionRecord[];
  effects: EffectRecord[];
  ignored: IgnoredCount[];
}

const draftOf = (round: RoundRecord): Draft => ({
  round,
  actions: [...round.actions],
  effects: [...round.effects],
  ignored: [...round.ignored],
});

const closeDraft = ({ round, actions, effects, ignored }: Draft): RoundRecord => ({
  ...round,
  actions,
  effects,
  ignored,
});

/** Le journal en cours de mise à jour, le temps d'un appel. */
class Writer {
  private readonly closed: RoundRecord[] = [];
  /** L'avant-dernière manche du journal reçu, complétée d'un appui « trop tard » (#207). */
  private amendedPrevious: RoundRecord | null = null;
  private draft: Draft | null;
  /** Les effets du début d'une manche, en attente de son `roundStarted`. */
  private opening: EffectRecord[] = [];
  private status: BattleLog['status'];
  private elapsedMs: number;
  private entries: number;
  private truncated: boolean;

  constructor(
    private readonly log: BattleLog,
    private readonly battle: Battle,
  ) {
    const last = log.rounds.at(-1);
    this.draft = last === undefined ? null : draftOf(last);
    this.status = log.status;
    this.elapsedMs = log.elapsedMs;
    this.entries = log.entries;
    this.truncated = log.truncated;
  }

  record(event: BattleEvent): void {
    const t = elapsedAt(this.log, event.at);
    this.elapsedMs = Math.max(this.elapsedMs, t);
    if (event.type === 'roundStarted') return this.startRound(event, t);
    const draft = this.draft;
    if (draft === null) {
      // Avant la première manche, seuls les effets du début de manche attendent celle-ci.
      if (opensRound(event)) this.opening.push(effectOf(event as EffectEvent, t));
      return;
    }
    if (event.type === 'battleEnded') {
      this.status = event.outcome === 'victory' ? 'won' : 'lost';
      draft.round = { ...draft.round, durationMs: t - draft.round.t };
    }
    if (draft.round.detailed) this.detail(draft, event, t);
  }

  finish(): BattleLog {
    const draft = this.draft;
    // Aucune manche : rien à noter (aucun effet ne précède la première manche).
    if (draft === null) return this.log;
    this.attachOpening(draft);
    const earlier = this.log.rounds.length === 0 ? [] : this.log.rounds.slice(0, -1);
    if (this.amendedPrevious !== null) earlier[earlier.length - 1] = this.amendedPrevious;
    return {
      ...this.log,
      status: this.status,
      elapsedMs: this.elapsedMs,
      entries: this.entries,
      truncated: this.truncated,
      rounds: [...earlier, ...this.closed, closeDraft(draft)],
    };
  }

  /** Les effets du début de manche en attente rejoignent la manche `draft`, si elle est détaillée. */
  private attachOpening(draft: Draft): void {
    if (draft.round.detailed) {
      this.entries += this.opening.length;
      draft.effects.push(...this.opening);
    }
    this.opening = [];
  }

  private startRound(event: Extract<BattleEvent, { type: 'roundStarted' }>, t: number): void {
    if (this.draft !== null) {
      const { round } = this.draft;
      this.closed.push(closeDraft({ ...this.draft, round: { ...round, durationMs: t - round.t } }));
    }
    const detailed = this.entries < BATTLE_LOG_MAX_ENTRIES;
    if (!detailed) this.truncated = true;
    const draft: Draft = {
      round: {
        round: event.round,
        t,
        durationMs: null,
        order: this.battle.round === event.round ? this.battle.turn.order : [],
        intents: event.intents.map(intentRecord),
        detailed,
        actions: [],
        effects: [],
        ignored: [],
      },
      actions: [],
      effects: [],
      ignored: [],
    };
    this.attachOpening(draft);
    this.draft = draft;
  }

  private detail(draft: Draft, event: BattleEvent, t: number): void {
    switch (event.type) {
      case 'stepInStarted':
        // L'avancée ouvre l'action de l'ennemi, du type de son intention tirée.
        const category = draft.round.intents[event.enemy]?.category ?? 'attack';
        this.act(draft, event.enemy, KIND_OF_INTENT[category], t, false);
        return;
      case 'strikeStarted':
        this.act(draft, 'hero', 'strike', t);
        return;
      case 'strikeResolved':
        this.press(draft, this.act(draft, 'hero', 'strike', t), {
          kind: 'strike',
          t,
          button: 'strike',
          heroAction: this.battle.heroActions,
          hit: event.hit ?? 1,
          enemy: event.enemy,
          delta: event.delta,
          judgement: event.judgement,
          damage: event.damage,
          guardDamage: event.guardDamage,
        });
        return;
      case 'windUpStarted': {
        const index = this.act(draft, event.enemy, 'attack', t);
        const action = draft.actions[index]!;
        draft.actions[index] = {
          ...action,
          attack: {
            attack: event.attack,
            impactOffsets: event.impacts.map((impact) => impact - event.at),
            feintOffset: event.feintAt === null ? null : event.feintAt - event.at,
          },
        };
        return;
      }
      case 'blowResolved':
        this.press(draft, this.act(draft, event.enemy, 'attack', t), {
          kind: 'defense',
          t,
          button: event.button,
          enemy: event.enemy,
          index: event.index,
          delta: event.delta,
          judgement: event.outcome,
          damage: event.damage,
          heroHp: event.heroHp,
        });
        return;
      case 'whiffed': {
        const whiff: WhiffRecord = {
          kind: 'whiff',
          t,
          button: event.button,
          delta: event.delta ?? null,
          judgement: event.reason,
        };
        if (event.reason === 'late') this.pressLate(draft, whiff);
        else this.press(draft, draft.actions.length - 1, whiff);
        return;
      }
      case 'pressIgnored':
        this.ignore(draft, event.button, event.reason);
        return;
      case 'powerUsed':
        this.effect(draft, event, t, this.act(draft, 'hero', 'power', t, event.instant !== true));
        return;
      case 'guardRaised':
        this.effect(draft, event, t, this.act(draft, event.enemy, 'guard', t));
        return;
      case 'allyRaised':
        this.effect(draft, event, t, this.act(draft, event.enemy, 'raise', t));
        return;
      case 'actionLost':
        this.effect(draft, event, t, this.act(draft, event.enemy, 'lostAction', t));
        return;
      case 'guardRestored':
        if (event.inPlaceOfAction)
          this.effect(draft, event, t, this.act(draft, event.enemy, 'guardRestored', t));
        return;
      default:
        if (!EFFECTS.has(event.type)) return;
        if (opensRound(event)) {
          this.opening.push(effectOf(event as EffectEvent, t));
          return;
        }
        this.effect(draft, event as EffectEvent, t, draft.actions.length - 1);
    }
  }

  /** L'action de `actor` dans la manche `draft`, ouverte au besoin. */
  private act(draft: Draft, actor: Actor, kind: ActionKind, t: number, replaceKind = true): number {
    const index = draft.actions.findIndex((action) => action.actor === actor);
    if (index < 0) {
      draft.actions.push({ actor, t, kind, presses: [], effects: [] });
      return draft.actions.length - 1;
    }
    const action = draft.actions[index]!;
    if (replaceKind && action.kind !== kind) draft.actions[index] = { ...action, kind };
    return index;
  }

  /**
   * Ajoute l'appui à l'action `index`, ou remplace celui de même identité (un impact ou une frappe
   * rejoués). Un appui raté hors de toute action ne peut venir que d'une avancée : il n'y en a pas.
   */
  private press(draft: Draft, index: number, press: PressRecord): void {
    if (index < 0) return;
    const action = draft.actions[index]!;
    const same = action.presses.findIndex((each) => samePress(each, press));
    if (same < 0) this.entries += 1;
    const presses =
      same < 0
        ? [...action.presses, press]
        : action.presses.map((each, at) => (at === same ? press : each));
    draft.actions[index] = { ...action, presses };
  }

  /**
   * Un appui « trop tard » rejoint l'attaque qu'il juge (#207) : la dernière préparée de la manche,
   * sinon, pendant la transition de phase qui suit son coup, celle de la manche précédente.
   */
  private pressLate(draft: Draft, whiff: WhiffRecord): void {
    const index = lastAttack(draft.actions);
    if (index >= 0) return this.press(draft, index, whiff);
    const fromClosed = this.closed.length > 0;
    const round = fromClosed
      ? this.closed.at(-1)
      : (this.amendedPrevious ?? this.log.rounds.at(-2));
    if (round === undefined || !round.detailed) return;
    const previous = draftOf(round);
    this.press(previous, lastAttack(previous.actions), whiff);
    if (fromClosed) this.closed[this.closed.length - 1] = closeDraft(previous);
    else this.amendedPrevious = closeDraft(previous);
  }

  /** Ajoute l'effet à l'action `index`, ou à la manche hors de toute action (`-1`). */
  private effect(draft: Draft, event: EffectEvent, t: number, index: number): void {
    this.entries += 1;
    const record = effectOf(event, t);
    if (index < 0) {
      draft.effects.push(record);
      return;
    }
    const action = draft.actions[index]!;
    draft.actions[index] = { ...action, effects: [...action.effects, record] };
  }

  private ignore(draft: Draft, button: PlayerButton, reason: IgnoredReason): void {
    const index = draft.ignored.findIndex(
      (each) => each.button === button && each.reason === reason,
    );
    if (index < 0) {
      this.entries += 1;
      draft.ignored.push({ button, reason, count: 1 });
      return;
    }
    const counted = draft.ignored[index]!;
    draft.ignored[index] = { ...counted, count: counted.count + 1 };
  }
}

/** La dernière action dont le coup a été préparé, sinon -1. */
function lastAttack(actions: readonly ActionRecord[]): number {
  return actions.findLastIndex((action) => action.attack !== undefined);
}

function samePress(left: PressRecord, right: PressRecord): boolean {
  if (left.kind === 'strike' && right.kind === 'strike') {
    return left.heroAction === right.heroAction && left.hit === right.hit;
  }
  if (left.kind === 'defense' && right.kind === 'defense') {
    return left.enemy === right.enemy && left.index === right.index;
  }
  // Les appuis ratés n'ont pas d'identité : ils sont ajoutés.
  return false;
}

/**
 * Le journal après les événements `events` d'une mise à jour du combat `battle` (tel que publié) :
 * ils sont rangés par manche, puis par action. Seules la manche en cours et ses actions sont
 * recopiées ; rien ne change sans événement.
 */
export function recordBattleEvents(
  log: BattleLog,
  battle: Battle,
  events: readonly BattleEvent[],
): BattleLog {
  if (events.length === 0) return log;
  const writer = new Writer(log, battle);
  for (const event of events) writer.record(event);
  return writer.finish();
}
