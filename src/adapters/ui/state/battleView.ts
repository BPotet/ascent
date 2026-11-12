import type { Actor } from '../../../domain/battle/actionOrder';
import { ATTACKS } from '../../../domain/battle/attacks';
import { auraAlone } from '../../../domain/battle/aura';
import {
  equippedOf,
  escortedElite,
  nextRoundOrder,
  powerAvailability,
  powerCost,
  pendingSummon,
  strikeProfile,
  type Battle,
  type EnemyState,
} from '../../../domain/battle/Battle';
import type { PhaseDirection } from '../../../domain/battle/BattleEvent';
import {
  ENEMIES,
  enemySignature,
  type EnemySignature,
  type EnemyKind,
  type HeroKind,
} from '../../../domain/battle/combatants';
import { chargeMark } from '../../../domain/battle/charge';
import { exhumeMark, type ExhumeMark } from '../../../domain/battle/exhume';
import { sanctuaryUp } from '../../../domain/battle/sanctuary';
import { thornsActive } from '../../../domain/battle/thorns';
import { summonedKind } from '../../../domain/battle/summon';
import { POWERS, type PowerKind } from '../../../domain/battle/powers';
import type { PowerKeyAvailability } from '../format/powerText';
import { shownIntent, type ShownIntent } from '../../../domain/battle/shownIntent';
import {
  ENEMY_NAMES,
  enemyHpText,
  cursedTag,
  enemyLabel,
  enemyName,
  enemyTag,
  guardText,
  exhumeLineText,
  chargeLineText,
  CHARGE_ACTION_LINE,
  signatureText,
  stunnedLabel,
  type SignatureMarkState,
} from '../format/battleText';
import type { IconName } from '../pixelArt/sprites/icons';

/** Le temps mort affiché par l'étiquette « Attends » : de son début à sa fin, en ms. */
export interface LockSpan {
  readonly since: number;
  readonly until: number;
}

/**
 * Une touche de pouvoir (#235) : le pouvoir équipé, son coût (`powerCost`), sa disponibilité
 * (`powerAvailability`, la seule règle) et l'Élan qui manque (0 s'il suffit).
 */
export interface PowerSlot {
  readonly power: PowerKind;
  readonly cost: number;
  readonly availability: PowerKeyAvailability;
  readonly missing: number;
  /** Un pouvoir instantané (#173) : il ne prend pas l'action du héros. */
  readonly instant?: true;
  /** Un pouvoir attisé (#237) : `cost` est réduit, `baseCost` est son prix normal. */
  readonly kindled?: true;
  readonly baseCost?: number;
}

/**
 * Une case de la frise d'action (#175) : qui agit (`actor`, le héros ou l'indice de l'ennemi), le
 * combattant qu'elle montre (`fighter`, son nom de code) et s'il a changé de phase (`phase2`).
 */
export interface TrackEntry {
  readonly actor: Actor;
  readonly fighter: HeroKind | EnemyKind;
  readonly phase2: boolean;
  /** Un ennemi invoqué annoncé, pas encore entré (#172) : sa case est en pointillé. */
  readonly pending?: true;
  /** Un ennemi maudit (#209) : sa case est rose, avec un crâne en coin. */
  readonly cursed?: true;
  /**
   * L'Élite escortée tant qu'un ennemi d'escorte est debout (#257, E2) : sa case porte la couronne
   * d'Élite ; seule, elle la perd (E8).
   */
  readonly crowned?: true;
  /**
   * Un ennemi entré par une Exhumation (#258, F3, F5) : sa case est en pointillé dans l'aperçu de la
   * manche suivante. Un invoqué de #172 ne l'a pas (décision de l'orchestrateur).
   */
  readonly exhumed?: true;
}

/**
 * La marque de signature d'une Élite (`SignatureMark`, #258, D8), une seule lecture par ennemi :
 * sa mécanique, son glyphe, son mot sous le nom, sa phrase au lecteur d'écran, grisée (`off`) ou
 * soulignée (`now`). #259 y ajoute les Épines et le Sanctuaire.
 */
export interface SignatureView {
  readonly variant: EnemySignature;
  readonly glyph: IconName;
  readonly text: string;
  readonly speech: string;
  readonly off: boolean;
  readonly now: boolean;
}

/**
 * La frise d'action (prototype #90, maquette F2, F6) : le combattant en cours et ceux qui n'ont
 * pas encore agi dans la manche, ennemis debout seulement, puis l'aperçu de la manche suivante.
 */
