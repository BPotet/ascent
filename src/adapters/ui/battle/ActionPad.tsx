import { type Ref, useCallback, useEffect, useRef } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { DefenseButton } from '../../../domain/battle/BattleEvent';
import type { PowerKind } from '../../../domain/battle/powers';
import { attackButtonLabel } from '../format/battleText';
import {
  powersKeyLabel,
  readyCountText,
  strikeKeyLabel,
  strikePowerLine,
} from '../format/powerText';
import { artPalette } from '../pixelArt/artPalette';
import { PixelFrame } from '../pixelArt/PixelFrame';
import { pixelFont, textFont } from '../pixelArt/pixelTypography';
import type { ActionPad as Pad, LockSpan } from '../state/battleView';
import { battleColors } from '../theme/battleColors';
import { LockGlyph } from './BattleGlyphs';
import { Hatching, KEY_LOOKS, PixelKey } from './PixelKey';
import { useDefenseGesture, useReleaseGesture } from './touchGestures';

export const ATTACK_GESTURE_TEST_ID = 'battle-attack';
/** Le geste de la touche « Pouvoirs », qui ouvre et ferme la liste des pouvoirs (#271). */
export const POWERS_GESTURE_TEST_ID = 'battle-powers';
/** Le geste de la ligne du pouvoir `power` dans la liste des pouvoirs (#235, #271) ; maintenu : `…-hold`. */
export function powerGestureTestId(power: PowerKind): string {
  return `battle-power-${power}`;
}
/** Le toucher maintenu qui ouvre l'effet d'un pouvoir, en ms (#235, K10). */
export const POWER_HOLD_MS = 400;
export const STRIKE_GESTURE_TEST_ID = 'battle-strike';
/** La place du trait sur la barre de « Frapper » : la barre l'atteint à l'impact (maquette F3). */
const STRIKE_MARK = 0.8;
export const DEFENSE_GESTURE_TEST_IDS: Readonly<Record<DefenseButton, string>> = {
  parry: 'battle-parry',
  dodge: 'battle-dodge',
};

const { roles } = artPalette;

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
    <PixelFrame
      variant="raised"
      under={battleColors.background}
      accessibilityRole="text"
      testID="battle-lock-tag"
      style={[styles.tag, styles.lockTag]}
    >
      <LockGlyph color={battleColors.text} />
      <Text style={styles.tagText}>Attends</Text>
      {lock === null ? null : <Animated.View style={[styles.lockBar, bar]} />}
    </PixelFrame>
  );
}

