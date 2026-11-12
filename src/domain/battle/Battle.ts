/**
 * Le moteur du combat (#31, règles C1, C4, C7 à C12, complété par #32 : C0, C2, C3, C5, C6) : un
 * moteur déterministe, piloté par les échéances. Il reçoit des instants (en ms, sur une base
 * monotone) et une graine du combat, et renvoie un nouvel état et les événements de combat datés
 * de leur instant nominal. Aucune horloge ni aucun hasard caché : le temps et le hasard passent
 * par la session (ports `BattleClock` et `SeedSource`).
 *
 * La manche suit l'ordre d'action (`actionOrder`) par un curseur. Une transition de phase n'a lieu
 * qu'entre deux actions jouées de camps différents (`lastPlayed`) : une action perdue et un
 * retour en garde n'en déclenchent pas.
 */
import { actionOrder, initiativeOrder, type Actor } from './actionOrder';
import { ATTACKS, type AttackKind } from './attacks';
import type {
  BattleEvent,
  BattleOutcome,
  BlowOutcome,
  DefenseButton,
  GuardBreaker,
  IgnoredReason,
  PhaseDirection,
  PlayerButton,
  WhiffReason,
} from './BattleEvent';
import {
  ENEMIES,
  ENEMY_INITIATIVE,
  GOOD_PARRY_PERCENT,
  HEROES,
  MAX_DAMAGE_REDUCTION_PERCENT,
  startingInitiative,
  type Bleed,
  type EnemyKind,
  type HeroKind,
  type HeroProfile,
} from './combatants';
import {
  GUARD_RESTORE_MS,
  LOST_ACTION_MS,
  blowOnEnemy,
  isRestoreDue,
  restoreGuard,
  type Stunned,
} from './guard';
import { NO_MODIFIERS, combineModifiers, heroAttack, type HeroModifiers } from './heroModifiers';
import { heroInitiative } from './initiative';
import { cursedValue } from './curse';
import { exhumeSlot } from './exhume';
import {
  drawIntent,
  raisedHp,
  type ChargeIntent,
  type ExhumeIntent,
  type GuardIntent,
  type Intent,
  type RaiseIntent,
} from './intents';
import { MOMENTUM_MAX, MOMENTUM_START, gainMomentum, missingMomentum } from './momentum';
import {
  BULWARK_DAMAGE_PERCENT,
  POWERS,
  POWER_STRIKE_INTERVAL_MS,
  basePower,
  isPowerStrike,
  kindledCost,
  type PowerKind,
  type PowerStrikeKind,
} from './powers';
import {
  COUNTER_MS,
  HERO_ACTION_MS,
  HIT_STOP_MS,
  OFF_BALANCE_MS,
  SUPPORT_ACTION_MS,
  PARRY_WINDOW_MS,
  judgePress,
  lateToleranceEnd,
  missDeadline,
  pressDelta,
  scaleDamage,
  type PressJudgement,
} from './rules';
import { seedRandom, type BattleSeed, type RandomState } from './SeededRandom';
import { SECOND_CHANCE_MS, secondChanceHp } from './secondChance';
import { sanctuaryPercents } from './sanctuary';
import { boostedDamage } from './aura';
import { selfRevive } from './selfRevive';
import {
  STRIKE_RECOVERY_MS,
  STRIKE_WIND_UP_MS,
  bulwarkCounterBlow,
  counterBlow,
  judgeStrike,
  strikeBlow,
  type EnemyBlow,
} from './strike';
import { bleedsOn, mergeBleed, tickBleed } from './bleed';
import { burnAtRoundStart, burnOnBlow } from './burn';
import { freeSlots, summonedKind, type PendingSummon } from './summon';
import { cappedParryHeal } from './parryHeal';
import { thornsActive, thornsLoss } from './thorns';
import { NO_TIER_MULTIPLIER, scaleByPercent, type TierMultiplier } from './tierMultiplier';

/** Les intentions jouées sans coup, par `startSupport` : Garde, Relever, Exhumer et Charge (#266). */
type SupportIntent = GuardIntent | RaiseIntent | ExhumeIntent | ChargeIntent;

export interface HeroState {
  readonly hp: number;
  readonly maxHp: number;
  /** L'Élan (`Momentum`), de 0 à 5. */
  readonly momentum: number;
  /** Le Rempart est actif : le prochain coup subi fait 50 % de dégâts en moins. */
  readonly bulwark: boolean;
  /** Pas de l'ombre est actif (l'Errante, prototype #90, P11) ; absent s'il ne l'a jamais été. */
  readonly shadowStep?: boolean;
  /** Le Saignement en cours (prototype #107) ; absent, le héros ne saigne pas. */
  readonly bleed?: Bleed;
  /** Les charges de Brûlure (#171), de 1 à 5 ; absent, le héros ne brûle pas (jamais 0). */
  readonly burn?: number;
  /** La seconde chance de la faveur (#206), prête ou utilisée ; absente, le héros n'en a pas. */
  readonly secondChance?: 'ready' | 'used';
  /** Représailles est actif (#235) : la prochaine contre-attaque à 200 % ; absent, non. */
  readonly retaliation?: true;
  /** Brume est active (#235) : le prochain impact à dégâts à 50 % ; absente, non. */
  readonly mist?: true;
  /** Entaille attend la prochaine frappe en rythme (#235) ; absente, non. */
  readonly rend?: true;
  /** Les pouvoirs « une fois par combat » déjà lancés (#235) ; absent, aucun. */
  readonly spent?: readonly PowerKind[];
  /**
   * Les PV rendus par parade parfaite dans ce combat (#244, R4), sous le plafond de soin de
   * parade ; absent, 0 (aucun, ou un combat sauvegardé avant #244).
   */
  readonly parryHealed?: number;
}

export interface EnemyState {
  readonly kind: EnemyKind;
  readonly hp: number;
  readonly maxHp: number;
  /** La garde (`Guard`), de 0 à sa garde max. */
  readonly guard: number;
  readonly maxGuard: number;
  /** L'intention tirée au début de la manche ; `null` quand son action de la manche est prise. */
  readonly intent: Intent | null;
  /** `null` s'il n'est pas étourdi. */
  readonly stun: Stunned | null;
  /** Il a déjà été relevé une fois par l'intention Relever. */
  readonly raised: boolean;
  /** La manche où il a été relevé : il n'y agit pas. */
  readonly raisedRound: number | null;
  /**
   * Le dernier retour en garde, pour l'animation du relèvement ; `cause` dit une relève de Se relève
   * seul (#38), absente pour un retour en garde après étourdissement.
   */
  readonly guardRestore: {
    readonly since: number;
    readonly until: number;
    readonly cause?: 'selfRevive';
  } | null;
  /** Un boss passé en phase 2 (`BossPhaseShift`, P6). */
  readonly phase2?: boolean;
  /** Le nombre de relèves faites dans ce combat (`SelfRevive`, #106) ; absent, 0. */
  readonly selfRevives?: number;
  /** Un ennemi invoqué (`Invoqué`, #172) : entré par une Invocation, il tombe avec le boss. */
  readonly summoned?: true;
  /** Un ennemi maudit (`CursedEnemy`, #209) : il le reste jusqu'à la fin du combat, relevé compris. */
  readonly cursed?: true;
  /**
   * Un ennemi d'escorte (`Escorte`, #257) : il accompagne l'Élite, au multiplicateur de l'escorte
   * (`Battle.escortMultiplier`) ; absent, non.
   */
  readonly escort?: true;
  /**
   * Un ennemi exhumé (`Exhumation`, #258) : entré par l'Exhumation du Fossoyeur, en plus de
   * `summoned` ; il compte pour le plafond d'Exhumer. Absent, non.
   */
  readonly exhumed?: true;
  /**
   * La Charge du Bélier de bronze (#266, D4) : il charge depuis son action (`charging`) jusqu'au
   * début de la préparation de son Coup de bélier, ou elle a été brisée (`broken`) jusqu'au retour
   * en garde. Absente, aucune ; effacée à la chute.
   */
  readonly charge?: 'charging' | 'broken';
}

export interface ImpactState {
  readonly at: number;
  /** L'instant de l'impact est passé. */
  readonly landed: boolean;
  /** L'impact est tombé pendant le déséquilibre : aucun appui ne peut plus le parer. */
  readonly lost: boolean;
  /** `null` tant que l'impact n'est pas jugé. */
  readonly outcome: BlowOutcome | null;
}

export interface CounterState {
  readonly at: number;
  readonly until: number;
  readonly done: boolean;
  /** La Riposte du Rempart (#128) ; absent, une contre-attaque (un combat sauvé avant compris). */
  readonly by?: 'bulwark';
}

/** L'avancée (`StepIn`) d'un ennemi, avant sa préparation ou l'effet de son intention. */
export interface StepInStep {
  readonly kind: 'stepIn';
  readonly enemy: number;
  readonly since: number;
  readonly until: number;
}

/** L'attaque d'un ennemi : sa préparation, ses impacts et sa résolution. */
export interface AttackStep {
  readonly kind: 'attack';
  readonly enemy: number;
  readonly attack: AttackKind;
  readonly damage: number;
  readonly startedAt: number;
  readonly feintAt: number | null;
  readonly feintShown: boolean;
  readonly impacts: readonly ImpactState[];
  /** L'instant nominal où le dernier impact est résolu (impact + 160 ms + max(0, −décalage)). */
  readonly resolvedAt: number;
  readonly counter: CounterState | null;
  /** Le Saignement du coup (prototype #107). */
  readonly bleed?: Bleed;
  /** Les charges de Brûlure du coup (#171). */
  readonly burn?: number;
  /** Le relèvement de la seconde chance (#206) sur ce coup : un temps mort jusqu'à `until`. */
  readonly secondChance?: { readonly since: number; readonly until: number };
  /** Le Coup de bélier d'une Charge (#266, CH3) ; absent, un coup ordinaire. */
  readonly charged?: true;
  /**
   * Les dégâts ajoutés par impact par la Nuée, puis par l'Aura (#268, D5), déjà dans `damage` ;
   * absents, 0.
   */
  readonly swarm?: number;
  readonly aura?: number;
}

/** L'effet d'une intention Garde, Relever, Exhumer ou Charge, après l'avancée. */
export interface SupportStep {
  readonly kind: 'support';
  readonly enemy: number;
  readonly intent: SupportIntent;
  readonly since: number;
  readonly until: number;
}

/** L'action perdue (`LostAction`) ou le retour en garde (`GuardRestore`) d'un ennemi étourdi. */
export interface StunStep {
  readonly kind: 'lostAction' | 'guardRestore';
  readonly enemy: number;
  readonly since: number;
  readonly until: number;
}

export type EnemyStep = StepInStep | AttackStep | SupportStep | StunStep;

/** Le premier appui sur « Frapper », jugé comme une parade (C6.2). */
export interface StrikePress {
  readonly at: number;
  readonly delta: number;
  readonly judgement: PressJudgement;
}

export type BattlePhase =
  | {
      readonly kind: 'hero';
      readonly since: number;
      /** Elle commence sans transition de phase, par l'annonce « À toi ». */
      readonly announced: boolean;
      /**
       * Un pouvoir instantané vient d'être lancé (#173) : le héros choisit encore son action, et
       * aucun autre pouvoir instantané ne se lance dans cette phase (PW2, #235).
       */
      readonly instantPowerUsed?: true;
    }
  | {
      /** La frappe en rythme (`TimedStrike`) : sa préparation, son impact, sa récupération. */
      readonly kind: 'heroStrike';
      readonly enemy: number;
      readonly since: number;
      readonly impactAt: number;
      readonly press: StrikePress | null;
      readonly resolved: boolean;
      /** La fin de l'action : fin de la fenêtre de l'impact, puis la récupération. */
      readonly until: number;
      /** Le rang du coup, pour un héros qui frappe plusieurs fois (prototype #90). */
      readonly hit?: number;
      /** Entaille (#235) : chaque coup de cette frappe retire 150 % de son Brise-garde. */
      readonly rend?: true;
      /** La frappe de pouvoir lancée (#236) ; absente pour « Attaquer ». */
      readonly power?: PowerStrikeKind;
      /** Frappe furtive (#236) : la cible avait encore sa case après l'Errante, jugé au lancer. */
      readonly ambush?: true;
    }
  | {
      readonly kind: 'heroPower';
      readonly power: PowerKind;
      readonly since: number;
      readonly until: number;
    }
  | { readonly kind: 'defenseHint'; readonly since: number }
  | {
      readonly kind: 'transition';
      readonly to: PhaseDirection;
      readonly since: number;
      readonly until: number;
    }
  | { readonly kind: 'enemy'; readonly step: EnemyStep }
  | { readonly kind: 'over'; readonly outcome: BattleOutcome; readonly at: number };

