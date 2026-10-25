import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';

import type { IntentCategory } from '../../../domain/battle/shownIntent';
import { intentNumber } from '../format/battleText';
import { PixelIcon } from '../pixelArt/PixelIcon';
import type { IconName } from '../pixelArt/sprites/icons';
import type { EnemyView } from '../state/battleView';
import { battleColors } from '../theme/battleColors';
import { DamageFloat } from './BattleEffects';
import { PerilSeal } from './PerilSeal';
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
 * La colonne d'un ennemi (maquette F1, F5, F7) : toute la colonne est touchable pour le viser (au
 * relâcher). Elle montre son intention en icône (avec « +N » pour Garde et Soin), sa barre de PV,
 * son nom, sa garde (ou « Étourdie ×1,5 ») et le sceau rouge d'un coup imparable. En phase ennemie
 * épurée, le nom et les chiffres sont masqués. L'ennemi est annoncé en entier au lecteur d'écran.
 * La silhouette est dessinée par la scène, derrière.
 */
export function EnemyColumn({
  view,
  index,
  width,
  sealed,
  float,
  uiNow,
  now,
  onTarget,
}: {
  readonly view: EnemyView;
  readonly index: number;
  readonly width: number;
  readonly sealed: boolean;
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
          { width },
          view.dimmed && styles.dimmed,
          !view.standing && styles.down,
        ]}
      >
        <View
          {...(intent === null ? {} : { testID: `enemy-${kind}-intent` })}
          style={[styles.intent, intent === null && styles.noIntent]}
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
          {sealed ? <PerilSeal /> : null}
          {view.stunned ? (
            <Text
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              testID={`enemy-${kind}-stars`}
              style={[styles.stars, view.losingAction && styles.starsJump]}
            >
              ✦ ✦ ✦
            </Text>
          ) : null}
          {float === null ? null : <DamageFloat key={float.key} float={float.float} />}
        </View>
        <View style={[styles.plate, view.target && styles.targetPlate]}>
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
      </View>
    </GestureDetector>
  );
}

// Stryker disable all: dessin de la scène, vérifié par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  column: {
    alignItems: 'center',
    gap: 3,
    paddingTop: 4,
    paddingBottom: 8,
    borderRadius: 18,
  },
  dimmed: { opacity: 0.45 },
  down: { opacity: 0 },
  intent: {
    height: 34,
    minWidth: 34,
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
  intentText: {
    color: battleColors.text,
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  figure: { width: 104, height: 112, alignItems: 'center' },
  stars: {
    position: 'absolute',
    top: 34,
    color: battleColors.light,
    fontSize: 13,
    letterSpacing: 2,
  },
  starsJump: { top: 28 },
  plate: {
    width: '96%',
    maxWidth: 120,
    gap: 2,
    padding: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: battleColors.line,
    backgroundColor: battleColors.badge,
  },
  targetPlate: { borderColor: battleColors.light },
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
  name: { color: battleColors.text, fontSize: 12, fontWeight: '600' },
  targetName: { color: battleColors.light },
});
// Stryker restore all