export interface ActionTrackView {
  readonly round: number;
  readonly current: readonly TrackEntry[];
  readonly next: readonly TrackEntry[];
}

/**
 * La zone d'action (grille de deux cases, maquette F1, F3, P0) : en phase du héros, « Pouvoir » à
 * gauche et « Attaquer » à droite ; pendant la frappe en rythme, « Frapper » sur toute la largeur ;
 * en phase ennemie, Esquive à gauche et Parade à droite. `locked` : inactifs, sans hachures
 * (transition de phase) ; `offBalance` : grisés et hachurés, toujours actifs (déséquilibre).
 */
export type ActionPad =
  | {
      readonly kind: 'hero';
      readonly locked: boolean;
      readonly lock: LockSpan | null;
      /** Les 1 à 3 pouvoirs équipés, dans l'ordre de l'arbre (#235). */
      readonly powers: readonly PowerSlot[];
      /** Un pouvoir instantané vient d'être lancé dans cette phase du héros (#173). */
      readonly instantCast?: true;
    }
  | {
      readonly kind: 'strike';
      readonly since: number;
      readonly impactAt: number;
      readonly resolved: boolean;
      /** La frappe de pouvoir (#236, K13), son nombre de coups et le coup en cours ; absents pour « Attaquer ». */
      readonly power?: PowerKind;
      readonly hits?: number;
      readonly hit?: number;
    }
  | {
      readonly kind: 'defense';
      readonly locked: boolean;
      readonly lock: LockSpan | null;
      readonly offBalance: boolean;
    }
  | { readonly kind: 'none' };

/** La ligne au-dessus des boutons : « Cible : Goule », « Touche Frapper quand… ». */
export interface ZoneLine {
  readonly before: string;
  readonly strong: string;
  readonly after: string;
}

/**
 * La plaque d'un ennemi et son état dans la scène (contrat avec #81, qui le dessine) : à terre et
 * étoiles (`stunned`), étoiles qui sursautent (`losingAction`), relèvement (`rising`), premier
 * plan (`active`) et estompé (`dimmed`). En phase ennemie épurée, le nom et les chiffres sont
 * masqués (`null`) ; le lecteur d'écran garde tout (`label`).
 */
export interface EnemyView {
  readonly kind: EnemyKind;
  readonly name: string | null;
  readonly standing: boolean;
  readonly target: boolean;
  readonly hpRatio: number;
  readonly hpText: string | null;
  readonly guardRatio: number;
  /** « Garde 15/15 », « Étourdie ×1,5 », ou `null` (masqué). */
  readonly guardText: string | null;
  readonly stunned: boolean;
  readonly losingAction: boolean;
  /** Le retour en garde, et s'il vient de Se relève seul (#38). */
  readonly rising: {
    readonly since: number;
    readonly until: number;
    readonly selfRevive: boolean;
  } | null;
  /** Un boss passé en phase 2 (#38) ; absent, non. */
  readonly phase2?: boolean;
  readonly intent: ShownIntent | null;
  readonly active: boolean;
  readonly dimmed: boolean;
  /**
   * L'étiquette sous le nom : « Invoquée » pour un ennemi invoqué (#172), « Relevé » pour un ennemi
   * qui s'est relevé seul (#106), ou `null`.
   */
  readonly tag: string | null;
  /** Un ennemi invoqué (#172) : son étiquette a l'allure de la poussière ; absent, non. */
  readonly summoned?: boolean;
  /**
   * L'étiquette d'un ennemi maudit (#209), « Maudit » ou « Maudite », sur sa propre ligne en plus de
   * `tag` ; absente, il n'est pas maudit.
   */
  readonly curse?: string;
  /**
   * L'Élite d'une Élite escortée (#257, E2) : la couronne d'Élite avant son nom, gardée quand son
   * escorte est tombée (E8) ; absent, non.
   */
  readonly elite?: true;
  /** Un ennemi d'escorte (#257) : sa plaque fait 100 dp au plus ; absent, non. */
  readonly escort?: true;
  /** La marque de signature d'une Élite (#258) ; absente sans signature, ou tombée. */
  readonly signature?: SignatureView;
  /**
   * Le liseré d'acier de la barre de garde (#259, B1) : le Sanctuaire du Bedeau le protège ; absent,
   * non (garde à 0, étourdi, ou sans Sanctuaire).
   */
  readonly guardWard?: true;
  /** Le Bélier de bronze charge (#266) : la scène tient sa pose de charge ; absent, non. */
  readonly charging?: true;
  /** Sa Charge est brisée (#266, A9) : la scène montre la Charge brisée à sa chute ; absent, non. */
  readonly chargeBroken?: true;
  readonly label: string;
}

