import { ATTACKS, type AttackKind } from '../../../../../domain/battle/attacks';
import { ENEMIES, type EnemyKind, type HeroKind } from '../../../../../domain/battle/combatants';
import type { Point, Sprite } from '../Sprite';
import { ASH_BRAMBLE_ANIMATION } from '../atelier/data/ashBramble';
import { ASH_GARDENER_ANIMATION } from '../atelier/data/ashGardener';
import { ASH_GLEANER_ANIMATION } from '../atelier/data/ashGleaner';
import { BRONZE_WARDEN_ANIMATION } from '../atelier/data/bronzeWarden';
import { FACELESS_PRIOR_ANIMATION } from '../atelier/data/facelessPrior';
import { FALLEN_KNIGHT_ANIMATION } from '../atelier/data/fallenKnight';
import { FIRST_PILGRIM_ANIMATION } from '../atelier/data/firstPilgrim';
import { GHOUL_ANIMATION } from '../atelier/data/ghoul';
import { HOUR_RINGER_ANIMATION } from '../atelier/data/hourRinger';
import { HOUR_RINGER_PHASE2 } from '../atelier/data/hourRingerPhase2';
import { MAD_VILLAGER_ANIMATION } from '../atelier/data/madVillager';
import { NECROMANCER_ANIMATION } from '../atelier/data/necromancer';
import { OSSUARY_WARDEN_ANIMATION } from '../atelier/data/ossuaryWarden';
import { SCARECROW_ANIMATION } from '../atelier/data/scarecrow';
import { SKELETON_ANIMATION } from '../atelier/data/skeleton';
import { SPECTER_ANIMATION } from '../atelier/data/specter';
import { STONE_SAINT_ANIMATION } from '../atelier/data/stoneSaint';
import { THORN_PILGRIM_ANIMATION } from '../atelier/data/thornPilgrim';
import { TWINS_ANIMATION } from '../atelier/data/twins';
import { WISH_GRANTER_ANIMATION } from '../atelier/data/wishGranter';
import { WISH_GRANTER_PHASE2 } from '../atelier/data/wishGranterPhase2';
import { BELL_FOUNDER_ANIMATION } from '../atelier/data/bellFounder';
import { BRAMBLE_BURNER_ANIMATION } from '../atelier/data/brambleBurner';
import { BURNING_HUSK_ANIMATION } from '../atelier/data/burningHusk';
import { GARGOYLE_ANIMATION } from '../atelier/data/gargoyle';
import { MOTH_QUEEN_ANIMATION } from '../atelier/data/mothQueen';
import { MOTH_QUEEN_PHASE2 } from '../atelier/data/mothQueenPhase2';
import { MOTHKIN_ANIMATION } from '../atelier/data/mothkin';
import { BELL_NOVICE_ANIMATION } from '../atelier/data/bellNovice';
import { CLOCK_JACK_ANIMATION } from '../atelier/data/clockJack';
import { GRAVEDIGGER_ANIMATION } from '../atelier/data/gravedigger';
import { BEADLE_ANIMATION } from '../atelier/data/beadle';
import { BELL_CLAPPER_ANIMATION } from '../atelier/data/bellClapper';
import { BRONZE_RAM_ANIMATION } from '../atelier/data/bronzeRam';
import { BRAMBLE_MOTHER_ANIMATION } from '../atelier/data/brambleMother';
import { MATINS_RINGER_ANIMATION } from '../atelier/data/matinsRinger';
import { animationSprite, type ExtraFrame, type FullAnimation } from '../atelier/fullAnimation';
import { HERO_ANIMATIONS, HERO_CELL, isHero } from './heroAnimations';

/** Un personnage du combat : un ennemi de trois quarts face, ou l'héroïne de dos. */
export type BattleCharacter = EnemyKind | HeroKind;

/** Les images d'un ennemi (maquette, `pxlib`) : repos, avancée, préparation, ruée, impact… */
export type EnemyFrame =
  | 'idle0'
  | 'idle1'
  | 'step0'
  | 'step1'
  | 'step2'
  | 'ant0'
  | 'ant1'
  | 'ant2'
  | 'hes'
  | 'lunge'
  | 'impact'
  | 'rec0'
  | 'rec1'
  | 'feint0'
  | 'feint1'
  | 'hurt'
  | 'down';

