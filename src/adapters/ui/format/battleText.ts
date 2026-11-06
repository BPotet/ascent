import { ATTACKS, type AttackKind } from '../../../domain/battle/attacks';
import type { Battle } from '../../../domain/battle/Battle';
import type {
  BattleEvent,
  BattleOutcome,
  BlowOutcome,
  PhaseDirection,
  WhiffReason,
} from '../../../domain/battle/BattleEvent';
import type { Actor } from '../../../domain/battle/actionOrder';
import {
  ENEMIES,
  HEROES,
  startingInitiative,
  type Armor,
  type EnemyKind,
  type HeroKind,
  type Weapon,
} from '../../../domain/battle/combatants';
import type { Stunned } from '../../../domain/battle/guard';
import { MOMENTUM_MAX } from '../../../domain/battle/momentum';
import { POWERS, basePower, type PowerKind } from '../../../domain/battle/powers';
import type { ShownIntent } from '../../../domain/battle/shownIntent';

/** Les libellés du combat, tirés du glossaire et de la maquette de l'épique #30. */
export const HERO_NAME = 'La Sentinelle';

export const ENEMY_NAMES: Readonly<Record<EnemyKind, string>> = {
  ghoul: 'Goule',
  specter: 'Spectre',
  necromancer: 'Nécromancien',
  fallenKnight: 'Chevalier déchu',
  twins: 'Les Jumeaux',
  ossuaryWarden: 'Gardienne des ossuaires',
  facelessPrior: 'Prieur sans visage',
  skeleton: 'Squelette',
  madVillager: 'Villageois fou',
  // Les paliers 2 et 3 (#38) : les noms du Codex, sans article comme au palier 1.
  thornPilgrim: 'Pèlerin enronce',
  ashBramble: 'Ronce de cendre',
  ashGleaner: 'Glaneuse de cendre',
  bronzeWarden: "Veilleur d'airain",
  scarecrow: 'Épouvantail',
  firstPilgrim: 'Premier Pèlerin',
  stoneSaint: 'Saint de pierre',
  ashGardener: 'Jardinière des cendres',
  hourRinger: 'Sonneur des heures',
  wishGranter: 'Celle qui exauce',
  // La Brûlure (#171) : le Brûleur de ronces sans article, comme dans la maquette (initiale B).
  burningHusk: 'Embrasé',
  gargoyle: 'Gargouille',
  bellFounder: 'Fondeur de cloches',
  brambleBurner: 'Brûleur de ronces',
  // L'Invocation (#172) : la Reine des phalènes avec son article, comme dans la maquette.
  mothQueen: 'La Reine des phalènes',
  mothkin: 'Phalénide',
  // Le Beffroi (#214) : les noms du Codex, sans article.
  bellNovice: 'Novice des cloches',
  matinsRinger: 'Sonneuse de matines',
  clockJack: 'Jaquemart',
};

/** Le genre du nom de l'ennemi, pour « étourdie », « tombée »… */
const FEMININE: Readonly<Record<EnemyKind, boolean>> = {
  ghoul: true,
  specter: false,
  necromancer: false,
  fallenKnight: false,
  twins: false,
  ossuaryWarden: true,
  facelessPrior: false,
  skeleton: false,
  madVillager: false,
  thornPilgrim: false,
  ashBramble: true,
  ashGleaner: true,
  bronzeWarden: false,
  scarecrow: false,
  firstPilgrim: false,
  stoneSaint: false,
  ashGardener: true,
  hourRinger: false,
  wishGranter: true,
  burningHusk: false,
  gargoyle: true,
  bellFounder: false,
  brambleBurner: false,
  mothQueen: true,
  mothkin: true,
  bellNovice: false,
  matinsRinger: true,
  clockJack: false,
};

export const ATTACK_NAMES: Readonly<Record<AttackKind, string>> = {
  basic: 'coup simple',
  double: 'double frappe',
  delayed: 'coup retardé',
  feint: 'coup trompeur',
  perilous: 'coup imparable',
  delayedPerilous: 'coup retardé imparable',
};

export const POWER_NAMES: Readonly<Record<PowerKind, string>> = {
  bulwark: 'Rempart',
  retaliation: 'Représailles',
  holdFast: 'Tenir bon',
  shadowStep: "Pas de l'ombre",
  rend: 'Entaille',
  mist: 'Brume',
};