/** Le combat (`Battle`) : un état immuable. */
export interface Battle {
  /** L'instant jusqu'où le moteur a avancé. */
  readonly now: number;
  readonly random: RandomState;
  /** Le décalage (`InputOffset`), fixé à 0 ms dans #31. */
  readonly inputOffset: number;
  readonly round: number;
  /** Le héros joué (prototype #90). */
  readonly heroKind: HeroKind;
  /**
   * Les pouvoirs équipés (#235), dans l'ordre de l'arbre ; absents, le pouvoir de base seul (un
   * combat sauvé avant #235, le combat d'essai) : voir `equippedOf`.
   */
  readonly powers?: readonly PowerKind[];
  /**
   * Les pouvoirs attisés du combat (#237), 1 Élan de moins (`powerCost`) ; absents, aucun : un
   * combat sans attisé garde son JSON.
   */
  readonly kindled?: readonly PowerKind[];
  /** L'ordre d'action par Initiative (prototype #90), sinon le héros d'abord. */
  readonly initiative: boolean;
  /** Les modificateurs du héros (prototype #93) ; absents, aucun. */
  readonly modifiers?: HeroModifiers;
  /**
   * Le multiplicateur des ennemis du combat : de palier pour un combat ordinaire (#38), d'Élite et
   * de boss sinon (#244) ; absent, × 1 (palier 1, ou une Élite ou un boss sauvés avant #244).
   */
  readonly tierMultiplier?: TierMultiplier;
  /** Le multiplicateur du palier des ennemis invoqués (#172) ; absent, × 1. */
  readonly summonMultiplier?: TierMultiplier;
  /**
   * Le multiplicateur des ennemis d'escorte d'une Élite escortée (#257) ; absent, aucune escorte
   * (un combat sans escorte, ou un combat d'Élite sauvé avant #257).
   */
  readonly escortMultiplier?: TierMultiplier;
  /** L'Invocation annoncée, pas encore entrée (#172) ; absente, aucune. */
  readonly summon?: PendingSummon;
  /** Le répit du palier, en % (#244, R3) ; absent, `RESPITE_PERCENT` (un combat d'avant #244). */
  readonly respitePercent?: number;
  readonly hero: HeroState;
  /** La première ligne (`FrontLine`) : au plus 3 ennemis qui se battent en même temps (P3b). */
  readonly enemies: readonly EnemyState[];
  /** La réserve (`EnemyReserve`) : les ennemis du groupe qui attendent, dans l'ordre du tirage. */
  readonly reserve: readonly EnemyKind[];
  readonly target: number;
  readonly phase: BattlePhase;
  /** L'ordre d'action de la manche et la place de celui qui agit. */
  readonly turn: { readonly order: readonly Actor[]; readonly position: number };
  /** Le camp du dernier combattant qui a joué une action (C0), `null` avant la première. */
  readonly lastPlayed: 'hero' | 'enemy' | null;
  /** Le nombre d'actions du héros commencées : date l'événement (b) de C5.3. */
  readonly heroActions: number;
  /** La fin du déséquilibre en cours, `null` sans déséquilibre. */
  readonly offBalanceUntil: number | null;
  /**
   * Le dernier impact subi et la fin de sa tolérance « trop tard », décalée par les arrêts sur
   * image (#207) ; absent, aucun.
   */
  readonly sufferedImpact?: { readonly at: number; readonly lateUntil: number };
  /** Le dernier arrêt sur image. */
  readonly hitStop: { readonly at: number; readonly until: number } | null;
  /** La bulle d'aide de la phase ennemie reste à montrer avant la première transition. */
  readonly defenseHintPending: boolean;
}

/** Un nouvel état et les événements produits, dans l'ordre. */
export interface BattleUpdate {
  readonly battle: Battle;
  readonly events: readonly BattleEvent[];
}

/** La prochaine échéance du moteur. `awaitsPress` : un impact sans appui, subi après l'instant. */
export interface BattleDeadline {
  readonly at: number;
  readonly awaitsPress: boolean;
}

export type HeroAction =
  | { readonly kind: 'attack' }
  | { readonly kind: 'target'; readonly enemy: number }
  | { readonly kind: 'power'; readonly power: PowerKind };

type Events = BattleEvent[];

interface Deadline extends BattleDeadline {
  readonly apply: (battle: Battle, events: Events) => Battle;
}

// ---------------------------------------------------------------------------------------------
// Création

/** La transition de phase (`PhaseTransition`), en ms : une durée fixe (C12, #121). */
export const PHASE_TRANSITION_MS = 800;

/** L'avancée (`StepIn`) d'un ennemi, en ms : une durée fixe (C12, #121). */
export const STEP_IN_MS = 400;

/** Le départ d'un combat, sans son groupe d'ennemis. */
export interface BattleStartOptions {
  readonly seed: BattleSeed;
  /** Montrer la bulle d'aide de la phase ennemie avant la première transition. */
  readonly defenseHint: boolean;
  /** L'instant de départ, sur la base de l'horloge de combat. */
  readonly at: number;
  readonly inputOffset?: number;
  /** Le héros joué (prototype #90) ; la Sentinelle par défaut. */
  readonly hero?: HeroKind;
  /** L'ordre d'action par Initiative (prototype #90) ; par défaut, le héros d'abord. */
  readonly initiative?: boolean;
}

/** Un combat de l'ascension : le héros avec ses PV, contre un groupe d'ennemis (#91). */
export interface BattleOptions extends BattleStartOptions {
  /** Les PV du héros au début du combat ; par défaut ses PV max. */
  readonly heroHp?: number;
  /** Les PV max du héros (prototype #93 : Vigueur, fatigue) ; par défaut ceux du héros. */
  readonly heroMaxHp?: number;
  /** Les modificateurs du héros (prototype #93) ; par défaut, aucun. */
  readonly modifiers?: HeroModifiers;
  /** Le groupe d'ennemis, de gauche à droite, dans l'ordre du tirage. */
  readonly enemies: readonly EnemyKind[];
  /**
   * Le multiplicateur des ennemis du combat : de palier pour un combat ordinaire (#38), d'Élite et
   * de boss sinon (#244) ; par défaut, × 1.
   */
  readonly tierMultiplier?: TierMultiplier;
  /**
   * Le multiplicateur du palier des ennemis invoqués (#172), pour tout combat d'étage, boss
   * compris (le boss, lui, a le multiplicateur d'Élite et de boss) ; par défaut, × 1.
   */
  readonly summonMultiplier?: TierMultiplier;
  /**
   * Le multiplicateur de l'escorte d'une Élite escortée (#257) : présent, chaque ennemi de départ
   * sauf le premier (l'Élite, à l'indice 0) est un ennemi d'escorte ; absent, aucune escorte.
   */
  readonly escortMultiplier?: TierMultiplier;
  /**
   * L'indice de l'ennemi maudit (#209) dans la première ligne ; absent, aucun. Un indice de la
   * réserve ne maudit personne : un renfort ou un invoqué n'est jamais maudit.
   */
  readonly cursed?: number;
  /** Le héros a la seconde chance de la faveur (#206) ; par défaut, non. */
  readonly secondChance?: boolean;
  /** Les pouvoirs équipés (#235), 1 à 3 ; par défaut, le pouvoir de base du héros. */
  readonly powers?: readonly PowerKind[];
  /** Le répit du palier, en % (#244, R3) ; par défaut, `RESPITE_PERCENT`. */
  readonly respitePercent?: number;
  /** Les pouvoirs attisés de l'ascension (#237) ; par défaut, aucun. */
  readonly kindled?: readonly PowerKind[];
}

/** Au plus 3 ennemis se battent en même temps (P3b). */
export const FRONT_LINE_SIZE = 3;

/**
 * Un ennemi qui entre, à PV et garde max, multipliés par le multiplicateur du combat (de palier,
 * #38, ou d'Élite et de boss, #244), puis maudits (#209) s'il l'est.
 */
function freshEnemy(
  kind: EnemyKind,
  { hpPercent, guardPercent }: TierMultiplier = NO_TIER_MULTIPLIER,
  cursed = false,
): EnemyState {
  const curse = cursed ? cursedValue : (value: number) => value;
  const maxHp = curse(scaleByPercent(ENEMIES[kind].maxHp, hpPercent));
  const maxGuard = curse(scaleByPercent(ENEMIES[kind].maxGuard, guardPercent));
  return {
    kind,
    hp: maxHp,
    maxHp,
    guard: maxGuard,
    maxGuard,
    intent: null,
    stun: null,
    raised: false,
    raisedRound: null,
    guardRestore: null,
    ...(cursed && { cursed: true as const }),
  };
}

/**
 * Un combat, en phase du héros (C1) : la première ligne (les 3 premiers ennemis) et la réserve
 * (les suivants), l'Élan à 1 (P8).
 */
export function startBattle({
  seed,
  defenseHint,
  at,
  inputOffset = 0,
  hero = 'sentinel',
  initiative = false,
  heroHp,
  heroMaxHp,
  modifiers,
  enemies: group,
  tierMultiplier,
  summonMultiplier,
  escortMultiplier,
  cursed,
  secondChance,
  powers,
  respitePercent,
  kindled,
}: BattleOptions): BattleUpdate {
  const maxHp = heroMaxHp ?? HEROES[hero].maxHp;
  const momentum = Math.min(MOMENTUM_MAX, MOMENTUM_START + (modifiers?.startingMomentum ?? 0));
  const events: Events = [];
  const enemies = group
    .slice(0, FRONT_LINE_SIZE)
    .map((kind, index) =>
      escortMultiplier && index > 0
        ? { ...freshEnemy(kind, escortMultiplier, index === cursed), escort: true as const }
        : freshEnemy(kind, tierMultiplier, index === cursed),
    );
  const battle = startRound(
    {
      now: at,
      random: seedRandom(seed),
      inputOffset,
      round: 0,
      heroKind: hero,
      ...(powers && { powers }),
      ...(kindled !== undefined && kindled.length > 0 && { kindled }),
      initiative,
      ...(modifiers && { modifiers }),
      ...(tierMultiplier && { tierMultiplier }),
      ...(summonMultiplier && { summonMultiplier }),
      ...(escortMultiplier && { escortMultiplier }),
      ...(respitePercent !== undefined && { respitePercent }),
      hero: {
        hp: heroHp ?? maxHp,
        maxHp,
        momentum,
        bulwark: false,
        ...(secondChance && { secondChance: 'ready' as const }),
      },
      enemies,
      reserve: group.slice(FRONT_LINE_SIZE),
      target: 0,
      phase: { kind: 'hero', since: at, announced: false },
      turn: { order: [], position: 0 },
      lastPlayed: null,
      heroActions: 0,
      offBalanceUntil: null,
      hitStop: null,
      defenseHintPending: defenseHint,
    },
    events,
    at,
  );
  if (battle.turn.order[0] !== 'hero') return { battle: playTurn(battle, events, at), events };
  events.push({ type: 'heroPhaseStarted', at, announced: false });
  return { battle, events };
}

// ---------------------------------------------------------------------------------------------
// Lecture

/** Le profil du héros joué. */
export function heroProfile(battle: Battle): HeroProfile {
  return HEROES[battle.heroKind];
}

/** Les pouvoirs équipés du combat (#235) : absents, le pouvoir de base seul. */
export function equippedOf(battle: Battle): readonly PowerKind[] {
  return battle.powers ?? [basePower(battle.heroKind)];
}

/**
 * Le coût en Élan d'un pouvoir dans ce combat (#235) : tout coût passe par ici. Attisé (#237), il
 * coûte 1 Élan de moins, au moins 1.
 */
export function powerCost(battle: Battle, power: PowerKind): number {
  return battle.kindled?.includes(power) === true ? kindledCost(power) : POWERS[power].cost;
}

