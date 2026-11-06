/**
 * L'ascension (`Ascent`, #91, #38) : gravir les trois paliers, les Catacombes, les Jardins de cendre
 * et le Beffroi, de 6 étages chacun, du combat imposé de l'étage 1 au boss de l'étage 6, en
 * choisissant ses sorties, jusqu'au Sommet. Un état immuable et sérialisable ; tous les tirages
 * viennent de la graine de l'ascension (P9), et un tirage révélé est gardé.
 */
import { HEROES, type EnemyKind, type HeroKind } from '../battle/combatants';
import { basePower, powerOrder, type PowerKind } from '../battle/powers';
import { nextRandom, seedRandom, type BattleSeed, type RandomState } from '../battle/SeededRandom';
import {
  SECOND_BREATH,
  boonPool,
  drawBoonOffer,
  drawRerolledOffer,
  offerEmberHeart,
  secondBreathHp,
  withSecondBreath,
  type BoonKind,
  type OfferCard,
} from './boons';
import {
  blessingKeys,
  drawBlessingOffer,
  heroMaxHp,
  vigorPercent,
  type BlessingFamily,
  type StartingBlessing,
} from './blessings';
import { cursedElite, cursedOrdinary, drawCursedEnemy } from './cursedEnemy';
import type { Drawn } from './draw';
import {
  fatiguePercent,
  favorKeys,
  favorRerolls,
  favorSecondChance,
  type FateGauge,
} from './fateGauge';
import {
  STARTING_EQUIPMENT,
  drawLoot,
  drawSealedChestItem,
  equip,
  type Equipment,
  type ItemKind,
} from './items';
import type { Rarity } from './rarity';
import { drawElite } from './elites';
import { drawGroup, drawGroupSize } from './enemyGroup';
import { drawExitKinds, type Exit } from './exits';
import { bossGold, campfireHeal, drawBoss, drawCombatGold, eliteGold } from './rewards';
import { shardAwards, type ShardAward } from './shards';
import { TIERS, TOP_TIER, type Tier } from './tiers';
import { unlockedItems, type Unlock } from './unlocks';

/** La graine de l'ascension (`AscentSeed`). */
export type AscentSeed = number;

/** Le dernier étage : le boss (P1). */
export const TOP_FLOOR = 6;
/** Le dernier étage à sorties : après lui, la seule porte mène au boss. */
const LAST_EXIT_FLOOR = TOP_FLOOR - 1;

/** Le combat d'un étage : son type, ses ennemis (de gauche à droite) et sa graine du combat. */
export interface Encounter {
  readonly kind: 'combat' | 'elite' | 'boss';
  readonly enemies: readonly EnemyKind[];
  readonly battleSeed: BattleSeed;
  /** L'indice de l'ennemi maudit (#209), dans la première ligne ; absent, aucun. */
  readonly cursed?: number;
}

/**
 * Le Passage de palier (`TierTransition`, #38) en cours, vers le palier `to` : l'écran du boss
 * vaincu (`bossDefeated`), puis l'écran de transition (`announce`).
 */
export interface TierPassage {
  readonly to: 2 | 3;
  readonly step: 'bossDefeated' | 'announce';
}

/** Le coffre scellé (#226) : après une Élite gagnée, jusqu'à « Ouvrir » ou « Laisser ». */
export interface SealedChest {
  /** L'objet garanti de cette Élite : jamais dans le coffre (CH7). */
  readonly eliteItem: ItemKind | null;
  /** Ouvert : son objet est l'objet trouvé (`foundItem`) en attente. */
  readonly opened: boolean;
}

/** Le soin du Passage de palier, en % des PV max (#38). */
export const TIER_PASSAGE_HEAL_PERCENT = 30;

