import { type ReactNode, useCallback, useEffect, useMemo } from 'react';
import {
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { DefenseButton } from '../../../domain/battle/BattleEvent';
import {
  attackButtonLabel,
  missingMomentumText,
  powerButtonLabel,
  powerCostText,
} from '../format/battleText';
import { artPalette } from '../pixelArt/artPalette';
import { artPixelSize, notchedCorners } from '../pixelArt/artPixel';
import { PixelFrame } from '../pixelArt/PixelFrame';
import { pixelFont, textFont } from '../pixelArt/pixelTypography';
import type { ActionPad as Pad, LockSpan, PowerSlot } from '../state/battleView';
import { battleColors } from '../theme/battleColors';
import { LockGlyph } from './BattleGlyphs';
import { useDefenseGesture, useReleaseGesture } from './touchGestures';

export const ATTACK_GESTURE_TEST_ID = 'battle-attack';
export const POWER_GESTURE_TEST_ID = 'battle-power';
export const STRIKE_GESTURE_TEST_ID = 'battle-strike';
/** La place du trait sur la barre de « Frapper » : la barre l'atteint à l'impact (maquette F3). */
const STRIKE_MARK = 0.8;
export const DEFENSE_GESTURE_TEST_IDS: Readonly<Record<DefenseButton, string>> = {
  parry: 'battle-parry',
  dodge: 'battle-dodge',
};

const { roles } = artPalette;
/** Le trait des touches : un pixel d'art. */
const LINE = artPixelSize(2);
/** Un doigt maintenu reste appuyé (même durée que le geste de datation, `touchGestures`). */
const LOOK_MAX_MS = 60_000;

// Stryker disable all: valeurs purement visuelles, vérifiées par la conformité aux maquettes (barrière 10 bis).
/**
 * Les habillages d'une touche de combat (maquette #118, C1 à C7) : or (Attaquer, Parade), surface
 * (Pouvoir, Esquive), grisé (déséquilibre), indisponible (hachuré), actif (trait d'or) et Frapper.
 */
const KEY_LOOKS = {
  gold: {
    background: roles.gold,
    line: roles.ink,
    light: roles.light,
    shade: roles.goldDark,
    text: battleColors.onLight,
    note: battleColors.onLight,
  },
  surface: {
    background: roles.surface,
    line: roles.line,
    light: roles.raised,
    shade: roles.ink,
    text: battleColors.text,
    note: roles.parchment,
  },
  grey: {
    background: roles.surface,
    line: roles.line,
    light: roles.raised,
    shade: roles.ink,
    text: roles.muted,
    note: roles.muted,
  },
  unavailable: {
    background: roles.surface,
    line: roles.raised,
    light: roles.surface,
    shade: roles.surface,
    text: roles.muted,
    note: roles.muted,
  },
  active: {
    background: roles.surface,
    line: roles.gold,
    light: roles.raised,
    shade: roles.ink,
    text: battleColors.text,
    note: roles.gold,
  },
  strike: {
    background: roles.goldBg,
    line: roles.goldDark,
    light: roles.goldBg,
    shade: roles.ink,
    text: roles.gold,
    note: roles.gold,
  },
} as const;
// Stryker restore all

type KeyLook = (typeof KEY_LOOKS)[keyof typeof KEY_LOOKS];

/** Des rayures décoratives : l'état est aussi écrit (« Déséquilibré », « Il manque 1 Élan »). */
function Hatching({ testID, color }: { readonly testID: string; readonly color: string }) {
  return (
    <View pointerEvents="none" testID={testID} style={styles.hatching}>
      {Array.from({ length: 24 }, (_, stripe) => (
        <View
          key={stripe}
          style={[styles.stripe, { left: -120 + stripe * 18, backgroundColor: color }]}
        />
      ))}
    </View>
  );
}

/**
 * L'habillage du bouton pixel d'une touche de combat (`PixelButton`, à 112 dp) : cadre cranté, arête
 * haute éclairée, bas dans l'ombre. Le geste de la touche (`gesture`) est inchangé ; un geste de
 * look lui est composé en simultané : il n'écrit que `pressed`, sur le fil UI, pour que la touche
 * descende de 2 dp et que son arête s'inverse dès que le doigt se pose. Le décalage est fixe, sans
 * animation : le mouvement réduit est respecté.
 */
function PixelKey({
  name,
  look,
  pressable,
  gesture,
  style,
  children,
  ...props
}: Omit<ViewProps, 'style'> & {
  readonly name: string;
  readonly look: KeyLook;
  /** Faux pour une touche inactive : elle ne s'enfonce pas. */
  readonly pressable: boolean;
  readonly gesture: GestureType;
  readonly style: StyleProp<ViewStyle>;
  readonly children: ReactNode;
}) {
  const pressed = useSharedValue(0);
  const both = useMemo(
    () =>
      Gesture.Simultaneous(
        gesture,
        Gesture.Tap()
          .withTestId(`battle-${name}-look`)
          .maxDuration(LOOK_MAX_MS)
          .shouldCancelWhenOutside(false)
          .onBegin(() => {
            'worklet';
            pressed.set(1);
          })
          .onFinalize(() => {
            'worklet';
            pressed.set(0);
          }),
      ),
    [gesture, name, pressed],
  );
  const { light, shade } = look;
  // Le geste de look reste le même quand la touche devient inactive : seul son effet s'éteint.
  // Dépendances explicites : le code instrumenté par Stryker n'est plus reconnu comme worklet.
  const down = useAnimatedStyle(() => {
    'worklet';
    return { transform: [{ translateY: pressable ? pressed.get() * LINE : 0 }] };
  }, [pressed, pressable]);
  const edge = useAnimatedStyle(() => {
    'worklet';
    return { backgroundColor: pressable && pressed.get() === 1 ? shade : light };
  }, [pressed, pressable, light, shade]);
  return (
    <GestureDetector gesture={both}>
      <Animated.View
        {...props}
        style={[
          styles.key,
          { borderWidth: LINE, backgroundColor: look.background, borderColor: look.line },
          style,
          down,
        ]}
      >
        <Animated.View
          pointerEvents="none"
          testID={`battle-${name}-edge`}
          style={[styles.strip, { top: 0, height: LINE }, edge]}
        />
        <View
          pointerEvents="none"
          style={[styles.strip, { bottom: 0, height: 3 * LINE, backgroundColor: shade }]}
        />
        {children}
        {notchedCorners(LINE).map((corner, index) => (
          <View
            key={index}
            pointerEvents="none"
            testID="pixel-key-corner"
            style={[styles.corner, corner]}
          />
        ))}
      </Animated.View>
    </GestureDetector>
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
    <PixelKey
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
 * « Pouvoir » (C3) : le pouvoir de base et son coût. Sans assez d'Élan, il reste visible mais
 * indisponible, hachuré, et dit l'Élan qui manque ; pendant le temps mort, il est seulement estompé.
 */
function PowerKey({
  slot,
  locked,
  uiNow,
  now,
  onPower,
}: {
  readonly slot: PowerSlot;
  readonly locked: boolean;
  readonly uiNow: () => number;
  readonly now: () => number;
  readonly onPower: (touchStartedAt: number, releasedAt: number) => void;
}) {
  const active = slot.active === true;
  const disabled = locked || slot.missing > 0 || active;
  const gesture = useReleaseGesture(POWER_GESTURE_TEST_ID, uiNow, onPower);
  const hatched = !locked && slot.missing > 0;
  const look = hatched ? KEY_LOOKS.unavailable : active ? KEY_LOOKS.active : KEY_LOOKS.surface;
  return (
    <PixelKey
      name="power"
      look={look}
      pressable={!disabled}
      gesture={gesture}
      accessible
      accessibilityRole="button"
      accessibilityLabel={powerButtonLabel(slot.power, slot.missing, active)}
      accessibilityState={{ disabled }}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={() => {
        if (!disabled) onPower(now(), now());
      }}
      testID="battle-power-button"
      style={[styles.secondary, locked && styles.locked]}
    >
      {hatched ? <Hatching testID="battle-power-hatching" color={UNAVAILABLE_HATCH} /> : null}
      <Text style={[styles.keyText, { color: look.text }]}>Pouvoir</Text>
      <Text style={[styles.keyNote, { color: look.note }]}>
        {active
          ? 'Actif'
          : slot.missing > 0
            ? missingMomentumText(slot.missing)
            : powerCostText(slot.power)}
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
  return (
    <PixelKey
      name="strike"
      look={KEY_LOOKS.strike}
      pressable={!pad.resolved}
      gesture={gesture}
      accessible
      accessibilityRole="button"
      accessibilityLabel="Frapper"
      accessibilityState={{ disabled: pad.resolved }}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={() => onStrike(now())}
      testID="battle-strike-button"
      style={styles.strike}
    >
      <Animated.View pointerEvents="none" style={[styles.strikeFill, bar]} />
      <View pointerEvents="none" testID="battle-strike-mark" style={styles.strikeMark} />
      <Text style={[styles.keyText, { color: KEY_LOOKS.strike.text }]}>Frapper</Text>
    </PixelKey>
  );
}

/**
 * La zone d'action : une grille de deux cases, ancrée en bas. En phase du héros, « Pouvoir » à
 * gauche et « Attaquer » à droite ; pendant la frappe en rythme, « Frapper » sur toute la largeur ;
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
  onPower,
  onStrike,
}: {
  readonly pad: Pad;
  readonly targetName: string;
  readonly uiNow: () => number;
  readonly now: () => number;
  readonly onDefense: (button: DefenseButton, touchedAt: number) => void;
  readonly onAttack: (touchStartedAt: number, releasedAt: number) => void;
  readonly onPower: (touchStartedAt: number, releasedAt: number) => void;
  readonly onStrike: (touchedAt: number) => void;
}) {
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
          style={[styles.tag, styles.offTag]}
        >
          <Text accessibilityLiveRegion="polite" testID="battle-off-balance" style={styles.offText}>
            Déséquilibré
          </Text>
        </PixelFrame>
      ) : null}
      {pad.kind === 'hero' ? (
        <>
          <PowerKey
            slot={pad.power}
            locked={pad.locked}
            uiNow={uiNow}
            now={now}
            onPower={onPower}
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
/** Les hachures d'une touche indisponible : celles du bouton pixel inactif. */
const UNAVAILABLE_HATCH = 'rgba(62,72,112,0.35)';

const styles = StyleSheet.create({
  pad: { flexDirection: 'row', gap: 12 },
  offBalance: { opacity: 0.7 },
  key: {
    minHeight: 112,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
    overflow: 'hidden',
  },
  strip: { position: 'absolute', left: 0, right: 0 },
  // Les coins coupés, de la couleur du fond derrière le pavé.
  corner: { position: 'absolute', backgroundColor: battleColors.background },
  primary: { flex: 1.45 },
  secondary: { flex: 1 },
  locked: { opacity: 0.4 },
  keyText: { fontFamily: pixelFont, fontSize: 24, lineHeight: 28, textAlign: 'center' },
  keyNote: { fontFamily: textFont.semiBold, fontSize: 12, lineHeight: 15, textAlign: 'center' },
  strike: { flex: 1 },
  strikeFill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: battleColors.lightGlow,
    transformOrigin: 'left',
  },
  strikeMark: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: `${100 * STRIKE_MARK}%`,
    width: 4,
    marginLeft: -2,
    backgroundColor: roles.gold,
  },
  hatching: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  stripe: {
    position: 'absolute',
    top: -60,
    width: 8,
    height: 260,
    transform: [{ rotate: '45deg' }],
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
