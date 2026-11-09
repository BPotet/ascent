/**
 * La scène du combat en pixel art 2.5D (ADR 0008) : un seul canevas Skia, transparent, qui dessine
 * les ombres au sol, les ennemis (l'ennemi actif en dernier), le héros et les effets, sans anneau
 * (ADR 0006). Le décor est le fond de palier (`TierBackdrop`, #176), sous tout l'écran de combat.
 * Les images des personnages et des effets viennent d'atlas précalculés au montage ; l'`Atlas` de
 * Skia les dessine, et chaque image est choisie sur le fil UI par les fonctions pures de `scene/`,
 * calées sur les instants nominaux des événements de combat : aucun rendu React par image.
 *
 * Sous Jest, Skia reste limité à son test de fumée : les tests d'écran simulent ce module.
 */
import {
  Atlas,
  Canvas,
  Circle,
  ColorMatrix,
  DashPathEffect,
  FilterMode,
  Image,
  MipmapMode,
  Path,
  RadialGradient,
  Rect,
  Skia,
  useRSXformBuffer,
  useRectBuffer,
  vec,
  type SkImage,
} from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import {
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  type DerivedValue,
  type SharedValue,
} from 'react-native-reanimated';

import type { AttackKind } from '../../../domain/battle/attacks';
import type { EnemyKind, HeroKind } from '../../../domain/battle/combatants';
import { artPalette } from '../pixelArt/artPalette';
import { toSkImage } from '../pixelArt/SpriteCanvas';
import type { Point } from '../pixelArt/sprites/Sprite';
import { atlasRect, battleAtlas, type AtlasTable } from '../pixelArt/sprites/battle/battleAtlas';
import type { ExtraFrame } from '../pixelArt/sprites/atelier/fullAnimation';
import {
  ENEMY_FRAMES,
  attackMotion,
  enemyExtraFrames,
  hasPhase2,
  poseAnchors,
  type AttackMotions,
  type BattleCharacter,
  type BattleFrame,
  type EnemyFrame,
  type SceneFrame,
} from '../pixelArt/sprites/battle/battleCharacters';
import {
  effectTableRect,
  effectsAtlas,
  vignetteImage,
  type EffectKind,
  type EffectTable,
} from '../pixelArt/sprites/battle/battleEffects';
import { GROUND_SHADOW_OPACITY, groundShadowImage } from '../pixelArt/sprites/battle/battleStage';
import { HERO_ANIMATIONS } from '../pixelArt/sprites/battle/heroAnimations';
import { enemyPose, restPose } from './scene/enemyPose';
import { spriteOrigin, type EnemySlot, type SceneGeometry } from './scene/sceneGeometry';
import { BASH_ADVANCE_DP, heroFrame } from './scene/heroFrame';
import { SHADOW_STEP_MATRIX, shadowStepGhost, type ShadowStepScene } from './scene/shadowStep';
import {
  bulwarkShards,
  bulwarkShield,
  glintSprites,
  hurtLevel,
  impactFlash,
  riposteBurst,
  riposteWave,
  sparkFrame,
} from './scene/sceneEffects';
import { burnFlames, burnHitFrame } from './scene/burnFlames';
import { exhumeDustFrame, exhumeLook } from './scene/exhumeRise';
import { summonDustFrame, summonedOpacity, type SceneSummon } from './scene/summonDust';
import { risenPose, secondChanceLook, type SceneSecondChance } from './scene/secondChanceRise';
import {
  NO_SCENE_POWERS,
  holdFastHalo,
  mistVeilOpacity,
  retaliationBurst,
  type ScenePowers,
} from './scene/powerScene';
import type { HeroPose, SceneBurn, SceneEnemy, SceneSpark, SceneTimeline } from './sceneTypes';

export interface BattleSceneProps {
  readonly width: number;
  readonly height: number;
  /** La géométrie commune à la scène et aux colonnes des ennemis. */
  readonly geometry: SceneGeometry;
  readonly enemies: readonly SceneEnemy[];
  /** L'héroïne de l'ascension, dessinée avec son animation complète (#140). */
  readonly heroKind: HeroKind;
  readonly heroPose: HeroPose;
  readonly heroPoseSince: number;
  /** L'ennemi visé par la frappe du héros (son élan va vers lui). */
  readonly strikeTarget: number;
  /** L'impact de la frappe en rythme en cours : la lame brille autour. */
  readonly strikeImpactAt: number | null;
  /** L'action de l'ennemi actif, `null` sans action. */
  readonly timeline: SceneTimeline | null;
  readonly spark: SceneSpark | null;
  readonly hurtAt: number | null;
  /** Le Rempart est actif : son écu est devant le héros (#128). Par défaut, non. */
  readonly bulwark?: boolean;
  /** L'instant où le Rempart s'est usé (l'écu se fend puis éclate), `null` sinon. */
  readonly bulwarkWornAt?: number | null;
  /** La dernière Riposte du Rempart : l'onde va de l'écu à l'ennemi `enemy`. */
  readonly riposte?: { readonly at: number; readonly enemy: number } | null;
  /** Pas de l'ombre est actif (#173) : l'ombre violette derrière l'Errante. Par défaut, non. */
  readonly shadowStep?: ShadowStepScene | null;
  /** La Brûlure du héros (#171) : ses flammes, l'éclat de braise et la fumée. Par défaut, aucune. */
  readonly burn?: SceneBurn | null;
  /**
   * L'Invocation (#172) : la poussière des places annoncées, la sortie des invoqués et leur chute
   * avec le boss. Par défaut, aucune.
   */
  readonly summon?: SceneSummon | null;
  /**
   * Le relèvement de la seconde chance (#206, S2, S3) : le héros gris pendant le gel, puis le voile,
   * le halo d'or et la pose « raise ». Par défaut, aucun.
   */
  readonly secondChance?: SceneSecondChance | null;
  /**
   * Les pouvoirs de #235, dessinés en code : le halo de Tenir bon, le voile de Brume, la marque
   * d'Entaille et l'éclat d'or de Représailles. Par défaut, aucun.
   */
  readonly powers?: ScenePowers;
  readonly reducedMotion: boolean;
  /** L'horloge du fil UI : un worklet, sur la base de l'horloge de combat (méthode a). */
  readonly uiNow: () => number;
}