export interface Ascent {
  readonly seed: AscentSeed;
  readonly random: RandomState;
  /** Le palier (`Tier`, #38), de 1 à 3. */
  readonly tier: Tier;
  /** L'étage (`Floor`), de 1 à 6, dans son palier. */
  readonly floor: number;
  /** Le héros choisi au pied de la tour (#92), ses PV et ses bienfaits. */
  readonly hero: {
    readonly kind: HeroKind;
    readonly hp: number;
    readonly maxHp: number;
    readonly boons: readonly BoonKind[];
  };
  /**
   * L'offre de bienfaits en attente (#92), `null` sans offre ; complétée par la carte Second
   * souffle (#212).
   */
  readonly boonOffer: readonly OfferCard[] | null;
  /** L'Or (`Gold`) gagné pendant l'ascension, perdu à la fin. */
  readonly gold: number;
  /** L'Or du dernier étage franchi (0 après un Feu de camp). */
  readonly lastGold: number;
  /** Les sorties proposées après l'étage ; vides pendant un combat et à la fin. */
  readonly exits: readonly Exit[];
  /** Le combat de l'étage, `null` entre deux étages. */
  readonly encounter: Encounter | null;
  /** Un groupe de 5 a déjà été affronté. */
  readonly fiveFaced: boolean;
  /** L'étage 2 a proposé un Feu de camp (sinon l'étage 3 en propose un). */
  readonly campfireOffered: boolean;
  /** `null` tant que l'ascension est en cours ; la chute vaut aussi pour l'abandon. */
  readonly outcome: 'victory' | 'fall' | null;
  /** La jauge de l'ascension, gardée jusqu'à sa fin (#93, P30). */
  readonly gauge: FateGauge;
  /** Les bénédictions de départ choisies (#93, P25). */
  readonly blessings: readonly StartingBlessing[];
  /** Les raretés des bénédictions qui restent à choisir. */
  readonly blessingRarities: readonly Rarity[];
  /** L'offre de bénédiction en attente, `null` sans offre. */
  readonly blessingOffer: readonly BlessingFamily[] | null;
  /** L'équipement porté (#93, P21). */
  readonly equipment: Equipment;
  /** L'objet trouvé en attente : à équiper ou laisser (P19). */
  readonly foundItem: ItemKind | null;
  /** Le flux de hasard des bénédictions et du butin, dérivé de la graine (P9). */
  readonly lootRandom: RandomState;
  /** Les Éclats gagnés pendant l'ascension (#38) : ils restent après une chute. */
  readonly shardAwards: readonly ShardAward[];
  /** Le Passage de palier en cours, `null` sans passage (#38). */
  readonly passage: TierPassage | null;
  /** Les Déblocages de l'ascension (#195), reçus à son début et gardés jusqu'à sa fin. */
  readonly unlocks: readonly Unlock[];
  /**
   * Les pouvoirs équipés (`EquippedPower`, #235), fixés au départ de l'ascension, dans l'ordre de
   * l'arbre, jusqu'à sa fin ; le pouvoir de base seul par défaut.
   */
  readonly powers: readonly PowerKind[];
  /** Cœur de braise a déjà été proposé dans l'ascension, pris ou non (#195). */
  readonly emberHeartOffered: boolean;
  /** Les relances qui restent (#42), données au lancement selon la jauge. */
  readonly rerolls: number;
  /** Le flux de hasard des relances, dérivé de la graine : seule une relance l'avance (#42). */
  readonly rerollRandom: RandomState;
  /** La seconde chance encore là (#206), donnée au lancement selon la jauge. */
  readonly secondChance: boolean;
  /** Les clés qui restent (#226), données au lancement par la faveur et au choix de Fortune. */
  readonly keys: number;
  /** Le coffre scellé en attente après une Élite (#226), `null` sans coffre. */
  readonly sealedChest: SealedChest | null;
  /** Le flux de hasard du coffre scellé, dérivé de la graine : seule une ouverture l'avance. */
  readonly sealedChestRandom: RandomState;
}

/**
 * Le lancement de l'ascension : le héros choisi au pied de la tour (#92, la Sentinelle par
 * défaut), la jauge scellée, les raretés des bénédictions (#93) et les Déblocages (#195, aucun par
 * défaut).
 */
export interface AscentLaunch {
  readonly hero?: HeroKind;
  readonly gauge?: FateGauge;
  readonly blessings?: readonly Rarity[];
  readonly unlocks?: readonly Unlock[];
  /** Les pouvoirs équipés (#235) ; par défaut, le pouvoir de base du héros. */
  readonly powers?: readonly PowerKind[];
}

/** Le flux de hasard des bénédictions et du butin : séparé, il ne déplace pas les autres tirages. */
export function lootStream(seed: AscentSeed): RandomState {
  return seedRandom((seed ^ 0x9e3779b9) >>> 0);
}