export interface BattleView {
  /** La pastille de phase en haut de la scène, `null` à la fin du combat ou hors des phases. */
  readonly phase: PhaseDirection | null;
  readonly banner: {
    readonly to: PhaseDirection;
    readonly since: number;
    readonly until: number;
  } | null;
  readonly pad: ActionPad;
  readonly line: ZoneLine | null;
  readonly enemies: readonly EnemyView[];
  /** L'ennemi qui porte le sceau rouge. */
  readonly sealed: number | null;
  /** L'ennemi qui porte le trait de balayage, pendant son Balayage (#266, A2, A3). */
  readonly swept: number | null;
  readonly defenseHint: boolean;
  /** Les actions de la phase du héros sont possibles (cible, « Attaquer », « Pouvoir »). */
  readonly heroActions: boolean;
  /** La phase ennemie épurée : noms, chiffres des PV et ligne d'information masqués. */
  readonly trimmed: boolean;
  /** Les places de la poussière d'une Invocation annoncée (#172), de gauche à droite. */
  readonly dust: readonly number[];
  /** Les colonnes de la scène : les ennemis de la première ligne et les places de poussière. */
  readonly columns: number;
  /**
   * La disposition d'un ennemi qui mène, sur 1,25 colonne, plus haut : le boss qui invoque, à trois
   * colonnes (#172, maquette « boss3 »), ou l'Élite escortée, à deux ou trois (#257, « el2 », « el3 »).
   */
  readonly leadLayout: boolean;
}

/** La durée de l'annonce « À toi » quand la phase du héros commence sans transition. */
export const ANNOUNCED_BANNER_MS = 800;

const STRIKE_LINE: ZoneLine = {
  before: 'Touche ',
  strong: 'Frapper',
  after: ' quand la barre atteint le trait.',
};

/** La ligne d'aide juste après un pouvoir instantané (#173, maquette E2). */
const INSTANT_LINE: ZoneLine = { before: '', strong: 'Toujours à toi', after: ' : attaque.' };

function instantCast(battle: Battle): boolean {
  return battle.phase.kind === 'hero' && battle.phase.instantPowerUsed === true;
}

function powerSlot(battle: Battle, power: PowerKind): PowerSlot {
  const cost = powerCost(battle, power);
  const availability = powerAvailability(battle, power);
  return {
    power,
    cost,
    // Un pouvoir équipé n'est jamais `notEquipped` ici : `equippedOf` le liste.
    availability: availability.kind as PowerKeyAvailability,
    missing: availability.kind === 'missing' ? availability.missing : 0,
    ...(POWERS[power].instant && { instant: true as const }),
    ...(cost !== POWERS[power].cost && { kindled: true as const, baseCost: POWERS[power].cost }),
  };
}

/** L'Élite escortée a encore un ennemi d'escorte debout (#257) : elle n'est pas seule. */
function escortStanding(battle: Battle): boolean {
  return battle.enemies.some((enemy) => enemy.escort === true && enemy.hp > 0);
}

/** La case de `actor` dans la frise d'action : le héros, ou l'ennemi à cet indice. */
export function trackEntry(battle: Battle, actor: Actor): TrackEntry {
  if (actor === 'hero') return { actor, fighter: battle.heroKind, phase2: false };
  const enemy = battle.enemies[actor]!;
  return {
    actor,
    fighter: enemy.kind,
    phase2: enemy.phase2 === true,
    ...(enemy.cursed === true && { cursed: true as const }),
    ...(escortedElite(battle) === actor && escortStanding(battle) && { crowned: true as const }),
  };
}

/**
 * Une case de l'aperçu de la manche suivante : un ennemi invoqué annoncé y est déjà, à sa place, en
 * pointillé (#172), comme un ennemi exhumé (#258).
 */
function nextEntry(battle: Battle, actor: Actor): TrackEntry {
  const summon = pendingSummon(battle);
  if (actor === 'hero' || summon === null || !summon.slots.includes(actor)) {
    const entry = trackEntry(battle, actor);
    const exhumed = actor !== 'hero' && battle.enemies[actor]?.exhumed === true;
    return exhumed ? { ...entry, exhumed: true } : entry;
  }
  return { actor, fighter: summon.kind, phase2: false, pending: true };
}