/**
 * La disponibilité d'un pouvoir (#235), seule règle, lue par `heroAction` et par l'interface, dans
 * cet ordre : non équipé, charge active (PW3), un instantané déjà lancé dans la phase (PW2), l'Élan
 * qui manque, puis disponible.
 */
export type PowerAvailability =
  | { readonly kind: 'available' }
  | { readonly kind: 'notEquipped' }
  | { readonly kind: 'usedThisBattle' }
  | { readonly kind: 'active' }
  | { readonly kind: 'instantUsed' }
  | { readonly kind: 'missing'; readonly missing: number };

/**
 * La charge du pouvoir `power` est active : il attend son emploi (PW3). Tenir bon et les frappes de
 * pouvoir (#236) n'ont pas de charge : jamais actifs. Le `switch` est exhaustif, sans `default` : un
 * pouvoir oublié ne compile pas, et aucun ne lit `hero[power]`.
 */
function isActive(hero: HeroState, power: PowerKind): boolean {
  switch (power) {
    case 'bulwark':
      return hero.bulwark;
    case 'shadowStep':
      return hero.shadowStep === true;
    case 'retaliation':
      return hero.retaliation === true;
    case 'mist':
      return hero.mist === true;
    case 'rend':
      return hero.rend === true;
    case 'holdFast':
    case 'shieldBash':
    case 'crushingBlow':
    case 'flurry':
    case 'ambush':
      return false;
  }
}

export function powerAvailability(battle: Battle, power: PowerKind): PowerAvailability {
  if (!equippedOf(battle).includes(power)) return { kind: 'notEquipped' };
  if (battle.hero.spent?.includes(power)) return { kind: 'usedThisBattle' };
  if (isActive(battle.hero, power)) return { kind: 'active' };
  const { phase } = battle;
  if (POWERS[power].instant && phase.kind === 'hero' && phase.instantPowerUsed) {
    return { kind: 'instantUsed' };
  }
  const missing = missingMomentum(battle.hero.momentum, powerCost(battle, power));
  return missing > 0 ? { kind: 'missing', missing } : { kind: 'available' };
}

/** Les modificateurs du héros dans ce combat (prototype #93). */
function heroModifiers(battle: Battle): HeroModifiers {
  // Un combat sauvegardé avant #92 n'a pas tous les champs : les absents sont neutres.
  return battle.modifiers === undefined ? NO_MODIFIERS : combineModifiers(battle.modifiers);
}

/** L'Invocation annoncée et pas encore entrée (#172), `null` sans Invocation en attente. */
export function pendingSummon(battle: Battle): PendingSummon | null {
  return battle.summon ?? null;
}

export function isStanding(enemy: EnemyState): boolean {
  return enemy.hp > 0;
}

/**
 * L'Élite escortée (#257) : l'indice de l'Élite (0) quand un ennemi du combat est d'escorte ;
 * `null` dans un combat sans escorte.
 */
export function escortedElite(battle: Battle): number | null {
  return battle.enemies.some((enemy) => enemy.escort === true) ? 0 : null;
}

/** Les indices des ennemis debout, de gauche à droite. */
export function standingEnemies(battle: Battle): number[] {
  return battle.enemies.flatMap((enemy, index) => (isStanding(enemy) ? [index] : []));
}

/** Le déséquilibre est en cours à l'instant `at`. */
export function isOffBalanceAt(battle: Battle, at: number): boolean {
  return battle.offBalanceUntil !== null && at < battle.offBalanceUntil;
}

// ---------------------------------------------------------------------------------------------
// Échéances

function compareDeadlines(left: Deadline, right: Deadline): number {
  if (left.at !== right.at) return left.at - right.at;
  // À instant égal, l'échéance d'un appui absent passe après les autres.
  return Number(left.awaitsPress) - Number(right.awaitsPress);
}

function attackDeadlines(battle: Battle, step: AttackStep): Deadline[] {
  const deadlines: Deadline[] = [];
  if (step.feintAt !== null && !step.feintShown) {
    deadlines.push({ at: step.feintAt, awaitsPress: false, apply: showFeint });
  }
  step.impacts.forEach((impact, index) => {
    if (!impact.landed) {
      deadlines.push({
        at: impact.at,
        awaitsPress: false,
        apply: (current, events) => landImpact(current, events, index),
      });
    }
    if (impact.outcome === null) {
      deadlines.push({
        at: missDeadline(impact.at, battle.inputOffset),
        awaitsPress: true,
        apply: (current, events) => sufferImpact(current, events, index),
      });
    }
  });
  // La contre-attaque, la riposte (#128, R1) et la fin du coup attendent tous ses impacts.
  if (step.impacts.some((impact) => impact.outcome === null)) return deadlines;
  const { counter } = step;
  deadlines.push(
    counter !== null && !counter.done
      ? { at: counter.at, awaitsPress: false, apply: counterAttack }
      : { at: attackEnd(step), awaitsPress: false, apply: endEnemyStep },
  );
  return deadlines;
}

function strikeDeadline(battle: Battle, phase: StrikePhase): Deadline {
  if (phase.resolved) return { at: phase.until, awaitsPress: false, apply: endHeroAction };
  // Un appui avant l'impact est jugé à l'impact ; sans appui, la frappe part à la fin de la fenêtre.
  return phase.press === null
    ? {
        at: missDeadline(phase.impactAt, battle.inputOffset),
        awaitsPress: true,
        apply: (current, events) =>
          resolveStrike(current, events, missDeadline(phase.impactAt, current.inputOffset)),
      }
    : {
        at: phase.impactAt,
        awaitsPress: false,
        apply: (current, events) => resolveStrike(current, events, phase.impactAt),
      };
}

function phaseDeadlines(battle: Battle): Deadline[] {
  const { phase } = battle;
  switch (phase.kind) {
    case 'heroStrike':
      return [strikeDeadline(battle, phase)];
    case 'heroPower':
      return [{ at: phase.until, awaitsPress: false, apply: endHeroAction }];
    case 'transition':
      return [{ at: phase.until, awaitsPress: false, apply: endTransition }];
    case 'enemy': {
      const { step } = phase;
      if (step.kind === 'attack') return attackDeadlines(battle, step);
      const apply = step.kind === 'stepIn' ? startEnemyAction : endEnemyStep;
      return [{ at: step.until, awaitsPress: false, apply }];
    }
    default:
      return [];
  }
}

function deadlinesOf(battle: Battle): Deadline[] {
  const deadlines = phaseDeadlines(battle);
  if (battle.offBalanceUntil !== null) {
    deadlines.push({ at: battle.offBalanceUntil, awaitsPress: false, apply: endOffBalance });
  }
  return deadlines.sort(compareDeadlines);
}

function isDue(deadline: BattleDeadline, until: number): boolean {
  // Un impact sans appui n'est subi qu'après son échéance : un appui à l'instant même est jugé.
  return deadline.awaitsPress ? deadline.at < until : deadline.at <= until;
}

/** La prochaine échéance, ou `null` quand le combat attend le joueur (ou est fini). */
export function nextDeadline(battle: Battle): BattleDeadline | null {
  const [first] = deadlinesOf(battle);
  return first === undefined ? null : { at: first.at, awaitsPress: first.awaitsPress };
}

/** Fait avancer le combat jusqu'à `until` : toutes les échéances atteintes, dans l'ordre. */
export function advance(battle: Battle, until: number): BattleUpdate {
  const events: Events = [];
  let current = battle;
  for (;;) {
    const due = deadlinesOf(current).find((deadline) => isDue(deadline, until));
    if (due === undefined) break;
    current = due.apply(current, events);
  }
  return { battle: { ...current, now: Math.max(current.now, until) }, events };
}

// ---------------------------------------------------------------------------------------------
// Manche et ordre d'action

type StrikePhase = Extract<BattlePhase, { kind: 'heroStrike' }>;
type HeroPhase = Extract<BattlePhase, { kind: 'hero' }>;

/** Le premier allié tombé jamais relevé de `enemy`, `null` s'il n'y en a pas. */
function fallenAlly(battle: Battle, enemy: number): number | null {
  const ally = battle.enemies.findIndex(
    (other, index) => index !== enemy && !isStanding(other) && !other.raised,
  );
  return ally < 0 ? null : ally;
}

/**
 * Le renfort (P3b) : s'il ne reste qu'un ennemi debout ou aucun, le 1er de la réserve prend la
 * place du tombé le plus à gauche, qui ne peut plus être relevé ; un seul par manche.
 */
function reinforce(battle: Battle, events: Events, at: number): Battle {
  const [kind, ...reserve] = battle.reserve;
  if (kind === undefined || standingEnemies(battle).length > 1) return battle;
  const slot = battle.enemies.findIndex((enemy) => !isStanding(enemy));
  events.push({ type: 'reinforcementEntered', at, enemy: slot, kind });
  const entering = freshEnemy(kind, battle.tierMultiplier);
  const reinforced = { ...withEnemy(battle, slot, entering), reserve };
  if (isStanding(reinforced.enemies[reinforced.target]!)) return reinforced;
  events.push({ type: 'targetChanged', at, enemy: slot });
  return { ...reinforced, target: slot };
}

/** La perte du Saignement (B2), avant le renfort et les tirages ; ni réduction ni Rempart (B3). */
function bleedHero(battle: Battle, events: Events, at: number): Battle {
  const { hero } = battle;
  if (hero.bleed === undefined) return battle;
  const { loss, bleed } = tickBleed(hero.hp, hero.bleed);
  const { bleed: _, ...rest } = hero;
  const heroHp = hero.hp - loss;
  events.push({ type: 'bleedTicked', at, loss, heroHp, roundsLeft: bleed?.rounds ?? 0 });
  return { ...battle, hero: { ...rest, hp: heroHp, ...(bleed && { bleed }) } };
}

/** Les charges de Brûlure du héros : `undefined` retire la clé (jamais 0). */
function withBurn(hero: HeroState, stacks: number | undefined): HeroState {
  const { burn: _, ...rest } = hero;
  return stacks === undefined ? rest : { ...rest, burn: stacks };
}

/** La perte de la Brûlure (#171), après le Saignement ; ni réduction ni Rempart (4). */
function burnHero(battle: Battle, events: Events, at: number): Battle {
  const { hero } = battle;
  if (hero.burn === undefined) return battle;
  const burnt = burnAtRoundStart(hero.hp, hero.burn, at);
  events.push(...burnt.events);
  return { ...battle, hero: withBurn({ ...hero, hp: hero.hp - burnt.loss }, burnt.stacks) };
}

/**
 * L'entrée des invoqués (#172) : chaque place réservée reçoit un ennemi invoqué, aux valeurs du
 * palier des invoqués, de gauche à droite, puis l'Invocation n'est plus en attente. Un tombé dont la
 * place est reprise ne peut plus être relevé (règle 7) : il n'est plus dans la première ligne.
 */
function summonEnter(battle: Battle, events: Events, at: number): Battle {
  const { summon, ...rest } = battle;
  if (summon === undefined) return battle;
  const enemies = [...battle.enemies];
  for (const slot of [...summon.slots].sort((left, right) => left - right)) {
    events.push({ type: 'summonEntered', at, enemy: slot, kind: summon.kind });
    enemies[slot] = { ...freshEnemy(summon.kind, battle.summonMultiplier), summoned: true };
  }
  return { ...rest, enemies };
}

/**
 * Le multiplicateur d'un ennemi (#257, D1) : celui des invoqués pour un invoqué, celui de
 * l'escorte pour un ennemi d'escorte, sinon celui du combat ; absent, × 1.
 */
function enemyMultiplier(battle: Battle, enemy: EnemyState): TierMultiplier | undefined {
  if (enemy.summoned) return battle.summonMultiplier;
  if (enemy.escort) return battle.escortMultiplier;
  return battle.tierMultiplier;
}