/** Un atlas prêt à dessiner : son image Skia et sa table. */
interface PreparedAtlas {
  readonly image: SkImage | null;
  readonly table: AtlasTable;
}

/** Les ancrages d'une pose d'un ennemi : l'œil et les pointes (le reflet), la tête (les étoiles). */
interface EnemyAnchors {
  readonly eye: Point | null;
  readonly tips: readonly Point[];
  readonly head: Point;
}

/** Les ancrages des poses d'un coup d'un ennemi : type de coup, puis pose. */
type AttackAnchors = Readonly<
  Partial<Record<AttackKind, Readonly<Partial<Record<EnemyFrame, EnemyAnchors>>>>>
>;

/** Les ancrages de chaque pose d'un ennemi, poses en plus comprises (#38). */
type PoseAnchorTable = Readonly<Record<EnemyFrame, EnemyAnchors>> &
  Readonly<Partial<Record<ExtraFrame, EnemyAnchors>>>;

/**
 * Les ennemis préparés (#38, avenant à l'ADR 0008 § 5) : par type, à la demande. Un type absent ne
 * se dessine pas ; il ne peut pas arriver, la scène prépare ceux qu'elle montre.
 */
interface PreparedEnemies {
  readonly characters: Partial<Record<EnemyKind, PreparedAtlas>>;
  /** Les ancrages de chaque pose de chaque ennemi (`poseAnchors`). */
  readonly anchors: Partial<Record<EnemyKind, PoseAnchorTable>>;
  /** Les ancrages de chaque pose d'un coup de chaque ennemi (#139). */
  readonly attackAnchors: Partial<Record<EnemyKind, AttackAnchors>>;
  /** La portée et l'élévation des coups qui ont des poses d'un coup, par ennemi (#139). */
  readonly motions: Partial<Record<EnemyKind, AttackMotions>>;
}

export interface PreparedScene extends PreparedEnemies {
  /** L'aspect de phase 2 des boss qui en ont un (#38), aux mêmes tables. */
  readonly phase2: PreparedEnemies;
  /** Les poses en plus de chaque ennemi (#38). */
  readonly extras: Partial<Record<EnemyKind, readonly ExtraFrame[]>>;
  /** L'atlas de chaque héroïne, toutes préparées : celle de l'ascension est choisie au rendu. */
  readonly heroes: Readonly<Record<HeroKind, PreparedAtlas>>;
  readonly effects: { readonly image: SkImage | null; readonly table: EffectTable };
  /** L'ombre au sol (#184), la même sous chaque personnage. */
  readonly groundShadow: SkImage | null;
}

/** Ce qu'un personnage affiche à une image : son image dans l'atlas et sa place, en dp. */
interface SpriteLook<Frame extends BattleFrame = BattleFrame> {
  readonly frame: Frame;
  readonly tier: number;
  readonly red: boolean;
  /** Le type de coup dont l'image vient (ses poses d'un coup), `null` pour l'animation complète. */
  readonly poses: AttackKind | null;
  readonly x: number;
  readonly y: number;
}

// Stryker disable all: dessin de la scène, vérifié par la conformité aux maquettes (barrière 10 bis).
const NEAREST = { filter: FilterMode.Nearest, mipmap: MipmapMode.None } as const;
/** Les autres ennemis : à 30 %, désaturés et assombris (maquette, `.pfoe.dim`). */
const DIMMED_OPACITY = 0.3;
/** L'ombre de Pas de l'ombre : chaque pixel en violet (#173). */
const SHADE = [...SHADOW_STEP_MATRIX];
const FADED = [
  0.106, 0.358, 0.036, 0, 0, 0.106, 0.358, 0.036, 0, 0, 0.106, 0.358, 0.036, 0, 0, 0, 0, 0, 1, 0,
];
/**
 * Les places de l'atlas des effets : éclair, étincelle, deux reflets, trois étoiles, l'écu du
 * Rempart, ses 4 éclats, les 4 éclats de la riposte sur l'ennemi (#128), la Brûlure (#171) : 5
 * flammes ou fumées et l'éclat de braise, et la poussière de l'Invocation sur 3 places (#172), d'os
 * pour l'Exhumation (#258).
 */
const EFFECT_SLOTS = 25;
/** Les nombres d'une place : effet, image, x, y, échelle. */
const EFFECT_FIELDS = 5;
const EFFECT_ORDER: readonly EffectKind[] = [
  'flash',
  'gold',
  'steel',
  'glintWhite',
  'glintRed',
  'glintDull',
  'stars',
  'shield',
  'silverShard',
  'burn',
  'burnHit',
  'burnOut',
  'summon',
  'boneDust',
];
/**
 * L'écu du Rempart, en pixels d'art du héros (maquette, `.aura`) : le centre de sa case de 15, calé
 * sur un pixel entier, et le départ de l'onde.
 */
const SHIELD_CENTER = { x: 34.5, y: 19.5 } as const;
const WAVE_START = { x: 40, y: 17 } as const;
/** L'onde d'argent en pointillé (maquette, `.wave`) : 8 dp de haut, traits de 10 dp tous les 16 dp. */
const WAVE_WIDTH = 8;
const WAVE_DASHES = [10, 6];
const NO_ENEMY: SceneEnemy = {
  kind: 'ghoul',
  standing: false,
  target: false,
  dimmed: false,
  active: false,
  down: false,
  losingAction: false,
  rising: null,
  downSince: null,
};
const NO_SUMMON: SceneSummon = { pending: [], calledAt: null, entered: {}, fell: {} };