/** La frise d'action d'un état du combat ; vide à la fin du combat. */
export function actionTrackView(battle: Battle): ActionTrackView {
  if (battle.phase.kind === 'over') return { round: battle.round, current: [], next: [] };
  const standing = (actor: Actor) => actor === 'hero' || battle.enemies[actor]!.hp > 0;
  const entry = (actor: Actor) => trackEntry(battle, actor);
  return {
    round: battle.round,
    current: battle.turn.order.slice(battle.turn.position).filter(standing).map(entry),
    next: nextRoundOrder(battle).map((actor) => nextEntry(battle, actor)),
  };
}

/**
 * Le prix de la cible à signature, sur la ligne du pouce (#259, M1, B1) : les Épines de la
 * Mère-ronce non étourdie, le Sanctuaire du Bedeau tant que sa garde tient.
 */
function signatureLine(target: EnemyState): string {
  switch (enemySignature(target.kind)) {
    case 'thorns':
      return thornsActive(target)
        ? ` · Épines : −${ENEMIES[target.kind].thorns!.damage} PV par frappe`
        : '';
    case 'sanctuary':
      return sanctuaryUp(target) ? ' · Sanctuaire, ½ des dégâts' : '';
    default:
      return '';
  }
}

/** La ligne du pouce de la Charge, quand le Bélier de bronze est la cible (#266, A6, A8). */
function chargeLine(battle: Battle): string {
  return chargeLineText(chargeMark(battle, battle.target));
}

function targetLine(battle: Battle): ZoneLine | null {
  const target = battle.enemies[battle.target];
  if (target === undefined) return null;
  // Une Élite qui exhume (#258, F2, F5) : la ligne dit comment l'en empêcher, ou pourquoi elle
  // n'exhume pas, lu dans `exhumeMark`.
  const exhumer = battle.enemies.findIndex((enemy) => enemySignature(enemy.kind) === 'exhume');
  const mark = exhumer < 0 ? null : exhumeMark(battle, exhumer);
  const exhume =
    mark === null
      ? ''
      : exhumeLineText(battle.enemies[exhumer]!.kind, mark.state, exhumer === battle.target);
  return {
    before: 'Cible : ',
    strong: enemyName(target),
    after: `${exhume}${signatureLine(target)}${chargeLine(battle)}${target.stun === null ? '' : ' · ×1,5'}`,
  };
}

/** L'ennemi au premier plan : celui qui s'avance, attaque ou garde, jamais un étourdi. */
function activeEnemy(battle: Battle): number | null {
  const { phase } = battle;
  if (phase.kind !== 'enemy') return null;
  const { step } = phase;
  return step.kind === 'lostAction' || step.kind === 'guardRestore' ? null : step.enemy;
}

/** Le glyphe de chaque état de la marque Exhumer (maquette 245) : la pelle, fendue, l'os. */
const EXHUME_GLYPHS: Readonly<Record<ExhumeMark['state'], IconName>> = {
  next: 'shovel8',
  now: 'shovel8',
  lost: 'crack8',
  standing: 'bone8',
};

/**
 * L'état de la marque de l'ennemi `index`, lu dans le domaine, selon sa mécanique (#258, #259) ;
 * `null` sans signature, ou tombé.
 */
function signatureMark(
  battle: Battle,
  index: number,
  variant: EnemySignature,
): SignatureMarkState | null {
  const enemy = battle.enemies[index]!;
  if (variant === 'exhume') return exhumeMark(battle, index);
  if (enemy.hp <= 0) return null;
  switch (variant) {
    case 'thorns':
      return { state: 'thorns', off: !thornsActive(enemy) };
    case 'sanctuary':
      return { state: 'sanctuary', off: !sanctuaryUp(enemy) };
    case 'sweep':
      return { state: 'sweep' };
    case 'charge':
      return { state: 'charge', mark: chargeMark(battle, index) ?? 'idle' };
    case 'aura':
      return { state: 'aura', off: auraAlone(battle.enemies, battle.reserve.length, index) };
  }
}

/** Le glyphe d'une marque : celui de l'état d'Exhumer, l'épine, l'écu d'acier ou sa fêlure. */
function signatureGlyph(mark: SignatureMarkState): IconName {
  switch (mark.state) {
    case 'thorns':
      return 'thorn8';
    case 'sanctuary':
      return mark.off ? 'crack8' : 'ward8';
    case 'sweep':
      return 'sweep8';
    case 'charge':
      return mark.mark === 'broken' ? 'crack8' : 'ram8';
    case 'aura':
      return 'candle8';
    default:
      return EXHUME_GLYPHS[mark.state];
  }
}