/** Le flux de hasard des relances (#42) : séparé, il ne déplace aucun autre tirage. */
export function rerollStream(seed: AscentSeed): RandomState {
  return seedRandom((seed ^ 0x2545f491) >>> 0);
}

/** Le flux de hasard du coffre scellé (#226) : séparé, il ne déplace aucun autre tirage. */
export function sealedChestStream(seed: AscentSeed): RandomState {
  return seedRandom((seed ^ 0x85ebca6b) >>> 0);
}

/** L'issue d'un combat d'étage. */
export interface FloorBattleResult {
  readonly outcome: 'victory' | 'defeat';
  readonly heroHp: number;
  /** La seconde chance a servi pendant le combat (#206) ; absent, non. */
  readonly secondChanceUsed?: boolean;
}

function drawBattleSeed(random: RandomState): Drawn<BattleSeed> {
  const drawn = nextRandom(random);
  return { value: Math.floor(drawn.value * 4_294_967_296), random: drawn.state };
}

function encounter(
  kind: Encounter['kind'],
  enemies: readonly EnemyKind[],
  random: RandomState,
  cursed?: number,
): Drawn<Encounter> {
  const seed = drawBattleSeed(random);
  return {
    value: { kind, enemies, battleSeed: seed.value, ...(cursed !== undefined && { cursed }) },
    random: seed.random,
  };
}

/**
 * Un combat ordinaire : le groupe, puis l'ennemi maudit sous la malédiction (#209), puis la graine
 * du combat. Sans malédiction, aucun tirage de plus.
 */
function combat(size: number, random: RandomState, tier: Tier, gauge: FateGauge): Drawn<Encounter> {
  const group = drawGroup(size, random, tier);
  if (!cursedOrdinary(gauge)) return encounter('combat', group.value, group.random);
  const cursed = drawCursedEnemy(group.value, group.random);
  return encounter('combat', group.value, cursed.random, cursed.value);
}

/**
 * L'ascension commence : le héros choisi à PV max (fatigue comprise), sans bienfait, l'étage 1,
 * un combat dont la taille est tirée, et la première offre de bénédiction s'il y en a.
 */
export function startAscent(seed: AscentSeed, launch: AscentLaunch = {}): Ascent {
  const { hero: heroKind = 'sentinel', gauge = 0, blessings = [], unlocks = [] } = launch;
  const powers = powerOrder(heroKind, launch.powers ?? [basePower(heroKind)]);
  const size = drawGroupSize(1, seedRandom(seed), false);
  const first = combat(size.value, size.random, 1, gauge);
  const maxHp = heroMaxHp(HEROES[heroKind].maxHp, 0, fatiguePercent(gauge));
  const offer = blessings.length > 0 ? drawBlessingOffer([], lootStream(seed)) : null;
  return {
    seed,
    random: first.random,
    tier: 1,
    floor: 1,
    hero: { kind: heroKind, hp: maxHp, maxHp, boons: [] },
    boonOffer: null,
    gold: 0,
    lastGold: 0,
    exits: [],
    encounter: first.value,
    fiveFaced: false,
    campfireOffered: false,
    outcome: null,
    gauge,
    blessings: [],
    blessingRarities: blessings,
    blessingOffer: offer?.value ?? null,
    equipment: STARTING_EQUIPMENT,
    foundItem: null,
    lootRandom: offer?.random ?? lootStream(seed),
    shardAwards: [],
    passage: null,
    unlocks: [...new Set(unlocks)],
    powers,
    emberHeartOffered: false,
    rerolls: favorRerolls(gauge),
    rerollRandom: rerollStream(seed),
    secondChance: favorSecondChance(gauge),
    keys: favorKeys(gauge),
    sealedChest: null,
    sealedChestRandom: sealedChestStream(seed),
  };
}

/**
 * Le joueur prend la bénédiction `index` de l'offre, avec la rareté de son habitude ; l'offre
 * suivante est tirée parmi les familles non prises. Les PV max sont recalculés (Vigueur), le héros
 * part à PV max (P26), et Fortune ajoute ses clés (#226).
 */
