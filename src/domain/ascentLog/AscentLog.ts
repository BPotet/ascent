/**
 * Le Journal d'ascension (`AscentLog`, #196, ADR 0014) : le récit d'une ascension, écrit pendant
 * qu'elle se joue. Il observe l'ascension (son état avant et après chaque transition) sans rien
 * recalculer ni tirer de hasard. Immuable et sérialisable en JSON. Depuis la version 2 du format
 * (#197, ADR 0016), il liste aussi ses combats, écrits à part (`BattleLog`).
 *
 * Il ne contient aucune donnée des habitudes : les bénédictions de départ n'y figurent que par leur
 * famille et leur rareté.
 */
import type { Ascent, AscentSeed, Encounter } from '../ascent/Ascent';
import type { BlessingFamily } from '../ascent/blessings';
import { SECOND_BREATH, type OfferCard } from '../ascent/boons';
import type { Exit, ExitKind } from '../ascent/exits';
import type { FateGauge } from '../ascent/fateGauge';
import type { Equipment, ItemKind } from '../ascent/items';
import type { Rarity } from '../ascent/rarity';
import { shardSum } from '../ascent/shards';
import type { Tier } from '../ascent/tiers';
import type { HeroKind } from '../battle/combatants';
import type { Day } from '../day/Day';
import { BATTLE_LOG_FORMAT_VERSION, type FloorPlace } from './BattleLog';

/**
 * La version du format du journal et de l'export : 2 depuis les combats (#197, ADR 0016). Un champ
 * ajouté la garde ; un sens changé, non.
 */
export const ASCENT_LOG_FORMAT_VERSION = BATTLE_LOG_FORMAT_VERSION;

/** L'état de la Jauge : Faveur pleine, Faveur, Neutre, Malédiction, Malédiction forte. */
export type GaugeState = 'fullFavor' | 'favor' | 'neutral' | 'curse' | 'strongCurse';

const GAUGE_STATES: Readonly<Record<FateGauge, GaugeState>> = {
  2: 'fullFavor',
  1: 'favor',
  0: 'neutral',
  [-1]: 'curse',
  [-2]: 'strongCurse',
};

/** Les PV et l'Élan du héros ; l'Élan est `null` hors combat. */
export interface HeroVitals {
  readonly hp: number;
  readonly maxHp: number;
  readonly momentum: number | null;
}

/** Un choix de bénédiction de départ : les familles proposées, la famille et la rareté prises. */
export interface BlessingRecord {
  readonly offered: readonly BlessingFamily[];
  readonly chosen: { readonly family: BlessingFamily; readonly rarity: Rarity };
}

/** Le combat d'un étage, sans sa graine. */
export interface EncounterRecord {
  readonly kind: Encounter['kind'];
  readonly enemies: Encounter['enemies'];
}

/** Un étage, identifié par son palier et son numéro. */
export interface FloorRecord {
  readonly tier: Tier;
  readonly floor: number;
  /** Les sorties proposées pour arriver à cet étage ; vides pour l'étage 1, imposé. */
  readonly exitsOffered: readonly Exit[];
  /** La sortie prise pour arriver à cet étage, `null` pour l'étage 1. */
  readonly exitTaken: { readonly kind: ExitKind; readonly groupSize: number | null } | null;
  /** Le combat de l'étage, `null` au Feu de camp. */
  readonly encounter: EncounterRecord | null;
  readonly entry: HeroVitals;
  /** `null` tant que l'étage n'est pas fini. */
  readonly exit: HeroVitals | null;
  /** L'Or de l'étage. */
  readonly gold: number;
  /** Les cartes de l'offre, carte Second souffle comprise (#212). */
  readonly boonsOffered: readonly OfferCard[];
  /** Les offres remplacées par une relance, dans l'ordre (#42) ; absent sans relance. */
  readonly rerolledOffers?: readonly (readonly OfferCard[])[];
  readonly boonChosen: OfferCard | null;
  readonly itemFound: ItemKind | null;
  readonly itemOutcome: 'equipped' | 'left' | null;
  /** Les Éclats de l'étage. */
  readonly shards: number;
}

/** Un Passage de palier, avec les PV du héros à l'entrée du nouveau palier. */
export interface TierPassageRecord {
  readonly from: Tier;
  readonly to: Tier;
  readonly heroHp: number;
}

/** La fin : Sommet, chute ou abandon ; pour une chute, le combat d'étage où elle a lieu. */
export interface AscentEnd {
  readonly kind: 'summit' | 'fall' | 'abandon';
  readonly tier: Tier;
  readonly floor: number;
  readonly encounter?: EncounterRecord;
}