/** Les héros, leur équipement de base, leur pouvoir et leur trait (prototype #90, maquette H1, H2). */
export const HERO_NAMES: Readonly<Record<HeroKind, string>> = {
  sentinel: 'La Sentinelle',
  wanderer: "L'Errante",
};

const HERO_STYLES: Readonly<Record<HeroKind, string>> = {
  sentinel: 'Parade et contre-attaque',
  wanderer: 'Esquive et rythme',
};

const HERO_TRAITS: Readonly<Record<HeroKind, string>> = {
  sentinel: 'Contre-attaque ×1,3',
  wanderer: 'Chaque impact esquivé dans la fenêtre de parade : +1 Élan',
};

export const WEAPON_NAMES: Readonly<Record<Weapon, string>> = {
  shortSword: 'Épée courte',
  twinDaggers: 'Dagues jumelles',
};

export const ARMOR_NAMES: Readonly<Record<Armor, string>> = {
  dentedCuirass: 'Cuirasse cabossée',
  wornCloak: 'Cape usée',
};

const POWER_EFFECTS: Readonly<Record<PowerKind, string>> = {
  // La `powerDescription` du Codex (`sentinel`), recopiée mot pour mot le 29/10/2026 (#128).
  bulwark:
    "Elle plante son bouclier devant elle et y met tout son poids. Le prochain coup qu'elle subit ne lui fait que la moitié de ses dégâts, après sa réduction, et elle riposte aussitôt, moins fort qu'une contre-attaque.",
  // La `powerDescription` du Codex (`wanderer` v3), recopiée mot pour mot le 01/11/2026 (#173).
  shadowStep:
    "Elle se fond dans sa propre ombre sans s'arrêter, et frappe dans le même élan. Sa prochaine esquive complète déclenche une contre-attaque, comme si le coup l'avait traversée sans la trouver.",
  // La `description` des fiches `codex/<code>` version 1 (#235).
  retaliation:
    'Elle a compté chaque coup reçu sur le rempart. Le prochain, elle le rendra deux fois.',
  holdFast:
    "Une sentinelle ne tombe pas tant que la nuit n'est pas finie. Elle serre les dents, et la nuit continue.",
  rend: "Une seule ligne, fine comme un fil, à l'endroit exact où l'armure cédera.",
  mist: "Le froid du matin monte du sol avec elle. Ce qui la frappe frappe d'abord le brouillard.",
};

/** La fiche d'un héros sur l'écran du choix du héros. */
export interface HeroCard {
  readonly name: string;
  readonly style: string;
  readonly stats: string;
  readonly kit: string;
  readonly trait: string;
  readonly label: string;
}

/** La description d'un pouvoir, le texte du Codex lu sur le Choix du héros. */
export function powerDescription(power: PowerKind): string {
  return POWER_EFFECTS[power];
}

/**
 * La fiche d'un héros sur le Choix du héros, avec ses pouvoirs équipés (#235), le pouvoir de base
 * seul par défaut.
 */
export function heroCard(
  kind: HeroKind,
  equipped: readonly PowerKind[] = [basePower(kind)],
): HeroCard {
  const hero = HEROES[kind];
  const attack = hero.hits > 1 ? `${hero.attackPower} × ${hero.hits}` : `${hero.attackPower}`;
  const weapon = WEAPON_NAMES[hero.startingKit.weapon];
  const armor = ARMOR_NAMES[hero.startingKit.armor];
  const powers = equipped
    .map((power) => `${POWER_NAMES[power]}, ${POWERS[power].cost} Élan`)
    .join(' ; ');
  const initiative = startingInitiative(kind);
  return {
    name: HERO_NAMES[kind],
    style: HERO_STYLES[kind],
    stats: `${hero.maxHp} PV · Attaque ${attack} · Initiative ${initiative}`,
    kit: `${weapon} · ${armor}`,
    trait: HERO_TRAITS[kind],
    label: `${HERO_NAMES[kind]}, ${HERO_STYLES[kind]}. ${hero.maxHp} PV, Attaque ${attack}, Initiative ${initiative}. Arme ${weapon}, armure ${armor}. Pouvoirs équipés : ${powers}. ${HERO_TRAITS[kind]}`,
  };
}