export function chooseBlessing(ascent: Ascent, index: number): Ascent {
  const family = ascent.blessingOffer?.[index];
  const [rarity, ...rest] = ascent.blessingRarities;
  if (family === undefined || rarity === undefined) return ascent;
  const blessing = { family, rarity };
  const blessings = [...ascent.blessings, blessing];
  const maxHp = heroMaxHp(
    HEROES[ascent.hero.kind].maxHp,
    vigorPercent(blessings),
    fatiguePercent(ascent.gauge),
  );
  const offer =
    rest.length > 0
      ? drawBlessingOffer(
          blessings.map((each) => each.family),
          ascent.lootRandom,
        )
      : null;
  return {
    ...ascent,
    blessings,
    blessingRarities: rest,
    blessingOffer: offer?.value ?? null,
    lootRandom: offer?.random ?? ascent.lootRandom,
    hero: { ...ascent.hero, hp: maxHp, maxHp },
    // Les clés de Fortune, au choix de la bénédiction (#226, F2).
    keys: ascent.keys + blessingKeys(blessing),
  };
}

/** Le coffre scellé, refermé (`null`) une fois son objet équipé ou laissé (#226). */
function afterItem(ascent: Ascent): SealedChest | null {
  return ascent.sealedChest?.opened === true ? null : ascent.sealedChest;
}

/** Le héros porte l'objet trouvé ; celui qu'il remplace est perdu. */
export function equipItem(ascent: Ascent): Ascent {
  if (ascent.foundItem === null) return ascent;
  return {
    ...ascent,
    equipment: equip(ascent.equipment, ascent.foundItem),
    foundItem: null,
    sealedChest: afterItem(ascent),
  };
}

/** L'objet trouvé est laissé : il est perdu. */
export function leaveItem(ascent: Ascent): Ascent {
  return { ...ascent, foundItem: null, sealedChest: afterItem(ascent) };
}

/**
 * Le coffre scellé peut être ouvert (#226, CH2, CH4) : il est fermé, l'objet garanti a été équipé
 * ou laissé, et il reste au moins une clé.
 */
export function canOpenSealedChest(ascent: Ascent): boolean {
  return (
    ascent.sealedChest !== null &&
    !ascent.sealedChest.opened &&
    ascent.foundItem === null &&
    ascent.keys > 0
  );
}

/**
 * Le joueur ouvre le coffre scellé (#226, CH4, CH6) : une clé de moins, et son objet, tiré sur le
 * flux du coffre, devient l'objet trouvé. Sans ouverture possible, rien ne change.
 */
export function openSealedChest(ascent: Ascent): Ascent {
  const chest = ascent.sealedChest;
  if (chest === null || !canOpenSealedChest(ascent)) return ascent;
  const drawn = drawSealedChestItem(
    ascent.equipment,
    chest.eliteItem,
    ascent.sealedChestRandom,
    unlockedItems(ascent.unlocks),
  );
  return {
    ...ascent,
    keys: ascent.keys - 1,
    foundItem: drawn.value,
    sealedChest: { ...chest, opened: true },
    sealedChestRandom: drawn.random,
  };
}

/**
 * Le coffre scellé est laissé fermé (#226, CH4, CH5), avec ou sans clé : il est perdu, les clés ne
 * changent pas et rien n'est tiré.
 */
export function leaveSealedChest(ascent: Ascent): Ascent {
  if (ascent.sealedChest === null || ascent.sealedChest.opened || ascent.foundItem !== null) {
    return ascent;
  }
  return { ...ascent, sealedChest: null };
}

/** Les sorties vers l'étage `floor` ; la taille du groupe est tirée avec la porte Combat. */
function withExits(ascent: Ascent, floor: number): Ascent {
  if (floor > LAST_EXIT_FLOOR) {
    return { ...ascent, encounter: null, exits: [{ kind: 'boss', groupSize: null }] };
  }
  const guaranteed = floor === 3 && !ascent.campfireOffered;
  const kinds = drawExitKinds(floor, ascent.random, guaranteed);
  let random = kinds.random;
  const exits = kinds.value.map((kind): Exit => {
    if (kind !== 'combat') return { kind, groupSize: null };
    const size = drawGroupSize(floor, random, ascent.fiveFaced, ascent.tier);
    random = size.random;
    return { kind, groupSize: size.value };
  });
  return {
    ...ascent,
    random,
    encounter: null,
    exits,
    campfireOffered: ascent.campfireOffered || (floor === 2 && kinds.value.includes('campfire')),
  };
}

