import { type Ref, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { DefenseButton } from '../../../domain/battle/BattleEvent';
import type { PowerKind } from '../../../domain/battle/powers';
import { KindledFlame } from '../components/KindledFlame';
import { PowerIcon } from '../components/PowerIcon';
import { INSTANT_WORD, attackButtonLabel } from '../format/battleText';
import {
  POWER_BUTTON_NAMES,
  POWER_TIPS,
  powerKeyLabel,
  powerKeyReason,
  strikeKeyLabel,
  strikePowerLine,
} from '../format/powerText';
import { artPalette } from '../pixelArt/artPalette';
import { PixelFrame } from '../pixelArt/PixelFrame';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { pixelFont, textFont } from '../pixelArt/pixelTypography';
import type { ActionPad as Pad, LockSpan, PowerSlot } from '../state/battleView';
import { battleColors } from '../theme/battleColors';
import { LockGlyph } from './BattleGlyphs';
import { CrescentGlyph } from './ShadowStepChip';
import { Hatching, KEY_LOOKS, PixelKey, UNAVAILABLE_HATCH } from './PixelKey';
import { PowerTip } from './PowerTip';
import { useDefenseGesture, useReleaseGesture } from './touchGestures';

export const ATTACK_GESTURE_TEST_ID = 'battle-attack';
/** Le geste de la touche du pouvoir `power` (#235) ; maintenu : `…-hold`. */
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
  flex,
  disabled,
  uiNow,
  onRelease,
  onAccessibilityPress,
}: {
  readonly ref: Ref<View>;
  readonly targetName: string;
  /** La part de la rangée : « Attaquer » reste la plus large, à droite (#235). */
  readonly flex: number;
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
      style={[styles.primary, { flex }, disabled && styles.locked]}
    >
      <Text style={[styles.keyText, { color: KEY_LOOKS.gold.text }]}>Attaquer</Text>
    </PixelKey>
  );
}

/**
 * Une touche de pouvoir (#235, maquette K1 à K12) : l'icône du pouvoir, son nom, puis son coût et
 * « Instantané », ou la raison qui le rend indisponible (hachurée), ou « Actif » (trait d'or).
 * Pendant le temps mort, elle est seulement estompée. Maintenue, elle montre son effet sans rien
 * lancer.
 */
function PowerKey({
  slot,
  locked,
  uiNow,
  now,
  onPower,
  onTip,
}: {
  readonly slot: PowerSlot;
  readonly locked: boolean;
  readonly uiNow: () => number;
  readonly now: () => number;
  readonly onPower: (power: PowerKind, touchStartedAt: number, releasedAt: number) => void;
  readonly onTip: (power: PowerKind | null) => void;
}) {
  const { power, availability, instant = false, kindled = false } = slot;
  const available = availability === 'available';
  const active = availability === 'active';
  const disabled = locked || !available;
  const onRelease = useCallback(
    (touchStartedAt: number, releasedAt: number) => onPower(power, touchStartedAt, releasedAt),
    [onPower, power],
  );
  const hold = useMemo(
    () => ({ ms: POWER_HOLD_MS, onHold: () => onTip(power), onHoldEnd: () => onTip(null) }),
    [onTip, power],
  );
  const gesture = useReleaseGesture(powerGestureTestId(power), uiNow, onRelease, hold);
  const hatched = !locked && !available && !active;
  const look = hatched
    ? KEY_LOOKS.unavailable
    : active
      ? KEY_LOOKS.active
      : kindled
        ? KEY_LOOKS.kindled
        : KEY_LOOKS.surface;
  const reason = powerKeyReason(slot);
  return (
    <PixelKey
      name={`power-${power}`}
      look={look}
      pressable={!disabled}
      gesture={gesture}
      accessible
      accessibilityRole="button"
      accessibilityLabel={powerKeyLabel(slot)}
      accessibilityHint={POWER_TIPS[power]}
      accessibilityState={{ disabled }}
      accessibilityActions={[{ name: 'activate' }, { name: 'longpress', label: "Voir l'effet" }]}
      onAccessibilityAction={({ nativeEvent }) => {
        if (nativeEvent.actionName === 'longpress') onTip(power);
        else if (!disabled) onPower(power, now(), now());
      }}
      testID={`battle-power-button-${power}`}
      style={[styles.secondary, locked && styles.locked]}
    >
      {hatched ? (
        <Hatching testID={`battle-power-hatching-${power}`} color={UNAVAILABLE_HATCH} />
      ) : null}
      <PowerIcon power={power} scale={2} testID={`battle-power-icon-${power}`} />
      <Text numberOfLines={2} style={[styles.powerName, { color: look.text }]}>
        {POWER_BUTTON_NAMES[power]}
      </Text>
      {available ? (
        <>
          {kindled ? (
            <View style={styles.instantRow}>
              <KindledFlame testID={`battle-power-kindled-${power}`} />
              <Text
                style={[styles.keyNote, { color: look.note }]}
              >{`${slot.baseCost} → ${slot.cost} Élan`}</Text>
            </View>
          ) : (
            <Text style={[styles.keyNote, { color: look.note }]}>{`${slot.cost} Élan`}</Text>
          )}
          {instant ? (
            <View testID={`battle-power-instant-${power}`} style={styles.instantRow}>
              <CrescentGlyph
                background={look.background}
                testID={`battle-power-crescent-${power}`}
              />
              <Text style={[styles.keyNote, styles.instant]}>{INSTANT_WORD}</Text>
            </View>
          ) : null}
        </>
      ) : (
        <View style={styles.noteRow}>
          {active ? (
            <PixelIcon
              name="check8"
              color={look.note}
              testID={`battle-power-active-check-${power}`}
            />
          ) : null}
          <Text style={[styles.keyNote, { color: look.note }]}>{reason.join('\n')}</Text>
        </View>
      )}
    </PixelKey>
  );
}