/** Ce que les journaux de toutes les versions du format ont en commun. */
interface AscentLogBody {
  /** Attribué par le stockage, `null` avant. */
  readonly id: number | null;
  readonly ascentSeed: AscentSeed;
  /** Le jour du début, `AAAA-MM-JJ`. */
  readonly startedOn: string;
  readonly hero: HeroKind;
  readonly gauge: GaugeState;
  readonly startingEquipment: Equipment;
  readonly blessings: readonly BlessingRecord[];
  readonly floors: readonly FloorRecord[];
  readonly tierPassages: readonly TierPassageRecord[];
  readonly status: 'inProgress' | 'ended';
  readonly end: AscentEnd | null;
}

/** Un journal écrit avant #197 : sans combats. Une ascension en cours le garde jusqu'à sa fin. */
export interface AscentLogV1 extends AscentLogBody {
  readonly formatVersion: 1;
}

export interface AscentLog extends AscentLogBody {
  readonly formatVersion: typeof ASCENT_LOG_FORMAT_VERSION;
  /** Les combats écrits à part, par leur palier et leur étage, dans l'ordre où ils ont commencé. */
  readonly battles: readonly FloorPlace[];
}

/** Un journal de l'une ou l'autre version du format. */
export type AnyAscentLog = AscentLogV1 | AscentLog;

interface Transition {
  readonly before: Ascent;
  readonly after: Ascent;
}

/** Une transition de l'ascension, avec sa cause. L'abandon est explicite : il finit comme une chute. */
export type AscentStep =
  | (Transition & {
      readonly kind:
        | 'blessingChosen'
        | 'itemEquipped'
        | 'itemLeft'
        | 'boonChosen'
        | 'boonOfferRerolled'
        | 'exitChosen'
        | 'abandoned'
        | 'bossAcknowledged'
        | 'tierEntered';
    })
  | (Transition & { readonly kind: 'battleStarted' | 'battleEnded'; readonly hero: HeroVitals });

const encounterRecord = (encounter: Encounter | null): EncounterRecord | null =>
  encounter === null ? null : { kind: encounter.kind, enemies: encounter.enemies };

const restingVitals = (ascent: Ascent): HeroVitals => ({
  hp: ascent.hero.hp,
  maxHp: ascent.hero.maxHp,
  momentum: null,
});

/** L'étage où se trouve `ascent`, tel qu'il commence. */
function floorRecord(
  ascent: Ascent,
  exitsOffered: readonly Exit[] = [],
  exitTaken: FloorRecord['exitTaken'] = null,
): FloorRecord {
  return {
    tier: ascent.tier,
    floor: ascent.floor,
    exitsOffered,
    exitTaken,
    encounter: encounterRecord(ascent.encounter),
    entry: restingVitals(ascent),
    exit: null,
    gold: 0,
    boonsOffered: [],
    boonChosen: null,
    itemFound: null,
    itemOutcome: null,
    shards: 0,
  };
}

/** Le journal d'une ascension qui commence, le jour `day`. */
export function beginAscentLog(ascent: Ascent, day: Day): AscentLog {
  return {
    formatVersion: ASCENT_LOG_FORMAT_VERSION,
    id: null,
    ascentSeed: ascent.seed,
    startedOn: day.toIsoString(),
    hero: ascent.hero.kind,
    gauge: GAUGE_STATES[ascent.gauge],
    startingEquipment: ascent.equipment,
    blessings: [],
    floors: [floorRecord(ascent)],
    tierPassages: [],
    status: 'inProgress',
    end: null,
    battles: [],
  };
}

/** Le journal avec le combat de `place`, au début de ce combat ; jamais deux fois le même lieu. */
export function recordBattlePlace(log: AscentLog, place: FloorPlace): AscentLog {
  if (log.battles.some((each) => each.tier === place.tier && each.floor === place.floor)) {
    return log;
  }
  return { ...log, battles: [...log.battles, { tier: place.tier, floor: place.floor }] };
}

const sameFloor = (record: FloorRecord, ascent: Ascent) =>
  record.tier === ascent.tier && record.floor === ascent.floor;

/** Remplace l'étage de même palier et numéro, ou l'ajoute : jamais de doublon d'étage. */
function upsertFloor<Log extends AnyAscentLog>(log: Log, record: FloorRecord): Log {
  const index = log.floors.findIndex(
    (each) => each.tier === record.tier && each.floor === record.floor,
  );
  const floors =
    index < 0
      ? [...log.floors, record]
      : log.floors.map((each, at) => (at === index ? record : each));
  return { ...log, floors };
}

/** Modifie l'étage où se trouve `ascent`, s'il est dans le journal. */
function updateFloor<Log extends AnyAscentLog>(
  log: Log,
  ascent: Ascent,
  change: (record: FloorRecord) => FloorRecord,
): Log {
  const record = log.floors.find((each) => sameFloor(each, ascent));
  return record === undefined ? log : upsertFloor(log, change(record));
}

function ended<Log extends AnyAscentLog>(log: Log, end: AscentEnd): Log {
  return { ...log, status: 'ended', end };
}