function startRound(previous: Battle, events: Events, at: number): Battle {
  // Saignement, Brûlure, entrée des invoqués, puis le renfort, avant les tirages : l'ordre de la
  // manche est calculé après (P3b, #171, #172). Les invoqués entrent avant le renfort : celui-ci
  // ne prend jamais une place réservée par l'Invocation (règle 7).
  const burnt = burnHero(bleedHero(previous, events, at), events, at);
  const battle = reinforce(summonEnter(burnt, events, at), events, at);
  let random = battle.random;
  const round = battle.round + 1;
  // Tous les tirages au début de la manche, ennemis debout de gauche à droite (C2.1). La place
  // d'une Exhumation est fixée ici (#258, D1) : aucune ne peut être reprise avant son action.
  const enemies = battle.enemies.map((enemy, index) => {
    if (!isStanding(enemy)) return enemy;
    const drawn = drawIntent(enemy.kind, random, {
      exhumeSlot: exhumeSlot(battle.enemies, index, round),
      fallenAlly: fallenAlly(battle, index),
      stunned: enemy.stun !== null,
      guardDamaged: enemy.guard < enemy.maxGuard,
      phase2: enemy.phase2 === true,
      maxGuard: enemy.maxGuard,
      damagePercent: enemyMultiplier(battle, enemy)?.hpPercent ?? 100,
      cursed: enemy.cursed === true,
      charging: enemy.charge === 'charging',
    });
    random = drawn.random;
    return { ...enemy, intent: drawn.intent };
  });
  // Les intentions tirées, annoncées avec la manche : une avance peut déjà consommer la première.
  const intents = enemies.map((enemy) => (isStanding(enemy) ? enemy.intent : null));
  events.push({ type: 'roundStarted', at, round, intents });
  return {
    ...battle,
    enemies,
    random,
    round,
    turn: { order: roundOrder(battle, enemies), position: 0 },
  };
}

/** L'Initiative d'un ennemi : celle de sa phase 2 pour un boss qui a changé de phase (P13). */
export function enemyInitiative(enemy: EnemyState): number {
  const phase2 = enemy.phase2 === true ? ENEMIES[enemy.kind].phase2Initiative : undefined;
  return phase2 ?? ENEMY_INITIATIVE[enemy.kind];
}

/** L'ordre d'action de la manche, figé jusqu'à la suivante (P14). */
function roundOrder(battle: Battle, enemies: readonly EnemyState[]): Actor[] {
  if (!battle.initiative) return actionOrder(enemies);
  return initiativeOrder(
    heroInitiative(startingInitiative(battle.heroKind), heroModifiers(battle).initiative),
    enemies.map((enemy) => ({ hp: enemy.hp, initiative: enemyInitiative(enemy) })),
  );
}

/**
 * L'ordre de la manche suivante sur l'état courant : l'aperçu de la frise d'action (#90), les
 * invoqués annoncés déjà à leurs places (#172).
 */
export function nextRoundOrder(battle: Battle): Actor[] {
  return roundOrder(battle, summonEnter(battle, [], battle.now).enemies);
}

/** Celui qui agit à la place courante de l'ordre d'action, à l'instant `at`. */
function playTurn(battle: Battle, events: Events, at: number): Battle {
  const actor = battle.turn.order[battle.turn.position];
  if (actor === undefined) return playTurn(startRound(battle, events, at), events, at);
  if (actor === 'hero') return heroTurn(battle, events, at);
  if (!isStanding(battle.enemies[actor]!)) return nextTurn(battle, events, at);
  return enemyTurn(battle, events, actor, at);
}

/** Le combattant suivant de l'ordre d'action (ou la manche suivante). */
function nextTurn(battle: Battle, events: Events, at: number): Battle {
  const turn = { ...battle.turn, position: battle.turn.position + 1 };
  return playTurn({ ...battle, turn }, events, at);
}

function heroTurn(battle: Battle, events: Events, at: number): Battle {
  if (battle.lastPlayed === 'enemy') return startTransition(battle, events, 'hero', at);
  // Aucun ennemi n'a joué d'action depuis le héros : ni transition ni « Phase ennemie » (C5.4).
  events.push({ type: 'heroPhaseStarted', at, announced: true });
  return { ...battle, phase: { kind: 'hero', since: at, announced: true } };
}

function enemyTurn(battle: Battle, events: Events, enemy: number, at: number): Battle {
  const { stun, intent } = battle.enemies[enemy]!;
  if (stun !== null) return stunTurn(battle, events, enemy, stun, at);
  // Un ennemi à Charge relevé dans une manche commencée étourdi n'y agit pas (#266, CH1).
  if (intent === null) return nextTurn(battle, events, at);
  if (battle.lastPlayed === 'enemy') return startStepIn(battle, events, enemy, at);
  if (battle.defenseHintPending) {
    events.push({ type: 'defenseHintShown', at });
    return { ...battle, phase: { kind: 'defenseHint', since: at } };
  }
  return startTransition(battle, events, 'enemy', at);
}

function withEnemy(battle: Battle, index: number, enemy: EnemyState): Battle {
  return {
    ...battle,
    enemies: battle.enemies.map((current, position) => (position === index ? enemy : current)),
  };
}

/** Sans la Charge (#266) : un ennemi relevé ou tombé repart de zéro. */
function withoutCharge(enemy: EnemyState): EnemyState {
  const { charge: _, ...rest } = enemy;
  return rest;
}

/** Un ennemi qui a un coup à Charge (#266) : le Bélier de bronze. */
function chargesOf(kind: EnemyKind): boolean {
  return ENEMIES[kind].moves.some(({ charge }) => charge === true);
}

/** Le retour en garde (C5.5) : une Charge brisée (#266) est perdue et repart de zéro. */
function restoredEnemy(enemy: EnemyState, percent: number): EnemyState {
  return withoutCharge(restoreGuard(enemy, percent));
}

/**
 * Le tour d'un ennemi étourdi (C5.4, C5.5) : son action perdue (250 ms), ou, si l'action du héros
 * qui suit la cassure est déjà passée, son retour en garde à sa place (400 ms). Ni l'un ni l'autre
 * n'est une action : pas de transition, et le camp du dernier acteur ne change pas.
 */
function stunTurn(
  battle: Battle,
  events: Events,
  enemy: number,
  stun: Stunned,
  at: number,
): Battle {
  const state = battle.enemies[enemy]!;
  if (isRestoreDue(stun, battle.heroActions)) {
    const until = at + GUARD_RESTORE_MS;
    events.push({ type: 'guardRestored', at, enemy, until, inPlaceOfAction: true });
    const restored = {
      ...restoredEnemy(state, heroModifiers(battle).guardRestorePercent ?? 100),
      intent: null,
      guardRestore: { since: at, until },
    };
    return {
      ...withEnemy(battle, enemy, restored),
      phase: { kind: 'enemy', step: { kind: 'guardRestore', enemy, since: at, until } },
    };
  }
  const until = at + LOST_ACTION_MS;
  events.push({ type: 'actionLost', at, enemy, until });
  return {
    ...withEnemy(battle, enemy, { ...state, stun: { ...stun, actionLost: true } }),
    phase: { kind: 'enemy', step: { kind: 'lostAction', enemy, since: at, until } },
  };
}

// ---------------------------------------------------------------------------------------------
// Déroulé

function endOffBalance(battle: Battle, events: Events): Battle {
  events.push({ type: 'offBalanceEnded', at: battle.offBalanceUntil! });
  return { ...battle, offBalanceUntil: null };
}

/** Le déséquilibre s'arrête (début d'une transition, fin du combat). */
function clearOffBalance(battle: Battle, events: Events, at: number): Battle {
  if (battle.offBalanceUntil === null) return battle;
  events.push({ type: 'offBalanceEnded', at });
  return { ...battle, offBalanceUntil: null };
}

/** La victoire : aucun ennemi debout et la réserve vide (P3b). */
function isWon(battle: Battle): boolean {
  return standingEnemies(battle).length === 0 && battle.reserve.length === 0;
}

/**
 * Le répit (C11) : +10 % des PV max à la victoire, sans dépasser le maximum ; depuis #244, le
 * pourcentage du palier (`Battle.respitePercent`), celui-ci restant celui d'un combat d'avant.
 */
export const RESPITE_PERCENT = 10;

function finish(battle: Battle, events: Events, outcome: BattleOutcome, at: number): Battle {
  // Le Saignement s'arrête à la fin du combat (B6), la Brûlure aussi, avant le répit (#171).
  if (battle.hero.burn !== undefined) events.push({ type: 'burnCleared', at });
  const { bleed: _, burn: __, ...hero } = battle.hero;
  let settled = clearOffBalance({ ...battle, hero }, events, at);
  if (outcome === 'victory') {
    const { hero } = settled;
    const percent = settled.respitePercent ?? RESPITE_PERCENT;
    const heroHp = Math.min(hero.maxHp, hero.hp + Math.floor((hero.maxHp * percent) / 100));
    events.push({ type: 'respite', at, gain: heroHp - hero.hp, heroHp });
    settled = { ...settled, hero: { ...hero, hp: heroHp } };
  }
  events.push({ type: 'battleEnded', at, outcome });
  return { ...settled, phase: { kind: 'over', outcome, at } };
}

function startTransition(battle: Battle, events: Events, to: PhaseDirection, at: number): Battle {
  const settled = clearOffBalance(battle, events, at);
  const until = at + PHASE_TRANSITION_MS;
  events.push({ type: 'phaseTransitionStarted', at, to, until });
  return { ...settled, phase: { kind: 'transition', to, since: at, until } };
}

/**
 * La fin de l'action du héros (C5.5, C12) : chaque ennemi étourdi qui a déjà perdu son action se
 * relève (le retour en garde se joue pendant ce qui suit), puis la victoire ou l'acteur suivant.
 */
function endHeroAction(battle: Battle, events: Events): Battle {
  const at = (battle.phase as { readonly until: number }).until;
  const enemies = battle.enemies.map((enemy, index) => {
    const { stun } = enemy;
    if (stun === null || !stun.actionLost || !isRestoreDue(stun, battle.heroActions)) return enemy;
    const until = at + GUARD_RESTORE_MS;
    events.push({ type: 'guardRestored', at, enemy: index, until, inPlaceOfAction: false });
    return {
      ...restoredEnemy(enemy, heroModifiers(battle).guardRestorePercent ?? 100),
      guardRestore: { since: at, until },
      // Un ennemi à Charge étourdi au début de la manche n'en agit pas, même sa garde revenue :
      // son Coup de bélier ne part jamais sans Charge (#266, CH1).
      ...(chargesOf(enemy.kind) && { intent: null }),
    };
  });
  const restored = { ...battle, enemies };
  if (isWon(restored)) return finish(restored, events, 'victory', at);
  return nextTurn(restored, events, at);
}

function startStepIn(battle: Battle, events: Events, enemy: number, at: number): Battle {
  const until = at + STEP_IN_MS;
  events.push({ type: 'stepInStarted', at, enemy, until });
  return {
    ...battle,
    lastPlayed: 'enemy',
    phase: { kind: 'enemy', step: { kind: 'stepIn', enemy, since: at, until } },
  };
}

function endTransition(battle: Battle, events: Events): Battle {
  const phase = battle.phase as Extract<BattlePhase, { kind: 'transition' }>;
  if (phase.to === 'hero') {
    events.push({ type: 'heroPhaseStarted', at: phase.until, announced: false });
    return { ...battle, phase: { kind: 'hero', since: phase.until, announced: false } };
  }
  // L'ennemi dont c'est le tour s'avance (C12).
  return startStepIn(
    battle,
    events,
    battle.turn.order[battle.turn.position] as number,
    phase.until,
  );
}

function enemyStep(battle: Battle): EnemyStep {
  return (battle.phase as Extract<BattlePhase, { kind: 'enemy' }>).step;
}

function withStep(battle: Battle, step: EnemyStep): Battle {
  return { ...battle, phase: { kind: 'enemy', step } };
}

function currentAttack(battle: Battle): AttackStep {
  return enemyStep(battle) as AttackStep;
}

/** Après l'avancée : l'attaque, ou l'effet de l'intention Garde, Relever, Exhumer ou Charge. */
function startEnemyAction(battle: Battle, events: Events): Battle {
  const { enemy, until: at } = enemyStep(battle) as StepInStep;
  const intent = battle.enemies[enemy]!.intent!;
  return intent.category === 'attack'
    ? startAttack(battle, events, enemy, intent, at)
    : startSupport(battle, events, enemy, intent, at);
}