/** Ce que la phrase de la frise lit d'une case (`TrackEntry`) : qui agit, son nom de code, sa malédiction. */
interface TrackName {
  readonly actor: Actor;
  readonly fighter: HeroKind | EnemyKind;
  readonly cursed?: true;
}

/**
 * La frise d'action lue au lecteur d'écran (maquette, `friseLabel`) : « Ordre d'action. Manche 1 :
 * Spectre, toi, Goule. Manche suivante : Spectre, toi, Goule. »
 */
export function actionTrackLabel(
  round: number,
  current: readonly TrackName[],
  next: readonly TrackName[],
): string {
  const name = ({ actor, fighter, cursed }: TrackName) =>
    actor === 'hero' ? 'toi' : enemyName({ kind: fighter as EnemyKind, ...(cursed && { cursed }) });
  return `Ordre d'action. Manche ${round} : ${current.map(name).join(', ')}. Manche suivante : ${next.map(name).join(', ')}.`;
}

export const SEAL_LABEL = 'Sceau rouge : coup imparable';

/** « étourdie » pour la Goule, « étourdi » pour les autres. */
function agreed(kind: EnemyKind, word: string): string {
  return FEMININE[kind] ? `${word}e` : word;
}

/**
 * Le nom d'un ennemi, partout où il est nommé au lecteur d'écran : « Goule maudite » pour un ennemi
 * maudit (#209), accordé à son nom ; sinon son nom seul.
 */
export function enemyName(enemy: { readonly kind: EnemyKind; readonly cursed?: true }): string {
  const name = ENEMY_NAMES[enemy.kind];
  return enemy.cursed === true ? `${name} ${agreed(enemy.kind, 'maudit')}` : name;
}

/** L'étiquette d'un ennemi maudit (#209) : « Maudite » pour la Goule, « Maudit » sinon ; ou `null`. */
export function cursedTag(enemy: {
  readonly kind: EnemyKind;
  readonly cursed?: true;
}): string | null {
  return enemy.cursed === true ? agreed(enemy.kind, 'Maudit') : null;
}

function damages(count: number): string {
  return `${count} ${count > 1 ? 'dégâts' : 'dégât'}`;
}

/** L'étiquette du Saignement sous les PV du héros (prototype #107) : « Saignement ×3 ». */
export function bleedChipText(rounds: number): string {
  return `Saignement ×${rounds}`;
}

/** L'étiquette de la Brûlure sous les PV du héros (#171) : « Brûlure ×3 ». */
export function burnChipText(stacks: number): string {
  return `Brûlure ×${stacks}`;
}

function stacksText(stacks: number): string {
  return `${stacks} ${stacks > 1 ? 'charges' : 'charge'}`;
}

/** La Brûlure lue dans l'étiquette de la barre du héros (#171) : « Brûlure, 2 charges ». */
export function burnLabel(stacks: number): string {
  return `Brûlure, ${stacksText(stacks)}`;
}

/** Les charges de Brûlure et les dégâts qu'elles feront (#171) : « Brûlure, 3 charges, 3 dégâts ». */
function burnStacksAnnouncement(stacks: number): string {
  return `${burnLabel(stacks)}, ${damages(stacks)}`;
}

/** L'étiquette du Rempart sous les PV du héros (#128) : « Rempart », puis « Rempart usé ». */
export function bulwarkChipText(worn: boolean): string {
  return worn ? 'Rempart usé' : POWER_NAMES.bulwark;
}

/** Les PV sous un ennemi : « 38/50 PV ». */
export function enemyHpText(hp: number, maxHp: number): string {
  return `${hp}/${maxHp} PV`;
}

/** La garde sous un ennemi : « Garde 15/15 ». */
export function guardText(guard: number, maxGuard: number): string {
  return `Garde ${guard}/${maxGuard}`;
}

/** Le libellé d'un ennemi étourdi, à la place de sa garde : « Étourdie ×1,5 ». */
export function stunnedLabel(kind: EnemyKind): string {
  return `${agreed(kind, 'Étourdi')} ×1,5`;
}

/** L'étiquette d'un ennemi qui s'est relevé seul (#106) : « Relevé », ou `null`. */
export function selfRevivedTag(enemy: {
  readonly kind: EnemyKind;
  readonly selfRevives?: number;
}): string | null {
  return (enemy.selfRevives ?? 0) > 0 ? agreed(enemy.kind, 'Relevé') : null;
}