/** Le joueur franchit la porte `index` : le combat de l'étage suivant, ou le Feu de camp. */
export function chooseExit(ascent: Ascent, index: number): Ascent {
  const exit = ascent.exits[index];
  if (exit === undefined || ascent.outcome !== null || ascent.boonOffer !== null) return ascent;
  const { tier } = ascent;
  const floor = ascent.floor + 1;
  // Une porte franchie laisse l'objet trouvé, s'il en reste un, et le coffre scellé (#226).
  const entered = { ...ascent, floor, exits: [], foundItem: null, sealedChest: null };
  switch (exit.kind) {
    case 'campfire':
      return withExits(
        { ...entered, hero: { ...ascent.hero, hp: campfireHeal(ascent.hero) }, lastGold: 0 },
        floor + 1,
      );
    case 'combat': {
      const size = exit.groupSize!;
      const drawn = combat(size, ascent.random, tier, ascent.gauge);
      return {
        ...entered,
        random: drawn.random,
        encounter: drawn.value,
        fiveFaced: ascent.fiveFaced || size === 5,
      };
    }
    case 'elite': {
      const elite = drawElite(TIERS[tier].elites, ascent.random);
      // L'Élite maudite sous la malédiction forte (#209), sans tirage : elle est seule.
      const cursed = cursedElite(ascent.gauge) ? 0 : undefined;
      const drawn = encounter('elite', [elite.value], elite.random, cursed);
      return { ...entered, random: drawn.random, encounter: drawn.value };
    }
    case 'boss': {
      const boss = drawBoss(ascent.random, TIERS[tier].bosses);
      const drawn = encounter('boss', [boss.value], boss.random);
      return { ...entered, random: drawn.random, encounter: drawn.value };
    }
  }
}

/**
 * La fin du combat de l'étage (P7, P8, P16, #38) : la chute à 0 PV ; sinon l'Or du combat et ses
 * Éclats, puis le Passage de palier après le boss du palier 1 ou 2 (+30 % des PV max), la victoire
 * au boss du palier 3 (le Sommet), ou l'offre de bienfaits et les sorties vers l'étage suivant.
 */
export function endFloorBattle(ascent: Ascent, result: FloorBattleResult): Ascent {
  const { encounter: current, tier } = ascent;
  if (current === null || ascent.outcome !== null) return ascent;
  const hero = { ...ascent.hero, hp: result.heroHp };
  // Une seconde chance utilisée le reste, même dans une chute (#206).
  const secondChance = ascent.secondChance && result.secondChanceUsed !== true;
  if (result.outcome === 'defeat') {
    return { ...ascent, hero, encounter: null, outcome: 'fall', secondChance };
  }
  let random = ascent.random;
  let gold = current.kind === 'elite' ? eliteGold(tier) : bossGold(tier);
  if (current.kind === 'combat') {
    const drawn = drawCombatGold(current.enemies.length, random, TIERS[tier].goldPercent);
    gold = drawn.value;
    random = drawn.random;
  }
  const loot = drawLoot(
    current,
    ascent.gauge,
    ascent.equipment,
    ascent.lootRandom,
    unlockedItems(ascent.unlocks),
  );
  const earned = {
    ...ascent,
    hero,
    secondChance,
    random,
    gold: ascent.gold + gold,
    lastGold: gold,
    foundItem: loot.value,
    lootRandom: loot.random,
    // Le coffre scellé, après une Élite seulement (#226, CH2) : il ne tire rien.
    ...(current.kind === 'elite' && {
      sealedChest: { eliteItem: loot.value, opened: false },
    }),
    shardAwards: [
      ...ascent.shardAwards,
      ...shardAwards(ascent.seed, tier, ascent.floor, current.kind),
    ],
  };
  if (current.kind === 'boss') {
    if (tier === TOP_TIER) return { ...earned, encounter: null, outcome: 'victory' };
    const healed = Math.floor((hero.maxHp * TIER_PASSAGE_HEAL_PERCENT) / 100);
    return {
      ...earned,
      hero: { ...hero, hp: Math.min(hero.maxHp, hero.hp + healed) },
      encounter: null,
      passage: { to: (tier + 1) as TierPassage['to'], step: 'bossDefeated' },
    };
  }
  // L'offre de bienfaits suit l'objet trouvé, sur le même flux : les portes ne bougent pas (P9).
  // Au palier du combat gagné (#212) : la réserve de ses bienfaits de palier.
  const offer = drawBoonOffer(hero.boons, earned.lootRandom, tier);
  const withHeart = emberHeartDrawn(ascent, current)
    ? offerEmberHeart(offer.value, offer.random)
    : { value: { offer: offer.value, offered: false }, random: offer.random };
  return withExits(
    {
      ...earned,
      lootRandom: withHeart.random,
      // Puis la carte de repli, sans tirage (#212) : l'offre n'est jamais vide.
      boonOffer: withSecondBreath(withHeart.value.offer),
      emberHeartOffered: ascent.emberHeartOffered || withHeart.value.offered,
    },
    ascent.floor + 1,
  );
}