function startAttack(
  battle: Battle,
  events: Events,
  enemy: number,
  intent: Extract<Intent, { category: 'attack' }>,
  at: number,
): Battle {
  const profile = ATTACKS[intent.attack];
  const impacts = profile.hitOffsetsMs.map((offset) => at + intent.windUpMs + offset);
  const feintAt = profile.feint ? at + Math.round(intent.windUpMs * intent.feintFraction) : null;
  // Le Coup de bélier d'une Charge (#266, CH3) : la Charge s'efface ici, plus rien ne l'annule.
  const state = battle.enemies[enemy]!;
  const charged = state.charge === 'charging';
  // La Nuée puis l'Aura (#268, D1 à D3) : lues ici, sur la ligne, pour tous les impacts du coup.
  const { damage, ...boosts } = boostedDamage(battle.enemies, enemy, intent.damage);
  events.push({
    type: 'windUpStarted',
    at,
    enemy,
    attack: intent.attack,
    impacts,
    feintAt,
    ...(charged && { charged: true as const }),
    ...boosts,
  });
  const started = charged ? withEnemy(battle, enemy, withoutCharge(state)) : battle;
  return withStep(started, {
    kind: 'attack',
    enemy,
    attack: intent.attack,
    damage,
    startedAt: at,
    feintAt,
    feintShown: false,
    impacts: impacts.map((impactAt) => ({
      at: impactAt,
      landed: false,
      lost: false,
      outcome: null,
    })),
    resolvedAt: missDeadline(impacts.at(-1)!, battle.inputOffset),
    counter: null,
    ...(intent.bleed && { bleed: intent.bleed }),
    ...(intent.burn !== undefined && { burn: intent.burn }),
    ...(charged && { charged: true as const }),
    ...boosts,
  });
}

/**
 * L'Exhumation (#258, X2) : un ennemi exhumé entre à la place fixée au tirage, aux valeurs du palier
 * des invoqués, jamais maudit ni d'escorte ; une place vide allonge la ligne, celle d'un tombé est
 * reprise. Il n'est pas dans l'ordre de la manche : il n'y agit pas.
 */
function exhume(battle: Battle, events: Events, enemy: number, slot: number, at: number): Battle {
  const kind = ENEMIES[battle.enemies[enemy]!.kind].exhume!.enemy;
  events.push({ type: 'enemyExhumed', at, enemy, slot, kind });
  const entering: EnemyState = {
    ...freshEnemy(kind, battle.summonMultiplier),
    summoned: true,
    exhumed: true,
    raisedRound: battle.round,
  };
  const enemies = [...battle.enemies];
  enemies[slot] = entering;
  return { ...battle, enemies };
}

/**
 * L'intention Garde (la garde remonte, sans dépasser son maximum), Relever (C2, C5.9), Exhumer
 * (#258) ou Charge (#266, CH2 : il charge, sans impact ni défense possible).
 */
function startSupport(
  battle: Battle,
  events: Events,
  enemy: number,
  intent: SupportIntent,
  at: number,
): Battle {
  let supported: Battle;
  if (intent.category === 'charge') {
    events.push({ type: 'chargeStarted', at, enemy });
    supported = withEnemy(battle, enemy, { ...battle.enemies[enemy]!, charge: 'charging' });
  } else if (intent.category === 'exhume') {
    supported = exhume(battle, events, enemy, intent.slot, at);
  } else if (intent.category === 'guard') {
    const state = battle.enemies[enemy]!;
    const guard = Math.min(state.maxGuard, state.guard + intent.gain);
    events.push({ type: 'guardRaised', at, enemy, gain: intent.gain, guard });
    supported = withEnemy(battle, enemy, { ...state, guard });
  } else {
    const ally = battle.enemies[intent.ally]!;
    const hp = raisedHp(ally.maxHp);
    events.push({ type: 'allyRaised', at, enemy, ally: intent.ally, hp });
    supported = withEnemy(battle, intent.ally, {
      ...restoreGuard(ally),
      hp,
      intent: null,
      raised: true,
      raisedRound: battle.round,
    });
  }
  return withStep(supported, {
    kind: 'support',
    enemy,
    intent,
    since: at,
    until: at + SUPPORT_ACTION_MS,
  });
}

function showFeint(battle: Battle, events: Events): Battle {
  const step = currentAttack(battle);
  events.push({ type: 'feintStarted', at: step.feintAt!, enemy: step.enemy });
  return withStep(battle, { ...step, feintShown: true });
}

function withImpact(step: AttackStep, index: number, impact: Partial<ImpactState>): AttackStep {
  return {
    ...step,
    impacts: step.impacts.map((current, position) =>
      position === index ? { ...current, ...impact } : current,
    ),
  };
}

function landImpact(battle: Battle, events: Events, index: number): Battle {
  const step = currentAttack(battle);
  const { at } = step.impacts[index]!;
  // Un impact qui tombe pendant le déséquilibre compte comme un coup raté (C9).
  const lost = isOffBalanceAt(battle, at);
  events.push({ type: 'impactLanded', at, enemy: step.enemy, index, lost });
  return withStep(battle, withImpact(step, index, { landed: true, lost }));
}

/** Le résultat d'un impact : dégâts au héros (le Rempart s'use), puis défaite s'il tombe. */
function resolveBlow(
  battle: Battle,
  events: Events,
  blow: {
    readonly index: number;
    readonly outcome: BlowOutcome;
    readonly button: DefenseButton | null;
    readonly delta: number | null;
    readonly damage: number;
    readonly at: number;
  },
): Battle {
  const step = currentAttack(battle);
  const heroHp = Math.max(0, battle.hero.hp - blow.damage);
  events.push({
    type: 'blowResolved',
    at: blow.at,
    enemy: step.enemy,
    index: blow.index,
    outcome: blow.outcome,
    button: blow.button,
    delta: blow.delta,
    damage: blow.damage,
    heroHp,
  });
  // Le Rempart s'use au premier impact qui fait des dégâts, et la riposte part à la fin du coup.
  const worn = battle.hero.bulwark && blow.damage > 0;
  if (worn) events.push({ type: 'bulwarkWorn', at: blow.at, enemy: step.enemy });
  // Brume s'use comme le Rempart, sans riposte (#235).
  const { mist, ...rest } = battle.hero;
  const misted = mist === true && blow.damage > 0;
  if (misted) events.push({ type: 'mistWorn', at: blow.at, enemy: step.enemy });
  const hero = {
    ...(misted ? rest : battle.hero),
    hp: heroHp,
    bulwark: battle.hero.bulwark && !worn,
  };
  const resolved = withStep(
    {
      ...battle,
      hero: burnOn(bleedOn(hero, step, blow.outcome, events, blow.at), step, blow, events),
    },
    {
      ...withImpact(step, blow.index, { outcome: blow.outcome }),
      ...(worn && heroProfile(battle).bulwarkCounter && { counter: bulwarkCounter(step) }),
    },
  );
  if (heroHp > 0) return resolved;
  return battle.hero.secondChance === 'ready'
    ? rise(resolved, events, blow.index, blow.at)
    : finish(resolved, events, 'defeat', blow.at);
}

/**
 * Le héros se relève grâce à sa seconde chance (#206) : 50 % de ses PV max, sans Brûlure ni
 * Saignement, l'Élan et le pouvoir actif gardés. Les impacts restants du coup sont annulés, puis le
 * combat reste en temps mort jusqu'à `until` ; la riposte du Rempart part ensuite.
 */
function rise(battle: Battle, events: Events, index: number, at: number): Battle {
  const step = currentAttack(battle);
  const until = at + SECOND_CHANCE_MS;
  const { bleed: _, burn, ...hero } = battle.hero;
  const hp = secondChanceHp(hero.maxHp);
  const cancelled = step.impacts.length - index - 1;
  events.push({ type: 'secondChanceUsed', at, until, enemy: step.enemy, hp, cancelled });
  if (burn !== undefined) events.push({ type: 'burnCleared', at });
  const { counter } = step;
  return withStep(
    { ...battle, hero: { ...hero, hp, secondChance: 'used' } },
    {
      ...step,
      impacts: step.impacts.slice(0, index + 1),
      resolvedAt: until,
      secondChance: { since: at, until },
      counter: counter === null ? null : { ...counter, at: until, until: until + COUNTER_MS },
    },
  );
}

/** La Riposte du Rempart (#128, R1) : à la fin du coup, quand aurait lieu une contre-attaque. */
function bulwarkCounter(step: AttackStep): CounterState {
  return { at: step.resolvedAt, until: step.resolvedAt + COUNTER_MS, done: false, by: 'bulwark' };
}

/** Un coup qui saigne fait saigner le héros encore debout, selon l'issue de l'impact (B1, B4). */
function bleedOn(
  hero: HeroState,
  step: AttackStep,
  outcome: BlowOutcome,
  events: Events,
  at: number,
): HeroState {
  if (step.bleed === undefined || hero.hp === 0 || !bleedsOn(outcome)) return hero;
  const bleed = mergeBleed(hero.bleed, step.bleed);
  events.push({ type: 'heroBleeding', at, ...bleed });
  return { ...hero, bleed };
}

/** La Brûlure d'un impact sur le héros encore debout (#171) : prise ou extinction. */
function burnOn(
  hero: HeroState,
  step: AttackStep,
  blow: { readonly outcome: BlowOutcome; readonly at: number },
  events: Events,
): HeroState {
  if (hero.hp === 0) return hero;
  const burnt = burnOnBlow(hero.burn, {
    ...blow,
    ...(step.burn !== undefined && { burn: step.burn }),
  });
  events.push(...burnt.events);
  return withBurn(hero, burnt.stacks);
}

/**
 * Les dégâts subis par le héros : réduction des dégâts (plafonnée à 40 %), puis le Rempart et Brume
 * (#235) s'ils sont actifs ; un seul arrondi.
 */
function heroDamage(battle: Battle, damage: number, ...percents: readonly number[]): number {
  const reduction =
    100 -
    Math.min(
      heroProfile(battle).damageReductionPercent + heroModifiers(battle).damageReductionPoints,
      MAX_DAMAGE_REDUCTION_PERCENT,
    );
  const bulwark = battle.hero.bulwark ? [BULWARK_DAMAGE_PERCENT] : [];
  const mist = battle.hero.mist ? [POWERS.mist.damageTakenPercent!] : [];
  return scaleDamage(damage, ...percents, reduction, ...bulwark, ...mist);
}

function sufferImpact(battle: Battle, events: Events, index: number): Battle {
  const step = currentAttack(battle);
  const impactAt = step.impacts[index]!.at;
  const suffered = resolveBlow(battle, events, {
    index,
    outcome: 'suffered',
    button: null,
    delta: null,
    damage: heroDamage(battle, step.damage),
    at: missDeadline(impactAt, battle.inputOffset),
  });
  const lateUntil = lateToleranceEnd(impactAt, battle.inputOffset);
  return { ...suffered, sufferedImpact: { at: impactAt, lateUntil } };
}

/**
 * Un coup du héros à un ennemi (frappe ou contre-attaque), pendant son action `heroActions` : il
 * perd ses PV et sa garde ; à 0 PV il tombe, et la cible passe au premier ennemi debout (C4) ; à
 * 0 de garde, c'est la cassure, avec l'arrêt sur image (C5.1).
 */
function hitEnemy(
  battle: Battle,
  events: Events,
  index: number,
  blow: EnemyBlow,
  context: { readonly at: number; readonly by: GuardBreaker },
): { readonly battle: Battle; readonly broken: boolean } {
  const before = battle.enemies[index]!;
  const hit = blowOnEnemy(before, blow, battle.heroActions);
  const revived = hit.fallen ? selfRevive(hit.enemy, ENEMIES[hit.enemy.kind]) : null;
  if (revived !== null) {
    return { battle: reviveSelf(battle, events, index, revived, context.at), broken: false };
  }
  // Une Charge brisée (#266, CH4), quel qu'en soit l'auteur : l'ennemi lu avant le coup charge, ou
  // a l'intention Charge sans avoir encore agi. Tombé, il n'en garde aucune (CH6).
  const breaksCharge =
    hit.broken && (before.charge === 'charging' || before.intent?.category === 'charge');
  const struck: EnemyState = hit.fallen
    ? withoutCharge(hit.enemy)
    : breaksCharge
      ? { ...hit.enemy, charge: 'broken' }
      : hit.enemy;
  const damaged = shiftPhase(withEnemy(battle, index, struck), events, index, context.at);
  if (hit.broken) {
    events.push({ type: 'guardBroken', at: context.at, enemy: index, by: context.by });
    if (breaksCharge) events.push({ type: 'chargeBroken', at: context.at, enemy: index });
    return { battle: onGuardBreak(damaged, events, context.at), broken: true };
  }
  if (!hit.fallen) return { battle: damaged, broken: false };
  events.push({ type: 'enemyDefeated', at: context.at, enemy: index });
  const settled = fallWithSummoner(damaged, events, index, context.at);
  const [next] = standingEnemies(settled);
  if (battle.target !== index || next === undefined) return { battle: settled, broken: false };
  events.push({ type: 'targetChanged', at: context.at, enemy: next });
  return { battle: { ...settled, target: next }, broken: false };
}