/**
 * Les images d'une héroïne : repos, garde levée, frappe, parade, esquive, touchée, déséquilibrée,
 * et le coup de bouclier (`bash`) et Fracas (`crush0`, `crush1`, #236), propres à la Sentinelle
 * (#155).
 */
export type HeroFrame =
  | 'idle0'
  | 'idle1'
  | 'raise'
  | 'raiseG'
  | 'atk0'
  | 'atk1'
  | 'parry0'
  | 'parry1'
  | 'dodge0'
  | 'dodge1'
  | 'hit0'
  | 'hit1'
  | 'off0'
  | 'off1'
  | 'bash'
  | 'crush0'
  | 'crush1';

/** Une image d'un ennemi dans la scène : ses 17 images, ou une de ses poses en plus (#38). */
export type SceneFrame = EnemyFrame | ExtraFrame;

export type BattleFrame = EnemyFrame | HeroFrame | ExtraFrame;

/** Les poses en plus (#38), dans l'ordre de l'atlas. */
export const EXTRA_FRAMES: readonly ExtraFrame[] = [
  'rise0',
  'rise1',
  'guard',
  'raiseAlly',
  'exhume',
  'charge0',
  'charge1',
  'chargeBroken',
];

export const ENEMY_FRAMES: readonly EnemyFrame[] = [
  'idle0',
  'idle1',
  'step0',
  'step1',
  'step2',
  'ant0',
  'ant1',
  'ant2',
  'hes',
  'lunge',
  'impact',
  'rec0',
  'rec1',
  'feint0',
  'feint1',
  'hurt',
  'down',
];

export const HERO_FRAMES: readonly HeroFrame[] = [
  'idle0',
  'idle1',
  'raise',
  'raiseG',
  'atk0',
  'atk1',
  'parry0',
  'parry1',
  'dodge0',
  'dodge1',
  'hit0',
  'hit1',
  'off0',
  'off1',
];

/**
 * Les poses propres à une héroïne, en plus des 14 poses du héros : le coup de bouclier de la
 * Sentinelle (#155) et les deux poses de Fracas (#236). Une héroïne future doit y figurer, même sans pose propre.
 */
const OWN_HERO_FRAMES = {
  sentinel: ['bash', 'crush0', 'crush1'],
  wanderer: [],
} satisfies Record<HeroKind, readonly HeroFrame[]>;

/** Les poses d'une héroïne (`heroFrames`) : les 14 poses du héros, puis les siennes. */
export function heroFrames(kind: HeroKind): readonly HeroFrame[] {
  return [...HERO_FRAMES, ...OWN_HERO_FRAMES[kind]];
}

/** Les images d'une attaque, les seules qui existent aussi en palette rouge (coup imparable). */
export const RED_FRAMES: readonly EnemyFrame[] = [
  'idle0',
  'step0',
  'step1',
  'step2',
  'ant0',
  'ant1',
  'ant2',
  'hes',
  'lunge',
  'impact',
  'rec0',
  'rec1',
  'feint0',
  'feint1',
];

/**
 * Les ancrages d'une image, en pixels d'art du sprite fini : l'œil (le reflet), les pointes des
 * griffes (le reflet double) et le haut de la tête (les étoiles).
 */
export interface SpriteAnchors {
  readonly eye: Point | null;
  readonly tips: readonly Point[];
  readonly head: Point | null;
}

export interface CharacterImage {
  readonly sprite: Sprite;
  readonly anchors: SpriteAnchors;
}

export interface CharacterLook {
  /**
   * Le liseré demandé par la scène : 0 aucun, 1 pointillé, 2 plein. Une pose recopiée n'en a
   * jamais (ADR 0010).
   */
  readonly tier?: 0 | 1 | 2;
  /** La palette rouge du coup imparable. */
  readonly red?: boolean;
  /** Le type de coup préparé : ses poses d'un coup remplacent celles de l'animation complète. */
  readonly attack?: AttackKind | null;
  /** Un boss en phase 2 : les poses de son aspect de phase 2, s'il en a un (#38). */
  readonly phase2?: boolean;
}

/**
 * L'animation complète de chaque ennemi, validée dans l'Atelier (#119, #137, #138, #139, #38, ADR
 * 0010) : tous les ennemis, aucun n'est plus dessiné par le code.
 */