/**
 * L'étiquette sous le nom d'un ennemi : « Invoquée » pour un ennemi invoqué (#172), sinon
 * « Relevé » pour un ennemi qui s'est relevé seul (#106), ou `null`.
 */
export function enemyTag(enemy: {
  readonly kind: EnemyKind;
  readonly selfRevives?: number;
  readonly summoned?: true;
}): string | null {
  return enemy.summoned === true ? agreed(enemy.kind, 'Invoqué') : selfRevivedTag(enemy);
}

/** Le nombre d'une intention (C2.2) : « +N » pour Garde et Soin, aucun sinon. */
export function intentNumber(intent: ShownIntent): string | null {
  return intent.category === 'guard' || intent.category === 'heal' ? `+${intent.gain}` : null;
}

/** L'intention lue par le lecteur d'écran : sa catégorie, et son nombre pour Garde et Soin. */
export function intentSpeech(kind: EnemyKind, intent: ShownIntent): string {
  switch (intent.category) {
    case 'attack':
      return 'intention : attaque';
    case 'guard':
      return `intention : garde, plus ${intent.gain}`;
    case 'heal':
      return `intention : soin, plus ${intent.gain}`;
    case 'raise':
      return 'intention : relever un allié';
    case 'skip':
      return `${agreed(kind, intent.reason === 'stunned' ? 'étourdi' : 'relevé')}, n'agit pas`;
  }
}

/** Un ennemi annoncé en entier : nom, cible, PV, garde (ou étourdi) et intention montrée. */
export function enemyLabel(
  enemy: {
    readonly kind: EnemyKind;
    readonly hp: number;
    readonly maxHp: number;
    readonly guard: number;
    readonly maxGuard: number;
    readonly stun: Stunned | null;
    readonly selfRevives?: number;
    readonly summoned?: true;
    readonly cursed?: true;
  },
  intent: ShownIntent | null,
  isTarget: boolean,
): string {
  const tag = enemyTag(enemy);
  const name = `${enemyName(enemy)}${tag === null ? '' : `, ${tag.toLowerCase()}`}`;
  if (enemy.hp <= 0) return `${name}, ${agreed(enemy.kind, 'tombé')}`;
  const guard =
    enemy.stun === null
      ? `garde ${enemy.guard} sur ${enemy.maxGuard}`
      : `${agreed(enemy.kind, 'étourdi')}, dégâts ×1,5`;
  const intentPart = intent === null ? '' : `, ${intentSpeech(enemy.kind, intent)}`;
  return `${name}${isTarget ? ', cible' : ''}, ${enemy.hp} PV sur ${enemy.maxHp}, ${guard}${intentPart}`;
}

export function attackButtonLabel(targetName: string): string {
  return `Attaquer, cible : ${targetName}`;
}

/**
 * Le pouvoir et son coût, sous « Pouvoir » : « Rempart · 1 Élan ». Un pouvoir instantané (#173)
 * a son nom sur sa propre ligne, et son coût dit « 3 Élan · Instantané ».
 */
export function powerCostText(power: PowerKind, instant = false): string {
  const cost = `${POWERS[power].cost} Élan`;
  return instant ? `${cost} · ${INSTANT_WORD}` : `${POWER_NAMES[power]} · ${cost}`;
}

/** La mention d'un pouvoir instantané sur la touche Pouvoir (#173), toujours avec le croissant. */
export const INSTANT_WORD = 'Instantané';

/** L'Élan qui manque à un pouvoir : « Il manque 1 Élan ». */
export function missingMomentumText(missing: number): string {
  return `Il manque ${missing} Élan`;
}

export function powerButtonLabel(
  power: PowerKind,
  missing: number,
  active = false,
  instant = false,
): string {
  const label = `Pouvoir : ${POWER_NAMES[power]}, ${POWERS[power].cost} Élan${instant ? ', instantané' : ''}`;
  if (active) return `${label}, actif`;
  return missing > 0 ? `${label}, indisponible : il manque ${missing} Élan` : label;
}

export function momentumLabel(momentum: number): string {
  return `Élan ${momentum} sur ${MOMENTUM_MAX}`;
}