/**
 * La chute avec celui qui appelle (#172, règle 4 ; #258, X4) : quand tombe un boss qui invoque ou
 * le Fossoyeur, chaque ennemi invoqué encore debout tombe avec lui, sans Or, et une Invocation
 * encore annoncée n'entre jamais. Un seul ennemi appelle par combat.
 */
function fallWithSummoner(battle: Battle, events: Events, index: number, at: number): Battle {
  if (summonedKind(battle.enemies[index]!.kind) === null) return battle;
  const { summon: _, ...rest } = battle;
  const enemies = battle.enemies.map((enemy, place) => {
    if (enemy.summoned !== true || !isStanding(enemy)) return enemy;
    events.push({ type: 'summonedFell', at, enemy: place });
    return { ...enemy, hp: 0 };
  });
  return { ...rest, enemies };
}

/**
 * L'ennemi se relève seul (#106) : ni chute ni cassure (S3, S4), la remontée du retour en garde
 * (R2). S'il n'a pas encore agi dans la manche, il n'y agit pas (S2).
 */
function reviveSelf(
  battle: Battle,
  events: Events,
  index: number,
  enemy: EnemyState,
  at: number,
): Battle {
  events.push({ type: 'enemySelfRevived', at, enemy: index, hp: enemy.hp });
  const guardRestore = { since: at, until: at + GUARD_RESTORE_MS, cause: 'selfRevive' as const };
  const revived = { ...enemy, guardRestore };
  const { order, position } = battle.turn;
  const pending = order.indexOf(index, position + 1);
  if (pending < 0) return withEnemy(battle, index, revived);
  return {
    ...withEnemy(battle, index, { ...revived, raisedRound: battle.round }),
    turn: { order: order.filter((_, place) => place !== pending), position },
  };
}

/** Cœur de braise (prototype #92) : à chaque garde brisée, l'Élan gagné et les PV rendus. */
function onGuardBreak(battle: Battle, events: Events, at: number): Battle {
  const { momentum, heal } = heroModifiers(battle).onGuardBreak;
  let gained = battle;
  for (let point = 0; point < momentum; point += 1) gained = gainMomentumAt(gained, events, at);
  const { hero } = gained;
  return { ...gained, hero: { ...hero, hp: Math.min(hero.maxHp, hero.hp + heal) } };
}

/**
 * Le changement de phase d'un boss (P6, #38) : à 50 % de ses PV max ou moins (150 de 300, 210 de
 * 420), une fois ; sa garde revient à son maximum s'il n'est pas étourdi (sinon à son retour en
 * garde). L'ordre de la manche ne change pas. Un boss qui invoque annonce son Invocation (#172).
 */
function shiftPhase(battle: Battle, events: Events, index: number, at: number): Battle {
  const enemy = battle.enemies[index]!;
  const { phaseShiftPercent, phase2Summon } = ENEMIES[enemy.kind];
  if (phaseShiftPercent === undefined || enemy.phase2 || enemy.hp === 0) return battle;
  if (enemy.hp > scaleByPercent(enemy.maxHp, phaseShiftPercent)) return battle;
  events.push({ type: 'bossPhaseShifted', at, enemy: index });
  const guard = enemy.stun === null ? enemy.maxGuard : enemy.guard;
  const shifted = withEnemy(battle, index, { ...enemy, phase2: true, guard });
  if (phase2Summon === undefined) return shifted;
  // Les places libres, comptées une seule fois, ici (règle 6) : sans place, rien n'est appelé.
  const slots = freeSlots(shifted.enemies, phase2Summon.count);
  if (slots.length === 0) return shifted;
  events.push({ type: 'summonCalled', at, enemy: index, kind: phase2Summon.enemy, slots });
  return { ...shifted, summon: { summoner: index, kind: phase2Summon.enemy, slots } };
}

/**
 * La contre-attaque, ou la Riposte du Rempart (#128, R4, R5) : sur l'ennemi qui a porté le coup,
 * sans Élan ; une cassure, une chute ou une victoire suivent les règles d'une frappe.
 */
function counterAttack(battle: Battle, events: Events): Battle {
  const step = currentAttack(battle);
  const counter = step.counter!;
  const hero = heroProfile(battle);
  const modifiers = heroModifiers(battle);
  // Le Sanctuaire (#259, S1), lu avant le coup : la contre-attaque et la Riposte aussi.
  const warded = sanctuaryPercents(battle.enemies[step.enemy]!);
  const input = {
    attackPower: heroAttack(hero.attackPower, modifiers),
    guardDamage: hero.guardDamage,
    counterPercent: hero.counterPercent,
    stunned: battle.enemies[step.enemy]!.stun !== null,
    attackPercents: [...modifiers.attackPercents, ...warded],
    guardPercents: modifiers.guardDamagePercents,
    counterPercents: modifiers.counterPercents,
    stunnedBonusPercent: modifiers.stunnedBonusPercent,
  };
  const riposte = counter.by === 'bulwark';
  // Représailles renforce une contre-attaque ordinaire seulement, jamais la riposte (#235).
  const { retaliation, ...rest } = battle.hero;
  const retaliated = !riposte && retaliation === true;
  const blow = riposte
    ? bulwarkCounterBlow({ ...input, ...hero.bulwarkCounter! })
    : counterBlow({
        ...input,
        ...(retaliated && {
          hpPercent: POWERS.retaliation.counterHpPercent!,
          guardPercent: POWERS.retaliation.counterGuardPercent!,
        }),
      });
  events.push({
    type: riposte ? 'bulwarkCountered' : 'counterAttacked',
    at: counter.at,
    enemy: step.enemy,
    damage: blow.hp,
    guardDamage: blow.guard,
    until: counter.until,
    ...(retaliated && { retaliation: true as const }),
    ...(warded.length > 0 && { sanctuary: true as const }),
  });
  const countered = withStep(retaliated ? { ...battle, hero: rest } : battle, {
    ...step,
    counter: { ...counter, done: true },
  });
  const by = riposte ? 'bulwarkCounter' : 'counter';
  const hit = hitEnemy(countered, events, step.enemy, blow, { at: counter.at, by });
  return hit.broken ? startHitStop(hit.battle, events, counter.at) : hit.battle;
}

function attackEnd(step: AttackStep): number {
  return Math.max(step.resolvedAt, step.counter?.until ?? step.resolvedAt);
}

/** La fin du tour d'un ennemi : la victoire (une contre-attaque a fait tomber le dernier), ou la suite. */
function endEnemyStep(battle: Battle, events: Events): Battle {
  const step = enemyStep(battle);
  const at = step.kind === 'attack' ? attackEnd(step) : (step as { readonly until: number }).until;
  if (isWon(battle)) return finish(battle, events, 'victory', at);
  return nextTurn(battle, events, at);
}

// ---------------------------------------------------------------------------------------------
// Commandes du joueur

function ignored(
  update: BattleUpdate,
  at: number,
  button: PlayerButton,
  reason: IgnoredReason,
): BattleUpdate {
  return {
    battle: update.battle,
    events: [...update.events, { type: 'pressIgnored', at, button, reason }],
  };
}

function startOffBalance(battle: Battle, events: Events, at: number): Battle {
  const until = at + OFF_BALANCE_MS;
  events.push({ type: 'offBalanceStarted', at, until });
  return { ...battle, offBalanceUntil: until };
}

function whiff(
  battle: Battle,
  events: Events,
  button: DefenseButton,
  reason: WhiffReason,
  at: number,
  delta?: number,
): Battle {
  events.push({ type: 'whiffed', at, button, reason, ...(delta !== undefined && { delta }) });
  return startOffBalance(battle, events, at);
}

/**
 * L'arrêt sur image (parade parfaite, frappe parfaite, cassure) : le temps du combat s'arrête,
 * toutes les échéances qui suivent sont décalées. Une seule fois par instant : chaque cas ne
 * l'appelle qu'une fois (une frappe parfaite qui brise la garde n'en lance qu'un).
 */
function startHitStop(battle: Battle, events: Events, at: number): Battle {
  const until = at + HIT_STOP_MS;
  events.push({ type: 'hitStopStarted', at, until });
  const later = (instant: number) => (instant >= at ? instant + HIT_STOP_MS : instant);
  const { sufferedImpact } = battle;
  const stopped = {
    ...battle,
    hitStop: { at, until },
    ...(sufferedImpact && {
      sufferedImpact: { ...sufferedImpact, lateUntil: later(sufferedImpact.lateUntil) },
    }),
  };
  const { phase } = battle;
  if (phase.kind === 'heroStrike') {
    return {
      ...stopped,
      phase: { ...phase, impactAt: later(phase.impactAt), until: later(phase.until) },
    };
  }
  const step = currentAttack(battle);
  return withStep(stopped, {
    ...step,
    feintAt: step.feintAt === null ? null : later(step.feintAt),
    impacts: step.impacts.map((impact) => ({ ...impact, at: later(impact.at) })),
    resolvedAt: later(step.resolvedAt),
    counter:
      step.counter === null
        ? null
        : { ...step.counter, at: later(step.counter.at), until: later(step.counter.until) },
  });
}

function gainMomentumAt(battle: Battle, events: Events, at: number): Battle {
  const momentum = gainMomentum(battle.hero.momentum);
  if (momentum === battle.hero.momentum) return battle;
  events.push({ type: 'momentumChanged', at, momentum });
  return { ...battle, hero: { ...battle.hero, momentum } };
}

/** L'impact à juger : le premier du coup en cours encore à résoudre et pas perdu, sinon -1. */
function pendingImpact(battle: Battle): number {
  if (battle.phase.kind !== 'enemy') return -1;
  const { step } = battle.phase;
  if (step.kind !== 'attack') return -1;
  return step.impacts.findIndex((impact) => impact.outcome === null && !impact.lost);
}

/**
 * L'écart d'un appui « trop tard » sur le dernier impact subi (#207), sinon `null` : jusqu'à
 * 150 ms après sa fenêtre de parade, plus les arrêts sur image, même pendant l'avancée suivante ou
 * la transition de phase. Un appui daté au début d'un arrêt sur image lancé quand l'impact est
 * subi (écart 160 ms) en fait partie. Sur une double frappe, l'appui est jugé contre l'impact le
 * plus proche ; à égalité, celui à venir.
 */
function lateDelta(battle: Battle, at: number): number | null {
  const { sufferedImpact, phase, inputOffset, hitStop } = battle;
  if (sufferedImpact === undefined || at > sufferedImpact.lateUntil) return null;
  if (phase.kind !== 'enemy' && phase.kind !== 'transition') return null;
  const delta = pressDelta(at, inputOffset, sufferedImpact.at);
  const datedAtHitStop = delta === PARRY_WINDOW_MS && hitStop?.at === at;
  if (delta <= PARRY_WINDOW_MS && !datedAtHitStop) return null;
  const index = pendingImpact(battle);
  if (index < 0) return delta;
  const next = pressDelta(at, inputOffset, currentAttack(battle).impacts[index]!.at);
  return delta < Math.abs(next) ? delta : null;
}