/** La part de la rangée que prend « Attaquer », selon le nombre de pouvoirs (maquette, section 3). */
const ATTACK_FLEX: Readonly<Record<number, number>> = { 1: 1.45, 2: 1.25, 3: 1.15 };

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
  onPowerTip,
}: {
  readonly pad: Pad;
  readonly targetName: string;
  readonly uiNow: () => number;
  readonly now: () => number;
  readonly onDefense: (button: DefenseButton, touchedAt: number) => void;
  readonly onAttack: (touchStartedAt: number, releasedAt: number) => void;
  readonly onPower: (power: PowerKind, touchStartedAt: number, releasedAt: number) => void;
  readonly onStrike: (touchedAt: number) => void;
  /** Le toucher maintenu ouvre l'effet d'un pouvoir (une vibration très courte, #235). */
  readonly onPowerTip?: (power: PowerKind) => void;
}) {
  // Juste après un pouvoir instantané, le lecteur d'écran passe à « Attaquer » (#173, E2).
  const attackRef = useRef<View>(null);
  const instantCast = pad.kind === 'hero' && pad.instantCast === true;
  const [tip, setTip] = useState<PowerKind | null>(null);
  const onTip = useCallback(
    (power: PowerKind | null) => {
      setTip(power);
      if (power !== null) onPowerTip?.(power);
    },
    [onPowerTip],
  );
  // La bulle se ferme à toute action et à tout changement de phase : elle ne revient jamais seule.
  // (état ajusté au rendu, sans effet : https://react.dev/learn/you-might-not-need-an-effect).
  const heroPhase = pad.kind === 'hero' && !pad.locked;
  const [tipPhase, setTipPhase] = useState(heroPhase);
  if (tipPhase !== heroPhase) {
    setTipPhase(heroPhase);
    if (!heroPhase) setTip(null);
  }
  const castPower = useCallback(
    (power: PowerKind, touchStartedAt: number, releasedAt: number) => {
      setTip(null);
      onPower(power, touchStartedAt, releasedAt);
    },
    [onPower],
  );
  const attack = useCallback(
    (touchStartedAt: number, releasedAt: number) => {
      setTip(null);
      onAttack(touchStartedAt, releasedAt);
    },
    [onAttack],
  );
  useEffect(() => {
    const attackKey = attackRef.current;
    if (instantCast && attackKey !== null) {
      AccessibilityInfo.sendAccessibilityEvent(attackKey, 'focus');
    }
  }, [instantCast]);
  if (pad.kind === 'none') return null;
  if (pad.kind === 'strike') {
    return (
      <View testID="battle-pad" style={styles.pad}>
        <StrikeKey pad={pad} uiNow={uiNow} now={now} onStrike={onStrike} />
      </View>
    );
  }
  const offBalance = pad.kind === 'defense' && pad.offBalance;
  const powers = pad.kind === 'hero' ? pad.powers : [];
  // La bulle ne vit que dans la phase du héros, hors du temps mort.
  const tipSlot =
    pad.kind === 'hero' && !pad.locked ? powers.find(({ power }) => power === tip) : undefined;
  return (
    <View
      testID="battle-pad"
      style={[styles.pad, powers.length > 2 && styles.tightPad, offBalance && styles.offBalance]}
    >
      {tipSlot === undefined ? null : (
        <PowerTip power={tipSlot.power} cost={tipSlot.cost} kindled={tipSlot.kindled === true} />
      )}
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
          {pad.powers.map((slot) => (
            <PowerKey
              key={slot.power}
              slot={slot}
              locked={pad.locked}
              uiNow={uiNow}
              now={now}
              onPower={castPower}
              onTip={onTip}
            />
          ))}
          <AttackKey
            ref={attackRef}
            targetName={targetName}
            flex={ATTACK_FLEX[pad.powers.length] ?? 1.15}
            disabled={pad.locked}
            uiNow={uiNow}
            onRelease={attack}
            onAccessibilityPress={() => attack(now(), now())}
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
  // Trois pouvoirs à 360 dp : la plus étroite fait 72 dp (#235, K3).
  tightPad: { gap: 8 },
  offBalance: { opacity: 0.7 },
  primary: { flex: 1.45 },
  secondary: { flex: 1 },
  locked: { opacity: 0.4 },
  keyText: { fontFamily: pixelFont, fontSize: 24, lineHeight: 28, textAlign: 'center' },
  powerName: { fontFamily: textFont.bold, fontSize: 11.5, lineHeight: 14, textAlign: 'center' },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  instantRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  keyNote: { fontFamily: textFont.semiBold, fontSize: 12, lineHeight: 15, textAlign: 'center' },
  instant: { fontFamily: textFont.bold, color: battleColors.onShadowStep },
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