/** La sortie franchie entre `before` et `after`, parmi celles proposées. */
function exitTaken(before: Ascent, after: Ascent): NonNullable<FloorRecord['exitTaken']> {
  const kind: ExitKind = after.encounter === null ? 'campfire' : after.encounter.kind;
  // Les portes proposées sont de types distincts : la porte prise est celle de ce type.
  return { kind, groupSize: before.exits.find((each) => each.kind === kind)!.groupSize };
}

function exitChosen<Log extends AnyAscentLog>(log: Log, before: Ascent, after: Ascent): Log {
  // Une porte franchie laisse l'objet trouvé, s'il en reste un.
  const left =
    before.foundItem === null
      ? log
      : updateFloor(log, before, (record) => ({ ...record, itemOutcome: 'left' }));
  const taken = exitTaken(before, after);
  if (taken.kind !== 'campfire') return upsertFloor(left, floorRecord(after, before.exits, taken));
  // Le Feu de camp : un étage sans combat, soigné entre l'entrée et la sortie.
  return upsertFloor(left, {
    ...floorRecord(after, before.exits, taken),
    entry: restingVitals(before),
    exit: restingVitals(after),
  });
}

function battleEnded<Log extends AnyAscentLog>(
  log: Log,
  before: Ascent,
  after: Ascent,
  hero: HeroVitals,
): Log {
  const fought = updateFloor(log, before, (record) => ({
    ...record,
    exit: hero,
    gold: after.gold - before.gold,
    boonsOffered: after.boonOffer ?? [],
    itemFound: after.foundItem,
    shards: shardSum(after.shardAwards) - shardSum(before.shardAwards),
  }));
  const place = { tier: before.tier, floor: before.floor };
  if (after.outcome === 'victory') return ended(fought, { kind: 'summit', ...place });
  if (after.outcome === 'fall') {
    const encounter = encounterRecord(before.encounter);
    return ended(fought, { kind: 'fall', ...place, ...(encounter !== null && { encounter }) });
  }
  return fought;
}

/**
 * La carte choisie dans l'offre : le bienfait ajouté au héros ; si ses bienfaits n'ont pas grandi,
 * Second souffle (#212), car un bienfait offert n'est jamais déjà possédé.
 */
function chosenCard({ before, after }: AscentStep): OfferCard {
  return after.hero.boons.length > before.hero.boons.length
    ? after.hero.boons.at(-1)!
    : SECOND_BREATH;
}

/** Le journal après la transition `step` ; rien ne change si elle ne change rien. */
export function recordAscentStep<Log extends AnyAscentLog>(log: Log, step: AscentStep): Log {
  const { before, after } = step;
  if (log.status === 'ended') return log;
  if (before === after && step.kind !== 'battleStarted') return log;
  switch (step.kind) {
    case 'blessingChosen': {
      // Une bénédiction prise : l'offre existait, et la dernière bénédiction est la nouvelle.
      const { family, rarity } = after.blessings.at(-1)!;
      return {
        ...log,
        blessings: [
          ...log.blessings,
          { offered: before.blessingOffer!, chosen: { family, rarity } },
        ],
      };
    }
    case 'itemEquipped':
      return updateFloor(log, before, (record) => ({ ...record, itemOutcome: 'equipped' }));
    case 'itemLeft':
      return updateFloor(log, before, (record) => ({ ...record, itemOutcome: 'left' }));
    case 'boonChosen':
      return updateFloor(log, before, (record) => ({ ...record, boonChosen: chosenCard(step) }));
    case 'boonOfferRerolled':
      return updateFloor(log, before, (record) => ({
        ...record,
        rerolledOffers: [...(record.rerolledOffers ?? []), before.boonOffer!],
        boonsOffered: after.boonOffer!,
      }));
    case 'exitChosen':
      return exitChosen(log, before, after);
    case 'abandoned':
      return ended(log, { kind: 'abandon', tier: before.tier, floor: before.floor });
    case 'bossAcknowledged':
      return log;
    case 'tierEntered':
      return upsertFloor(
        {
          ...log,
          tierPassages: [
            ...log.tierPassages,
            { from: before.tier, to: after.tier, heroHp: after.hero.hp },
          ],
        },
        floorRecord(after),
      );
    case 'battleStarted':
      return updateFloor(log, before, (record) => ({ ...record, entry: step.hero }));
    case 'battleEnded':
      return battleEnded(log, before, after, step.hero);
  }
}

/**
 * Le journal repris avec l'ascension sauvegardée `ascent` (après une fermeture) : l'étage courant
 * est ajouté s'il manque, jamais en double.
 */
export function resumeAscentLog<Log extends AnyAscentLog>(log: Log, ascent: Ascent): Log {
  if (log.floors.some((record) => sameFloor(record, ascent))) return log;
  return upsertFloor(log, floorRecord(ascent));
}
