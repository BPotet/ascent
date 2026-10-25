import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import Animated, { useSharedValue } from 'react-native-reanimated';

import type { BattleSession } from '../../../application/useCases/BattleSession';
import type { AttackStep, Battle } from '../../../domain/battle/Battle';
import type { BattleEvent, DefenseButton } from '../../../domain/battle/BattleEvent';
import { ActionPad } from '../battle/ActionPad';
import { BattleScene } from '../battle/BattleCanvas';
import { DamageFloat, FeedbackLabel, Flash, useShake } from '../battle/BattleEffects';
import { BattleEndPanel } from '../battle/BattleEndPanel';
import { BattleHintBubble } from '../battle/BattleHintBubble';
import { EnemyColumn } from '../battle/EnemyColumn';
import { HeroBar } from '../battle/HeroBar';
import { PhaseBanner } from '../battle/PhaseBanner';
import {
  columnWidth,
  type FrameMeter,
  type SceneEnemy,
  type SceneTimeline,
} from '../battle/sceneTypes';
import {
  BattleMeasuresPanel,
  TrialTuningPanel,
  measureLines,
  type FrameStats,
} from '../battle/TrialToolsPanels';
import { Screen } from '../components/Screen';
import { ENEMY_NAMES, TRIAL_BATTLE_TITLE } from '../format/battleText';
import { toBattleInstant } from '../state/battleTouch';
import { battleView, type BattleView } from '../state/battleView';
import { useBattleMeasures } from '../state/useBattleMeasures';
import { useReducedMotion } from '../state/useReducedMotion';
import { jsThreadNow, uiThreadNow } from '../state/useTouchProbe';
import { useTrialBattle } from '../state/useTrialBattle';
import { useTrialTuning } from '../state/useTrialTuning';
import { battleColors } from '../theme/battleColors';

export interface TrialBattleScreenProps {
  readonly session: BattleSession;
  /** Quitter le combat d'essai. */
  readonly onClose: () => void;
  /** Le build de preview : panneaux Réglages d'essai et Mesures sur l'écran de fin. */
  readonly trialTools: boolean;
  /** L'horloge du fil JS, sur la base de l'horloge de combat. Par défaut `performance.now()`. */
  readonly now?: () => number;
  /** L'horloge du fil UI, lue dans les worklets des gestes : ce doit être un worklet. */
  readonly uiNow?: () => number;
  /** Les latences mesurées du son de combat, en ms. */
  readonly soundLatencies?: () => readonly number[];
}

/** La ligne au-dessus des boutons s'efface pendant le temps mort et le déséquilibre. */
function lineHidden(pad: BattleView['pad']): boolean {
  if (pad.kind === 'none' || pad.kind === 'strike') return false;
  return pad.locked || (pad.kind === 'defense' && pad.offBalance);
}

/** Les PV regagnés par le répit de la victoire, `null` sans répit (ou s'il ne rend rien). */
function respiteOf(events: readonly BattleEvent[]): number | null {
  const respite = events.find((event) => event.type === 'respite');
  return respite?.type === 'respite' && respite.gain > 0 ? respite.gain : null;
}

/** La hauteur de la scène de la maquette (cadre de 390 × 844 pt). */
const SCENE_HEIGHT = 440;
const NO_LATENCIES = () => [];

/** La préparation tirée de l'intention d'attaque d'un ennemi (0 pour une autre intention). */
function windUpOf(battle: Battle, enemy: number): number {
  const intent = battle.enemies[enemy]!.intent;
  return intent?.category === 'attack' ? intent.windUpMs : 0;
}

function sceneTimeline(battle: Battle): SceneTimeline | null {
  const { phase } = battle;
  if (phase.kind !== 'enemy') return null;
  const { step } = phase;
  if (step.kind !== 'stepIn' && step.kind !== 'attack') return null;
  const hitStop = battle.hitStop ?? { at: 0, until: 0 };
  if (step.kind === 'stepIn') {
    return {
      enemy: step.enemy,
      stepInAt: step.since,
      windUpAt: step.until,
      windUpMs: windUpOf(battle, step.enemy),
      impacts: [],
      feintAt: null,
      hitStopAt: hitStop.at,
      hitStopUntil: hitStop.until,
    };
  }
  const attack: AttackStep = step;
  return {
    enemy: attack.enemy,
    stepInAt: attack.startedAt,
    windUpAt: attack.startedAt,
    windUpMs: attack.impacts[0]!.at - attack.startedAt,
    impacts: attack.impacts.map((impact) => impact.at),
    feintAt: attack.feintAt,
    hitStopAt: hitStop.at,
    hitStopUntil: hitStop.until,
  };
}

