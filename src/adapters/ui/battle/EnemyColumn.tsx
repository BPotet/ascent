import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';

import type { IntentCategory } from '../../../domain/battle/shownIntent';
import { intentNumber } from '../format/battleText';
import { artPalette } from '../pixelArt/artPalette';
import { PixelFrame } from '../pixelArt/PixelFrame';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { textFont } from '../pixelArt/pixelTypography';
import type { IconName } from '../pixelArt/sprites/icons';
import type { EnemyView } from '../state/battleView';
import { battleColors } from '../theme/battleColors';
import { DamageFloat } from './BattleEffects';
import { PerilSeal } from './PerilSeal';
import type { EnemySlot } from './scene/sceneGeometry';
import type { TrialBattleDisplay } from '../state/useTrialBattle';
import { useReleaseGesture } from './touchGestures';

/** L'identifiant du geste de la colonne d'un ennemi, pour `getByGestureTestId` dans les tests. */
export function enemyGestureTestId(index: number): string {
  return `battle-enemy-${index}`;
}

/** L'icône de chaque catégorie d'intention (C2.2). */
const INTENT_ICONS: Readonly<Record<IntentCategory, IconName>> = {
  attack: 'iAttack',
  guard: 'iGuard',
  heal: 'iHeal',
  raise: 'iRaise',
  skip: 'iSkip',
};

/**
 * La colonne d'un ennemi (maquette F1, F5, F7, P0b à P13) : toute la colonne est touchable pour le
 * viser (au relâcher). Elle montre son intention en icône (avec « +N » pour Garde et Soin), sa barre
 * de PV, son nom, sa garde (ou « Étourdie ×1,5 ») et le sceau rouge d'un coup imparable. En phase
 * ennemie épurée, le nom et les chiffres sont masqués. L'ennemi actif a son intention cernée de
 * lumière (de rouge sous le sceau) et sa plaque à 45 % ; les autres s'estompent. L'ennemi est
 * annoncé en entier au lecteur d'écran. Sa plaque est en cadre cranté ; la cible a un double cadre
 * d'or, une flèche au-dessus de son intention et son nom en gras, jamais la couleur seule (#120). Son sprite, ses étoiles et son socle sont dessinés par la
 * scène, derrière, à la place que donne `sceneGeometry`.
 */