function judgeDefense(battle: Battle, events: Events, button: DefenseButton, at: number): Battle {
  const late = lateDelta(battle, at);
  if (late !== null) return whiff(battle, events, button, 'late', at, late);
  const index = pendingImpact(battle);
  if (index < 0) return whiff(battle, events, button, 'empty', at);
  const step = currentAttack(battle);

  const delta = pressDelta(at, battle.inputOffset, step.impacts[index]!.at);
  const judgement = judgePress(delta);
  if (judgement === 'miss') {
    return whiff(battle, events, button, delta < 0 ? 'early' : 'late', at, delta);
  }

  const blow = { index, button, delta, at };
  if (button === 'dodge' && ATTACKS[step.attack].sweep) {
    // Une esquive sur un Balayage échoue : dégâts entiers et déséquilibre (#266, SW3), sans les
    // suites d'une esquive (SW5).
    return failDefense(battle, events, { ...blow, outcome: 'sweepDodge' });
  }
  if (button === 'dodge') {
    return afterDodge(
      resolveBlow(battle, events, { ...blow, outcome: 'dodge', damage: 0 }),
      events,
      at,
    );
  }
  if (ATTACKS[step.attack].perilous) {
    // Une parade sur un coup imparable échoue : dégâts entiers et déséquilibre (C8).
    return failDefense(battle, events, { ...blow, outcome: 'perilousParry' });
  }
  if (judgement === 'good') {
    return resolveBlow(battle, events, {
      ...blow,
      outcome: 'parry',
      damage: heroDamage(battle, step.damage, GOOD_PARRY_PERCENT),
    });
  }
  const parried = startHitStop(
    gainMomentumAt(
      healOnPerfectParry(
        resolveBlow(battle, events, { ...blow, outcome: 'perfectParry', damage: 0 }),
      ),
      events,
      at,
    ),
    events,
    at,
  );
  const attack = currentAttack(parried);
  if (!attack.impacts.every((impact) => impact.outcome === 'perfectParry')) return parried;
  // Tous les impacts parés parfaitement : contre-attaque, à la fin de l'arrêt sur image (C8).
  const counterAt = at + HIT_STOP_MS;
  return withStep(parried, {
    ...attack,
    counter: { at: counterAt, until: counterAt + COUNTER_MS, done: false },
  });
}

/**
 * Une défense qui échoue (C8 ; #266, SW3) : la parade sur un coup imparable ou l'esquive sur un
 * Balayage, dégâts entiers puis déséquilibre ; pas de déséquilibre si le combat est fini.
 */
function failDefense(
  battle: Battle,
  events: Events,
  blow: {
    readonly index: number;
    readonly outcome: 'perilousParry' | 'sweepDodge';
    readonly button: DefenseButton;
    readonly delta: number;
    readonly at: number;
  },
): Battle {
  const { damage } = currentAttack(battle);
  const hurt = resolveBlow(battle, events, { ...blow, damage: heroDamage(battle, damage) });
  return hurt.phase.kind === 'over' ? hurt : startOffBalance(hurt, events, blow.at);
}

/**
 * Le soin de parade parfaite (Bouclier du veilleur, prototype #93 ; Gelée blanche, Givre du
 * clocher) : des PV rendus, sans dépasser les PV max ni le plafond de soin de parade (#244, R4).
 * Seul le gain réel compte dans le plafond.
 */
function healOnPerfectParry(battle: Battle): Battle {
  const { hero } = battle;
  const healed = hero.parryHealed ?? 0;
  const gain = cappedParryHeal({
    hp: hero.hp,
    maxHp: hero.maxHp,
    heal: heroModifiers(battle).healOnPerfectParry,
    healed,
  });
  if (gain === 0) return battle;
  return { ...battle, hero: { ...hero, hp: hero.hp + gain, parryHealed: healed + gain } };
}

/**
 * Après une esquive (prototype #90) : le trait de l'Errante (+1 Élan), puis Pas de l'ombre, qui
 * contre-attaque quand tous les impacts du coup sont esquivés (P11) et prend fin.
 */
function afterDodge(battle: Battle, events: Events, at: number): Battle {
  const dodged = heroProfile(battle).dodgeMomentum ? gainMomentumAt(battle, events, at) : battle;
  const attack = currentAttack(dodged);
  if (dodged.hero.shadowStep !== true) return dodged;
  if (!attack.impacts.every((impact) => impact.outcome === 'dodge')) return dodged;
  return withStep(
    { ...dodged, hero: { ...dodged.hero, shadowStep: false } },
    { ...attack, counter: { at, until: at + COUNTER_MS, done: false } },
  );
}

/** L'instant d'un appui : jamais avant l'état du moteur ; pendant un arrêt sur image, son début. */
function datePress(battle: Battle, at: number): number {
  if (battle.hitStop !== null && at < battle.hitStop.until && at >= battle.hitStop.at) {
    return battle.hitStop.at;
  }
  return Math.max(at, battle.now);
}

/**
 * Le temps mort à l'instant `at`, où un toucher est ignoré sans effet : la transition de phase ou
 * la bulle d'aide (C12), ou le relèvement de la seconde chance (#206) ; `null` hors temps mort.
 */
function deadTime(battle: Battle, at: number): 'phaseTransition' | 'secondChance' | null {
  const { phase } = battle;
  if (phase.kind === 'transition' || phase.kind === 'defenseHint') return 'phaseTransition';
  const rising = phase.kind === 'enemy' && phase.step.kind === 'attack' && phase.step.secondChance;
  return rising && at < rising.until ? 'secondChance' : null;
}

/**
 * Un appui sur « Parade » ou « Esquive », daté à l'instant du toucher (C7, C9, C12). Il est
 * ignoré pendant une transition de phase ou le relèvement de la seconde chance (#206), sans
 * déséquilibre ni mémoire, et relance le déséquilibre en cours. Hors d'une fenêtre de parade,
 * c'est un appui raté ; dans la tolérance « trop tard » d'un impact subi, il est trop tard, même
 * pendant l'avancée suivante ou la transition (#207).
 */
export function pressDefense(
  battle: Battle,
  { button, at }: { readonly button: DefenseButton; readonly at: number },
): BattleUpdate {
  const pressedAt = datePress(battle, at);
  const advanced = advance(battle, pressedAt);
  // Le relèvement de la seconde chance prime sur tout (#206) ; la tolérance « trop tard » prime
  // sur le temps mort de la transition de phase (#207).
  const dead = deadTime(advanced.battle, pressedAt);
  if (dead === 'secondChance') return ignored(advanced, pressedAt, button, dead);
  const late = lateDelta(advanced.battle, pressedAt) !== null;
  if (!late && dead !== null) return ignored(advanced, pressedAt, button, dead);
  if (!late && advanced.battle.phase.kind !== 'enemy') {
    return ignored(advanced, pressedAt, button, 'notAvailable');
  }
  const events = [...advanced.events];
  if (isOffBalanceAt(advanced.battle, pressedAt)) {
    // Marteler prolonge : l'appui est ignoré et le déséquilibre repart de lui (C9).
    events.push({ type: 'pressIgnored', at: pressedAt, button, reason: 'offBalance' });
    return { battle: startOffBalance(advanced.battle, events, pressedAt), events };
  }
  return { battle: judgeDefense(advanced.battle, events, button, pressedAt), events };
}

/**
 * La frappe en rythme résolue à l'instant `at` (C6) : PV et garde retirés selon le multiplicateur
 * de frappe et l'étourdissement ; arrêt sur image pour une frappe parfaite ou une cassure.
 */
function resolveStrike(battle: Battle, events: Events, at: number): Battle {
  const phase = battle.phase as StrikePhase;
  const hero = heroProfile(battle);
  const profile = strikeProfile(battle, phase);
  const hit = phase.hit ?? 1;
  const judgement = phase.press?.judgement ?? null;
  const modifiers = heroModifiers(battle);
  const rend = phase.rend === true;
  // L'ennemi lu avant le coup (#259, T2, S3) : le Sanctuaire et les Épines.
  const target = battle.enemies[phase.enemy]!;
  const warded = sanctuaryPercents(target);
  const blow = strikeBlow({
    attackPower: heroAttack(hero.attackPower, modifiers),
    guardDamage: hero.guardDamage,
    judgement,
    perfectBonusPercents: modifiers.perfectStrikeBonusPercents,
    stunned: target.stun !== null,
    attackPercents: [...modifiers.attackPercents, profile.hpPercent, ...warded],
    guardPercents: [
      ...modifiers.guardDamagePercents,
      ...(rend ? [POWERS.rend.guardPercentNextStrike!] : []),
      profile.guardPercent,
    ],
    stunnedBonusPercent: modifiers.stunnedBonusPercent,
  });
  events.push({
    type: 'strikeResolved',
    at,
    enemy: phase.enemy,
    judgement,
    delta: phase.press?.delta ?? null,
    damage: blow.hp,
    guardDamage: blow.guard,
    ...(profile.hits > 1 && { hit }),
    ...(rend && { rend }),
    ...(phase.power !== undefined && { power: phase.power }),
    ...(warded.length > 0 && { sanctuary: true as const }),
  });
  const struck = hitEnemy(
    { ...battle, phase: { ...phase, resolved: true } },
    events,
    phase.enemy,
    blow,
    { at, by: 'strike' },
  );
  // Une fois par frappe, au 1er coup (T1) : la cible ne change pas pendant une frappe.
  const pricked =
    hit === 1 && thornsActive(target)
      ? prick(struck.battle, events, phase.enemy, at)
      : struck.battle;
  const stopped = judgement === 'perfect' || struck.broken;
  const resolved = stopped ? startHitStop(pricked, events, at) : pricked;
  if (hit >= profile.hits || !isStanding(resolved.enemies[phase.enemy]!)) return resolved;
  // Le coup suivant (les Dagues jumelles, une frappe de pouvoir), décalé par l'arrêt sur image ;
  // perdu si la cible tombe.
  const impactAt = phase.impactAt + profile.intervalMs + (stopped ? HIT_STOP_MS : 0);
  return startStrike(resolved, events, {
    enemy: phase.enemy,
    at,
    impactAt,
    hit: hit + 1,
    rend,
    ...strikeOf(phase),
  });
}

/**
 * Les Épines de l'ennemi `enemy` (#259, T4) : le héros paie après le coup, jamais sous 1 PV, à côté
 * de la réduction des dégâts, du Rempart et de Brume, qu'elles n'usent pas. Dites même sans perte.
 */
function prick(battle: Battle, events: Events, enemy: number, at: number): Battle {
  const { hero } = battle;
  const loss = thornsLoss(hero.hp, ENEMIES[battle.enemies[enemy]!.kind].thorns!);
  const heroHp = hero.hp - loss;
  events.push({ type: 'thornsPricked', at, enemy, loss, heroHp });
  return { ...battle, hero: { ...hero, hp: heroHp } };
}

/** La frappe de pouvoir d'une frappe en rythme (#236) : son pouvoir et Frappe furtive. */
interface PowerStrikeSpec {
  readonly power?: PowerStrikeKind;
  readonly ambush?: true;
}

function strikeOf({ power, ambush }: PowerStrikeSpec): PowerStrikeSpec {
  return { ...(power !== undefined && { power }), ...(ambush && { ambush }) };
}

/** Le profil d'une frappe en rythme : ses coups, leur écart et ses parts de PV et de Brise-garde. */
export interface StrikeProfile {
  readonly hits: number;
  readonly intervalMs: number;
  readonly hpPercent: number;
  readonly guardPercent: number;
}

/**
 * Le profil de la frappe en rythme `phase` (#236), seule lecture : sans pouvoir, celui
 * d'« Attaquer » (les coups du héros, 100 % et 100 %) ; une frappe de pouvoir prend ses coups (à la
 * place des Dagues jumelles), à 300 ms d'écart, et ses parts ; Frappe furtive jugée au lancer, ses
 * 250 % à la place de ses 100 %.
 */
export function strikeProfile(battle: Battle, { power, ambush }: PowerStrikeSpec): StrikeProfile {
  if (power === undefined) {
    const { hits, hitIntervalMs } = heroProfile(battle);
    return { hits, intervalMs: hitIntervalMs, hpPercent: 100, guardPercent: 100 };
  }
  const profile = POWERS[power];
  return {
    hits: profile.strikeHits!,
    intervalMs: POWER_STRIKE_INTERVAL_MS,
    hpPercent: ambush === true ? profile.ambushHpPercent! : profile.strikeHpPercent!,
    guardPercent: profile.strikeGuardPercent!,
  };
}