function DefenseKey({
  button,
  label,
  primary,
  disabled,
  offBalance,
  uiNow,
  now,
  onDefense,
}: {
  readonly button: DefenseButton;
  readonly label: string;
  readonly primary: boolean;
  readonly disabled: boolean;
  readonly offBalance: boolean;
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
  const look = offBalance ? KEY_LOOKS.grey : primary ? KEY_LOOKS.gold : KEY_LOOKS.surface;
  return (
    <PixelKey
      name={button}
      look={look}
      pressable={!disabled}
      gesture={gesture}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={() => onDefense(button, now())}
      testID={`battle-${button}-button`}
      style={[primary ? styles.primary : styles.secondary, disabled && styles.locked]}
    >
      <Text style={[styles.keyText, { color: look.text }]}>{label}</Text>
    </PixelKey>
  );
}

function AttackKey({
  ref,
  targetName,
  disabled,
  uiNow,
  onRelease,
  onAccessibilityPress,
}: {
  readonly ref: Ref<View>;
  readonly targetName: string;
  readonly disabled: boolean;
  readonly uiNow: () => number;
  readonly onRelease: (touchStartedAt: number, releasedAt: number) => void;
  readonly onAccessibilityPress: () => void;
}) {
  const gesture = useReleaseGesture(ATTACK_GESTURE_TEST_ID, uiNow, onRelease);
  return (
    <PixelKey
      ref={ref}
      name="attack"
      look={KEY_LOOKS.gold}
      pressable={!disabled}
      gesture={gesture}
      accessible
      accessibilityRole="button"
      accessibilityLabel={attackButtonLabel(targetName)}
      accessibilityState={{ disabled }}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={onAccessibilityPress}
      testID="battle-attack-button"
      style={[styles.primary, disabled && styles.locked]}
    >
      <Text style={[styles.keyText, { color: KEY_LOOKS.gold.text }]}>Attaquer</Text>
    </PixelKey>
  );
}

/**
 * La touche « Pouvoirs » (#271, maquette 269 : KB1, KB2), à gauche d'« Attaquer » : « Pouvoirs », le
 * chevron et le compte des pouvoirs prêts, sans icône de pouvoir. Elle ouvre la liste des pouvoirs
 * au relâcher ; ouverte, elle prend le trait d'or, enfoncée, le chevron retourné. Pendant le temps
 * mort, elle est estompée et inactive, comme « Attaquer ».
 */
function PowersKey({
  ref,
  ready,
  total,
  open,
  disabled,
  uiNow,
  onToggle,
}: {
  readonly ref: Ref<View>;
  readonly ready: number;
  readonly total: number;
  readonly open: boolean;
  readonly disabled: boolean;
  readonly uiNow: () => number;
  readonly onToggle: () => void;
}) {
  // Le geste reste le même pendant le temps mort : la liste ne s'ouvre pas tant que la phase du
  // héros est verrouillée (`usePowerList`).
  const gesture = useReleaseGesture(POWERS_GESTURE_TEST_ID, uiNow, onToggle);
  const look = open ? KEY_LOOKS.active : KEY_LOOKS.surface;
  return (
    <PixelKey
      ref={ref}
      name="powers"
      look={look}
      pressable={!disabled}
      gesture={gesture}
      accessible
      accessibilityRole="button"
      accessibilityLabel={powersKeyLabel(ready, total)}
      accessibilityState={{ expanded: open, disabled }}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={() => {
        if (!disabled) onToggle();
      }}
      testID="battle-powers-button"
      style={[styles.secondary, open && styles.open, disabled && styles.locked]}
    >
      <View style={styles.powersLabel}>
        <Text style={[styles.powersText, { color: look.text }]}>Pouvoirs</Text>
        <View style={[styles.chevron, open && styles.chevronOpen]} />
      </View>
      <Text style={[styles.keyNote, { color: KEY_LOOKS.surface.note }]}>
        {readyCountText(ready, total)}
      </Text>
    </PixelKey>
  );
}

/**
 * « Frapper », sur toute la largeur, pendant la frappe en rythme (C6, maquette F3) : la barre se
 * remplit pendant la préparation et atteint le trait à l'impact. L'appui est daté quand le doigt se
 * pose, comme Parade.
 */
function StrikeKey({
  pad,
  uiNow,
  now,
  onStrike,
}: {
  readonly pad: Extract<Pad, { kind: 'strike' }>;
  readonly uiNow: () => number;
  readonly now: () => number;
  readonly onStrike: (touchedAt: number) => void;
}) {
  const gesture = useDefenseGesture(STRIKE_GESTURE_TEST_ID, uiNow, onStrike);
  const fill = useSharedValue(0);
  const { since, impactAt } = pad;
  useEffect(() => {
    const full = since + (impactAt - since) / STRIKE_MARK;
    const elapsed = Math.min(full - since, Math.max(0, now() - since));
    fill.set(elapsed / (full - since));
    fill.set(withTiming(1, { duration: full - since - elapsed, easing: Easing.linear }));
  }, [since, impactAt, now, fill]);
  // Dépendances explicites : le code instrumenté par Stryker n'est plus reconnu comme worklet.
  const bar = useAnimatedStyle(() => {
    'worklet';
    return { transform: [{ scaleX: fill.get() }] };
  }, [fill]);
  const { power, hits = 1, hit = 1 } = pad;
  return (
    <PixelKey
      name="strike"
      look={KEY_LOOKS.strike}
      pressable={!pad.resolved}
      gesture={gesture}
      accessible
      accessibilityRole="button"
      accessibilityLabel={strikeKeyLabel(power, hits, hit)}
      accessibilityState={{ disabled: pad.resolved }}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={() => onStrike(now())}
      testID="battle-strike-button"
      style={styles.strike}
    >
      <Animated.View pointerEvents="none" style={[styles.strikeFill, bar]} />
      <View pointerEvents="none" testID="battle-strike-mark" style={styles.strikeMark} />
      <Text style={[styles.keyText, { color: KEY_LOOKS.strike.text }]}>Frapper</Text>
      {power === undefined ? null : (
        <>
          <Text style={[styles.strikePower, { color: KEY_LOOKS.strike.text }]}>
            {strikePowerLine(power, hits)}
          </Text>
          {hits > 1 ? (
            <View pointerEvents="none" style={styles.strikeHits}>
              {Array.from({ length: hits }, (_, index) => (
                <View
                  key={index}
                  testID={`battle-strike-hit-${index + 1}`}
                  style={[styles.strikeHit, index < hit && styles.strikeHitDone]}
                />
              ))}
            </View>
          ) : null}
        </>
      )}
    </PixelKey>
  );
}

/**
 * La zone d'action : une grille de deux cases, ancrée en bas. En phase du héros, « Pouvoirs » à
 * gauche, qui ouvre la liste des pouvoirs (#271), et « Attaquer » à droite, la plus large ; pendant la frappe en rythme, « Frapper » sur toute la largeur ;
 * en phase ennemie, Esquive à gauche et Parade à droite. Pendant le temps mort : inactifs, sans
 * hachures, avec « Attends ». En déséquilibre : grisés et hachurés, toujours actifs. Chaque touche
 * a l'habillage du bouton pixel, à 112 dp (#120).
 */
export function ActionPad({
  pad,
  targetName,
  uiNow,
  now,
  onDefense,
  onAttack,
  onStrike,
  powersOpen,
  onTogglePowers,
  focusPowers,
}: {
  readonly pad: Pad;
  readonly targetName: string;
  readonly uiNow: () => number;
  readonly now: () => number;
  readonly onDefense: (button: DefenseButton, touchedAt: number) => void;
  readonly onAttack: (touchStartedAt: number, releasedAt: number) => void;
  readonly onStrike: (touchedAt: number) => void;
  /** La liste des pouvoirs est ouverte (#271) : « Pouvoirs » est lu « déplié ». */
  readonly powersOpen: boolean;
  readonly onTogglePowers: () => void;
  /** La liste vient d'être fermée sans lancer : le lecteur d'écran revient sur « Pouvoirs ». */
  readonly focusPowers: boolean;
}) {
  // Juste après un pouvoir instantané, le lecteur d'écran passe à « Attaquer » (#173, E2).
  const attackRef = useRef<View>(null);
  const powersRef = useRef<View>(null);
  const instantCast = pad.kind === 'hero' && pad.instantCast === true;
  useEffect(() => {
    const attackKey = attackRef.current;
    if (instantCast && attackKey !== null) {
      AccessibilityInfo.sendAccessibilityEvent(attackKey, 'focus');
    }
  }, [instantCast]);
  useEffect(() => {
    const powersKey = powersRef.current;
    if (focusPowers && powersKey !== null) {
      AccessibilityInfo.sendAccessibilityEvent(powersKey, 'focus');
    }
  }, [focusPowers]);
  if (pad.kind === 'none') return null;
  if (pad.kind === 'strike') {
    return (
      <View testID="battle-pad" style={styles.pad}>
        <StrikeKey pad={pad} uiNow={uiNow} now={now} onStrike={onStrike} />
      </View>
    );
  }
  const offBalance = pad.kind === 'defense' && pad.offBalance;
  return (
    <View testID="battle-pad" style={[styles.pad, offBalance && styles.offBalance]}>
      {pad.locked ? <LockTag lock={pad.lock} now={now} /> : null}
      {offBalance ? (
        <PixelFrame
          tone="error"
          under={battleColors.background}
          background={roles.errorBg}
          testID="battle-off-balance-tag"
          style={[styles.tag, styles.offTag, styles.offLine]}
        >
          <Text accessibilityLiveRegion="polite" testID="battle-off-balance" style={styles.offText}>
            Déséquilibré
          </Text>
        </PixelFrame>
      ) : null}
      {pad.kind === 'hero' ? (
        <>
          <PowersKey
            ref={powersRef}
            ready={pad.powers.filter(({ availability }) => availability === 'available').length}
            total={pad.powers.length}
            open={powersOpen}
            disabled={pad.locked}
            uiNow={uiNow}
            onToggle={onTogglePowers}
          />
          <AttackKey
            ref={attackRef}
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
            offBalance={offBalance}
            uiNow={uiNow}
            now={now}
            onDefense={onDefense}
          />
          <DefenseKey
            button="parry"
            label="Parade"
            primary
            disabled={pad.locked}
            offBalance={offBalance}
            uiNow={uiNow}
            now={now}
            onDefense={onDefense}
          />
        </>
      )}
      {offBalance ? <Hatching testID="battle-pad-hatching" color={battleColors.hatch} /> : null}
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  pad: { flexDirection: 'row', gap: 12 },
  offBalance: { opacity: 0.7 },
  primary: { flex: 1.45 },
  secondary: { flex: 1 },
  locked: { opacity: 0.4 },
  // « Pouvoirs » ouverte : enfoncée, sur l'arête (maquette, `.pwk2.open`).
  open: { backgroundColor: roles.raised, top: 2 },
  keyText: { fontFamily: pixelFont, fontSize: 24, lineHeight: 28, textAlign: 'center' },
  powersLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  powersText: { fontFamily: pixelFont, fontSize: 21, lineHeight: 25 },
  chevron: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: roles.parchment,
  },
  chevronOpen: { transform: [{ rotate: '180deg' }], borderBottomColor: roles.gold },
  keyNote: { fontFamily: textFont.semiBold, fontSize: 12, lineHeight: 15, textAlign: 'center' },
  strike: { flex: 1 },
  strikeFill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: battleColors.lightGlow,
    transformOrigin: 'left',
  },
  strikePower: { fontFamily: textFont.bold, fontSize: 12, lineHeight: 15, textAlign: 'center' },
  strikeHits: { flexDirection: 'row', gap: 6, marginTop: 4 },
  strikeHit: { width: 8, height: 8, borderWidth: 2, borderColor: roles.gold },
  strikeHitDone: { backgroundColor: roles.gold },
  strikeMark: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: `${100 * STRIKE_MARK}%`,
    width: 4,
    marginLeft: -2,
    backgroundColor: roles.gold,
  },
  tag: {
    position: 'absolute',
    top: -34,
    alignSelf: 'center',
    left: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    overflow: 'hidden',
    zIndex: 2,
  },
  lockTag: { transform: [{ translateX: -52 }] },
  // Le trait sombre de la pastille de la maquette (C6), plus doux que le rouge d'erreur.
  offLine: { borderColor: '#7A3446' },
  offTag: { transform: [{ translateX: -60 }] },
  tagText: { color: battleColors.text, fontFamily: textFont.bold, fontSize: 13, lineHeight: 17 },
  offText: { color: roles.pink, fontFamily: textFont.bold, fontSize: 13, lineHeight: 17 },
  lockBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: roles.gold,
    transformOrigin: 'left',
  },
});
// Stryker restore all