/**
 * L'écran du combat d'essai (#31 et #32, maquette de l'épique #30, écrans F0 à F8 et P0 à P15) :
 * la scène, les colonnes des ennemis, la barre du héros et la zone d'action ancrée en bas.
 * L'écran ne contient aucune règle : il envoie les touchers datés à la session de combat et
 * affiche ses états (`battleView`) et ses événements.
 */
export function TrialBattleScreen({
  session,
  onClose,
  trialTools,
  now = jsThreadNow,
  uiNow = uiThreadNow,
  soundLatencies = NO_LATENCIES,
}: TrialBattleScreenProps) {
  const reducedMotion = useReducedMotion();
  const display = useTrialBattle(session, reducedMotion);
  const measures = useBattleMeasures({ now, uiNow });
  const tuning = useTrialTuning();
  const shake = useShake(display.shakeKey);
  const { width: screenWidth } = useWindowDimensions();
  const [sceneHeight, setSceneHeight] = useState(SCENE_HEIGHT);
  const frames = useSharedValue(0);
  const dropped = useSharedValue(0);
  const worstGap = useSharedValue(0);
  const frameMeter: FrameMeter = useMemo(
    () => ({ frames, dropped, worstGap }),
    [frames, dropped, worstGap],
  );
  const [frameStats, setFrameStats] = useState<FrameStats>({ frames: 0, dropped: 0, worstGap: 0 });

  const { record } = measures;
  const onDefense = useCallback(
    (button: DefenseButton, touchedAt: number) => {
      record(touchedAt);
      session.pressDefense(button, toBattleInstant(touchedAt));
    },
    [record, session],
  );
  const onStrike = useCallback(
    (touchedAt: number) => {
      record(touchedAt);
      session.pressStrike(toBattleInstant(touchedAt));
    },
    [record, session],
  );
  const onPower = useCallback(
    (touchStartedAt: number, releasedAt: number) =>
      session.heroAction(
        { kind: 'power', power: 'bulwark' },
        toBattleInstant(touchStartedAt),
        toBattleInstant(releasedAt),
      ),
    [session],
  );
  const onAttack = useCallback(
    (touchStartedAt: number, releasedAt: number) =>
      session.heroAction(
        { kind: 'attack' },
        toBattleInstant(touchStartedAt),
        toBattleInstant(releasedAt),
      ),
    [session],
  );
  const onTarget = useCallback(
    (enemy: number, touchStartedAt: number, releasedAt: number) =>
      session.heroAction(
        { kind: 'target', enemy },
        toBattleInstant(touchStartedAt),
        toBattleInstant(releasedAt),
      ),
    [session],
  );
  const replay = useCallback(() => {
    measures.reset();
    frames.set(0);
    dropped.set(0);
    worstGap.set(0);
    display.replay();
  }, [display, frames, dropped, worstGap, measures]);

  const battle = display.snapshot?.battle ?? null;
  const view = useMemo(() => (battle === null ? null : battleView(battle)), [battle]);
  const timeline = useMemo(() => (battle === null ? null : sceneTimeline(battle)), [battle]);
  const over = battle?.phase.kind === 'over' ? battle.phase.outcome : null;

  // Les images comptées sur le fil UI sont relues à la fin du combat, pour le panneau Mesures.
  useEffect(
    () =>
      session.subscribe(({ events }) => {
        if (!events.some((event) => event.type === 'battleEnded')) return;
        setFrameStats({ frames: frames.get(), dropped: dropped.get(), worstGap: worstGap.get() });
      }),
    [session, frames, dropped, worstGap],
  );

  if (battle === null || view === null) {
    return (
      <Screen testID="trial-battle-loading">
        <Text style={styles.loading}>Préparation du combat…</Text>
      </Screen>
    );
  }

  const enemies: SceneEnemy[] = view.enemies.map((enemy) => ({
    kind: enemy.kind,
    standing: enemy.standing,
    target: enemy.target,
    dimmed: enemy.dimmed,
    active: enemy.active,
    down: enemy.stunned,
  }));
  const width = columnWidth(screenWidth, enemies.length);
  const heroFloat = display.float?.float.at === 'hero' ? display.float : null;
  const respite = respiteOf(display.snapshot?.events ?? []);
  const targetName = ENEMY_NAMES[battle.enemies[battle.target]!.kind];
  const onSceneLayout = (event: LayoutChangeEvent) =>
    setSceneHeight(event.nativeEvent.layout.height);

  return (
    <Screen layout="top" testID="trial-battle">
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          {TRIAL_BATTLE_TITLE}
        </Text>
      </View>
      <Animated.View
        onLayout={onSceneLayout}
        testID="battle-scene-frame"
        style={[styles.scene, reducedMotion ? null : shake]}
      >
        <BattleScene
          width={screenWidth}
          height={sceneHeight}
          enemies={enemies}
          heroPose={display.heroPose}
          timeline={timeline}
          streaksAt={display.streaksAt}
          reducedMotion={reducedMotion}
          uiNow={uiNow}
          frameMeter={frameMeter}
        />
        {view.phase === null ? null : (
          <Text
            testID="battle-phase"
            style={[styles.phase, view.phase === 'enemy' ? styles.enemyPhase : styles.heroPhase]}
          >
            {view.phase === 'enemy' ? 'Phase ennemie' : 'Phase du héros'}
          </Text>
        )}
        <View style={styles.foes}>
          {view.enemies.map((enemy, index) => (
            <EnemyColumn
              key={enemy.kind}
              view={enemy}
              index={index}
              width={width}
              sealed={view.sealed === index}
              float={display.float?.float.at === index ? display.float : null}
              uiNow={uiNow}
              now={now}
              onTarget={onTarget}
            />
          ))}
        </View>
        {display.flash === null || reducedMotion ? null : (
          <Flash kind={display.flash.kind} flashKey={display.flash.key} />
        )}
        {display.feedback === null || over !== null ? null : (
          <FeedbackLabel key={display.feedback.key} texts={display.feedback.texts} />
        )}
        {heroFloat === null ? null : (
          <View pointerEvents="none" style={styles.heroFloat}>
            <DamageFloat key={heroFloat.key} float={heroFloat.float} />
          </View>
        )}
        {view.banner === null ? null : (
          <PhaseBanner
            key={view.banner.since}
            to={view.banner.to}
            reducedMotion={reducedMotion}
            {...(battle.phase.kind === 'hero' && {
              hideAfterMs: view.banner.until - view.banner.since,
            })}
          />
        )}
        {display.snapshot?.heroHint && view.heroActions ? (
          <BattleHintBubble kind="hero" onClose={() => session.dismissHint('hero')} />
        ) : null}
        {view.defenseHint ? (
          <BattleHintBubble kind="defense" onClose={() => session.dismissHint('defense')} />
        ) : null}
      </Animated.View>
      {over === null ? (
        <>
          <HeroBar hero={battle.hero} />
          <View style={styles.zone}>
            <Text
              testID="battle-zone-line"
              style={[styles.line, lineHidden(view.pad) && styles.hidden]}
            >
              {view.line === null ? null : (
                <>
                  {view.line.before}
                  <Text style={styles.strong}>{view.line.strong}</Text>
                  {view.line.after}
                </>
              )}
            </Text>
            <ActionPad
              pad={view.pad}
              targetName={targetName}
              uiNow={uiNow}
              now={now}
              onDefense={onDefense}
              onAttack={onAttack}
              onPower={onPower}
              onStrike={onStrike}
            />
          </View>
        </>
      ) : (
        <BattleEndPanel outcome={over} respite={respite} onReplay={replay} onClose={onClose}>
          {trialTools ? (
            <>
              <TrialTuningPanel tuning={tuning.tuning} onStep={tuning.step} />
              <BattleMeasuresPanel
                lines={measureLines({
                  touch: measures.report,
                  session: session.measures(),
                  frames: frameStats,
                  soundLatencies: soundLatencies(),
                })}
              />
            </>
          ) : null}
        </BattleEndPanel>
      )}
    </Screen>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  loading: { color: battleColors.muted, fontSize: 15 },
  header: { height: 54, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  title: { color: battleColors.text, fontSize: 17, fontWeight: '700', letterSpacing: 0.4 },
  // Sur un petit écran, la scène cède la place : la barre du héros et la zone d'action, ancrée en
  // bas, gardent toujours leur taille.
  scene: {
    flexBasis: SCENE_HEIGHT,
    flexGrow: 0,
    flexShrink: 1,
    minHeight: 240,
    overflow: 'hidden',
  },
  phase: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    zIndex: 6,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: battleColors.pill,
    borderWidth: 1,
  },
  enemyPhase: { color: battleColors.onCurseSoft, borderColor: battleColors.curseLine },
  heroPhase: { color: battleColors.light, borderColor: battleColors.lightGlow },
  foes: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    zIndex: 3,
  },
  zone: {
    flexGrow: 1,
    flexShrink: 0,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 34,
    gap: 10,
  },
  line: {
    color: battleColors.muted,
    fontSize: 14,
    lineHeight: 19,
    textAlign: 'center',
    minHeight: 20,
  },
  hidden: { opacity: 0 },
  heroFloat: { position: 'absolute', left: 40, bottom: 150, width: 80, zIndex: 8 },
  strong: { color: battleColors.text, fontWeight: '600' },
});
// Stryker restore all