export function EnemyColumn({
  view,
  index,
  slot,
  sealed,
  reducedMotion = false,
  float,
  uiNow,
  now,
  onTarget,
}: {
  readonly view: EnemyView;
  readonly index: number;
  /** Sa place dans la scène. */
  readonly slot: EnemySlot;
  readonly sealed: boolean;
  readonly reducedMotion?: boolean;
  /** Le chiffre qui s'envole au-dessus de lui, s'il est pour lui. */
  readonly float: TrialBattleDisplay['float'];
  readonly uiNow: () => number;
  readonly now: () => number;
  readonly onTarget: (enemy: number, touchStartedAt: number, releasedAt: number) => void;
}) {
  // Un rappel stable : le geste n'est pas recréé à chaque instantané du combat.
  const onRelease = useCallback(
    (touchStartedAt: number, releasedAt: number) => onTarget(index, touchStartedAt, releasedAt),
    [onTarget, index],
  );
  const gesture = useReleaseGesture(enemyGestureTestId(index), uiNow, onRelease);
  const { kind, intent } = view;
  const number = intent === null ? null : intentNumber(intent);
  return (
    <GestureDetector gesture={gesture}>
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={view.label}
        accessibilityState={{ selected: view.target, disabled: !view.standing }}
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={() => onTarget(index, now(), now())}
        testID={`enemy-${kind}`}
        style={[
          styles.column,
          { left: slot.column.x, top: slot.column.y, width: slot.column.width },
          view.dimmed && styles.dimmed,
          !view.standing && styles.down,
        ]}
      >
        {view.target ? (
          <View
            pointerEvents="none"
            testID={`enemy-${kind}-target-arrow`}
            style={styles.targetArrow}
          >
            <PixelIcon name="right" color={artPalette.roles.gold} style={styles.pointDown} />
          </View>
        ) : null}
        <View
          {...(intent === null ? {} : { testID: `enemy-${kind}-intent` })}
          style={[
            styles.intent,
            intent === null && styles.noIntent,
            view.active && (sealed ? styles.sealedIntent : styles.activeIntent),
          ]}
        >
          {intent === null ? null : (
            <>
              <PixelIcon
                name={INTENT_ICONS[intent.category]}
                color={battleColors.text}
                secondColor={battleColors.light}
                testID={`enemy-${kind}-intent-${intent.category}`}
              />
              {number === null ? null : <Text style={styles.intentText}>{number}</Text>}
            </>
          )}
        </View>
        <View style={styles.figure}>
          {sealed ? <PerilSeal reducedMotion={reducedMotion} /> : null}
          {float === null ? null : <DamageFloat key={float.key} float={float.float} />}
        </View>
        <PixelFrame
          tone={view.target ? 'gold' : 'default'}
          under={battleColors.background}
          testID={`enemy-${kind}-plate`}
          style={[styles.plate, view.active && styles.activePlate]}
        >
          <View
            testID={`enemy-${kind}-ring`}
            style={[styles.ring, view.target && styles.targetRing]}
          >
            <View style={styles.track}>
              <View
                testID={`enemy-${kind}-hp`}
                style={[styles.hp, { width: `${Math.round(100 * view.hpRatio)}%` }]}
              />
              {view.hpText === null ? null : <Text style={styles.barText}>{view.hpText}</Text>}
            </View>
            {view.name === null ? null : (
              <Text style={[styles.name, view.target && styles.targetName]}>{view.name}</Text>
            )}
            {view.tag === null ? null : <Text style={styles.tag}>{view.tag}</Text>}
            <View style={[styles.track, view.stunned && styles.stunnedTrack]}>
              <View
                testID={`enemy-${kind}-guard`}
                style={[styles.guard, { width: `${Math.round(100 * view.guardRatio)}%` }]}
              />
              {view.guardText === null ? null : (
                <Text style={[styles.barText, view.stunned && styles.stunnedText]}>
                  {view.guardText}
                </Text>
              )}
            </View>
          </View>
        </PixelFrame>
      </View>
    </GestureDetector>
  );
}

// Stryker disable all: dessin de la scène, vérifié par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  column: {
    position: 'absolute',
    alignItems: 'center',
    gap: 2,
    paddingTop: 2,
    paddingBottom: 4,
  },
  // Maquette `.pfoe.dim` : 25 % ; la scène désature son sprite.
  dimmed: { opacity: 0.25 },
  down: { opacity: 0 },
  intent: {
    height: 40,
    minWidth: 44,
    paddingHorizontal: 6,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: battleColors.badge,
    borderWidth: 1,
    borderColor: battleColors.curseLine,
  },
  noIntent: { opacity: 0 },
  activeIntent: { borderWidth: 2, borderColor: battleColors.light },
  sealedIntent: { borderWidth: 2, borderColor: battleColors.seal },
  intentText: {
    color: battleColors.text,
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  figure: { width: 88, height: 104, alignItems: 'center' },
  plate: { width: '100%', minHeight: 56 },
  // Le second trait, d'or pour la cible : le double cadre d'or (C2).
  ring: {
    flexGrow: 1,
    gap: 2,
    paddingHorizontal: 3,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  targetRing: { borderColor: artPalette.roles.gold },
  activePlate: { opacity: 0.45 },
  targetArrow: { position: 'absolute', top: -16, alignSelf: 'center', zIndex: 4 },
  pointDown: { transform: [{ rotate: '90deg' }] },
  track: {
    height: 14,
    borderRadius: 3,
    backgroundColor: battleColors.hpTrack,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  stunnedTrack: { backgroundColor: battleColors.light },
  hp: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: battleColors.foeHp },
  guard: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: battleColors.guard },
  barText: {
    color: battleColors.text,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  stunnedText: { color: battleColors.onLight },
  name: { color: battleColors.text, fontFamily: textFont.semiBold, fontSize: 12, lineHeight: 15 },
  targetName: { color: battleColors.light, fontFamily: textFont.bold },
  tag: { color: battleColors.light, fontSize: 11, fontWeight: '700' },
});
// Stryker restore all