const FULL_ANIMATIONS = {
  ghoul: GHOUL_ANIMATION,
  madVillager: MAD_VILLAGER_ANIMATION,
  skeleton: SKELETON_ANIMATION,
  necromancer: NECROMANCER_ANIMATION,
  specter: SPECTER_ANIMATION,
  fallenKnight: FALLEN_KNIGHT_ANIMATION,
  facelessPrior: FACELESS_PRIOR_ANIMATION,
  twins: TWINS_ANIMATION,
  ossuaryWarden: OSSUARY_WARDEN_ANIMATION,
  // Les paliers 2 et 3 (#38) ; l'aspect de phase 2 d'un boss recopié à part y est joint.
  thornPilgrim: THORN_PILGRIM_ANIMATION,
  ashBramble: ASH_BRAMBLE_ANIMATION,
  ashGleaner: ASH_GLEANER_ANIMATION,
  bronzeWarden: BRONZE_WARDEN_ANIMATION,
  scarecrow: SCARECROW_ANIMATION,
  firstPilgrim: FIRST_PILGRIM_ANIMATION,
  stoneSaint: STONE_SAINT_ANIMATION,
  ashGardener: ASH_GARDENER_ANIMATION,
  hourRinger: { ...HOUR_RINGER_ANIMATION, phase2: HOUR_RINGER_PHASE2 },
  wishGranter: { ...WISH_GRANTER_ANIMATION, phase2: WISH_GRANTER_PHASE2 },
  // La Brûlure (#171).
  burningHusk: BURNING_HUSK_ANIMATION,
  gargoyle: GARGOYLE_ANIMATION,
  bellFounder: BELL_FOUNDER_ANIMATION,
  brambleBurner: BRAMBLE_BURNER_ANIMATION,
  // L'Invocation (#172) : la Reine, son aspect de phase 2 joint, et la Phalénide.
  mothQueen: { ...MOTH_QUEEN_ANIMATION, phase2: MOTH_QUEEN_PHASE2 },
  mothkin: MOTHKIN_ANIMATION,
  // Le Beffroi (#214).
  bellNovice: BELL_NOVICE_ANIMATION,
  matinsRinger: MATINS_RINGER_ANIMATION,
  clockJack: CLOCK_JACK_ANIMATION,
  // Le Fossoyeur (#258).
  gravedigger: GRAVEDIGGER_ANIMATION,
  // La Mère-ronce et le Bedeau (#259).
  brambleMother: BRAMBLE_MOTHER_ANIMATION,
  beadle: BEADLE_ANIMATION,
  // Le Bélier de bronze et le Battant de cloche (#266).
  bronzeRam: BRONZE_RAM_ANIMATION,
  bellClapper: BELL_CLAPPER_ANIMATION,
} satisfies Record<EnemyKind, FullAnimation<EnemyFrame>>;

/** Les ennemis animés (`ANIMATED_ENEMIES`) : les clés du registre des animations complètes. */
export const ANIMATED_ENEMIES = Object.keys(FULL_ANIMATIONS) as readonly EnemyKind[];

/**
 * Un ennemi joue sa palette rouge (ADR 0010 § 4) s'il a un coup imparable, phase 2 comprise : lu
 * dans le domaine, sans liste en double.
 */
export function playsRed(kind: EnemyKind): boolean {
  const { moves, phase2Moves = [] } = ENEMIES[kind];
  return [...moves, ...phase2Moves].some((move) => ATTACKS[move.attack].perilous);
}

function isEnemyFrame(frame: BattleFrame): frame is EnemyFrame {
  return (ENEMY_FRAMES as readonly string[]).includes(frame);
}

/** Un boss qui a un aspect de phase 2 (#38). */
export function hasPhase2(kind: EnemyKind): boolean {
  return (FULL_ANIMATIONS[kind] as FullAnimation<EnemyFrame>).phase2 !== undefined;
}

/** Les poses en plus de l'ennemi `kind` (#38), celles de son aspect de phase 2 avec `phase2`. */
export function enemyExtraFrames(kind: EnemyKind, phase2 = false): readonly ExtraFrame[] {
  const animation: FullAnimation<EnemyFrame> = FULL_ANIMATIONS[kind];
  const { frames } = (phase2 ? animation.phase2 : undefined) ?? animation;
  return EXTRA_FRAMES.filter((frame) => Object.hasOwn(frames, frame));
}

/** L'image d'un ennemi à dessiner : la sienne, ou `idle0` pour une image qu'il n'a pas. */
function enemyFrameOf(kind: EnemyKind, frame: BattleFrame, phase2: boolean): SceneFrame {
  if (isEnemyFrame(frame)) return frame;
  const extra = frame as ExtraFrame;
  return enemyExtraFrames(kind, phase2).includes(extra) ? extra : 'idle0';
}

