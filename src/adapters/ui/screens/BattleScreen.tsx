import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import Animated from 'react-native-reanimated';

import type { BattleSession } from '../../../application/useCases/BattleSession';
import type { Battle } from '../../../domain/battle/Battle';
import type { DefenseButton } from '../../../domain/battle/BattleEvent';
import type { EnemyKind } from '../../../domain/battle/combatants';
import { summonedKind } from '../../../domain/battle/summon';
import type { PowerKind } from '../../../domain/battle/powers';
import { ActionPad } from '../battle/ActionPad';
import type { ScenePowers } from '../battle/scene/powerScene';
import type { SceneSignatures } from '../battle/scene/signatureScene';
import { ActionTrack } from '../battle/ActionTrack';
import { BattleScene, prepareBattleScene } from '../battle/BattleCanvas';
import { DamageFloat, FeedbackLabel, ThornsWord, useShake } from '../battle/BattleEffects';
import { BleedDrops } from '../battle/BleedChip';
import { BattleHintBubble } from '../battle/BattleHintBubble';
import { ACTION_ZONE_BOTTOM, ACTION_ZONE_SIDE, PowerList } from '../battle/PowerList';
import { EncounterHintBubble } from '../battle/EncounterHintBubble';
import { EnemyColumn } from '../battle/EnemyColumn';
import { EmberFlames, StolenMomentum } from '../battle/AshGardensEffects';
import { SweepTrail } from '../battle/SweepStroke';
import { HeroBar } from '../battle/HeroBar';
import { PhaseBanner } from '../battle/PhaseBanner';
import { sceneGeometry } from '../battle/scene/sceneGeometry';
import { sceneTimeline } from '../battle/scene/sceneTimeline';
import { SecondChanceBanner } from '../battle/SecondChanceBanner';
import { SummonBanner } from '../battle/SummonBanner';
import type { SceneEnemy } from '../battle/sceneTypes';
import { Screen } from '../components/Screen';
import { SECOND_CHANCE_FREEZE_MS } from '../../../domain/battle/secondChance';
import { SECOND_CHANCE_SPENT, enemyName } from '../format/battleText';
import { artPalette } from '../pixelArt/artPalette';
import { toBattleInstant } from '../state/battleTouch';
import { actionTrackView, battleView, type BattleView } from '../state/battleView';
import { useReducedMotion } from '../state/useReducedMotion';
import { jsThreadNow, uiThreadNow } from '../state/useTouchProbe';
import {
  heroHpShown,
  auraStruckAt,
  momentumShown,
  useBattleDisplay,
  useTheftRevealed,
  useThornsRevealed,
} from '../state/useBattleDisplay';
import { usePowerList } from '../state/usePowerList';
import { battleColors } from '../theme/battleColors';

export interface BattleScreenProps {
  readonly session: BattleSession;
  /** Le titre de l'en-tête : « Étage 3 », « Le boss ». */
  readonly title: string;
  /** L'horloge du fil JS, sur la base de l'horloge de combat. Par défaut `performance.now()`. */
  readonly now?: () => number;
  /** L'horloge du fil UI, lue dans les worklets des gestes : ce doit être un worklet. */
  readonly uiNow?: () => number;
  /**
   * Reçoit le haut et le bas du cadre de la scène, mesurés dans la fenêtre à chaque mise en page
   * (#176) : le voile de lisibilité du fond de palier s'arrête à ses bords.
   */
  readonly onSceneArea?: (top: number, bottom: number) => void;
}

/** La ligne au-dessus des boutons s'efface pendant le temps mort et le déséquilibre. */
function lineHidden(pad: BattleView['pad']): boolean {
  if (pad.kind === 'none' || pad.kind === 'strike') return false;
  return pad.locked || (pad.kind === 'defense' && pad.offBalance);
}

/**
 * Les ennemis dont l'écran prépare les atlas : la première ligne et la réserve (#38), puis ceux
 * qu'ils peuvent invoquer (#172) ou exhumer (#258), chacun une fois, dans cet ordre.
 */
