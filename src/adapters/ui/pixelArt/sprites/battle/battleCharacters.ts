import { ATTACKS, type AttackKind } from '../../../../../domain/battle/attacks';
import { ENEMIES, type EnemyKind, type HeroKind } from '../../../../../domain/battle/combatants';
import type { Point, Sprite } from '../Sprite';
import { FACELESS_PRIOR_ANIMATION } from '../atelier/data/facelessPrior';
import { FALLEN_KNIGHT_ANIMATION } from '../atelier/data/fallenKnight';
import { GHOUL_ANIMATION } from '../atelier/data/ghoul';
import { MAD_VILLAGER_ANIMATION } from '../atelier/data/madVillager';
import { NECROMANCER_ANIMATION } from '../atelier/data/necromancer';
import { OSSUARY_WARDEN_ANIMATION } from '../atelier/data/ossuaryWarden';
import { SKELETON_ANIMATION } from '../atelier/data/skeleton';
import { SPECTER_ANIMATION } from '../atelier/data/specter';
import { TWINS_ANIMATION } from '../atelier/data/twins';
import { animationSprite, type FullAnimation } from '../atelier/fullAnimation';
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

/** Les images d'une héroïne : repos, garde levée, frappe, parade, esquive, touchée, déséquilibrée. */
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
  | 'off1';

export type BattleFrame = EnemyFrame | HeroFrame;

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
}

/**
 * L'animation complète de chaque ennemi, validée dans l'Atelier (#119, #137, #138, #139, ADR 0010) :
 * tous les ennemis, aucun n'est plus dessiné par le code.
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

function isHeroFrame(frame: BattleFrame): frame is HeroFrame {
  return (HERO_FRAMES as readonly string[]).includes(frame);
}

function isEnemyFrame(frame: BattleFrame): frame is EnemyFrame {
  return (ENEMY_FRAMES as readonly string[]).includes(frame);
}

/**
 * L'image `frame` d'un personnage du combat : la pose recopiée telle quelle de son animation
 * complète, sans liseré ni traînée (ADR 0010). Pour un ennemi, dans sa case du combat, peinte avec
 * sa palette rouge pour un coup imparable s'il la joue, et prise dans ses poses d'un coup quand le
 * coup `attack` en a pour cette image (#139). Pour une héroïne, dans la case du héros, sans rouge
 * (#140).
 */
export function battleSprite(
  character: BattleCharacter,
  frame: BattleFrame,
  { red = false, attack = null }: CharacterLook = {},
): CharacterImage {
  if (isHero(character)) {
    const animation: FullAnimation<HeroFrame> = HERO_ANIMATIONS[character];
    return animationSprite(animation, isHeroFrame(frame) ? frame : 'idle0', HERO_CELL);
  }
  return animationSprite(
    FULL_ANIMATIONS[character],
    isEnemyFrame(frame) ? frame : 'idle0',
    undefined,
    { red: red && playsRed(character), attack },
  );
}

/** Les ancrages qui servent au combat : le reflet (l'œil, les pointes) et les étoiles (la tête). */
export interface PoseAnchors {
  readonly eye: Point | null;
  readonly tips: readonly Point[];
  readonly head: Point;
}

/**
 * Les ancrages de la pose `frame` d'un ennemi (`poseAnchors`) : ceux de la pose affichée, prise
 * dans ses poses d'un coup quand le coup `attack` en a pour cette image.
 */
export function poseAnchors(
  character: EnemyKind,
  frame: EnemyFrame,
  attack: AttackKind | null = null,
): PoseAnchors {
  return animationSprite(FULL_ANIMATIONS[character], frame, undefined, { attack }).anchors;
}

/**
 * Le mouvement d'un coup qui a des poses d'un coup (#139), en nombres seuls pour la scène : sa
 * portée (`reach`, la part du chemin vers le héros à l'impact, `null` pour celle d'aujourd'hui) et
 * l'élévation de chacune de ses poses (`lift`, en pixels d'art, 0 par défaut). Une image absente de
 * `lift` n'est pas une pose du coup.
 */
export interface AttackMotion {
  readonly reach: number | null;
  readonly lift: Readonly<Partial<Record<EnemyFrame, number>>>;
}

/** Le mouvement de chaque coup d'un ennemi qui a des poses d'un coup. */
export type AttackMotions = Readonly<Partial<Record<AttackKind, AttackMotion>>>;

const motions = new Map<EnemyKind, AttackMotions>();

/** Le mouvement des coups de l'ennemi `kind` qui ont des poses d'un coup (`attackMotion`). */
export function attackMotion(kind: EnemyKind): AttackMotions {
  const cached = motions.get(kind);
  if (cached !== undefined) return cached;
  const { attackPoses = {} } = FULL_ANIMATIONS[kind] as FullAnimation<EnemyFrame>;
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
  motions.set(kind, motion);
  return motion;
}