/** Le halo d'or de la seconde chance (#206, S3), autour du torse du héros, à sa pleine taille. */
const HALO_RADIUS_DP = 72;
const HALO_COLORS = [`${artPalette.roles.gold}8C`, `${artPalette.roles.gold}00`];
/** Le voile de Brume (#235), autour du torse de l'Errante. */
const MIST_RADIUS_DP = 44;
/** La marque d'Entaille (#235) : une entaille de braise en travers de la cible, en dp. */
const REND_MARK = { dx: 12, dy: 10, width: 4 } as const;
const NO_SLOT: EnemySlot = {
  column: { x: 0, y: 0, width: 0 },
  sprite: { x: 0, y: 0, width: 0, height: 0 },
  groundShadowAt: { x: 0, y: 0 },
  reach: { x: 0, y: 0 },
  plateBottom: 0,
};

let prepared: PreparedScene | null = null;

/** Un atlas en image Skia, avec sa table. */
function atlasOf(character: BattleCharacter, phase2 = false): PreparedAtlas {
  const atlas = battleAtlas(character, { phase2 });
  return { image: toSkImage(atlas), table: atlas.table };
}

/** Prépare l'ennemi `kind` dans `tables`, phase 1 ou aspect de phase 2. */
function prepareEnemy(tables: PreparedEnemies, kind: EnemyKind, phase2: boolean): void {
  const frames: readonly SceneFrame[] = [...ENEMY_FRAMES, ...enemyExtraFrames(kind, phase2)];
  tables.characters[kind] = atlasOf(kind, phase2);
  tables.anchors[kind] = Object.fromEntries(
    frames.map((frame) => [frame, poseAnchors(kind, frame, null, phase2)]),
  ) as PoseAnchorTable;
  const motions = attackMotion(kind, phase2);
  tables.attackAnchors[kind] = Object.fromEntries(
    Object.entries(motions).map(([attack, motion]) => [
      attack,
      Object.fromEntries(
        Object.keys(motion?.lift ?? {}).map((frame) => [
          frame,
          poseAnchors(kind, frame as EnemyFrame, attack as AttackKind, phase2),
        ]),
      ),
    ]),
  );
  tables.motions[kind] = motions;
}

const emptyTables = (): PreparedEnemies => ({
  characters: {},
  anchors: {},
  attackAnchors: {},
  motions: {},
});

/**
 * Prépare les atlas de la scène (`prepareBattleScene`) : les héroïnes, les effets et l'ombre au sol une
 * fois par lancement (cache de module) ; les ennemis par type, à la demande (#38, avenant à
 * l'ADR 0008 § 5), ceux de `kinds` (première ligne et réserve du combat), aspect de phase 2
 * compris. Pendant « Préparation du combat… », jamais pendant la phase ennemie ; « Rejouer » les
 * garde.
 */
export function prepareBattleScene(kinds: readonly EnemyKind[]): PreparedScene {
  if (prepared === null) {
    const effects = effectsAtlas();
    prepared = {
      ...emptyTables(),
      phase2: emptyTables(),
      extras: {},
      heroes: Object.fromEntries(
        (Object.keys(HERO_ANIMATIONS) as HeroKind[]).map((kind) => [kind, atlasOf(kind)]),
      ) as Record<HeroKind, PreparedAtlas>,
      effects: { image: toSkImage(effects), table: effects.table },
      groundShadow: toSkImage(groundShadowImage()),
    };
  }
  for (const kind of kinds) {
    if (prepared.characters[kind] !== undefined) continue;
    prepareEnemy(prepared, kind, false);
    prepared.extras[kind] = enemyExtraFrames(kind);
    if (hasPhase2(kind)) prepareEnemy(prepared.phase2, kind, true);
  }
  return prepared;
}

/** Les tables d'un ennemi à dessiner : celles de son aspect de phase 2 quand il y est passé. */
function tablesOf(scene: PreparedScene, enemy: SceneEnemy): PreparedEnemies {
  return enemy.phase2 === true && scene.phase2.characters[enemy.kind] !== undefined
    ? scene.phase2
    : scene;
}

const NO_EXTRAS: readonly ExtraFrame[] = [];
const NO_MOTIONS: AttackMotions = {};

/** Une image en pixels d'art, de 2 dp par défaut, sans lissage. */
function ArtImage({
  image,
  x,
  y,
  scale = 2,
  opacity,
}: {
  readonly image: SkImage | null;
  readonly x: number;
  readonly y: number;
  readonly scale?: number;
  readonly opacity?: DerivedValue<number> | number;
}) {
  return (
    <Image
      image={image}
      x={x}
      y={y}
      width={(image?.width() ?? 0) * scale}
      height={(image?.height() ?? 0) * scale}
      sampling={NEAREST}
      {...(opacity === undefined ? {} : { opacity })}
    />
  );
}

/**
 * Une ombre au sol (#184), le milieu de son bas en `at`, à l'échelle du personnage : fixe, la même
 * dans tous ses états.
 */
function GroundShadow({
  image,
  at,
  scale,
  opacity = GROUND_SHADOW_OPACITY,
}: {
  readonly image: SkImage | null;
  readonly at: { readonly x: number; readonly y: number };
  readonly scale: number;
  /** Son opacité : celle de l'ombre au sol, sauf un invoqué retombé en poussière (#172). */
  readonly opacity?: DerivedValue<number> | number;
}) {
  return (
    <ArtImage
      image={image}
      x={at.x - ((image?.width() ?? 0) * scale) / 2}
      y={at.y - (image?.height() ?? 0) * scale}
      scale={scale}
      opacity={opacity}
    />
  );
}