/** La bannière de l'annonce de phase : son titre et sa ligne. */
export function phaseBanner(to: PhaseDirection): { readonly title: string; readonly line: string } {
  return to === 'enemy'
    ? { title: 'Phase ennemie', line: 'Prépare ta parade' }
    : { title: 'À toi', line: 'Vise et attaque' };
}

export function phaseAnnouncement(to: PhaseDirection): string {
  const { title, line } = phaseBanner(to);
  return `${title}. ${line}.`;
}

/**
 * Le mot d'un résultat sur la scène. La phase ennemie est épurée : seuls « Parfait », « Parfait ·
 * contre-attaque », « Riposte » (précédé de l'écu, #128), « Cassure » et « Il se relève » (#106)
 * s'y écrivent ; « Frappe parfaite » en phase du héros. Jamais « Critique ».
 */
export interface FeedbackText {
  readonly tone: 'perfect' | 'break' | 'rise' | 'riposte' | 'shadowStep';
  readonly title: string;
}

/** Les pouvoirs au féminin, pour l'accord de « actif » (#235) : Entaille, Brume. */
const FEMININE_POWERS: ReadonlySet<PowerKind> = new Set(['rend', 'mist']);

/** « Représailles actif », « Brume active » : un pouvoir actif, accordé à son nom (#235). */
export function activePowerText(power: PowerKind): string {
  return `${POWER_NAMES[power]} ${FEMININE_POWERS.has(power) ? 'active' : 'actif'}`;
}

/** Le mot d'un événement sur la scène, ou `null` s'il n'en a pas. */
export function feedbackText(event: BattleEvent): FeedbackText | null {
  switch (event.type) {
    case 'blowResolved':
      return event.outcome === 'perfectParry' ? { tone: 'perfect', title: 'Parfait' } : null;
    case 'counterAttacked':
      return { tone: 'perfect', title: 'Parfait · contre-attaque' };
    case 'bulwarkCountered':
      return { tone: 'riposte', title: 'Riposte' };
    // Le mot de scène d'un pouvoir (#173, #235), sans bande ni bannière : en ombre pour ceux de
    // l'Errante, en or pour ceux de la Sentinelle ; le Rempart n'en a pas.
    case 'powerUsed':
      if (event.power === 'bulwark') return null;
      return {
        tone: POWERS[event.power].hero === 'wanderer' ? 'shadowStep' : 'perfect',
        title: POWER_NAMES[event.power],
      };
    case 'guardBroken':
      return { tone: 'break', title: 'Cassure' };
    case 'enemySelfRevived':
      return { tone: 'rise', title: 'Il se relève' };
    case 'strikeResolved':
      return event.judgement === 'perfect' ? { tone: 'perfect', title: 'Frappe parfaite' } : null;
    default:
      return null;
  }
}

/** Un chiffre qui s'envole : les dégâts (« −4 ») au-dessus du héros ou d'un ennemi, ou la garde. */
export interface DamageFloat {
  /** Le héros, ou l'indice de l'ennemi. */
  readonly at: 'hero' | number;
  readonly text: string;
  /** Agrandi pour une frappe parfaite (C6.7). */
  readonly big: boolean;
  /**
   * Des dégâts, de la garde, les dégâts de la Riposte du Rempart, précédés de l'écu (#128), ou la
   * perte de la Brûlure, précédée d'une flamme (#171).
   */
  readonly kind: 'damage' | 'guard' | 'riposte' | 'burn' | 'secondChance' | 'heal';
}

export function damageFloat(event: BattleEvent): DamageFloat | null {
  switch (event.type) {
    case 'blowResolved':
      return event.damage > 0
        ? { at: 'hero', text: `−${event.damage}`, big: false, kind: 'damage' }
        : null;
    case 'strikeResolved':
      return {
        at: event.enemy,
        text: `−${event.damage}`,
        big: event.judgement === 'perfect',
        kind: 'damage',
      };
    case 'counterAttacked':
      return { at: event.enemy, text: `−${event.damage}`, big: false, kind: 'damage' };
    case 'bulwarkCountered':
      return { at: event.enemy, text: `−${event.damage}`, big: false, kind: 'riposte' };
    case 'guardRaised':
      return { at: event.enemy, text: `+${event.gain}`, big: false, kind: 'guard' };
    case 'bleedTicked':
      return event.loss > 0
        ? { at: 'hero', text: `−${event.loss}`, big: false, kind: 'damage' }
        : null;
    case 'burnTicked':
      return event.loss > 0
        ? { at: 'hero', text: `−${event.loss}`, big: false, kind: 'burn' }
        : null;
    // Les PV du héros relevé, en or (#206).
    case 'secondChanceUsed':
      return { at: 'hero', text: `+${event.hp}`, big: false, kind: 'secondChance' };
    // Le soin de Tenir bon, en or (#235, K12) ; rien à PV max.
    case 'heroHealed':
      return event.heal > 0
        ? { at: 'hero', text: `+${event.heal}`, big: false, kind: 'heal' }
        : null;
    default:
      return null;
  }
}

