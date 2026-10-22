/**
 * La scène 2D du combat (Skia, ADR 0005) : le ciel, les silhouettes des ennemis et du héros, la
 * lueur de la cible, l'avancée, la préparation, la fausse amorce et les traînées de la parade
 * parfaite. Les animations tournent sur le fil UI, calées sur les instants nominaux des événements
 * de combat : la pose d'un ennemi se calcule à chaque image depuis l'instant présent et les
 * instants de sa préparation, jamais depuis le fil JS.
 *
 * Sous Jest, Skia reste limité à son test de fumée : les tests d'écran simulent ce module.
 */
import {
  Canvas,
  Circle,
  Group,
  LinearGradient,
  Oval,
  Path,
  RadialGradient,
  Rect,
  vec,
} from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { useDerivedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated';

import { battleColors } from '../theme/battleColors';
import type { FrameMeter, HeroPose, SceneEnemy, SceneTimeline } from './sceneTypes';

export interface BattleSceneProps {
  readonly width: number;
  readonly height: number;
  readonly enemies: readonly SceneEnemy[];
  readonly heroPose: HeroPose;
  /** La préparation ou l'avancée en cours, `null` sans attaque ennemie. */
  readonly timeline: SceneTimeline | null;
  /** L'instant de la dernière parade parfaite (traînées), `null` sans. */
  readonly streaksAt: number | null;
  readonly reducedMotion: boolean;
  /** L'horloge du fil UI : un worklet, sur la base de l'horloge de combat (méthode a). */
  readonly uiNow: () => number;
  readonly frameMeter: FrameMeter;
}

// Stryker disable all: dessin de la scène, vérifié par la conformité aux maquettes (barrière 10 bis).
const FOE_WIDTH = 104;
const FOE_HEIGHT = 130;
const FOE_SCALE = FOE_WIDTH / 120;
const COLUMN_WIDTH = 160;
/** Haut de la silhouette d'un ennemi dans la scène : rangée à 40, pastille d'intention de 28. */
const FOE_TOP = 75;
const HERO_SCALE = 124 / 120;
/** Une image de plus de 1,5 fois 60 Hz est comptée comme perdue. */
const DROPPED_FRAME_MS = 25;

const GHOUL = {
  body: 'M28 146c0-38 8-66 28-80 12-8 26-6 32 6 7 14 4 42 2 74z',
  claws: 'M36 104l-16 14M40 110l-12 18M44 112l-6 20',
  rim: 'M86 76c5 14 4 40 3 68',
  head: { x: 50, y: 62, r: 12 },
  eyes: [
    { x: 45, y: 60, r: 2.2 },
    { x: 53, y: 61, r: 2.2 },
  ],
};
const SPECTER = {
  body: 'M60 12c22 0 32 28 32 58 0 26-2 44-2 62l-8-7-8 9-7-9-7 9-7-9-8 7c0-18-2-36-2-62 0-30 10-58 34-58z',
  rim: 'M86 40c5 16 5 50 4 88',
  eyes: [
    { x: 52, y: 46, r: 2.6 },
    { x: 66, y: 46, r: 2.6 },
  ],
};
const HERO = {
  body: 'M60 44C46 54 34 86 30 156h60C86 86 74 54 60 44z',
  rims: ['M50 37C40 50 33 84 31 154', 'M50 28a11 11 0 0 1 8-8'],
  blade: 'M74 82L106 32',
  hilt: 'M68 86l11-6',
  shield: 'M30 74c-10 4-12 30-2 36 8-4 10-28 2-36z',
};
const POSES: { readonly [pose in HeroPose]: { readonly rotate: number; readonly x: number } } = {
  idle: { rotate: 0, x: 0 },
  lean: { rotate: 7, x: 0 },
  hit: { rotate: -13, x: 0 },
  off: { rotate: -17, x: 0 },
  counter: { rotate: 14, x: 30 },
  dodge: { rotate: -10, x: -26 },
  fallen: { rotate: -80, x: 10 },
};
const STREAKS = 'M150 330l-60 20M160 300l-80-10M170 360l-50 40M200 300l20-60M220 330l70-10';

/** La pose d'un ennemi qui prépare son coup, comme le prototype de la maquette. */
function windUpPose(
  timeline: SceneTimeline,
  now: number,
): { ty: number; lean: number; scale: number } {
  'worklet';
  // Pendant l'arrêt sur image, la pose reste figée sur son début.
  const t = now >= timeline.hitStopAt && now < timeline.hitStopUntil ? timeline.hitStopUntil : now;
  if (t < timeline.windUpAt) {
    const progress = Math.min(
      1,
      Math.max(0, (t - timeline.stepInAt) / Math.max(1, timeline.windUpAt - timeline.stepInAt)),
    );
    const eased = 1 - (1 - progress) * (1 - progress);
    return { ty: 6 * eased, lean: 0, scale: 1 + 0.03 * eased };
  }
  const impact =
    timeline.impacts.find((at: number) => at > t - 120) ??
    timeline.impacts[timeline.impacts.length - 1] ??
    t;
  const until = impact - t;
  const windUp = Math.max(1, timeline.windUpMs);
  const progress = Math.max(0, Math.min(1, 1 - until / windUp));
  let lean = -10 * Math.min(1, progress * 1.15);
  let ty = -8 * Math.min(1, progress * 1.2);
  let scale = 1 + 0.08 * progress;
  if (timeline.feintAt !== null) {
    const span = 0.25 * windUp;
    const into = t - timeline.feintAt;
    if (into > 0 && into < span) {
      const wave = Math.sin((into / span) * Math.PI);
      ty = 14 * wave;
      lean = 8 * wave;
    }
  }
  if (until < 140 && until > -120) {
    const strike = 1 - Math.abs(until) / 140;
    ty = 34 * strike;
    lean = 14 * strike;
    scale = 1.15;
  }
  return { ty, lean, scale };
}

function EnemyFigure({
  enemy,
  timeline,
  clock,
  sceneWidth,
  count,
  index,
}: {
  readonly enemy: SceneEnemy;
  readonly timeline: { get(): SceneTimeline | null };
  readonly clock: { get(): number };
  readonly sceneWidth: number;
  readonly count: number;
  readonly index: number;
}) {
  const left = sceneWidth / 2 - (count * COLUMN_WIDTH) / 2 + index * COLUMN_WIDTH;
  const x = left + (COLUMN_WIDTH - FOE_WIDTH) / 2;
  const transform = useDerivedValue(() => {
    const current = timeline.get();
    const pose =
      current !== null && current.enemy === index
        ? windUpPose(current, clock.get())
        : { ty: 0, lean: 0, scale: 1 };
    return [
      { translateX: x },
      { translateY: FOE_TOP + pose.ty },
      { translateX: FOE_WIDTH / 2 },
      { translateY: FOE_HEIGHT },
      { rotate: (pose.lean * Math.PI) / 180 },
      { scale: pose.scale },
      { translateX: -FOE_WIDTH / 2 },
      { translateY: -FOE_HEIGHT },
      { scale: FOE_SCALE },
    ];
  });
  if (!enemy.standing) return null;
  const figure =
    enemy.kind === 'ghoul' ? (
      <>
        <Path path={GHOUL.body} color={battleColors.silhouette} />
        <Circle
          cx={GHOUL.head.x}
          cy={GHOUL.head.y}
          r={GHOUL.head.r}
          color={battleColors.silhouette}
        />
        <Path
          path={GHOUL.claws}
          style="stroke"
          strokeWidth={4}
          strokeCap="round"
          color={battleColors.silhouette}
        />
        <Path
          path={GHOUL.rim}
          style="stroke"
          strokeWidth={1.6}
          strokeCap="round"
          color={battleColors.light}
          opacity={0.3}
        />
        {GHOUL.eyes.map((eye) => (
          <Circle key={eye.x} cx={eye.x} cy={eye.y} r={eye.r} color={battleColors.light} />
        ))}
      </>
    ) : (
      <>
        <Path path={SPECTER.body} color={battleColors.specter} opacity={0.93} />
        <Path
          path={SPECTER.rim}
          style="stroke"
          strokeWidth={1.6}
          strokeCap="round"
          color={battleColors.light}
          opacity={0.34}
        />
        {SPECTER.eyes.map((eye) => (
          <Circle key={eye.x} cx={eye.x} cy={eye.y} r={eye.r} color={battleColors.light} />
        ))}
      </>
    );
  return (
    <Group opacity={enemy.dimmed ? 0.45 : 1}>
      <Oval
        x={x + FOE_WIDTH * 0.08}
        y={FOE_TOP + FOE_HEIGHT - 4}
        width={FOE_WIDTH * 0.84}
        height={14}
      >
        <RadialGradient
          c={vec(x + FOE_WIDTH / 2, FOE_TOP + FOE_HEIGHT + 3)}
          r={FOE_WIDTH * 0.42}
          colors={
            enemy.target
              ? ['rgba(242,212,155,0.75)', 'rgba(242,212,155,0)']
              : ['rgba(0,0,0,0.6)', 'rgba(0,0,0,0)']
          }
        />
      </Oval>
      <Group transform={transform}>{figure}</Group>
    </Group>
  );
}

function HeroFigure({
  pose,
  sceneHeight,
}: {
  readonly pose: HeroPose;
  readonly sceneHeight: number;
}) {
  const { rotate, x } = POSES[pose];
  const top = sceneHeight - 6 - 166;
  return (
    <Group transform={[{ translateX: 22 }, { translateY: top }, { scale: HERO_SCALE }]}>
      <Oval x={22} y={152} width={76} height={8} color="rgba(0,0,0,0.55)" />
      <Group transform={[{ translateX: x }]} origin={vec(60, 156)}>
        <Group transform={[{ rotate: (rotate * Math.PI) / 180 }]} origin={vec(60, 156)}>
          <Path path={HERO.body} color={battleColors.silhouette} />
          <Circle cx={60} cy={32} r={12} color={battleColors.silhouette} />
          {HERO.rims.map((rim) => (
            <Path
              key={rim}
              path={rim}
              style="stroke"
              strokeWidth={1.6}
              strokeCap="round"
              color={battleColors.light}
              opacity={0.75}
            />
          ))}
          <Path
            path={HERO.blade}
            style="stroke"
            strokeWidth={3}
            strokeCap="round"
            color={battleColors.blade}
          />
          <Path
            path={HERO.hilt}
            style="stroke"
            strokeWidth={5}
            strokeCap="round"
            color={battleColors.hilt}
          />
          <Path path={HERO.shield} color={battleColors.silhouette} />
        </Group>
      </Group>
    </Group>
  );
}

/** La scène du combat : un seul canevas Skia, sous les colonnes des ennemis et les boutons. */
export function BattleScene({
  width,
  height,
  enemies,
  heroPose,
  timeline,
  streaksAt,
  reducedMotion,
  uiNow,
  frameMeter,
}: BattleSceneProps) {
  const clock = useSharedValue(0);
  const sharedTimeline = useSharedValue<SceneTimeline | null>(timeline);
  const sharedStreaks = useSharedValue(streaksAt ?? -1e9);
  const lastFrame = useSharedValue(0);

  useEffect(() => {
    sharedTimeline.set(timeline);
  }, [sharedTimeline, timeline]);
  useEffect(() => {
    sharedStreaks.set(streaksAt ?? -1e9);
  }, [sharedStreaks, streaksAt]);

  // L'horloge de la scène, lue à chaque image sur le fil UI ; les images perdues sont comptées
  // pendant les préparations et l'éclat (panneau Mesures).
  useFrameCallback(() => {
    const now = uiNow();
    const previous = lastFrame.get();
    lastFrame.set(now);
    clock.set(now);
    const measuring = sharedTimeline.get() !== null || now - sharedStreaks.get() < 450;
    if (previous === 0 || !measuring) return;
    const gap = now - previous;
    frameMeter.frames.set(frameMeter.frames.get() + 1);
    if (gap > DROPPED_FRAME_MS) frameMeter.dropped.set(frameMeter.dropped.get() + 1);
    if (gap > frameMeter.worstGap.get()) frameMeter.worstGap.set(gap);
  });

  const streaksOpacity = useDerivedValue(() =>
    reducedMotion ? 0 : Math.max(0, 1 - (clock.get() - sharedStreaks.get()) / 450) * 0.8,
  );

  return (
    <Canvas style={[StyleSheet.absoluteFill, { width, height }]}>
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(0, height)}
          colors={[battleColors.skyTop, battleColors.skyMiddle, battleColors.skyBottom]}
          positions={[0, 0.48, 1]}
        />
      </Rect>
      <Rect x={0} y={0} width={width} height={height * 0.45}>
        <RadialGradient
          c={vec(width / 2, 0)}
          r={width * 0.6}
          colors={['rgba(242,212,155,0.22)', 'rgba(242,212,155,0)']}
        />
      </Rect>
      {[
        [0.12, 0.22],
        [0.74, 0.14],
        [0.4, 0.6],
        [0.86, 0.52],
        [0.25, 0.8],
      ].map(([sx, sy]) => (
        <Circle
          key={`${sx}`}
          cx={sx! * width}
          cy={sy! * height}
          r={1.4}
          color="rgba(238,234,224,0.3)"
        />
      ))}
      <Rect x={0} y={height - 120} width={width} height={120}>
        <LinearGradient
          start={vec(0, height - 120)}
          end={vec(0, height)}
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.45)']}
        />
      </Rect>
      {enemies.map((enemy, index) => (
        <EnemyFigure
          key={enemy.kind}
          enemy={enemy}
          index={index}
          count={enemies.length}
          timeline={sharedTimeline}
          clock={clock}
          sceneWidth={width}
        />
      ))}
      <HeroFigure pose={heroPose} sceneHeight={height} />
      <Group opacity={streaksOpacity} transform={[{ translateY: height - 440 }]}>
        <Path path={STREAKS} style="stroke" strokeWidth={2} strokeCap="round" color="#FFF4D6" />
      </Group>
    </Canvas>
  );
}
// Stryker restore all
