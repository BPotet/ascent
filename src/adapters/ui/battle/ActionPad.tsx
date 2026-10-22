import { useCallback, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { DefenseButton } from '../../../domain/battle/BattleEvent';
import { attackButtonLabel } from '../format/battleText';
import type { ActionPad as Pad, LockSpan } from '../state/battleView';
import { battleColors } from '../theme/battleColors';
import { DodgeGlyph, LockGlyph, ShieldGlyph, SwordGlyph } from './BattleGlyphs';
import { useDefenseGesture, useReleaseGesture } from './touchGestures';

export const ATTACK_GESTURE_TEST_ID = 'battle-attack';
export const DEFENSE_GESTURE_TEST_IDS: Readonly<Record<DefenseButton, string>> = {
  parry: 'battle-parry',
  dodge: 'battle-dodge',
};

/** Les rayures du déséquilibre, sur toute la grille. Décoratives : l'étiquette le dit. */
function Hatching() {
  return (
    <View pointerEvents="none" testID="battle-pad-hatching" style={styles.hatching}>
      {Array.from({ length: 24 }, (_, stripe) => (
        <View key={stripe} style={[styles.stripe, { left: -120 + stripe * 18 }]} />
      ))}
    </View>
  );
}

/** L'étiquette « Attends » du temps mort, avec son cadenas et sa barre qui se remplit. */
function LockTag({ lock, now }: { readonly lock: LockSpan | null; readonly now: () => number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    if (lock === null) {
      progress.set(0);
      return;
    }
    const duration = Math.max(0, lock.until - lock.since);
    const elapsed = Math.min(duration, Math.max(0, now() - lock.since));
    progress.set(duration === 0 ? 1 : elapsed / duration);
    progress.set(withTiming(1, { duration: duration - elapsed, easing: Easing.linear }));
  }, [lock, now, progress]);
  // Dépendances explicites : le code instrumenté par Stryker n'est plus reconnu comme worklet.
  const bar = useAnimatedStyle(() => {
    'worklet';
    return { transform: [{ scaleX: progress.get() }] };
  }, [progress]);
  return (
    <View accessibilityRole="text" testID="battle-lock-tag" style={styles.tag}>
      <LockGlyph color={battleColors.text} />
      <Text style={styles.tagText}>Attends</Text>
      {lock === null ? null : <Animated.View style={[styles.lockBar, bar]} />}
    </View>
  );
}

function DefenseKey({
  button,
  label,
  primary,
  disabled,
  uiNow,
  now,
  onDefense,
}: {
  readonly button: DefenseButton;
  readonly label: string;
  readonly primary: boolean;
  readonly disabled: boolean;
  readonly uiNow: () => number;
  readonly now: () => number;
  readonly onDefense: (button: DefenseButton, touchedAt: number) => void;
}) {
  // Un rappel stable : le geste n'est pas recréé à chaque instantané du combat.
  const onTouch = useCallback(
    (touchedAt: number) => onDefense(button, touchedAt),
    [onDefense, button],
  );
  const gesture = useDefenseGesture(DEFENSE_GESTURE_TEST_IDS[button], uiNow, onTouch);
  return (
    <GestureDetector gesture={gesture}>
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={() => onDefense(button, now())}
        testID={`battle-${button}-button`}
        style={[styles.key, primary ? styles.primary : styles.secondary, disabled && styles.locked]}
      >
        {button === 'parry' ? (
          <ShieldGlyph color={battleColors.onLight} />
        ) : (
          <DodgeGlyph color={battleColors.text} />
        )}
        <Text style={[styles.keyText, primary ? styles.onPrimary : styles.onSecondary]}>
          {label}
        </Text>
      </View>
    </GestureDetector>
  );
}

function AttackKey({
  targetName,
  disabled,
  uiNow,
  onRelease,
  onAccessibilityPress,
}: {
  readonly targetName: string;
  readonly disabled: boolean;
  readonly uiNow: () => number;
  readonly onRelease: (touchStartedAt: number, releasedAt: number) => void;
  readonly onAccessibilityPress: () => void;
}) {
  const gesture = useReleaseGesture(ATTACK_GESTURE_TEST_ID, uiNow, onRelease);
  return (
    <GestureDetector gesture={gesture}>
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={attackButtonLabel(targetName)}
        accessibilityState={{ disabled }}
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={onAccessibilityPress}
        testID="battle-attack-button"
        style={[styles.key, styles.primary, disabled && styles.locked]}
      >
        <SwordGlyph color={battleColors.onLight} />
        <Text style={[styles.keyText, styles.onPrimary]}>Attaquer</Text>
      </View>
    </GestureDetector>
  );
}