/**
 * Cœur de braise est tiré après une Élite seulement (#195), s'il est débloqué, pas possédé et pas
 * encore proposé dans l'ascension ; sinon, aucun tirage.
 */
function emberHeartDrawn(ascent: Ascent, current: Encounter): boolean {
  return (
    current.kind === 'elite' &&
    ascent.unlocks.includes('emberHeart') &&
    !ascent.hero.boons.includes('emberHeart') &&
    !ascent.emberHeartOffered
  );
}

/** L'écran du boss vaincu est passé : l'écran de transition vers le palier suivant (#38). */
export function acknowledgeBossVictory(ascent: Ascent): Ascent {
  if (ascent.passage?.step !== 'bossDefeated') return ascent;
  return { ...ascent, passage: { ...ascent.passage, step: 'announce' } };
}

/**
 * L'écran de transition est passé (#38) : l'étage 1 du palier suivant, sur un combat imposé dont la
 * taille et les ennemis sont tirés avec les poids du palier. Le héros garde tout ; la Garantie du
 * Feu de camp vaut de nouveau.
 */
export function enterNextTier(ascent: Ascent): Ascent {
  if (ascent.passage?.step !== 'announce') return ascent;
  const tier = ascent.passage.to;
  const size = drawGroupSize(1, ascent.random, ascent.fiveFaced, tier);
  const first = combat(size.value, size.random, tier, ascent.gauge);
  return {
    ...ascent,
    tier,
    floor: 1,
    random: first.random,
    encounter: first.value,
    exits: [],
    campfireOffered: false,
    passage: null,
  };
}

/**
 * Le joueur prend la carte `index` de l'offre : un bienfait, qu'il garde jusqu'à la fin (P16), ou
 * Second souffle, qui soigne sans dépasser le maximum (#212).
 */
export function chooseBoon(ascent: Ascent, index: number): Ascent {
  const card = ascent.boonOffer?.[index];
  if (card === undefined) return ascent;
  const { hero } = ascent;
  if (card === SECOND_BREATH) {
    return {
      ...ascent,
      hero: { ...hero, hp: secondBreathHp(hero.hp, hero.maxHp) },
      boonOffer: null,
    };
  }
  return { ...ascent, hero: { ...hero, boons: [...hero.boons, card] }, boonOffer: null };
}

/**
 * Une relance est possible (#42) : il en reste, une offre est en attente, et au moins un bienfait
 * de la réserve du palier n'est ni possédé ni affiché.
 */
export function canReroll(ascent: Ascent): boolean {
  const offer = ascent.boonOffer;
  return (
    ascent.rerolls > 0 &&
    offer !== null &&
    boonPool(ascent.tier).some((kind) => !ascent.hero.boons.includes(kind) && !offer.includes(kind))
  );
}

/**
 * Le joueur relance l'offre (#42) : une nouvelle offre, tirée sur le flux des relances, et une
 * relance de moins. Sans relance possible, rien ne change.
 */
export function rerollBoonOffer(ascent: Ascent): Ascent {
  if (!canReroll(ascent)) return ascent;
  const drawn = drawRerolledOffer(
    ascent.hero.boons,
    ascent.boonOffer!,
    ascent.rerollRandom,
    ascent.tier,
  );
  return {
    ...ascent,
    boonOffer: drawn.value,
    rerolls: ascent.rerolls - 1,
    rerollRandom: drawn.random,
  };
}

/** L'abandon (`Abandon`) : il a le même effet qu'une chute (P33). */
export function abandonAscent(ascent: Ascent): Ascent {
  return { ...ascent, encounter: null, exits: [], outcome: 'fall' };
}
