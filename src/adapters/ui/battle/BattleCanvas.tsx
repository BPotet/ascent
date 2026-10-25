/**
 * La scène du combat en pixel art 2.5D (ADR 0008) : un seul canevas Skia qui dessine le décor, les
 * socles, les ennemis (l'ennemi actif en dernier), le héros, les effets et l'anneau. Les images
 * des personnages et des effets viennent d'atlas précalculés au montage ; l'`Atlas` de Skia les
 * dessine, et chaque image est choisie sur le fil UI par les fonctions pures de `scene/`, calées
 * sur les instants nominaux des événements de combat : aucun rendu React par image.
 *
 * Sous Jest, Skia reste limité à son test de fumée : les tests d'écran simulent ce module.
 */
import {
  Atlas,
  BlurMask,
  Canvas,
  Circle,
  ColorMatrix,
  DashPathEffect,
  FilterMode,
  Group,
  Image,
  MipmapMode,
  Rect,
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

import type { EnemyKind } from '../../../domain/battle/combatants';
import { artPalette } from '../pixelArt/artPalette';
import { toSkImage } from '../pixelArt/SpriteCanvas';
import type { Point } from '../pixelArt/sprites/Sprite';
import { atlasRect, battleAtlas, type AtlasTable } from '../pixelArt/sprites/battle/battleAtlas';
import { battleSprite, type BattleCharacter } from '../pixelArt/sprites/battle/battleCharacters';
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
import { enemyPose, restPose } from './scene/enemyPose';
import { heroFrame } from './scene/heroFrame';
import type { EnemySlot, SceneGeometry } from './scene/sceneGeometry';
import { glintSprites, hurtLevel, impactFlash, sparkFrame } from './scene/sceneEffects';
import { timingRing } from './scene/timingRing';
import type { FrameMeter, HeroPose, SceneEnemy, SceneSpark, SceneTimeline } from './sceneTypes';

export interface BattleSceneProps {
  readonly width: number;
  readonly height: number;
  /** La géométrie commune à la scène et aux colonnes des ennemis. */
  readonly geometry: SceneGeometry;
  readonly enemies: readonly SceneEnemy[];
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
  readonly reducedMotion: boolean;
  /** L'horloge du fil UI : un worklet, sur la base de l'horloge de combat (méthode a). */
  readonly uiNow: () => number;
  readonly frameMeter: FrameMeter;
}

/** Un atlas prêt à dessiner : son image Skia et sa table. */
interface PreparedAtlas {
  readonly image: SkImage | null;
  readonly table: AtlasTable;
}

/** Les ancrages d'un ennemi : l'œil et les griffes de sa pose pleine, la tête quand il est à terre. */
interface EnemyAnchors {
  readonly eye: Point | null;
  readonly tips: readonly Point[];
  readonly head: Point;
}

export interface PreparedScene {
  readonly characters: Readonly<Record<EnemyKind, PreparedAtlas>>;
  readonly anchors: Readonly<Record<EnemyKind, EnemyAnchors>>;
  readonly hero: PreparedAtlas;
  readonly effects: { readonly image: SkImage | null; readonly table: EffectTable };
  readonly pedestals: Readonly<Record<string, SkImage | null>>;
}

/** Ce qu'un personnage affiche à une image : son image dans l'atlas et sa place, en dp. */
interface SpriteLook {
  readonly frame: string;
  readonly tier: number;
  readonly red: boolean;
  readonly x: number;
  readonly y: number;
}

// Stryker disable all: dessin de la scène, vérifié par la conformité aux maquettes (barrière 10 bis).
const ENEMY_KINDS: readonly EnemyKind[] = ['ghoul', 'specter', 'necromancer'];
const PEDESTALS: readonly PedestalKind[] = ['enemy', 'single', 'hero'];
const NEAREST = { filter: FilterMode.Nearest, mipmap: MipmapMode.None } as const;
/** Une image de plus de 1,5 fois 60 Hz est comptée comme perdue. */
const DROPPED_FRAME_MS = 25;
/** Les autres ennemis : à 30 %, désaturés et assombris (maquette, `.pfoe.dim`). */
const DIMMED_OPACITY = 0.3;
const FADED = [
  0.106, 0.358, 0.036, 0, 0, 0.106, 0.358, 0.036, 0, 0, 0.106, 0.358, 0.036, 0, 0, 0, 0, 0, 1, 0,
];
const RING_GOLD = artPalette.roles.gold;
const RING_RED = artPalette.tints[22] ?? '#FF3B3B';
const NOTCH_RIM = artPalette.tints[25] ?? '#FFD0D8';
/** Les places de l'atlas des effets : éclair, étincelle, deux reflets, trois étoiles. */
const EFFECT_SLOTS = 7;
const EFFECT_ORDER: readonly EffectKind[] = [
  'flash',
  'gold',
  'steel',
  'glintWhite',
  'glintRed',
  'glintDull',
  'stars',
];
const NOTCHES = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const;
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
      ENEMY_KINDS.map((kind) => {
        const { eye, tips } = battleSprite(kind, 'ant2').anchors;
        return [kind, { eye, tips, head: battleSprite(kind, 'down').anchors.head ?? [22, 22] }];
      }),
    ) as Record<EnemyKind, EnemyAnchors>,
    hero: atlasOf('hero'),
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
function AtlasSprite({
  atlas,
  look,
  scale,
  faded = false,
}: {
  readonly atlas: PreparedAtlas;
  readonly look: DerivedValue<SpriteLook>;
  readonly scale: number;
  readonly faded?: boolean;
}) {
  const { table } = atlas;
  const sprites = useRectBuffer(1, (rect) => {
    'worklet';
    const current = look.get();
    const cell = atlasRect(table, current.frame, current.tier, current.red);
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

/** La pose d'un ennemi à chaque image : active (son action), ou au repos. */
function useEnemyLook(
  enemy: SceneEnemy,
  index: number,
  slot: EnemySlot,
  clock: SharedValue<number>,
  timeline: SharedValue<SceneTimeline | null>,
  reducedMotion: boolean,
): DerivedValue<SpriteLook> {
  const { standing, down, losingAction, rising, downSince } = enemy;
  const { sprite, reach } = slot;
  return useDerivedValue<SpriteLook>(() => {
    'worklet';
    const now = clock.get();
    const current = timeline.get();
    if (current !== null && current.enemy === index && standing) {
      const pose = enemyPose(current, now, reducedMotion);
      return {
        frame: pose.frame,
        tier: pose.tier,
        red: pose.red,
        x: sprite.x + Math.round((reach.x * pose.reach + pose.jitter) / 2) * 2,
        y: sprite.y + Math.round((reach.y * pose.reach) / 2) * 2,
      };
    }
    const rest = restPose({ standing, down, losingAction, rising, downSince }, index, now);
    return { frame: rest.frame, tier: 0, red: false, x: sprite.x, y: sprite.y };
  }, [clock, timeline, index, standing, down, losingAction, rising, downSince, sprite, reach]);
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

/**
 * L'anneau (aides visuelles Légères), en interface nette par-dessus la scène, à la cadence de
 * l'écran : un cercle de 3 px couleur lumière avec un halo, le contour d'arrivée en pointillés, et
 * en rouge avec quatre crans en losange pour un coup imparable. Il ne capte jamais le toucher.
 */
function Ring({
  center,
  size,
  timeline,
  clock,
  reducedMotion,
}: {
  readonly center: { readonly x: number; readonly y: number };
  readonly size: number;
  readonly timeline: SharedValue<SceneTimeline | null>;
  readonly clock: SharedValue<number>;
  readonly reducedMotion: boolean;
}) {
  const look = useDerivedValue(
    () => timingRing(timeline.get(), clock.get(), reducedMotion),
    [timeline, clock, reducedMotion],
  );
  const transform = useDerivedValue(
    () => [{ translateX: center.x }, { translateY: center.y }, { scale: look.get()?.scale ?? 1 }],
    [look, center],
  );
  const gold = useDerivedValue(() => {
    const current = look.get();
    return current === null || current.perilous ? 0 : current.opacity;
  }, [look]);
  const red = useDerivedValue(() => {
    const current = look.get();
    return current !== null && current.perilous ? current.opacity : 0;
  }, [look]);
  const guideGold = useDerivedValue(() => {
    const current = look.get();
    return current === null || current.perilous ? 0 : current.guideOpacity;
  }, [look]);
  const guideRed = useDerivedValue(() => {
    const current = look.get();
    return current !== null && current.perilous ? current.guideOpacity : 0;
  }, [look]);
  const radius = size / 2 - 1.5;
  const halo = reducedMotion ? null : <BlurMask blur={5} style="normal" />;
  return (
    <>
      <Group transform={[{ translateX: center.x }, { translateY: center.y }]}>
        {[
          [RING_GOLD, guideGold],
          [RING_RED, guideRed],
        ].map(([color, opacity]) => (
          <Circle
            key={String(color)}
            cx={0}
            cy={0}
            r={radius}
            style="stroke"
            strokeWidth={2}
            color={color as string}
            opacity={opacity as SharedValue<number>}
          >
            <DashPathEffect intervals={[6, 5]} />
          </Circle>
        ))}
      </Group>
      <Group transform={transform}>
        <Group opacity={gold}>
          <Circle
            cx={0}
            cy={0}
            r={radius}
            style="stroke"
            strokeWidth={6}
            color={RING_GOLD}
            opacity={0.35}
          >
            {halo}
          </Circle>
          <Circle cx={0} cy={0} r={radius} style="stroke" strokeWidth={3} color={RING_GOLD} />
        </Group>
        <Group opacity={red}>
          <Circle
            cx={0}
            cy={0}
            r={radius}
            style="stroke"
            strokeWidth={6}
            color={RING_RED}
            opacity={0.4}
          >
            {halo}
          </Circle>
          <Circle cx={0} cy={0} r={radius} style="stroke" strokeWidth={3} color={RING_RED} />
          {NOTCHES.map(([x, y]) => (
            <Group
              key={`${x}:${y}`}
              transform={[
                { translateX: x * radius },
                { translateY: y * radius },
                { rotate: Math.PI / 4 },
              ]}
            >
              <Rect x={-4.5} y={-4.5} width={9} height={9} color={RING_RED} />
              <Rect
                x={-4.5}
                y={-4.5}
                width={9}
                height={9}
                style="stroke"
                strokeWidth={1.5}
                color={NOTCH_RIM}
              />
            </Group>
          ))}
        </Group>
      </Group>
    </>
  );
}

/** La scène du combat : un seul canevas Skia, sous les colonnes des ennemis et les boutons. */
export function BattleScene({
  width,
  height,
  geometry,
  enemies,
  heroPose,
  heroPoseSince,
  strikeTarget,
  strikeImpactAt,
  timeline,
  spark,
  hurtAt,
  reducedMotion,
  uiNow,
  frameMeter,
}: BattleSceneProps) {
  const scene = prepareBattleScene();
  const clock = useSharedValue(0);
  const lastFrame = useSharedValue(0);
  const sharedTimeline = useSharedValue<SceneTimeline | null>(timeline);
  const sharedSpark = useSharedValue<SceneSpark | null>(spark);
  const sharedHurt = useSharedValue<number | null>(hurtAt);
  const sharedHero = useSharedValue({ pose: heroPose, since: heroPoseSince, strikeImpactAt });

  useEffect(() => sharedTimeline.set(timeline), [sharedTimeline, timeline]);
  useEffect(() => sharedSpark.set(spark), [sharedSpark, spark]);
  useEffect(() => sharedHurt.set(hurtAt), [sharedHurt, hurtAt]);
  useEffect(
    () => sharedHero.set({ pose: heroPose, since: heroPoseSince, strikeImpactAt }),
    [sharedHero, heroPose, heroPoseSince, strikeImpactAt],
  );

  // L'horloge de la scène, lue à chaque image sur le fil UI ; les images perdues sont comptées
  // pendant les actions des ennemis et les étincelles (panneau Mesures).
  useFrameCallback(() => {
    const now = uiNow();
    const previous = lastFrame.get();
    lastFrame.set(now);
    clock.set(now);
    const recent = sharedSpark.get();
    const measuring = sharedTimeline.get() !== null || (recent !== null && now - recent.at < 450);
    if (previous === 0 || !measuring) return;
    const gap = now - previous;
    frameMeter.frames.set(frameMeter.frames.get() + 1);
    if (gap > DROPPED_FRAME_MS) frameMeter.dropped.set(frameMeter.dropped.get() + 1);
    if (gap > frameMeter.worstGap.get()) frameMeter.worstGap.set(gap);
  });

  const { hero, ring, enemies: slots } = geometry;
  const stage = stageImage(width, height, geometry.feetY, ring.x);
  const vignettes = useMemo(
    () =>
      [0, 1, 2, 3, 4].map((level) =>
        toSkImage(vignetteImage(Math.floor(width / 2), Math.floor(height / 2), level)),
      ),
    [width, height],
  );
  // Trois ennemis au plus : un crochet par place, dans le même ordre à chaque rendu.
  const looks = [
    useEnemyLook(
      enemies[0] ?? NO_ENEMY,
      0,
      slots[0] ?? NO_SLOT,
      clock,
      sharedTimeline,
      reducedMotion,
    ),
    useEnemyLook(
      enemies[1] ?? NO_ENEMY,
      1,
      slots[1] ?? NO_SLOT,
      clock,
      sharedTimeline,
      reducedMotion,
    ),
    useEnemyLook(
      enemies[2] ?? NO_ENEMY,
      2,
      slots[2] ?? NO_SLOT,
      clock,
      sharedTimeline,
      reducedMotion,
    ),
  ];

  const target = slots[strikeTarget] ?? NO_SLOT;
  const lunge = {
    x: (target.sprite.x + 44 - ring.x) * 0.4,
    y: (target.sprite.y + 104 - ring.y) * 0.4,
  };
  const heroLook = useDerivedValue<SpriteLook>(() => {
    'worklet';
    const { pose, since, strikeImpactAt: impactAt } = sharedHero.get();
    const current = heroFrame(pose, since, clock.get(), impactAt);
    const dodge = reducedMotion ? current.dodge * 0.3 : current.dodge;
    const toward = reducedMotion ? current.lunge * 0.2 : current.lunge;
    return {
      frame: current.frame,
      tier: current.tier,
      red: false,
      x: hero.x + Math.round((-22 * dodge + lunge.x * toward) / 2) * 2,
      y: hero.y + Math.round((10 * dodge + lunge.y * toward) / 2) * 2,
    };
  }, [sharedHero, clock, hero, lunge, reducedMotion]);

  // Les effets : [effet, image, x, y] par place, l'effet −1 pour une place vide.
  const effectTable = scene.effects.table;
  const kinds = enemies.map((enemy) => enemy.kind);
  const { anchors } = scene;
  const stunned = enemies.map((enemy) => enemy.down && enemy.standing);
  const hops = enemies.map((enemy) => enemy.losingAction);
  const effects = useDerivedValue(() => {
    'worklet';
    const now = clock.get();
    const current = sharedTimeline.get();
    const placed: number[] = [];
    const place = (kind: EffectKind, frame: number, x: number, y: number) => {
      if (placed.length < EFFECT_SLOTS * 4) placed.push(EFFECT_ORDER.indexOf(kind), frame, x, y);
    };
    const flash = impactFlash(current, now);
    if (flash !== null) place('flash', flash, ring.x, ring.y);
    const sparkNow = sharedSpark.get();
    const sparkStep = sparkFrame(sparkNow, now);
    if (sparkNow !== null && sparkStep !== null) {
      place(sparkNow.kind === 'gold' ? 'gold' : 'steel', sparkStep, ring.x, ring.y - 8);
    }
    if (current !== null && current.kind === 'attack') {
      const kind = kinds[current.enemy];
      const look = looks[current.enemy]?.get();
      if (kind !== undefined && look !== undefined) {
        for (const glint of glintSprites(current.glints, now, anchors[kind])) {
          place(glint.effect, glint.frame, look.x + glint.x * 2 + 1, look.y + glint.y * 2 + 1);
        }
      }
    }
    for (let index = 0; index < kinds.length; index += 1) {
      const kind = kinds[index];
      const slot = slots[index];
      if (stunned[index] !== true || kind === undefined || slot === undefined) continue;
      const [headX, headY] = anchors[kind].head;
      const turn = Math.floor(now / 125) % 4;
      const hop = hops[index] === true ? 4 : 0;
      place('stars', turn, slot.sprite.x + headX * 2, slot.sprite.y + (headY - 4) * 2 - hop);
    }
    return placed;
  }, [clock, sharedTimeline, sharedSpark, ring, kinds, anchors, stunned, hops, slots, looks]);
  const effectSprites = useRectBuffer(EFFECT_SLOTS, (rect, slot) => {
    'worklet';
    const placed = effects.get();
    const kind = EFFECT_ORDER[placed[slot * 4] ?? -1];
    if (kind === undefined) {
      rect.setXYWH(0, 0, 0, 0);
      return;
    }
    const cell = effectTableRect(effectTable, kind, placed[slot * 4 + 1] ?? 0);
    rect.setXYWH(cell.x, cell.y, cell.width, cell.height);
  });
  const effectTransforms = useRSXformBuffer(EFFECT_SLOTS, (transform, slot) => {
    'worklet';
    const placed = effects.get();
    const kind = EFFECT_ORDER[placed[slot * 4] ?? -1];
    if (kind === undefined) {
      transform.set(0, 0, 0, 0);
      return;
    }
    // Centré sur son point, à 2 dp par pixel d'art.
    const side = effectTable[kind][2];
    transform.set(2, 0, (placed[slot * 4 + 2] ?? 0) - side, (placed[slot * 4 + 3] ?? 0) - side);
  });
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
      <AtlasSprite atlas={scene.hero} look={heroLook} scale={hero.scale} />
      <Atlas
        image={scene.effects.image}
        sprites={effectSprites}
        transforms={effectTransforms}
        sampling={NEAREST}
      />
      {vignettes.map((image, level) => (
        <VignetteLayer key={level} image={image} level={level} current={vignetteLevel} />
      ))}
      <Ring
        center={ring}
        size={ring.size}
        timeline={sharedTimeline}
        clock={clock}
        reducedMotion={reducedMotion}
      />
    </Canvas>
  );
}
// Stryker restore all