/** Un personnage, dessiné par l'`Atlas` de Skia : son image et sa place changent sur le fil UI. */
function AtlasSprite<Frame extends BattleFrame | SceneFrame>({
  atlas,
  look,
  scale,
  faded = false,
  shade,
  opacity,
}: {
  readonly atlas: PreparedAtlas;
  readonly look: DerivedValue<SpriteLook<Frame>>;
  readonly scale: number;
  readonly faded?: boolean;
  /** L'ombre de Pas de l'ombre (#173) : le sprite peint en violet, à cette opacité. */
  readonly shade?: DerivedValue<number>;
  /** L'opacité d'un ennemi qui sort de la poussière ou y retombe (#172). */
  readonly opacity?: DerivedValue<number>;
}) {
  const { table } = atlas;
  const sprites = useRectBuffer(1, (rect) => {
    'worklet';
    const current = look.get();
    const cell = atlasRect(table, current.frame, current.tier, current.red, current.poses);
    rect.setXYWH(cell.x, cell.y, cell.width, cell.height);
  });
  const transforms = useRSXformBuffer(1, (transform) => {
    'worklet';
    const current = look.get();
    transform.set(scale, 0, current.x, current.y);
  });
  return (
    <Atlas
      image={atlas.image}
      sprites={sprites}
      transforms={transforms}
      sampling={NEAREST}
      opacity={shade ?? opacity ?? (faded ? DIMMED_OPACITY : 1)}
    >
      {faded ? <ColorMatrix matrix={FADED} /> : null}
      {shade ? <ColorMatrix matrix={SHADE} /> : null}
    </Atlas>
  );
}

/**
 * La pose d'un ennemi à chaque image : active (son action), ou au repos. Sa case part de `origin`,
 * calculée sur le fil JS (`spriteOrigin`), jamais dans le worklet. Une pose d'un coup élevée
 * (`lift`, #139) monte de 2 dp par pixel d'art.
 */
function useEnemyLook(
  enemy: SceneEnemy,
  index: number,
  slot: EnemySlot,
  origin: { readonly x: number; readonly y: number },
  motions: AttackMotions,
  extras: readonly ExtraFrame[],
  clock: SharedValue<number>,
  timeline: SharedValue<SceneTimeline | null>,
  reducedMotion: boolean,
): DerivedValue<SpriteLook<SceneFrame>> {
  const { standing, down, losingAction, rising, downSince, exhumedAt } = enemy;
  const { reach } = slot;
  const { x, y } = origin;
  return useDerivedValue<SpriteLook<SceneFrame>>(() => {
    'worklet';
    const now = clock.get();
    const current = timeline.get();
    if (current !== null && current.enemy === index && standing) {
      const pose = enemyPose(current, now, reducedMotion, motions, extras);
      return {
        frame: pose.frame,
        tier: pose.tier,
        red: pose.red,
        poses: pose.poses,
        x: x + Math.round((reach.x * pose.reach + pose.jitter) / 2) * 2,
        y: y + Math.round((reach.y * pose.reach) / 2) * 2 - pose.lift * 2,
      };
    }
    // Le Squelette exhumé sort de terre (#258) : le tas d'os, puis il monte, sous le sol d'abord.
    const exhuming = standing ? exhumeLook(exhumedAt, now, reducedMotion) : null;
    if (exhuming !== null) {
      return { frame: exhuming.frame, tier: 0, red: false, poses: null, x, y: y + exhuming.sink };
    }
    const rest = restPose({ standing, down, losingAction, rising, downSince }, index, now, extras);
    return { frame: rest.frame, tier: 0, red: false, poses: null, x, y };
  }, [
    exhumedAt,
    clock,
    timeline,
    index,
    standing,
    down,
    losingAction,
    rising,
    downSince,
    x,
    y,
    reach,
    motions,
    extras,
  ]);
}

/** Un palier de la vignette rouge, visible seulement à son palier. */
function VignetteLayer({
  image,
  level,
  current,
}: {
  readonly image: SkImage | null;
  readonly level: number;
  readonly current: DerivedValue<number>;
}) {
  const opacity = useDerivedValue<number>(
    () => (current.get() === level ? 1 : 0),
    [current, level],
  );
  return <ArtImage image={image} x={0} y={0} opacity={opacity} />;
}