/** La seconde chance dans l'étiquette de la barre du héros (#206, S1, S4). */
export function secondChanceLabel(state: 'ready' | 'used'): string {
  return state === 'ready' ? 'seconde chance prête' : 'seconde chance utilisée';
}

/** Sous la défaite, quand la seconde chance avait déjà servi (#206, S4). */
export const SECOND_CHANCE_SPENT = 'Ta seconde chance a déjà servi.';

/**
 * Le bandeau de la seconde chance (#206, S3) : « La Sentinelle se relève avec 40 PV. », puis,
 * quand le coup avait un impact de plus, « Le second coup de la Goule est annulé. ». Seule la
 * double frappe a deux impacts : au plus un est annulé.
 */
export function secondChanceBannerText(
  event: Extract<BattleEvent, { type: 'secondChanceUsed' }>,
  battle: Battle,
): { readonly title: string; readonly lines: readonly string[] } {
  const enemy = battle.enemies[event.enemy]!.kind;
  return {
    title: 'Seconde chance',
    lines: [
      `${HERO_NAMES[battle.heroKind]} se relève avec ${event.hp} PV.`,
      ...(event.cancelled > 0 ? [`Le second coup ${ofName(enemy)} est annulé.`] : []),
    ],
  };
}

const WHIFF_TITLES: Readonly<Record<WhiffReason, string>> = {
  early: 'Trop tôt',
  late: 'Trop tard',
  empty: 'Dans le vide',
};

function blowAnnouncement(outcome: BlowOutcome, damage: number): string {
  switch (outcome) {
    case 'perfectParry':
      return 'Parade parfaite';
    case 'parry':
      return `Parade, ${damages(damage)}`;
    case 'dodge':
      return 'Esquive, aucun dégât';
    case 'perilousParry':
      return `Coup imparable : la parade échoue, ${damages(damage)}`;
    case 'suffered':
      return `Touché, ${damages(damage)}`;
  }
}

function strikeAnnouncement(
  judgement: Extract<BattleEvent, { type: 'strikeResolved' }>['judgement'],
  damage: number,
): string {
  const title =
    judgement === 'perfect' ? 'Frappe parfaite' : judgement === 'good' ? 'Bonne frappe' : 'Frappe';
  return `${title}, ${damages(damage)}`;
}

/**
 * La phrase complète d'un événement au lecteur d'écran, ou `null` s'il n'en a pas : la phase, le
 * type de coup au début de la préparation (jamais avant, C2.4), les résultats, la garde.
 */
