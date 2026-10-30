/**
 * La scène du combat en pixel art 2.5D (ADR 0008) : un seul canevas Skia qui dessine le décor, les
 * socles, les ennemis (l'ennemi actif en dernier), le héros et les effets, sans anneau (ADR 0006).
 * Les images des personnages et des effets viennent d'atlas précalculés au montage ; l'`Atlas` de
 * Skia les dessine, et chaque image est choisie sur le fil UI par les fonctions pures de `scene/`,
 * calées sur les instants nominaux des événements de combat : aucun rendu React par image.
 *
 * Sous Jest, Skia reste limité à son test de fumée : les tests d'écran simulent ce module.
 */
import {
  Atlas,
  Canvas,
  ColorMatrix,
  DashPathEffect,
  FilterMode,
  Image,
  MipmapMode,
  Path,
  Skia,
  useRSXformBuffer,
  useRectBuffer,
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
import {
  ENEMY_FRAMES,
  attackMotion,
  poseAnchors,
  type AttackMotions,
  type BattleCharacter,
  type BattleFrame,
  type EnemyFrame,
} from '../pixelArt/sprites/battle/battleCharacters';
import {
  effectTableRect,
  effectsAtlas,
  vignetteImage,
  type EffectKind,
  type EffectTable,
} from '../pixelArt/sprites/battle/battleEffects';
import {
  paintBattleStage,
  pedestalCenter,
  pedestalImage,
  type PedestalKind,
} from '../pixelArt/sprites/battle/battleStage';
import { HERO_ANIMATIONS } from '../pixelArt/sprites/battle/heroAnimations';
import { enemyPose, restPose } from './scene/enemyPose';
import { spriteOrigin, type EnemySlot, type SceneGeometry } from './scene/sceneGeometry';
import { BASH_ADVANCE_DP, heroFrame } from './scene/heroFrame';
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
import type { HeroPose, SceneEnemy, SceneSpark, SceneTimeline } from './sceneTypes';

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

export interface PreparedScene {
  readonly characters: Readonly<Record<EnemyKind, PreparedAtlas>>;
  /** Les ancrages de chaque pose de chaque ennemi (`poseAnchors`). */
  readonly anchors: Readonly<Record<EnemyKind, Readonly<Record<EnemyFrame, EnemyAnchors>>>>;
  /** Les ancrages de chaque pose d'un coup de chaque ennemi (#139). */
  readonly attackAnchors: Readonly<Record<EnemyKind, AttackAnchors>>;
  /** La portée et l'élévation des coups qui ont des poses d'un coup, par ennemi (#139). */
  readonly motions: Readonly<Record<EnemyKind, AttackMotions>>;
  /** L'atlas de chaque héroïne, toutes préparées : celle de l'ascension est choisie au rendu. */
  readonly heroes: Readonly<Record<HeroKind, PreparedAtlas>>;
  readonly effects: { readonly image: SkImage | null; readonly table: EffectTable };
  readonly pedestals: Readonly<Record<string, SkImage | null>>;
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
const ENEMY_KINDS: readonly EnemyKind[] = [
  'ghoul',
  'specter',
  'necromancer',
  'fallenKnight',
  'twins',
  'ossuaryWarden',
  'facelessPrior',
  'skeleton',
  'madVillager',
];
const PEDESTALS: readonly PedestalKind[] = ['enemy', 'single', 'hero'];
const NEAREST = { filter: FilterMode.Nearest, mipmap: MipmapMode.None } as const;
/** Les autres ennemis : à 30 %, désaturés et assombris (maquette, `.pfoe.dim`). */
const DIMMED_OPACITY = 0.3;
const FADED = [
  0.106, 0.358, 0.036, 0, 0, 0.106, 0.358, 0.036, 0, 0, 0.106, 0.358, 0.036, 0, 0, 0, 0, 0, 1, 0,
];
/**
 * Les places de l'atlas des effets : éclair, étincelle, deux reflets, trois étoiles, l'écu du
 * Rempart, ses 4 éclats et les 4 éclats de la riposte sur l'ennemi (#128).
 */
const EFFECT_SLOTS = 16;
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
const NO_SLOT: EnemySlot = {
  column: { x: 0, y: 0, width: 0 },
  sprite: { x: 0, y: 0, width: 0, height: 0 },
  pedestal: 'enemy',
  pedestalAt: { x: 0, y: 0 },
  reach: { x: 0, y: 0 },
  plateBottom: 0,
};

let prepared: PreparedScene | null = null;

/**
 * Prépare les atlas de la scène (`prepareBattleScene`) : les personnages, leurs ancrages, les
 * effets et les socles, en images Skia. Fait une fois par lancement (cache de module), pendant
 * « Préparation du combat… », jamais pendant la phase ennemie ; « Rejouer » les garde.
 */
export function prepareBattleScene(): PreparedScene {
  if (prepared !== null) return prepared;
  const atlasOf = (character: BattleCharacter): PreparedAtlas => {
    const atlas = battleAtlas(character);
    return { image: toSkImage(atlas), table: atlas.table };
  };
  const effects = effectsAtlas();
  prepared = {
    characters: Object.fromEntries(ENEMY_KINDS.map((kind) => [kind, atlasOf(kind)])) as Record<
      EnemyKind,
      PreparedAtlas
    >,
    anchors: Object.fromEntries(
      ENEMY_KINDS.map((kind) => [
        kind,
        Object.fromEntries(ENEMY_FRAMES.map((frame) => [frame, poseAnchors(kind, frame)])),
      ]),
    ) as Record<EnemyKind, Record<EnemyFrame, EnemyAnchors>>,
    attackAnchors: Object.fromEntries(
      ENEMY_KINDS.map((kind) => [
        kind,
        Object.fromEntries(
          Object.entries(attackMotion(kind)).map(([attack, motion]) => [
            attack,
            Object.fromEntries(
              Object.keys(motion?.lift ?? {}).map((frame) => [
                frame,
                poseAnchors(kind, frame as EnemyFrame, attack as AttackKind),
              ]),
            ),
          ]),
        ),
      ]),
    ) as Record<EnemyKind, AttackAnchors>,
    motions: Object.fromEntries(ENEMY_KINDS.map((kind) => [kind, attackMotion(kind)])) as Record<
      EnemyKind,
      AttackMotions
    >,
    heroes: Object.fromEntries(
      (Object.keys(HERO_ANIMATIONS) as HeroKind[]).map((kind) => [kind, atlasOf(kind)]),
    ) as Record<HeroKind, PreparedAtlas>,
    effects: { image: toSkImage(effects), table: effects.table },
    pedestals: Object.fromEntries(
      PEDESTALS.flatMap((kind) =>
        [false, true].map((selected) => [
          `${kind}-${selected ? 1 : 0}`,
          toSkImage(pedestalImage(kind, selected)),
        ]),
      ),
    ),
  };
  return prepared;
}

const stages = new Map<string, SkImage | null>();

/** Le décor d'une taille de scène, gardé en cache. */
function stageImage(width: number, height: number, feetY: number, heroX: number): SkImage | null {
  const key = `${width}x${height}:${feetY}:${heroX}`;
  if (!stages.has(key)) {
    if (stages.size > 4) stages.clear();
    stages.set(key, toSkImage(paintBattleStage(width, height, feetY, heroX)));
  }
  return stages.get(key) ?? null;
}

/** Une image en pixels d'art de 2 dp, sans lissage. */
function ArtImage({
  image,
  x,
  y,
  opacity,
}: {
  readonly image: SkImage | null;
  readonly x: number;
  readonly y: number;
  readonly opacity?: DerivedValue<number>;
}) {
  return (
    <Image
      image={image}
      x={x}
      y={y}
      width={(image?.width() ?? 0) * 2}
      height={(image?.height() ?? 0) * 2}
      sampling={NEAREST}
      {...(opacity === undefined ? {} : { opacity })}
    />
  );
}

/** Un socle, à sa place. */
function Pedestal({
  kind,
  selected,
  at,
  images,
}: {
  readonly kind: PedestalKind;
  readonly selected: boolean;
  readonly at: { readonly x: number; readonly y: number };
  readonly images: PreparedScene['pedestals'];
}) {
  const [cx, cy] = pedestalCenter(kind);
  return (
    <ArtImage
      image={images[`${kind}-${selected ? 1 : 0}`] ?? null}
      x={at.x - cx * 2}
      y={at.y - cy * 2}
    />
  );
}

/** Un personnage, dessiné par l'`Atlas` de Skia : son image et sa place changent sur le fil UI. */
function AtlasSprite<Frame extends BattleFrame>({
  atlas,
  look,
  scale,
  faded = false,
}: {
  readonly atlas: PreparedAtlas;
  readonly look: DerivedValue<SpriteLook<Frame>>;
  readonly scale: number;
  readonly faded?: boolean;
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
      opacity={faded ? DIMMED_OPACITY : 1}
    >
      {faded ? <ColorMatrix matrix={FADED} /> : null}
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
  clock: SharedValue<number>,
  timeline: SharedValue<SceneTimeline | null>,
  reducedMotion: boolean,
): DerivedValue<SpriteLook<EnemyFrame>> {
  const { standing, down, losingAction, rising, downSince } = enemy;
  const { reach } = slot;
  const { x, y } = origin;
  return useDerivedValue<SpriteLook<EnemyFrame>>(() => {
    'worklet';
    const now = clock.get();
    const current = timeline.get();
    if (current !== null && current.enemy === index && standing) {
      const pose = enemyPose(current, now, reducedMotion, motions);
      return {
        frame: pose.frame,
        tier: pose.tier,
        red: pose.red,
        poses: pose.poses,
        x: x + Math.round((reach.x * pose.reach + pose.jitter) / 2) * 2,
        y: y + Math.round((reach.y * pose.reach) / 2) * 2 - pose.lift * 2,
      };
    }
    const rest = restPose({ standing, down, losingAction, rising, downSince }, index, now);
    return { frame: rest.frame, tier: 0, red: false, poses: null, x, y };
  }, [
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
  reducedMotion,
  uiNow,
}: BattleSceneProps) {
  const scene = prepareBattleScene();
  const clock = useSharedValue(0);
  const sharedTimeline = useSharedValue<SceneTimeline | null>(timeline);
  const sharedSpark = useSharedValue<SceneSpark | null>(spark);
  const sharedHurt = useSharedValue<number | null>(hurtAt);
  const sharedHero = useSharedValue({ pose: heroPose, since: heroPoseSince, strikeImpactAt });
  const sharedBulwark = useSharedValue({ active: bulwark, wornAt: bulwarkWornAt, riposte });

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
  const stage = stageImage(width, height, geometry.feetY, chest.x);
  const vignettes = useMemo(
    () =>
      [0, 1, 2, 3, 4].map((level) =>
        toSkImage(vignetteImage(Math.floor(width / 2), Math.floor(height / 2), level)),
      ),
    [width, height],
  );
  // L'origine de chaque case, à la taille de l'entité (ADR 0010 § 3), calculée hors des worklets.
  const origins = [0, 1, 2].map((index) => {
    const { table } = scene.characters[(enemies[index] ?? NO_ENEMY).kind];
    return spriteOrigin((slots[index] ?? NO_SLOT).sprite, table.cellWidth, table.cellHeight);
  });
  // Trois ennemis au plus : un crochet par place, dans le même ordre à chaque rendu.
  const looks = [
    useEnemyLook(
      enemies[0] ?? NO_ENEMY,
      0,
      slots[0] ?? NO_SLOT,
      origins[0]!,
      scene.motions[(enemies[0] ?? NO_ENEMY).kind],
      clock,
      sharedTimeline,
      reducedMotion,
    ),
    useEnemyLook(
      enemies[1] ?? NO_ENEMY,
      1,
      slots[1] ?? NO_SLOT,
      origins[1]!,
      scene.motions[(enemies[1] ?? NO_ENEMY).kind],
      clock,
      sharedTimeline,
      reducedMotion,
    ),
    useEnemyLook(
      enemies[2] ?? NO_ENEMY,
      2,
      slots[2] ?? NO_SLOT,
      origins[2]!,
      scene.motions[(enemies[2] ?? NO_ENEMY).kind],
      clock,
      sharedTimeline,
      reducedMotion,
    ),
  ];

  const target = slots[strikeTarget] ?? NO_SLOT;
  const lunge = {
    x: (target.sprite.x + 44 - chest.x) * 0.4,
    y: (target.sprite.y + 104 - chest.y) * 0.4,
  };
  const heroLook = useDerivedValue<SpriteLook>(() => {
    'worklet';
    const { pose, since, strikeImpactAt: impactAt } = sharedHero.get();
    const current = heroFrame(pose, since, clock.get(), impactAt);
    const dodge = reducedMotion ? current.dodge * 0.3 : current.dodge;
    const toward = reducedMotion ? current.lunge * 0.2 : current.lunge;
    // Le coup de bouclier, sur place : 4 dp en avant et retour, au quart en mouvement réduit.
    const push = BASH_ADVANCE_DP * current.push * (reducedMotion ? 0.25 : 1);
    return {
      frame: current.frame,
      tier: current.tier,
      red: false,
      poses: null,
      x: hero.x + Math.round((-22 * dodge + lunge.x * toward + push) / 2) * 2,
      y: hero.y + Math.round((10 * dodge + lunge.y * toward) / 2) * 2,
    };
  }, [sharedHero, clock, hero, lunge, reducedMotion]);

  // Les effets : [effet, image, x, y] par place, l'effet −1 pour une place vide.
  const effectTable = scene.effects.table;
  const kinds = enemies.map((enemy) => enemy.kind);
  const { anchors, attackAnchors } = scene;
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
    const flash = impactFlash(current, now);
    if (flash !== null) place('flash', flash, chest.x, chest.y);
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
        const shown =
          (look.poses === null ? undefined : attackAnchors[kind][look.poses]?.[look.frame]) ??
          anchors[kind][look.frame];
        for (const glint of glintSprites(current.glints, now, shown)) {
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
      const [headX, headY] = anchors[kind][look.get().frame].head;
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
      <ArtImage image={stage} x={0} y={0} />
      {enemies.map((enemy, index) => {
        const slot = slots[index];
        return slot === undefined || !enemy.standing ? null : (
          <Pedestal
            key={enemy.kind}
            kind={slot.pedestal}
            selected={enemy.target}
            at={slot.pedestalAt}
            images={scene.pedestals}
          />
        );
      })}
      <Pedestal
        kind="hero"
        selected={false}
        at={geometry.heroPedestalAt}
        images={scene.pedestals}
      />
      {order.map(({ enemy, index }) => {
        const look = looks[index];
        return look === undefined ? null : (
          <AtlasSprite
            key={enemy.kind}
            atlas={scene.characters[enemy.kind]}
            look={look}
            scale={2}
            faded={enemy.dimmed || !enemy.standing}
          />
        );
      })}
      <AtlasSprite atlas={scene.heroes[heroKind]} look={heroLook} scale={hero.scale} />
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