/** Une marque éteinte : grisée (#258, #259 ; la Charge brisée, #266). */
function markOff(mark: SignatureMarkState): boolean {
  if ('off' in mark) return mark.off;
  if (mark.state === 'sweep') return false;
  if (mark.state === 'charge') return mark.mark === 'broken';
  return mark.state === 'lost' || mark.state === 'standing';
}

/** Une marque soulignée : l'Exhumation pour maintenant (#258), la Charge en cours (#266). */
function markNow(mark: SignatureMarkState): boolean {
  if (mark.state === 'charge') return mark.mark === 'first' || mark.mark === 'second';
  return mark.state === 'now';
}

/** La marque de signature de l'ennemi `index`, lue dans le domaine ; `null` sans signature. */
function signatureView(battle: Battle, index: number): SignatureView | null {
  const { kind } = battle.enemies[index]!;
  const variant = enemySignature(kind);
  const mark = variant === null ? null : signatureMark(battle, index, variant);
  if (variant === null || mark === null) return null;
  return {
    variant,
    glyph: signatureGlyph(mark),
    ...signatureText(kind, mark),
    off: markOff(mark),
    now: markNow(mark),
  };
}

/**
 * Une signature d'Élite (#258, #259) ; celles du Beffroi (#266) et l'Aura (#268) sont d'ennemis
 * ordinaires.
 */
function isEliteSignature(signature: SignatureView | null): boolean {
  return signature !== null && !ORDINARY_SIGNATURES.includes(signature.variant);
}

/** Les signatures d'ennemis ordinaires : le Balayage, la Charge (#266), l'Aura (#268). */
const ORDINARY_SIGNATURES: readonly EnemySignature[] = ['sweep', 'charge', 'aura'];

function enemyView(
  battle: Battle,
  enemy: EnemyState,
  index: number,
  { trimmed, active }: { readonly trimmed: boolean; readonly active: number | null },
): EnemyView {
  const { phase } = battle;
  const target = !trimmed && index === battle.target;
  const intent = shownIntent(battle, index);
  const stunned = enemy.stun !== null;
  const elite = escortedElite(battle) === index;
  const escort = enemy.escort === true;
  const signature = signatureView(battle, index);
  return {
    kind: enemy.kind,
    name: trimmed ? null : ENEMY_NAMES[enemy.kind],
    standing: enemy.hp > 0,
    target,
    hpRatio: enemy.hp / enemy.maxHp,
    hpText: trimmed ? null : enemyHpText(enemy.hp, enemy.maxHp),
    guardRatio: enemy.guard / enemy.maxGuard,
    guardText: stunned
      ? stunnedLabel(enemy.kind)
      : trimmed
        ? null
        : guardText(enemy.guard, enemy.maxGuard),
    stunned,
    losingAction:
      phase.kind === 'enemy' && phase.step.kind === 'lostAction' && phase.step.enemy === index,
    rising:
      enemy.guardRestore === null
        ? null
        : {
            since: enemy.guardRestore.since,
            until: enemy.guardRestore.until,
            selfRevive: enemy.guardRestore.cause === 'selfRevive',
          },
    phase2: enemy.phase2 === true,
    intent,
    active: active === index,
    dimmed: active !== null && active !== index,
    tag: enemyTag(enemy),
    ...(enemy.summoned === true && { summoned: true }),
    ...(enemy.cursed === true && { curse: cursedTag(enemy)! }),
    ...(elite && { elite: true as const }),
    ...(escort && { escort: true as const }),
    ...(signature !== null && { signature }),
    ...(enemy.hp > 0 && sanctuaryUp(enemy) && { guardWard: true as const }),
    ...(enemy.charge === 'charging' && { charging: true as const }),
    ...(enemy.charge === 'broken' && { chargeBroken: true as const }),
    label: enemyLabel(
      enemy,
      intent,
      target,
      elite || isEliteSignature(signature)
        ? 'elite'
        : escort && enemy.hp > 0
          ? 'escort'
          : undefined,
      signature?.speech,
    ),
  };
}