/**
 * La zone d'action : une grille de deux cases, ancrée en bas. En phase du héros, la case de
 * gauche reste vide (rien à toucher ni à lire) et « Attaquer » occupe la case de droite ; en phase
 * ennemie, Esquive à gauche et Parade à droite. Pendant le temps mort : inactifs, sans hachures,
 * avec « Attends ». En déséquilibre : grisés et hachurés, toujours actifs.
 */
export function ActionPad({
  pad,
  targetName,
  uiNow,
  now,
  onDefense,
  onAttack,
}: {
  readonly pad: Pad;
  readonly targetName: string;
  readonly uiNow: () => number;
  readonly now: () => number;
  readonly onDefense: (button: DefenseButton, touchedAt: number) => void;
  readonly onAttack: (touchStartedAt: number, releasedAt: number) => void;
}) {
  if (pad.kind === 'none') return null;
  const offBalance = pad.kind === 'defense' && pad.offBalance;
  return (
    <View testID="battle-pad" style={[styles.pad, offBalance && styles.offBalance]}>
      {pad.locked ? <LockTag lock={pad.lock} now={now} /> : null}
      {offBalance ? (
        <Text accessibilityLiveRegion="polite" testID="battle-off-balance" style={styles.offTag}>
          Déséquilibré
        </Text>
      ) : null}
      {pad.kind === 'hero' ? (
        <>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            testID="battle-empty-slot"
            style={styles.slot}
          />
          <AttackKey
            targetName={targetName}
            disabled={pad.locked}
            uiNow={uiNow}
            onRelease={onAttack}
            onAccessibilityPress={() => onAttack(now(), now())}
          />
        </>
      ) : (
        <>
          <DefenseKey
            button="dodge"
            label="Esquive"
            primary={false}
            disabled={pad.locked}
            uiNow={uiNow}
            now={now}
            onDefense={onDefense}
          />
          <DefenseKey
            button="parry"
            label="Parade"
            primary
            disabled={pad.locked}
            uiNow={uiNow}
            now={now}
            onDefense={onDefense}
          />
        </>
      )}
      {offBalance ? <Hatching /> : null}
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  pad: { flexDirection: 'row', gap: 12, borderRadius: 24 },
  offBalance: { opacity: 0.7 },
  slot: { flex: 1, minHeight: 116 },
  key: {
    minHeight: 116,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primary: { flex: 1.45, backgroundColor: battleColors.light },
  secondary: {
    flex: 1,
    backgroundColor: battleColors.secondaryButton,
    borderWidth: 1.5,
    borderColor: battleColors.secondaryLine,
  },
  locked: { opacity: 0.38 },
  keyText: { fontSize: 23, fontWeight: '700', letterSpacing: 0.5 },
  onPrimary: { color: battleColors.onLight },
  onSecondary: { color: battleColors.text },
  hatching: { ...StyleSheet.absoluteFill, borderRadius: 24, overflow: 'hidden' },
  stripe: {
    position: 'absolute',
    top: -60,
    width: 8,
    height: 260,
    backgroundColor: battleColors.hatch,
    transform: [{ rotate: '45deg' }],
  },
  tag: {
    position: 'absolute',
    top: -34,
    alignSelf: 'center',
    left: '50%',
    transform: [{ translateX: -52 }],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: battleColors.surfaceRaised,
    borderWidth: 1,
    borderColor: battleColors.line,
    overflow: 'hidden',
    zIndex: 2,
  },
  tagText: { color: battleColors.text, fontSize: 13, fontWeight: '700' },
  lockBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: battleColors.light,
    transformOrigin: 'left',
  },
  offTag: {
    position: 'absolute',
    top: -34,
    alignSelf: 'center',
    left: '50%',
    transform: [{ translateX: -56 }],
    color: battleColors.onCurseSoft,
    backgroundColor: battleColors.curseSoft,
    borderWidth: 1,
    borderColor: battleColors.curseLine,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    fontSize: 13,
    fontWeight: '700',
    overflow: 'hidden',
    zIndex: 2,
  },
});
// Stryker restore all