function preparedKinds(battle: Battle): string {
  const kinds = [...battle.enemies.map((enemy) => enemy.kind), ...battle.reserve];
  const summoned = kinds.flatMap((kind) => summonedKind(kind) ?? []);
  return [...new Set([...kinds, ...summoned])].join();
}

/** Avant le combat, aucune touche. */
const NO_PAD: BattleView['pad'] = { kind: 'none' };

/**
 * Tant que la liste des pouvoirs est ouverte (#271), le reste de l'écran est caché à TalkBack
 * (`accessibilityViewIsModal` n'agit que sur iOS).
 */
const HIDDEN_FROM_TALKBACK = { importantForAccessibility: 'no-hide-descendants' } as const;

/** La hauteur de la scène de la maquette (cadre de 390 × 844 pt). */
const SCENE_HEIGHT = 440;

/**
 * L'écran de combat (#31 et #32, maquette de l'épique #30, écrans F0 à F7 et P0 à P15), ouvert par
 * l'ascension : la scène, les colonnes des ennemis, la barre du héros et la zone d'action ancrée en
 * bas. L'écran ne contient aucune règle : il envoie les touchers datés à la session de combat et
 * affiche ses états (`battleView`) et ses événements. Le combat fini, rien ne s'affiche sous la
 * scène : l'ascension prend la suite.
 */