export function announcement(event: BattleEvent, battle: Battle): string | null {
  const name = (enemy: number) => enemyName(battle.enemies[enemy]!);
  const kind = (enemy: number) => battle.enemies[enemy]!.kind;
  switch (event.type) {
    case 'phaseTransitionStarted':
      return phaseAnnouncement(event.to);
    case 'heroPhaseStarted':
      return event.announced ? phaseAnnouncement('hero') : null;
    case 'windUpStarted':
      return `${name(event.enemy)}, ${ATTACK_NAMES[event.attack]}${ATTACKS[event.attack].perilous ? ', esquive' : ''}`;
    case 'blowResolved':
      return blowAnnouncement(event.outcome, event.damage);
    case 'counterAttacked':
      return `${event.retaliation ? 'Représailles, contre-attaque' : 'Contre-attaque'}, ${damages(event.damage)}`;
    // Le nom de l'ennemi est dit : la riposte ne vise pas forcément la cible choisie (#128).
    case 'bulwarkWorn':
      return 'Rempart usé.';
    case 'bulwarkCountered':
      return `Riposte du Rempart, ${name(event.enemy)}, ${damages(event.damage)}`;
    case 'whiffed':
      return `${WHIFF_TITLES[event.reason]}, déséquilibré`;
    case 'pressIgnored':
      return event.reason === 'offBalance' ? 'Déséquilibré' : null;
    case 'strikeResolved':
      return strikeAnnouncement(event.judgement, event.damage);
    case 'guardBroken':
      return `Cassure, ${name(event.enemy)} ${agreed(kind(event.enemy), 'étourdi')}`;
    case 'actionLost':
      return `${name(event.enemy)}, ${agreed(kind(event.enemy), 'étourdi')}, n'agit pas`;
    case 'guardRestored':
      return `${name(event.enemy)}, retour en garde`;
    case 'guardRaised':
      return `${name(event.enemy)} relève sa garde, plus ${event.gain}`;
    case 'allyRaised':
      return `${name(event.enemy)} relève ${name(event.ally)}, ${event.hp} PV`;
    case 'enemySelfRevived':
      return `${name(event.enemy)} se relève, ${event.hp} PV sur ${battle.enemies[event.enemy]!.maxHp}`;
    case 'powerUsed':
      return event.instant === true
        ? `${activePowerText(event.power)}. Toujours à toi : vise et attaque.`
        : POWER_NAMES[event.power];
    // Tenir bon (#235, K12) : le soin, puis la Brûlure éteinte ou le Saignement arrêté.
    case 'heroHealed':
      return event.heal > 0 ? `Plus ${event.heal} PV` : null;
    case 'bleedStopped':
      return 'Saignement arrêté.';
    // La Brûlure éteinte par Tenir bon (#235) ; rien à la fin du combat.
    case 'burnCleared':
      return battle.phase.kind === 'heroPower' ? 'Brûlure éteinte.' : null;
    case 'mistWorn':
      return 'Brume usée.';
    case 'respite':
      return event.gain > 0 ? `Répit, plus ${event.gain} PV` : null;
    case 'battleEnded':
      return event.outcome === 'defeat' && battle.hero.secondChance === 'used'
        ? `${endTitle(event.outcome)}. ${SECOND_CHANCE_SPENT}`
        : `${endTitle(event.outcome)}.`;
    case 'secondChanceUsed': {
      // « La Sentinelle » devient « la Sentinelle » après « Seconde chance : ».
      const text = secondChanceBannerText(event, battle).lines.join(' ');
      return `Seconde chance : ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
    }
    // Le changement de phase d'un boss (#172 : seul, quand il n'invoque rien).
    case 'bossPhaseShifted':
      return `${name(event.enemy)} change de phase.`;
    case 'heroBleeding':
      return `Saignement : moins ${event.damage} PV pendant ${event.rounds} manches`;
    case 'bleedTicked':
      return event.roundsLeft > 0
        ? `Saignement, ${damages(event.loss)}, encore ${event.roundsLeft} ${event.roundsLeft > 1 ? 'manches' : 'manche'}`
        : `Saignement, ${damages(event.loss)}. Saignement terminé`;
    // La Brûlure (#171) ; rien quand les flammes s'éteignent à la fin du combat (`burnCleared`).
    case 'heroBurning':
      return burnStacksAnnouncement(event.stacks);
    case 'burnTicked':
      return event.loss > 0 ? `Brûlure, moins ${event.loss} PV` : null;
    case 'burnExtinguished':
      return event.cause === 'blow' && event.stacks > 0
        ? `Une flamme s'éteint. ${burnStacksAnnouncement(event.stacks)}`
        : "Une flamme s'éteint";
    default:
      return null;
  }
}

/** Un nom au pluriel : « Phalénides », « Goules ». */
function plural(kind: EnemyKind): string {
  return `${ENEMY_NAMES[kind]}s`;
}

/** « Elle » pour un boss au nom féminin, « Il » sinon. */
function pronoun(kind: EnemyKind): string {
  return FEMININE[kind] ? 'Elle' : 'Il';
}

/** « une Phalénide », « un Squelette ». */
function oneOf(kind: EnemyKind): string {
  return `${FEMININE[kind] ? 'une' : 'un'} ${ENEMY_NAMES[kind]}`;
}

/** « de la Goule », « du Squelette », « de l'Épouvantail », « des Jumeaux », « de la Reine… ». */
function ofName(kind: EnemyKind): string {
  const name = ENEMY_NAMES[kind];
  if (name.startsWith('Les ')) return `des ${name.slice(4)}`;
  if (name.startsWith('La ')) return `de la ${name.slice(3)}`;
  if (/^[AEIOUÉÈ]/u.test(name)) return `de l'${name}`;
  return `${FEMININE[kind] ? 'de la' : 'du'} ${name}`;
}

/** « tombée », « tombé », « tombés » : accordé au nom de l'ennemi. */
function fallenWord(kind: EnemyKind): string {
  return ENEMY_NAMES[kind].startsWith('Les ') ? 'tombés' : agreed(kind, 'tombé');
}

/**
 * L'annonce de l'Invocation (#172, maquette 170, I2, I6) : « Elle appelle les Phalénides » pour
 * plusieurs, « Elle appelle une Phalénide » pour une, sous « La Reine des phalènes change de phase ».
 */
export function summonBannerText(
  summoner: EnemyKind,
  kind: EnemyKind,
  count: number,
): { readonly title: string; readonly line: string } {
  const called = count > 1 ? `les ${plural(kind)}` : oneOf(kind);
  return {
    title: `${pronoun(summoner)} appelle ${called}`,
    line: `${ENEMY_NAMES[summoner]} change de phase`,
  };
}

/**
 * L'Invocation lue au lecteur d'écran, avec le changement de phase : à une place, celle d'un ennemi
 * tombé est nommée (I6) ; à deux, les places ne sont pas nommées.
 */
function summonAnnouncement(
  event: Extract<BattleEvent, { type: 'summonCalled' }>,
  battle: Battle,
): string {
  const summoner = battle.enemies[event.enemy]!.kind;
  const { title } = summonBannerText(summoner, event.kind, event.slots.length);
  const shift = `${ENEMY_NAMES[summoner]} change de phase.`;
  if (event.slots.length > 1) {
    return `${shift} ${title} : deux ${plural(event.kind)} entrent à la prochaine manche.`;
  }
  const replaced = battle.enemies[event.slots[0]!];
  const place =
    replaced === undefined
      ? ''
      : `, à la place ${ofName(replaced.kind)} ${fallenWord(replaced.kind)}`;
  const subject = FEMININE[event.kind] ? 'elle' : 'il';
  return `${shift} ${title} : ${subject} entre à la prochaine manche${place}.`;
}

/**
 * La chute des invoqués avec leur boss (#172, I5) : « La Reine des phalènes tombe. Les Phalénides
 * tombent avec elle. », dite une fois pour tous les invoqués qui tombent ensemble.
 */
function summonFallAnnouncement(battle: Battle, count: number, enemy: number): string {
  const summoner = battle.enemies.find(({ kind }) => ENEMIES[kind].phase2Summon !== undefined);
  const boss = summoner?.kind ?? battle.enemies[enemy]!.kind;
  const kind = battle.enemies[enemy]!.kind;
  const with_ = `avec ${pronoun(boss).toLowerCase()}`;
  const fall =
    count > 1
      ? `Les ${plural(kind)} tombent ${with_}.`
      : `${FEMININE[kind] ? 'La' : 'Le'} ${ENEMY_NAMES[kind]} tombe ${with_}.`;
  return `${ENEMY_NAMES[boss]} tombe. ${fall}`;
}

/**
 * Les phrases d'une mise à jour au lecteur d'écran, dans l'ordre de ses événements : le changement
 * de phase et l'Invocation qui le suit en une seule phrase, la chute des invoqués une seule fois.
 */
export function announcementsFor(events: readonly BattleEvent[], battle: Battle): string[] {
  const fallen = events.filter((event) => event.type === 'summonedFell');
  return events.flatMap((event, index) => {
    if (event.type === 'bossPhaseShifted' && events[index + 1]?.type === 'summonCalled') return [];
    if (event.type === 'summonCalled') return [summonAnnouncement(event, battle)];
    if (event.type === 'summonedFell') {
      return event === fallen[0]
        ? [summonFallAnnouncement(battle, fallen.length, event.enemy)]
        : [];
    }
    return announcement(event, battle) ?? [];
  });
}

export function endTitle(outcome: BattleOutcome): string {
  return outcome === 'victory' ? 'Combat gagné' : 'Combat perdu';
}

export function heroHpText(hp: number, maxHp: number): string {
  return `PV ${hp}/${maxHp}`;
}