/**
 * L'image `frame` d'un personnage du combat : la pose recopiée telle quelle de son animation
 * complète, sans liseré ni traînée (ADR 0010). Pour un ennemi, dans sa case du combat, peinte avec
 * sa palette rouge pour un coup imparable s'il la joue, et prise dans ses poses d'un coup quand le
 * coup `attack` en a pour cette image (#139). Pour une héroïne, dans la case du héros, sans rouge
 * (#140) : une pose qu'elle n'a pas (une image d'ennemi, ou `bash` pour l'Errante) montre `idle0`.
 * Un ennemi montre ses poses en plus (#38), ou `idle0` s'il ne les a pas ; avec `phase2`, un boss
 * prend son aspect de phase 2.
 */
export function battleSprite(
  character: BattleCharacter,
  frame: BattleFrame,
  { red = false, attack = null, phase2 = false }: CharacterLook = {},
): CharacterImage {
  if (isHero(character)) {
    const animation: FullAnimation = HERO_ANIMATIONS[character];
    const own = (heroFrames(character) as readonly string[]).includes(frame);
    return animationSprite(animation, own ? frame : 'idle0', HERO_CELL);
  }
  const animation: FullAnimation<EnemyFrame> = FULL_ANIMATIONS[character];
  return animationSprite(animation, enemyFrameOf(character, frame, phase2), undefined, {
    red: red && playsRed(character),
    attack,
    phase2,
  });
}

/** Les ancrages qui servent au combat : le reflet (l'œil, les pointes) et les étoiles (la tête). */
export interface PoseAnchors {
  readonly eye: Point | null;
  readonly tips: readonly Point[];
  readonly head: Point;
}

/**
 * Les ancrages de la pose `frame` d'un ennemi (`poseAnchors`) : ceux de la pose affichée, prise
 * dans ses poses d'un coup quand le coup `attack` en a pour cette image, et dans son aspect de
 * phase 2 avec `phase2` (#38).
 */
export function poseAnchors(
  character: EnemyKind,
  frame: SceneFrame,
  attack: AttackKind | null = null,
  phase2 = false,
): PoseAnchors {
  const animation: FullAnimation<EnemyFrame> = FULL_ANIMATIONS[character];
  return animationSprite(animation, frame, undefined, { attack, phase2 }).anchors;
}

/**
 * Le mouvement d'un coup qui a des poses d'un coup (#139), en nombres seuls pour la scène : sa
 * portée (`reach`, un facteur sur le chemin du coup vers le héros, l'avancée exceptée ; `null` pour
 * le chemin d'aujourd'hui) et l'élévation de chacune de ses poses (`lift`, en pixels d'art, 0 par
 * défaut). Une image absente de `lift` n'est pas une pose du coup.
 */
export interface AttackMotion {
  readonly reach: number | null;
  readonly lift: Readonly<Partial<Record<EnemyFrame, number>>>;
}

/** Le mouvement de chaque coup d'un ennemi qui a des poses d'un coup. */
export type AttackMotions = Readonly<Partial<Record<AttackKind, AttackMotion>>>;

const motions = new Map<string, AttackMotions>();

/**
 * Le mouvement des coups de l'ennemi `kind` qui ont des poses d'un coup (`attackMotion`), ceux de
 * son aspect de phase 2 avec `phase2` (#38) ; sans aspect de phase 2, ceux de la phase 1.
 */
export function attackMotion(kind: EnemyKind, phase2 = false): AttackMotions {
  const shifted = phase2 && hasPhase2(kind);
  const key = shifted ? `${kind}:phase2` : kind;
  const cached = motions.get(key);
  if (cached !== undefined) return cached;
  const animation: FullAnimation<EnemyFrame> = FULL_ANIMATIONS[kind];
  const { attackPoses = {} } = (shifted ? animation.phase2 : undefined) ?? animation;
  const motion = Object.fromEntries(
    Object.entries(attackPoses).map(([attack, poses]) => [
      attack,
      {
        reach: poses.reach ?? null,
        lift: Object.fromEntries(
          Object.keys(poses.frames).map((frame) => [frame, poses.lift?.[frame as EnemyFrame] ?? 0]),
        ),
      },
    ]),
  );
  motions.set(key, motion);
  return motion;
}