/** La scène du combat : un seul canevas Skia, sous les colonnes des ennemis et les boutons. */
export function BattleScene({
  width,
  height,
  geometry,
  enemies,
  heroKind,
  heroPose,
  heroPoseSince,
  strikeTarget,
  strikeImpactAt,
  timeline,
  spark,
  hurtAt,
  bulwark = false,
  bulwarkWornAt = null,
  riposte = null,
  shadowStep = null,
  burn = null,
  summon = null,
  secondChance = null,
  powers = NO_SCENE_POWERS,
  reducedMotion,
  uiNow,
}: BattleSceneProps) {
  const scene = prepareBattleScene(enemies.map((enemy) => enemy.kind));
  const clock = useSharedValue(0);
  const sharedTimeline = useSharedValue<SceneTimeline | null>(timeline);
  const sharedSpark = useSharedValue<SceneSpark | null>(spark);
  const sharedHurt = useSharedValue<number | null>(hurtAt);
  const sharedHero = useSharedValue({ pose: heroPose, since: heroPoseSince, strikeImpactAt });
  const sharedBulwark = useSharedValue({ active: bulwark, wornAt: bulwarkWornAt, riposte });
  const sharedShadowStep = useSharedValue(shadowStep);
  useEffect(() => sharedShadowStep.set(shadowStep), [sharedShadowStep, shadowStep]);
  const sharedBurn = useSharedValue(burn);
  useEffect(() => sharedBurn.set(burn), [sharedBurn, burn]);
  const sharedRise = useSharedValue(secondChance);
  useEffect(() => sharedRise.set(secondChance), [sharedRise, secondChance]);
  const sharedPowers = useSharedValue(powers);
  useEffect(() => sharedPowers.set(powers), [sharedPowers, powers]);
  const sharedSummon = useSharedValue(summon ?? NO_SUMMON);
  useEffect(() => sharedSummon.set(summon ?? NO_SUMMON), [sharedSummon, summon]);

  useEffect(() => sharedTimeline.set(timeline), [sharedTimeline, timeline]);
  useEffect(() => sharedSpark.set(spark), [sharedSpark, spark]);
  useEffect(() => sharedHurt.set(hurtAt), [sharedHurt, hurtAt]);
  useEffect(
    () => sharedBulwark.set({ active: bulwark, wornAt: bulwarkWornAt, riposte }),
    [sharedBulwark, bulwark, bulwarkWornAt, riposte],
  );
  useEffect(
    () => sharedHero.set({ pose: heroPose, since: heroPoseSince, strikeImpactAt }),
    [sharedHero, heroPose, heroPoseSince, strikeImpactAt],
  );

  // L'horloge de la scène, lue à chaque image sur le fil UI.
  useFrameCallback(() => {
    clock.set(uiNow());
  });

  const { hero, chest, enemies: slots } = geometry;
  const vignettes = useMemo(
    () =>
      [0, 1, 2, 3, 4].map((level) =>
        toSkImage(vignetteImage(Math.floor(width / 2), Math.floor(height / 2), level)),
      ),
    [width, height],
  );
  // Les tables de chaque place : celles de l'aspect de phase 2 d'un boss qui y est passé (#38).
  const tables = [0, 1, 2].map((index) => tablesOf(scene, enemies[index] ?? NO_ENEMY));
  const kindAt = (index: number) => (enemies[index] ?? NO_ENEMY).kind;
  // L'origine de chaque case, à la taille de l'entité (ADR 0010 § 3), calculée hors des worklets.
  const origins = [0, 1, 2].map((index) => {
    const table = tables[index]!.characters[kindAt(index)]?.table;
    return spriteOrigin(
      (slots[index] ?? NO_SLOT).sprite,
      table?.cellWidth ?? 44,
      table?.cellHeight ?? 52,
    );
  });
  const motionsAt = (index: number) => tables[index]!.motions[kindAt(index)] ?? NO_MOTIONS;
  const extrasAt = (index: number) =>
    enemies[index]?.phase2 === true ? NO_EXTRAS : (scene.extras[kindAt(index)] ?? NO_EXTRAS);
  // Trois ennemis au plus : un crochet par place, dans le même ordre à chaque rendu.
  const looks = [
    useEnemyLook(
      enemies[0] ?? NO_ENEMY,
      0,
      slots[0] ?? NO_SLOT,
      origins[0]!,
      motionsAt(0),
      extrasAt(0),
      clock,
      sharedTimeline,
      reducedMotion,
    ),
    useEnemyLook(
      enemies[1] ?? NO_ENEMY,
      1,
      slots[1] ?? NO_SLOT,
      origins[1]!,
      motionsAt(1),
      extrasAt(1),
      clock,
      sharedTimeline,
      reducedMotion,
    ),
    useEnemyLook(
      enemies[2] ?? NO_ENEMY,
      2,
      slots[2] ?? NO_SLOT,
      origins[2]!,
      motionsAt(2),
      extrasAt(2),
      clock,
      sharedTimeline,
      reducedMotion,
    ),
  ];

  // L'Invocation (#172) : un invoqué paraît une fois la poussière levée, s'efface à sa chute ;
  // l'ombre au sol d'un invoqué retombé en poussière s'efface avec lui.
  const faded = enemies.map((enemy) => enemy.dimmed || !enemy.standing);
  // Le tas d'os à 70 %, puis la montée en fondu en mouvement réduit (#258).
  const exhumedAt = [0, 1, 2].map((index) => enemies[index]?.exhumedAt);
  const exhumed = enemies.map((enemy) => enemy.exhumedAt !== undefined);
  const shown0 = useDerivedValue(
    () => summonedOpacity(sharedSummon.get(), 0, clock.get(), reducedMotion),
    [sharedSummon, clock, reducedMotion],
  );
  const shown1 = useDerivedValue(
    () => summonedOpacity(sharedSummon.get(), 1, clock.get(), reducedMotion),
    [sharedSummon, clock, reducedMotion],
  );
  const shown2 = useDerivedValue(
    () => summonedOpacity(sharedSummon.get(), 2, clock.get(), reducedMotion),
    [sharedSummon, clock, reducedMotion],
  );
  const spriteOpacity0 = useDerivedValue(
    () =>
      shown0.get() *
      (faded[0] === true ? DIMMED_OPACITY : 1) *
      (exhumeLook(exhumedAt[0], clock.get(), reducedMotion)?.opacity ?? 1),
    [shown0, faded, exhumedAt, clock, reducedMotion],
  );
  const spriteOpacity1 = useDerivedValue(
    () =>
      shown1.get() *
      (faded[1] === true ? DIMMED_OPACITY : 1) *
      (exhumeLook(exhumedAt[1], clock.get(), reducedMotion)?.opacity ?? 1),
    [shown1, faded, exhumedAt, clock, reducedMotion],
  );
  const spriteOpacity2 = useDerivedValue(
    () =>
      shown2.get() *
      (faded[2] === true ? DIMMED_OPACITY : 1) *
      (exhumeLook(exhumedAt[2], clock.get(), reducedMotion)?.opacity ?? 1),
    [shown2, faded, exhumedAt, clock, reducedMotion],
  );
  const spriteOpacities = [spriteOpacity0, spriteOpacity1, spriteOpacity2];
  const fellSlots = Object.keys(summon?.fell ?? {}).map(Number);
  const summonedSlots = [
    ...Object.keys(summon?.entered ?? {}).map(Number),
    ...fellSlots,
    ...exhumed.flatMap((yes, index) => (yes ? [index] : [])),
  ];
  const shadow0 = useDerivedValue(
    () => GROUND_SHADOW_OPACITY * (fellSlots.includes(0) ? shown0.get() : 1),
    [shown0, fellSlots],
  );
  const shadow1 = useDerivedValue(
    () => GROUND_SHADOW_OPACITY * (fellSlots.includes(1) ? shown1.get() : 1),
    [shown1, fellSlots],
  );
  const shadow2 = useDerivedValue(
    () => GROUND_SHADOW_OPACITY * (fellSlots.includes(2) ? shown2.get() : 1),
    [shown2, fellSlots],
  );
  const shadowOpacities = [shadow0, shadow1, shadow2];
  const summonCenters = slots.map((slot) => ({
    x: slot.sprite.x + slot.sprite.width / 2,
    y: slot.sprite.y + slot.sprite.height / 2,
  }));

  const target = slots[strikeTarget] ?? NO_SLOT;
  const lunge = {
    x: (target.sprite.x + 44 - chest.x) * 0.4,
    y: (target.sprite.y + 104 - chest.y) * 0.4,
  };
  const heroLook = useDerivedValue<SpriteLook>(() => {
    'worklet';
    const { pose, since, strikeImpactAt: impactAt } = sharedHero.get();
    const now = clock.get();
    const current = heroFrame(pose, since, now, impactAt);
    // Le héros relevé par la seconde chance, après le gel (#206, S3).
    const frame = risenPose(sharedRise.get(), pose, since, now) ? 'raise' : current.frame;
    const dodge = reducedMotion ? current.dodge * 0.3 : current.dodge;
    const toward = reducedMotion ? current.lunge * 0.2 : current.lunge;
    // Le coup de bouclier, sur place : 4 dp en avant et retour, au quart en mouvement réduit.
    const push = BASH_ADVANCE_DP * current.push * (reducedMotion ? 0.25 : 1);
    return {
      frame,
      tier: current.tier,
      red: false,
      poses: null,
      x: hero.x + Math.round((-22 * dodge + lunge.x * toward + push) / 2) * 2,
      y: hero.y + Math.round((10 * dodge + lunge.y * toward) / 2) * 2,
    };
  }, [sharedHero, sharedRise, clock, hero, lunge, reducedMotion]);
  // La seconde chance (#206) : le héros gris, le voile et le halo d'or, sur l'horloge de la scène.
  const rising = useDerivedValue(
    () => secondChanceLook(sharedRise.get(), clock.get(), reducedMotion),
    [sharedRise, clock, reducedMotion],
  );
  const heroShown = useDerivedValue(() => 1 - rising.get().grey, [rising]);
  const heroGrey = useDerivedValue(() => rising.get().grey, [rising]);
  const riseVeil = useDerivedValue(() => rising.get().veil, [rising]);
  const haloOpacity = useDerivedValue(() => rising.get().halo, [rising]);
  const haloRadius = useDerivedValue(() => HALO_RADIUS_DP * rising.get().haloScale, [rising]);
  // Le halo d'or de Tenir bon (#235, K12), comme celui de la seconde chance.
  const holdFast = useDerivedValue(
    () => holdFastHalo(sharedPowers.get().healedAt, clock.get(), reducedMotion),
    [sharedPowers, clock, reducedMotion],
  );
  const holdFastOpacity = useDerivedValue(() => holdFast.get().halo, [holdFast]);
  const holdFastRadius = useDerivedValue(
    () => HALO_RADIUS_DP * holdFast.get().haloScale,
    [holdFast],
  );
  // L'ombre de Pas de l'ombre (#173) : l'image de l'Errante, glissée derrière elle.
  const ghost = useDerivedValue(
    () => shadowStepGhost(sharedShadowStep.get(), clock.get(), reducedMotion),
    [sharedShadowStep, clock, reducedMotion],
  );
  const ghostLook = useDerivedValue<SpriteLook>(
    () => ({ ...heroLook.get(), x: heroLook.get().x + (ghost.get()?.dx ?? 0) }),
    [heroLook, ghost],
  );
  const ghostOpacity = useDerivedValue(() => ghost.get()?.opacity ?? 0, [ghost]);

  // Les effets : [effet, image, x, y] par place, l'effet −1 pour une place vide.
  const effectTable = scene.effects.table;
  const kinds = enemies.map((enemy) => enemy.kind);
  // Les ancrages de la pose affichée de chaque place, aspect de phase 2 compris (#38).
  const anchors = tables.map((table, index) => table.anchors[kindAt(index)]);
  const attackAnchors = tables.map((table, index) => table.attackAnchors[kindAt(index)]);
  const stunned = enemies.map((enemy) => enemy.down && enemy.standing);
  const hops = enemies.map((enemy) => enemy.losingAction);
  // L'écu du Rempart devant le héros, à son échelle ; la riposte vise le centre d'un ennemi.
  const shieldAt = {
    x: hero.x + SHIELD_CENTER.x * hero.scale,
    y: hero.y + SHIELD_CENTER.y * hero.scale,
  };
  const enemyCenters = slots.map((slot) => ({
    x: slot.sprite.x + slot.sprite.width / 2,
    y: slot.sprite.y + Math.round(slot.sprite.height * 0.55),
  }));
  const effects = useDerivedValue(() => {
    'worklet';
    const now = clock.get();
    const current = sharedTimeline.get();
    const placed: number[] = [];
    const place = (kind: EffectKind, frame: number, x: number, y: number, scale = 2) => {
      if (placed.length < EFFECT_SLOTS * EFFECT_FIELDS) {
        placed.push(EFFECT_ORDER.indexOf(kind), frame, x, y, scale);
      }
    };
    const { active, wornAt, riposte: lastRiposte } = sharedBulwark.get();
    const shieldFrame = bulwarkShield(active, wornAt, now);
    if (shieldFrame !== null) place('shield', shieldFrame, shieldAt.x, shieldAt.y, hero.scale);
    for (const [dx, dy] of bulwarkShards(wornAt, now, reducedMotion)) {
      place('silverShard', 0, shieldAt.x + dx, shieldAt.y + dy);
    }
    const struck = lastRiposte === null ? undefined : enemyCenters[lastRiposte.enemy];
    if (struck !== undefined) {
      for (const [dx, dy] of riposteBurst(lastRiposte, now, reducedMotion)) {
        place('silverShard', 0, struck.x + dx, struck.y + dy);
      }
    }
    // L'éclat d'or de Représailles (#235) sur l'ennemi de la contre-attaque renforcée.
    const { retaliation } = sharedPowers.get();
    const countered = retaliation === null ? undefined : enemyCenters[retaliation.enemy];
    if (countered !== undefined) {
      for (const [dx, dy] of retaliationBurst(retaliation, now, reducedMotion)) {
        place('gold', 0, countered.x + dx, countered.y + dy);
      }
    }
    // La Brûlure (#171) : les flammes suivent le héros, à son échelle ; l'éclat de braise, au torse.
    const burning = sharedBurn.get();
    const { x: heroX, y: heroY } = heroLook.get();
    for (const flame of burnFlames(burning, now, reducedMotion)) {
      place(
        flame.effect,
        flame.frame,
        heroX + flame.x * hero.scale,
        heroY + flame.y * hero.scale,
        hero.scale,
      );
    }
    // La poussière de l'Invocation (#172), sur la case de chaque place, sous l'éclair ; en os pour
    // un Squelette exhumé, à sa sortie de terre et à sa chute avec le Fossoyeur (#258).
    const summoning = sharedSummon.get();
    for (let slot = 0; slot < summonCenters.length; slot += 1) {
      const center = summonCenters[slot];
      if (center === undefined) continue;
      const bone = exhumed[slot] === true;
      const frame =
        summonDustFrame(summoning, slot, now, reducedMotion) ??
        (bone ? exhumeDustFrame(exhumedAt[slot], now, reducedMotion) : null);
      if (frame !== null) place(bone ? 'boneDust' : 'summon', frame, center.x, center.y);
    }
    const flash = impactFlash(current, now);
    if (flash !== null) place('flash', flash, chest.x, chest.y);
    // L'éclat de braise par-dessus l'éclair d'impact (B1) : l'atlas dessine les places dans l'ordre.
    const ember = burnHitFrame(burning?.lit ?? null, now);
    if (ember !== null) place('burnHit', ember, chest.x, chest.y, hero.scale);
    const sparkNow = sharedSpark.get();
    const sparkStep = sparkFrame(sparkNow, now);
    if (sparkNow !== null && sparkStep !== null) {
      place(sparkNow.kind === 'gold' ? 'gold' : 'steel', sparkStep, chest.x, chest.y - 8);
    }
    if (current !== null && current.kind === 'attack') {
      const kind = kinds[current.enemy];
      const look = looks[current.enemy]?.get();
      if (kind !== undefined && look !== undefined) {
        // Les ancrages de la pose affichée : celle d'un coup quand elle en vient (#139).
        const own = attackAnchors[current.enemy];
        const shown =
          (look.poses === null ? undefined : own?.[look.poses]?.[look.frame as EnemyFrame]) ??
          anchors[current.enemy]?.[look.frame];
        for (const glint of shown === undefined ? [] : glintSprites(current.glints, now, shown)) {
          place(glint.effect, glint.frame, look.x + glint.x * 2 + 1, look.y + glint.y * 2 + 1);
        }
      }
    }
    for (let index = 0; index < kinds.length; index += 1) {
      const kind = kinds[index];
      const origin = origins[index];
      const look = looks[index];
      const shown = stunned[index] === true && kind !== undefined && origin !== undefined;
      if (!shown || look === undefined) continue;
      // Les étoiles suivent la tête de la pose affichée : `hurt`, puis `down`.
      const head = anchors[index]?.[look.get().frame]?.head;
      if (head === undefined) continue;
      const [headX, headY] = head;
      const turn = Math.floor(now / 125) % 4;
      const hop = hops[index] === true ? 4 : 0;
      place('stars', turn, origin.x + headX * 2, origin.y + (headY - 4) * 2 - hop);
    }
    return placed;
  }, [
    clock,
    sharedTimeline,
    sharedSpark,
    sharedBulwark,
    sharedPowers,
    sharedBurn,
    sharedSummon,
    summonCenters,
    exhumed,
    exhumedAt,
    heroLook,
    shieldAt,
    enemyCenters,
    hero,
    reducedMotion,
    chest,
    kinds,
    anchors,
    attackAnchors,
    stunned,
    hops,
    origins,
    looks,
  ]);
  const effectSprites = useRectBuffer(EFFECT_SLOTS, (rect, slot) => {
    'worklet';
    const placed = effects.get();
    const kind = EFFECT_ORDER[placed[slot * EFFECT_FIELDS] ?? -1];
    if (kind === undefined) {
      rect.setXYWH(0, 0, 0, 0);
      return;
    }
    const cell = effectTableRect(effectTable, kind, placed[slot * EFFECT_FIELDS + 1] ?? 0);
    rect.setXYWH(cell.x, cell.y, cell.width, cell.height);
  });
  const effectTransforms = useRSXformBuffer(EFFECT_SLOTS, (transform, slot) => {
    'worklet';
    const placed = effects.get();
    const at = slot * EFFECT_FIELDS;
    const kind = EFFECT_ORDER[placed[at] ?? -1];
    if (kind === undefined) {
      transform.set(0, 0, 0, 0);
      return;
    }
    // Centré sur son point, à 2 dp par pixel d'art (l'écu, à l'échelle du héros).
    const scale = placed[at + 4] ?? 2;
    const half = (effectTable[kind][2] * scale) / 2;
    transform.set(scale, 0, (placed[at + 2] ?? 0) - half, (placed[at + 3] ?? 0) - half);
  });
  // L'onde d'argent de la riposte, en pointillé, de l'écu à l'ennemi qui a frappé (#128).
  const struckAt = riposte === null ? undefined : enemyCenters[riposte.enemy];
  const toX = struckAt?.x ?? null;
  const toY = struckAt?.y ?? null;
  const wavePath = useMemo(() => {
    const path = Skia.Path.Make();
    if (toX === null || toY === null) return path;
    path.moveTo(hero.x + WAVE_START.x * hero.scale, hero.y + WAVE_START.y * hero.scale);
    path.lineTo(toX, toY);
    return path;
  }, [hero, toX, toY]);
  // La marque d'Entaille (#235) : une entaille de braise en travers de la cible de la frappe.
  const marked = powers.rendTarget === null ? undefined : enemyCenters[powers.rendTarget];
  const markX = marked?.x ?? null;
  const markY = marked?.y ?? null;
  const rendPath = useMemo(() => {
    const path = Skia.Path.Make();
    if (markX === null || markY === null) return path;
    path.moveTo(markX - REND_MARK.dx, markY - REND_MARK.dy);
    path.lineTo(markX + REND_MARK.dx, markY + REND_MARK.dy);
    return path;
  }, [markX, markY]);
  const waveEnd = useDerivedValue(
    () => riposteWave(sharedBulwark.get().riposte, clock.get(), reducedMotion) ?? 0,
    [sharedBulwark, clock, reducedMotion],
  );
  const vignetteLevel = useDerivedValue(
    () => hurtLevel(sharedHurt.get(), clock.get()) ?? -1,
    [sharedHurt, clock],
  );

  // L'ennemi actif est dessiné en dernier, au premier plan.
  const order = enemies
    .map((enemy, index) => ({ enemy, index }))
    .sort((left, right) => Number(left.enemy.active) - Number(right.enemy.active));

  return (
    <Canvas
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      testID="battle-canvas"
      style={[StyleSheet.absoluteFill, { width, height }]}
    >
      {enemies.map((enemy, index) => {
        const slot = slots[index];
        // Debout ou tombé, chaque ennemi de la première ligne garde son ombre (#184) ; une place de
        // poussière n'a pas d'ennemi, donc pas d'ombre, et un invoqué retombé en poussière perd la
        // sienne (#172).
        return slot === undefined ? null : (
          <GroundShadow
            key={`${index}-${enemy.kind}`}
            image={scene.groundShadow}
            at={slot.groundShadowAt}
            scale={2}
            {...(fellSlots.includes(index) && { opacity: shadowOpacities[index]! })}
          />
        );
      })}
      <GroundShadow
        image={scene.groundShadow}
        at={geometry.heroGroundShadowAt}
        scale={hero.scale}
      />
      {order.map(({ enemy, index }) => {
        const look = looks[index];
        const atlas = tables[index]?.characters[enemy.kind];
        // Un nouvel atlas (l'aspect de phase 2, #38) remonte le personnage avec sa table.
        return look === undefined || atlas === undefined ? null : (
          <AtlasSprite
            key={`${index}-${enemy.kind}-${enemy.phase2 === true ? 2 : 1}`}
            atlas={atlas}
            look={look}
            scale={2}
            faded={enemy.dimmed || !enemy.standing}
            {...(summonedSlots.includes(index) && { opacity: spriteOpacities[index]! })}
          />
        );
      })}
      {marked === undefined ? null : (
        <Path
          path={rendPath}
          style="stroke"
          strokeWidth={REND_MARK.width}
          color={artPalette.roles.ember}
        />
      )}
      {powers.healedAt === null ? null : (
        <Circle cx={chest.x} cy={chest.y} r={holdFastRadius} opacity={holdFastOpacity}>
          <RadialGradient c={vec(chest.x, chest.y)} r={holdFastRadius} colors={HALO_COLORS} />
        </Circle>
      )}
      {shadowStep === null ? null : (
        <AtlasSprite
          atlas={scene.heroes[heroKind]}
          look={ghostLook}
          scale={hero.scale}
          shade={ghostOpacity}
        />
      )}
      {secondChance === null ? null : (
        <>
          <Rect
            x={0}
            y={0}
            width={width}
            height={height}
            color={artPalette.roles.ink}
            opacity={riseVeil}
          />
          <Circle cx={chest.x} cy={chest.y} r={haloRadius} opacity={haloOpacity}>
            <RadialGradient c={vec(chest.x, chest.y)} r={haloRadius} colors={HALO_COLORS} />
          </Circle>
          <AtlasSprite
            atlas={scene.heroes[heroKind]}
            look={heroLook}
            scale={hero.scale}
            faded
            opacity={heroGrey}
          />
        </>
      )}
      <AtlasSprite
        atlas={scene.heroes[heroKind]}
        look={heroLook}
        scale={hero.scale}
        {...(secondChance !== null && { opacity: heroShown })}
      />
      {powers.mist ? (
        <Circle
          cx={chest.x}
          cy={chest.y}
          r={MIST_RADIUS_DP}
          color={artPalette.roles.blue}
          opacity={mistVeilOpacity(powers.mist)}
        />
      ) : null}
      <Path
        path={wavePath}
        style="stroke"
        strokeWidth={WAVE_WIDTH}
        color={artPalette.roles.bulwark}
        start={0}
        end={waveEnd}
      >
        <DashPathEffect intervals={WAVE_DASHES} />
      </Path>
      <Atlas
        image={scene.effects.image}
        sprites={effectSprites}
        transforms={effectTransforms}
        sampling={NEAREST}
      />
      {vignettes.map((image, level) => (
        <VignetteLayer key={level} image={image} level={level} current={vignetteLevel} />
      ))}
    </Canvas>
  );
}
// Stryker restore all