/** Un coup de la frappe en rythme commence : son impact, et sa récupération après la fenêtre. */
function startStrike(
  battle: Battle,
  events: Events,
  {
    enemy,
    at,
    impactAt,
    hit,
    rend,
    ...spec
  }: {
    readonly enemy: number;
    readonly at: number;
    readonly impactAt: number;
    readonly hit: number;
    readonly rend: boolean;
  } & PowerStrikeSpec,
): Battle {
  const until = missDeadline(impactAt, battle.inputOffset) + STRIKE_RECOVERY_MS;
  const multiple = strikeProfile(battle, spec).hits > 1;
  const power = strikeOf(spec);
  events.push({
    type: 'strikeStarted',
    at,
    enemy,
    impactAt,
    until,
    ...(multiple && { hit }),
    ...(power.power !== undefined && { power: power.power }),
  });
  return {
    ...battle,
    phase: {
      kind: 'heroStrike',
      enemy,
      since: at,
      impactAt,
      press: null,
      resolved: false,
      until,
      ...(multiple && { hit }),
      ...(rend && { rend: true as const }),
      ...power,
    },
  };
}

/**
 * Un appui sur « Frapper », daté à l'instant du toucher (C6.1) : seul le premier appui de la
 * frappe compte. Avant l'impact, il est jugé à l'impact ; après, aussitôt. Il ne déséquilibre
 * jamais.
 */
export function pressStrike(battle: Battle, { at }: { readonly at: number }): BattleUpdate {
  const pressedAt = datePress(battle, at);
  const advanced = advance(battle, pressedAt);
  const { phase } = advanced.battle;
  const dead = deadTime(advanced.battle, pressedAt);
  if (dead !== null) return ignored(advanced, pressedAt, 'strike', dead);
  if (phase.kind !== 'heroStrike' || phase.resolved || phase.press !== null) {
    return ignored(advanced, pressedAt, 'strike', 'notAvailable');
  }
  const delta = pressDelta(pressedAt, advanced.battle.inputOffset, phase.impactAt);
  const pressed = {
    ...advanced.battle,
    phase: { ...phase, press: { at: pressedAt, delta, judgement: judgeStrike(delta) } },
  };
  const events = [...advanced.events];
  if (pressedAt < phase.impactAt) return { battle: pressed, events };
  return { battle: resolveStrike(pressed, events, pressedAt), events };
}

/** L'action du héros commence : elle compte pour C5.3, et le héros est le dernier à jouer. */
function startHeroAction(battle: Battle, phase: BattlePhase): Battle {
  return { ...battle, phase, heroActions: battle.heroActions + 1, lastPlayed: 'hero' };
}

/**
 * La frappe en rythme (`TimedStrike`) commence sur `enemy` : son premier coup, après la
 * préparation. Toute frappe en rythme du héros part d'ici (#235) : Entaille, en attente, passe du
 * héros à la frappe, qui la consomme.
 */
function startTimedStrike(
  battle: Battle,
  events: Events,
  { enemy, at, ...spec }: { readonly enemy: number; readonly at: number } & PowerStrikeSpec,
): Battle {
  const { rend, ...hero } = battle.hero;
  return startStrike(rend ? { ...battle, hero } : battle, events, {
    enemy,
    at,
    impactAt: at + STRIKE_WIND_UP_MS,
    hit: 1,
    rend: rend === true,
    ...strikeOf(spec),
  });
}

function attack(battle: Battle, events: Events, at: number): Battle {
  const struck = startTimedStrike(battle, events, { enemy: battle.target, at });
  return gainMomentumAt(startHeroAction(struck, struck.phase), events, at);
}

/**
 * Tenir bon (#235) : 20 % des PV max rendus (entier inférieur, au moins 1, sans dépasser le
 * maximum ; 0 à PV max), la Brûlure éteinte, le Saignement arrêté ; une fois par combat.
 */
function holdFast(hero: HeroState, events: Events, at: number): HeroState {
  const { healMaxHpPercent, healMin } = POWERS.holdFast;
  const heal = Math.min(
    hero.maxHp - hero.hp,
    Math.max(healMin!, Math.floor((hero.maxHp * healMaxHpPercent!) / 100)),
  );
  const { burn, bleed, ...rest } = hero;
  events.push({ type: 'heroHealed', at, power: 'holdFast', heal, heroHp: hero.hp + heal });
  if (burn !== undefined) events.push({ type: 'burnCleared', at });
  if (bleed !== undefined) events.push({ type: 'bleedStopped', at });
  return { ...rest, hp: hero.hp + heal, spent: [...(hero.spent ?? []), 'holdFast'] };
}

/**
 * L'effet d'un pouvoir lancé sur le héros : sa charge posée, ou le soin de Tenir bon (#235). Une
 * frappe de pouvoir (#236) n'arrive jamais ici : elle n'a pas de charge.
 */
function powerEffect(
  hero: HeroState,
  power: Exclude<PowerKind, PowerStrikeKind>,
  events: Events,
  at: number,
): HeroState {
  switch (power) {
    case 'bulwark':
      return { ...hero, bulwark: true };
    case 'shadowStep':
      return { ...hero, shadowStep: true };
    case 'retaliation':
      return { ...hero, retaliation: true };
    case 'mist':
      return { ...hero, mist: true };
    case 'rend':
      return { ...hero, rend: true };
    case 'holdFast':
      return holdFast(hero, events, at);
  }
}

/**
 * Une frappe de pouvoir (#236, PW5) : son Élan (attisé compris), puis la frappe en rythme sur la
 * cible, qui consomme Entaille, et l'action du héros (C5.3) ; sans le +1 Élan d'une attaque.
 * Frappe furtive est jugée ici, une fois : la cible a encore sa case dans l'ordre après le héros.
 */
function launchPowerStrike(
  battle: Battle,
  events: Events,
  power: PowerStrikeKind,
  at: number,
): Battle {
  const momentum = battle.hero.momentum - powerCost(battle, power);
  const { target, turn } = battle;
  const ambush = power === 'ambush' && turn.order.indexOf(target, turn.position + 1) >= 0;
  const strikeEvents: Events = [];
  const struck = startTimedStrike({ ...battle, hero: { ...battle.hero, momentum } }, strikeEvents, {
    enemy: target,
    at,
    power,
    ...(ambush && { ambush }),
  });
  const { until } = struck.phase as StrikePhase;
  events.push({ type: 'powerUsed', at, power, until });
  events.push({ type: 'momentumChanged', at, momentum });
  events.push(...strikeEvents);
  return startHeroAction(struck, struck.phase);
}

/**
 * Un pouvoir : il coûte son Élan. Un pouvoir instantané (#173) n'est pas une action : la phase du
 * héros continue, sans durée d'action ni transition, et le héros choisit encore son action.
 */
function activatePower(
  battle: Battle,
  events: Events,
  { power, phase }: { readonly power: PowerKind; readonly phase: HeroPhase },
  at: number,
): Battle {
  if (isPowerStrike(power)) return launchPowerStrike(battle, events, power, at);
  const { instant } = POWERS[power];
  const until = instant ? at : at + HERO_ACTION_MS;
  const momentum = battle.hero.momentum - powerCost(battle, power);
  events.push({ type: 'powerUsed', at, power, until, ...(instant && { instant }) });
  events.push({ type: 'momentumChanged', at, momentum });
  const hero = powerEffect({ ...battle.hero, momentum }, power, events, at);
  if (instant) return { ...battle, hero, phase: { ...phase, instantPowerUsed: true } };
  return startHeroAction({ ...battle, hero }, { kind: 'heroPower', power, since: at, until });
}

/**
 * Une action de la phase du héros (C3, C4) : viser un ennemi, « Attaquer » (la frappe en rythme
 * commence) ou un pouvoir, s'il reste assez d'Élan. Elle se valide au relâcher (`releasedAt`),
 * seulement si le toucher a commencé dans la phase du héros (C12).
 */
export function heroAction(
  battle: Battle,
  {
    action,
    touchStartedAt,
    releasedAt,
  }: { readonly action: HeroAction; readonly touchStartedAt: number; readonly releasedAt: number },
): BattleUpdate {
  const at = Math.max(releasedAt, battle.now);
  const advanced = advance(battle, at);
  const { phase } = advanced.battle;
  const dead = deadTime(advanced.battle, at);
  if (dead !== null) return ignored(advanced, at, action.kind, dead);
  if (phase.kind !== 'hero') return ignored(advanced, at, action.kind, 'notAvailable');
  if (touchStartedAt < phase.since) return ignored(advanced, at, action.kind, 'touchTooEarly');

  const events = [...advanced.events];
  const current = advanced.battle;
  switch (action.kind) {
    case 'target': {
      const enemy = current.enemies[action.enemy];
      if (enemy === undefined || !isStanding(enemy)) {
        return ignored(advanced, at, 'target', 'notAvailable');
      }
      if (action.enemy !== current.target) {
        events.push({ type: 'targetChanged', at, enemy: action.enemy });
      }
      return { battle: { ...current, target: action.enemy }, events };
    }
    case 'power':
      // Un pouvoir équipé et disponible (#235) : assez d'Élan, pas actif, un instantané par phase.
      if (powerAvailability(current, action.power).kind !== 'available') {
        return ignored(advanced, at, 'power', 'notAvailable');
      }
      return {
        battle: activatePower(current, events, { power: action.power, phase }, at),
        events,
      };
    case 'attack':
      return { battle: attack(current, events, at), events };
  }
}

/** La fermeture de la bulle d'aide de la phase ennemie : la transition de phase commence (C12). */
export function dismissDefenseHint(battle: Battle, at: number): BattleUpdate {
  const dismissedAt = Math.max(at, battle.now);
  const advanced = advance(battle, dismissedAt);
  if (advanced.battle.phase.kind !== 'defenseHint') return advanced;
  const events = [...advanced.events];
  const shown = { ...advanced.battle, defenseHintPending: false };
  return { battle: startTransition(shown, events, 'enemy', dismissedAt), events };
}

// ---------------------------------------------------------------------------------------------
// Reprise

/** Décale de `delta` ms les instants d'une étape ennemie. */
function shiftStep(step: EnemyStep, delta: number): EnemyStep {
  if (step.kind !== 'attack')
    return { ...step, since: step.since + delta, until: step.until + delta };
  return {
    ...step,
    startedAt: step.startedAt + delta,
    feintAt: step.feintAt === null ? null : step.feintAt + delta,
    feintShown: false,
    // Un impact déjà jugé garde son issue : il n'est pas rejugé.
    impacts: step.impacts.map((impact) => ({
      ...impact,
      at: impact.at + delta,
      landed: impact.outcome !== null,
      lost: impact.outcome === null ? false : impact.lost,
    })),
    resolvedAt: step.resolvedAt + delta,
    counter:
      step.counter === null
        ? null
        : { ...step.counter, at: step.counter.at + delta, until: step.counter.until + delta },
    ...(step.secondChance && {
      secondChance: {
        since: step.secondChance.since + delta,
        until: step.secondChance.until + delta,
      },
    }),
  };
}

function stepStart(step: EnemyStep): number {
  return step.kind === 'attack' ? step.startedAt : step.since;
}

function resumedPhase(phase: BattlePhase, at: number): BattlePhase {
  switch (phase.kind) {
    case 'hero':
    case 'defenseHint':
      return { ...phase, since: at };
    case 'heroStrike': {
      if (phase.resolved) return { ...phase, until: at };
      const delta = at - phase.since;
      return {
        ...phase,
        since: at,
        impactAt: phase.impactAt + delta,
        until: phase.until + delta,
        press: null,
      };
    }
    case 'heroPower':
    case 'transition':
      return { ...phase, since: at, until: at + phase.until - phase.since };
    case 'enemy':
      return { kind: 'enemy', step: shiftStep(phase.step, at - stepStart(phase.step)) };
    default:
      // Un combat fini reste fini.
      return phase;
  }
}

/**
 * La reprise d'un combat sauvegardé (P32), à l'instant `at` : l'action en cours repart du début
 * de sa préparation, avec le même tirage ; un impact déjà jugé reste acquis. Le déséquilibre,
 * l'arrêt sur image et l'animation du retour en garde sont effacés. Les instants sauvés ne valent
 * rien après un redémarrage (base monotone) : tout repart de `at`.
 */
export function resumeBattle(battle: Battle, at: number): Battle {
  return {
    ...battle,
    now: at,
    offBalanceUntil: null,
    hitStop: null,
    enemies: battle.enemies.map((enemy) => ({ ...enemy, guardRestore: null })),
    phase: resumedPhase(battle.phase, at),
  };
}