export function BattleScreen({
  session,
  title,
  now = jsThreadNow,
  uiNow = uiThreadNow,
  onSceneArea,
}: BattleScreenProps) {
  const reducedMotion = useReducedMotion();
  const display = useBattleDisplay(session, reducedMotion);
  const shake = useShake(display.shakeKey);
  const thornsShown = useThornsRevealed(display.thorns);
  const theftShown = useTheftRevealed(display.theft);
  const { width: screenWidth } = useWindowDimensions();
  const [sceneHeight, setSceneHeight] = useState(SCENE_HEIGHT);
  const sceneFrame = useRef<View>(null);

  const battle = display.snapshot?.battle ?? null;
  // Les atlas de la scène sont faits avant le combat, jamais pendant la phase ennemie : ceux de
  // tous les ennemis du combat, première ligne et réserve, aspect de phase 2 compris (#38), et
  // ceux des ennemis qu'ils peuvent invoquer (#172), une fois chacun : la clé ne change pas quand
  // les invoqués entrent.
  const battleKinds = battle === null ? '' : preparedKinds(battle);
  useEffect(() => {
    if (battleKinds !== '') prepareBattleScene(battleKinds.split(',') as EnemyKind[]);
  }, [battleKinds]);

  const heroKind = display.snapshot?.battle.heroKind ?? 'sentinel';
  const onDefense = useCallback(
    (button: DefenseButton, touchedAt: number) =>
      session.pressDefense(button, toBattleInstant(touchedAt)),
    [session],
  );
  const onStrike = useCallback(
    (touchedAt: number) => session.pressStrike(toBattleInstant(touchedAt)),
    [session],
  );
  const onPower = useCallback(
    (power: PowerKind, touchStartedAt: number, releasedAt: number) =>
      session.heroAction(
        { kind: 'power', power },
        toBattleInstant(touchStartedAt),
        toBattleInstant(releasedAt),
      ),
    [session],
  );
  const onPowerTip = useCallback(() => session.feelPowerTip(), [session]);
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
  // L'ombre de Pas de l'ombre (#173), tant qu'il est actif : elle glisse depuis le dernier lancer ;
  // aussi pendant Frappe furtive (#236), depuis son lancer.
  const shadowStepActive =
    battle?.hero.shadowStep === true ||
    (battle?.phase.kind === 'heroStrike' && battle.phase.power === 'ambush');
  const shadowStep = useMemo(
    () => (shadowStepActive ? { castAt: display.shadowStepAt } : null),
    [shadowStepActive, display.shadowStepAt],
  );
  // La Brûlure sur la scène (#171) : les charges du combat ; un combat repris n'a ni prise ni fumée.
  const burnStacks = battle?.hero.burn ?? 0;
  const { burnFx } = display;
  const burn = useMemo(() => ({ stacks: burnStacks, ...burnFx }), [burnStacks, burnFx]);
  const view = useMemo(() => (battle === null ? null : battleView(battle)), [battle]);
  const powerList = usePowerList(view?.pad ?? NO_PAD);
  const powersOpen = powerList.open;
  // L'ouverture de la liste des pouvoirs : la vibration très courte du toucher maintenu (#271).
  useEffect(() => {
    if (powersOpen) session.feelPowerTip();
  }, [powersOpen, session]);
  // L'Invocation sur la scène (#172) : la poussière vient de l'état, l'annonce et la sortie des
  // événements ; un combat repris n'a pas d'annonce.
  const dust = view?.dust;
  const { summonFx } = display;
  const summon = useMemo(() => ({ ...summonFx, pending: dust ?? [] }), [dust, summonFx]);
  // Le relèvement de la seconde chance sur la scène (#206) ; un combat repris ne le rejoue pas.
  const rise = display.secondChance;
  const sceneRise = useMemo(
    () => (rise === null ? null : { at: rise.at, until: rise.until }),
    [rise],
  );
  // Les pouvoirs de #235 sur la scène : le halo de Tenir bon, le voile de Brume, la marque
  // d'Entaille sur la cible de la frappe qui la consomme, l'éclat d'or de Représailles.
  const mist = battle?.hero.mist === true;
  const rendTarget =
    battle !== null &&
    (battle.hero.rend === true ||
      (battle.phase.kind === 'heroStrike' && battle.phase.rend === true))
      ? battle.target
      : null;
  const scenePowers = useMemo<ScenePowers>(
    () => ({ healedAt: display.healedAt, mist, rendTarget, retaliation: display.retaliation }),
    [display.healedAt, mist, rendTarget, display.retaliation],
  );
  const timeline = useMemo(() => (battle === null ? null : sceneTimeline(battle)), [battle]);
  // La frise ne change qu'avec le combat : elle garde ainsi sa frise précédente d'un instantané à
  // l'autre. Elle existe dès que le combat existe (`battle` non nul plus bas).
  const track = useMemo(() => (battle === null ? null : actionTrackView(battle)), [battle]);
  const over = battle?.phase.kind === 'over' ? battle.phase.outcome : null;
  // Le voile de phase ennemie et la frise assombrie suivent la pastille de l'en-tête (#188).
  const enemyPhase = view?.phase === 'enemy';

  if (battle === null || view === null) {
    return (
      <Screen background="transparent" testID="battle-loading">
        <Text style={styles.loading}>Préparation du combat…</Text>
      </Screen>
    );
  }

  const enemies: SceneEnemy[] = view.enemies.map((enemy, index) => ({
    kind: enemy.kind,
    standing: enemy.standing,
    target: enemy.target,
    dimmed: enemy.dimmed,
    active: enemy.active,
    down: enemy.stunned,
    losingAction: enemy.losingAction,
    rising: enemy.rising,
    phase2: enemy.phase2 === true,
    downSince: display.downSince[index] ?? null,
    ...(display.exhumeFx[index] !== undefined && { exhumedAt: display.exhumeFx[index] }),
    ...(enemy.charging === true && { charging: true }),
    ...(enemy.chargeBroken === true && { chargeBroken: true }),
    // La Cosse de braise éclatée ou étouffée, la Phalène voleuse qui saisit l'Élan (#267).
    ...(display.podFalls[index] !== undefined && { podFall: display.podFalls[index] }),
    ...(display.theft?.enemy === index && { stealAt: display.theft.at }),
    // Le cierge soufflé du Porte-cierge, le grouillement d'un Rat en Nuée (#268).
    ...(display.candleFalls[index] !== undefined && { snuffedAt: display.candleFalls[index] }),
    ...(enemy.swarming === true && { swarming: true }),
  }));
  // La bulle de première rencontre (#258, F1) : le premier toucher, où qu'il soit, la ferme.
  const encounterHint = display.snapshot?.encounterHint;
  const closeEncounterHint = () => session.dismissEncounterHint();
  const geometry = sceneGeometry(screenWidth, sceneHeight, view.columns, {
    lead: view.leadLayout,
  });
  const strikeImpactAt = battle.phase.kind === 'heroStrike' ? battle.phase.impactAt : null;
  const { heroFloat, burnFloat, thorns } = display;
  // La piqûre des Épines (#259, M2) : la barre de PV du héros baisse avec le « −2 », 300 ms après la
  // fin de la frappe ; les pointes jaillissent alors du héros.
  const signatures: SceneSignatures = {
    prick: thorns === null ? null : { from: thorns.from },
    wardSpark: display.sanctuary.spark,
    wardBroken: display.sanctuary.broken,
  };
  const targetName = enemyName(battle.enemies[battle.target]!);
  const onSceneLayout = (event: LayoutChangeEvent) => {
    setSceneHeight(event.nativeEvent.layout.height);
    sceneFrame.current?.measureInWindow((_x, y, _width, height) => onSceneArea?.(y, y + height));
  };

  return (
    <Screen layout="top" background="transparent" testID="battle-screen">
      <View {...(powersOpen && HIDDEN_FROM_TALKBACK)} style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
      </View>
      {battle.initiative && over === null ? (
        <View {...(powersOpen && HIDDEN_FROM_TALKBACK)}>
          <ActionTrack track={track!} reducedMotion={reducedMotion} enemyPhase={enemyPhase} />
        </View>
      ) : null}
      {/* Le cadre fixe de la scène, mesuré, porte le voile ; la scène tremble au-dessus (ADR 0008, avenant #188). */}
      <View
        ref={sceneFrame}
        onLayout={onSceneLayout}
        {...(encounterHint !== undefined && { onTouchStart: closeEncounterHint })}
        {...(powersOpen && HIDDEN_FROM_TALKBACK)}
        testID="battle-scene-frame"
        style={styles.scene}
      >
        {enemyPhase ? (
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            testID="enemy-phase-veil"
            style={styles.enemyPhaseVeil}
          />
        ) : null}
        <Animated.View
          testID="battle-scene-shake"
          style={[styles.shake, reducedMotion ? null : shake]}
        >
          <BattleScene
            width={screenWidth}
            height={sceneHeight}
            geometry={geometry}
            enemies={enemies}
            heroKind={heroKind}
            heroPose={display.heroPose}
            heroPoseSince={display.heroPoseSince}
            strikeTarget={battle.target}
            strikeImpactAt={strikeImpactAt}
            timeline={timeline}
            spark={display.spark}
            hurtAt={display.hurtAt}
            bulwark={battle.hero.bulwark}
            bulwarkWornAt={display.bulwarkWornAt}
            riposte={display.riposte}
            shadowStep={shadowStep}
            burn={burn}
            summon={summon}
            secondChance={sceneRise}
            powers={scenePowers}
            signatures={signatures}
            reducedMotion={reducedMotion}
            uiNow={uiNow}
          />
          {view.phase === null ? null : (
            <Text
              testID="battle-phase"
              style={[styles.phase, view.phase === 'enemy' ? styles.enemyPhase : styles.heroPhase]}
            >
              {view.phase === 'enemy' ? 'Phase ennemie' : 'Phase du héros'}
            </Text>
          )}
          <View style={styles.foes} pointerEvents="box-none">
            {view.enemies.map((enemy, index) => (
              <EnemyColumn
                // Par place et par arrivée : un groupe compte plusieurs Goules, et un renfort a sa
                // propre colonne, sans l'état de l'ennemi tombé qu'il remplace.
                key={`${index}:${display.arrivals[index] ?? 0}`}
                view={enemy}
                index={index}
                slot={geometry.enemies[index]!}
                sealed={view.sealed === index}
                swept={view.swept === index}
                // Les « +20 % » barrés à la chute du Porte-cierge (#268, C4), par chute.
                auraOut={auraStruckAt(display, index)}
                reducedMotion={reducedMotion}
                float={display.float?.float.at === index ? display.float : null}
                uiNow={uiNow}
                now={now}
                onTarget={onTarget}
              />
            ))}
          </View>
          {/* Les chevrons du trait de balayage, au sol, de l'ennemi vers le héros (#266, A2). */}
          {view.swept === null || geometry.enemies[view.swept] === undefined ? null : (
            <SweepTrail
              from={geometry.hero.x + geometry.hero.width}
              to={geometry.enemies[view.swept]!.groundShadowAt.x - 24}
              y={geometry.heroGroundShadowAt.y}
              reducedMotion={reducedMotion}
            />
          )}
          {/* Les 2 flammes de l'Éclatement, de la Cosse au héros (#267, J7). */}
          {display.emberFlames === null ||
          geometry.enemies[display.emberFlames.enemy] === undefined ? null : (
            <EmberFlames
              key={display.emberFlames.key}
              from={{
                x: geometry.enemies[display.emberFlames.enemy]!.groundShadowAt.x - 8,
                y: geometry.enemies[display.emberFlames.enemy]!.groundShadowAt.y - 60,
              }}
              to={{ x: geometry.chest.x - 8, y: geometry.chest.y - 8 }}
              delayMs={display.emberFlames.delayMs}
              reducedMotion={reducedMotion}
            />
          )}
          {/* Le losange d'Élan volé, du héros vers la Phalène voleuse, et « −1 Élan » (#267, J2). */}
          {display.theft === null || geometry.enemies[display.theft.enemy] === undefined ? null : (
            <StolenMomentum
              key={display.theft.key}
              from={{ x: geometry.chest.x + 24, y: geometry.chest.y - 24 }}
              to={{
                x: geometry.enemies[display.theft.enemy]!.groundShadowAt.x - 8,
                y: geometry.enemies[display.theft.enemy]!.groundShadowAt.y - 80,
              }}
              stolen={display.theft.stolen}
              delayMs={display.theft.delayMs}
              reducedMotion={reducedMotion}
            />
          )}
          {/* « Victoire » (#258, F6) reste écrit pendant la chute du Squelette avec le Fossoyeur. */}
          {display.feedback === null ||
          (over !== null &&
            !display.feedback.texts.some((text) => text.tone === 'victory')) ? null : (
            <FeedbackLabel key={display.feedback.key} texts={display.feedback.texts} />
          )}
          {battle.hero.bleed ? <BleedDrops /> : null}
          {heroFloat === null ? null : (
            <View pointerEvents="none" testID="battle-hero-float" style={styles.heroFloat}>
              <DamageFloat key={heroFloat.key} float={heroFloat.float} />
            </View>
          )}
          {thorns === null ? null : (
            <View pointerEvents="none" testID="battle-thorns-float" style={styles.thornsFloat}>
              <DamageFloat
                key={thorns.key}
                float={{ at: 'hero', text: `−${thorns.loss}`, big: false, kind: 'thorns' }}
                delayMs={thorns.delayMs}
                reducedMotion={reducedMotion}
              />
              <ThornsWord key={`word-${thorns.key}`} delayMs={thorns.delayMs} />
            </View>
          )}
          {burnFloat === null ? null : (
            <View pointerEvents="none" testID="battle-burn-float" style={styles.burnFloat}>
              <DamageFloat
                key={burnFloat.key}
                float={burnFloat.float}
                delayMs={burnFloat.delayMs}
                reducedMotion={reducedMotion}
              />
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
          {/* L'annonce de l'Invocation (#172), dans la scène qui tremble, au-dessus du voile. */}
          {display.summonBanner === null || over !== null ? null : (
            <SummonBanner
              key={display.summonBanner.key}
              title={display.summonBanner.title}
              line={display.summonBanner.line}
              {...(display.summonBanner.tone !== undefined && { tone: display.summonBanner.tone })}
              reducedMotion={reducedMotion}
            />
          )}
          {/* Le bandeau et le « +40 » en or de la seconde chance (#206, S3), après le gel. */}
          {rise === null || over !== null ? null : (
            <>
              <SecondChanceBanner
                key={rise.key}
                title={rise.title}
                lines={rise.lines}
                reducedMotion={reducedMotion}
              />
              <View pointerEvents="none" testID="battle-rise-float" style={styles.heroFloat}>
                <DamageFloat
                  key={rise.key}
                  float={rise.float}
                  delayMs={SECOND_CHANCE_FREEZE_MS}
                  reducedMotion={reducedMotion}
                />
              </View>
            </>
          )}
          {display.snapshot?.heroHint && view.heroActions ? (
            <BattleHintBubble kind="hero" onClose={() => session.dismissHint('hero')} />
          ) : null}
          {display.snapshot?.powersHint && view.heroActions ? (
            <BattleHintBubble kind="powers" onClose={() => session.dismissHint('powers')} />
          ) : null}
          {encounterHint !== undefined && over === null ? (
            <EncounterHintBubble enemy={encounterHint} onClose={closeEncounterHint} />
          ) : null}
          {view.defenseHint ? (
            <BattleHintBubble kind="defense" onClose={() => session.dismissHint('defense')} />
          ) : null}
        </Animated.View>
        {/* Le combat se voile sous la liste des pouvoirs (#271, `.veil.deep`), la barre du héros au-dessus. */}
        {powersOpen ? (
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            testID="battle-power-scene-veil"
            style={styles.powersVeil}
          />
        ) : null}
      </View>
      {over === null ? (
        <>
          <View {...(powersOpen && HIDDEN_FROM_TALKBACK)}>
            <HeroBar
              hero={{
                ...battle.hero,
                // La barre d'Élan baisse avec le losange volé, pas avant (#267, J2).
                momentum: momentumShown(battle.hero.momentum, display, theftShown),
              }}
              kind={heroKind}
              bulwarkWorn={display.bulwarkWornAt !== null}
              shadowStepNew={view.pad.kind === 'hero' && view.pad.instantCast === true}
              burnRing={display.burnRing}
              rise={rise === null ? null : { key: rise.key }}
              healing={battle.phase.kind === 'heroPower' && battle.phase.power === 'holdFast'}
              shownHp={heroHpShown(battle.hero.hp, display, thornsShown)}
              pricked={thorns !== null && thornsShown ? { key: thorns.key } : null}
              reducedMotion={reducedMotion}
            />
          </View>
          <View {...(powersOpen && HIDDEN_FROM_TALKBACK)} style={styles.zone}>
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
              onStrike={onStrike}
              powersOpen={powersOpen}
              onTogglePowers={powerList.toggle}
              focusPowers={powerList.focusPowers}
            />
          </View>
        </>
      ) : null}
      {/* La chute quand la seconde chance a déjà servi (#206, S4), sous la défaite. */}
      {over === 'defeat' && battle.hero.secondChance === 'used' ? (
        <Text style={styles.spent}>{SECOND_CHANCE_SPENT}</Text>
      ) : null}
      {/* La liste des pouvoirs (#271), sur tout l'écran : son voile reçoit aussi les touchers. */}
      {powersOpen && view.pad.kind === 'hero' ? (
        <PowerList
          slots={view.pad.powers}
          uiNow={uiNow}
          now={now}
          reducedMotion={reducedMotion}
          onCast={onPower}
          onDismiss={powerList.dismiss}
          onTip={onPowerTip}
        />
      ) : null}
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
  },
  // La scène qui tremble, rognée à son cadre ; sans débord du voile, posé sous elle sur le cadre fixe.
  shake: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  enemyPhaseVeil: { ...StyleSheet.absoluteFill, backgroundColor: artPalette.roles.enemyPhaseVeil },
  powersVeil: { ...StyleSheet.absoluteFill, zIndex: 9, backgroundColor: artPalette.roles.scrim },
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
  foes: { ...StyleSheet.absoluteFill, zIndex: 3 },
  zone: {
    flexGrow: 1,
    flexShrink: 0,
    justifyContent: 'flex-end',
    paddingHorizontal: ACTION_ZONE_SIDE,
    paddingBottom: ACTION_ZONE_BOTTOM,
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
  // Le chiffre de la Brûlure, à droite de celui du Saignement (maquette 170, B5).
  burnFloat: { position: 'absolute', left: 86, bottom: 128, width: 80, zIndex: 8 },
  // Le « −2 » et le mot « Épines » près du héros (#259, M2, `.fword.thorn`).
  thornsFloat: { position: 'absolute', left: 8, bottom: 150, width: 120, zIndex: 8 },
  strong: { color: battleColors.text, fontWeight: '600' },
  spent: {
    color: artPalette.roles.parchment,
    fontSize: 14,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 16,
  },
});
// Stryker restore all