/** Ce que l'écran montre d'un état du combat. */
export function battleView(battle: Battle): BattleView {
  const { phase } = battle;
  const inEnemyPhase = phase.kind === 'enemy' && battle.lastPlayed === 'enemy';
  const trimmed =
    inEnemyPhase ||
    phase.kind === 'defenseHint' ||
    (phase.kind === 'transition' && phase.to === 'enemy');
  const active = activeEnemy(battle);
  const enemies = battle.enemies.map((enemy, index) =>
    enemyView(battle, enemy, index, { trimmed, active }),
  );
  const dust = [...(pendingSummon(battle)?.slots ?? [])].sort((left, right) => left - right);
  const [first] = battle.enemies;
  // Le Fossoyeur et son Squelette exhumé (#258, D7) : trois colonnes dès la 1re entrée, la 3e vide
  // jusqu'à une 2e Exhumation ; la scène ne se redispose qu'une fois.
  const exhuming = first !== undefined && ENEMIES[first.kind].exhume !== undefined;
  const columns =
    exhuming && enemies.length >= 2 ? 3 : Math.max(enemies.length, ...dust.map((slot) => slot + 1));
  const base = {
    banner: null,
    line: null,
    enemies,
    sealed: null,
    swept: null,
    defenseHint: false,
    heroActions: false,
    trimmed,
    dust,
    columns,
    leadLayout:
      escortedElite(battle) !== null ||
      (columns === 3 && first !== undefined && summonedKind(first.kind) !== null),
  };
  const heroPad = (locked: boolean, lock: LockSpan | null): ActionPad => ({
    kind: 'hero',
    locked,
    lock,
    powers: equippedOf(battle).map((power) => powerSlot(battle, power)),
    ...(instantCast(battle) && { instantCast: true as const }),
  });
  switch (phase.kind) {
    case 'hero':
      return {
        ...base,
        phase: 'hero',
        banner: phase.announced
          ? { to: 'hero', since: phase.since, until: phase.since + ANNOUNCED_BANNER_MS }
          : null,
        pad: heroPad(false, null),
        line: instantCast(battle) ? INSTANT_LINE : targetLine(battle),
        heroActions: true,
      };
    case 'heroStrike':
      return {
        ...base,
        phase: 'hero',
        pad: {
          kind: 'strike',
          since: phase.since,
          impactAt: phase.impactAt,
          resolved: phase.resolved,
          // Le compteur de coups d'une frappe de pouvoir vient de la phase (#236).
          ...(phase.power !== undefined && {
            power: phase.power,
            hits: strikeProfile(battle, phase).hits,
            hit: phase.hit ?? 1,
          }),
        },
        line: STRIKE_LINE,
      };
    case 'heroPower':
      return { ...base, phase: 'hero', pad: heroPad(true, null), line: targetLine(battle) };
    case 'defenseHint':
      return {
        ...base,
        phase: 'enemy',
        pad: { kind: 'defense', locked: true, lock: null, offBalance: false },
        defenseHint: true,
      };
    case 'transition': {
      const lock = { since: phase.since, until: phase.until };
      return {
        ...base,
        phase: phase.to,
        banner: { to: phase.to, since: phase.since, until: phase.until },
        pad:
          phase.to === 'hero'
            ? heroPad(true, lock)
            : { kind: 'defense', locked: true, lock, offBalance: false },
      };
    }
    case 'enemy': {
      // Une action perdue ou un retour en garde juste après le héros : ce n'est pas encore la
      // phase ennemie (C5.4).
      if (!inEnemyPhase) return { ...base, phase: null, pad: heroPad(true, null) };
      const { step } = phase;
      // Le relèvement de la seconde chance (#206, S2, S3) : un temps mort, touches verrouillées.
      const rise = step.kind === 'attack' ? step.secondChance : undefined;
      const rising = rise !== undefined && battle.now < rise.until;
      return {
        ...base,
        phase: 'enemy',
        pad: {
          kind: 'defense',
          locked: rising,
          lock: rising ? { since: rise.since, until: rise.until } : null,
          offBalance: battle.offBalanceUntil !== null,
        },
        sealed: step.kind === 'attack' && ATTACKS[step.attack].perilous ? step.enemy : null,
        swept: step.kind === 'attack' && ATTACKS[step.attack].sweep ? step.enemy : null,
        // L'action de la Charge (#266, A7) : rien à parer.
        ...(step.kind === 'support' &&
          step.intent.category === 'charge' && {
            line: { before: CHARGE_ACTION_LINE, strong: '', after: '' },
          }),
      };
    }
    case 'over':
      return { ...base, phase: null, pad: { kind: 'none' } };
  }
}
