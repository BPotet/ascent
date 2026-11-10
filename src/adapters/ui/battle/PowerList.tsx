import { type Ref, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Keyframe } from 'react-native-reanimated';

import type { PowerKind } from '../../../domain/battle/powers';
import { KindledFlame } from '../components/KindledFlame';
import { PowerIcon } from '../components/PowerIcon';
import { INSTANT_WORD } from '../format/battleText';
import {
  POWER_TIPS,
  TREE_POWER_NAMES,
  powerKeyLabel,
  powerStateText,
  powerType,
  readyCountText,
  staysActive,
} from '../format/powerText';
import { artPalette } from '../pixelArt/artPalette';
import { PixelFrame } from '../pixelArt/PixelFrame';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { pixelFont, textFont } from '../pixelArt/pixelTypography';
import type { PowerSlot } from '../state/battleView';
import { battleColors } from '../theme/battleColors';
import { POWER_HOLD_MS, powerGestureTestId } from './ActionPad';
import { Hatching, KEY_HEIGHT, KEY_LOOKS, PixelKey, UNAVAILABLE_HATCH } from './PixelKey';
import { PowerTip } from './PowerTip';
import { CrescentGlyph } from './ShadowStepChip';
import { useReleaseGesture } from './touchGestures';

const { roles } = artPalette;

/** La marge basse de la zone d'action de l'écran de combat, sous ses touches. */
export const ACTION_ZONE_BOTTOM = 34;
/** La marge des côtés de la zone d'action : la liste prend sa largeur (328 dp à 360 dp). */
export const ACTION_ZONE_SIDE = 16;
/** La ligne la plus basse de la liste, au-dessus de « Pouvoirs » (maquette KB2). */
const LIST_GAP = 10;
/** La liste monte en 160 ms (KB2), en fondu seul avec le mouvement réduit. */
export const POWER_LIST_MS = 160;
/** La hauteur dont la liste monte (maquette, `lup`). */
const RISE = 10;

/** Le décalage de départ de la liste : elle monte, sauf avec le mouvement réduit (même durée). */
export function powerListRise(reducedMotion: boolean): number {
  return reducedMotion ? 0 : RISE;
}

/** L'entrée de la liste : en deux pas, comme la maquette (`steps(2)`), le fondu avec la montée. */
function powerListEntering(reducedMotion: boolean) {
  const rise = powerListRise(reducedMotion);
  const at = (opacity: number) => ({ opacity, transform: [{ translateY: (1 - opacity) * rise }] });
  return new Keyframe({
    0: at(0),
    49: at(0),
    50: at(0.5),
    99: at(0.5),
    100: at(1),
  }).duration(POWER_LIST_MS);
}

/** Les losanges d'Élan d'une ligne : `cost` losanges, les pleins d'abord, couleur braise si attisé. */
function Pips({ slot }: { readonly slot: PowerSlot }) {
  const full = slot.cost - slot.missing;
  const color = slot.kindled === true ? roles.ember : roles.gold;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={`battle-power-pips-${slot.power}`}
      style={styles.pips}
    >
      {Array.from({ length: slot.cost }, (_, index) => (
        <View
          key={index}
          testID={index < full ? 'battle-power-pip-full' : 'battle-power-pip-empty'}
          style={[
            styles.pip,
            index < full
              ? { backgroundColor: color, borderColor: color }
              : { borderColor: battleColors.secondaryLine },
          ]}
        />
      ))}
    </View>
  );
}

/** Le croissant d'un pouvoir instantané, devant le mot ou l'état. */
function Crescent({ power, look }: { readonly power: PowerKind; readonly look: KeyLookName }) {
  return (
    <CrescentGlyph
      background={KEY_LOOKS[look].background}
      testID={`battle-power-crescent-${power}`}
    />
  );
}

type KeyLookName = keyof typeof KEY_LOOKS;

/** Le coût et le type d'une ligne prête : « 2 Élan · Frappe », « Attisé · 2 → 1 Élan · » + croissant. */
function ReadyLine({ slot, look }: { readonly slot: PowerSlot; readonly look: KeyLookName }) {
  const { power, cost, kindled = false, instant = false } = slot;
  const price = kindled ? `Attisé · ${slot.baseCost} → ${cost} Élan` : `${cost} Élan`;
  return (
    <View style={styles.sub}>
      {kindled ? <KindledFlame testID={`battle-power-kindled-${power}`} /> : null}
      {instant ? (
        <>
          <Text style={[styles.subText, kindled && styles.kindledText]}>{`${price} ·`}</Text>
          <View testID={`battle-power-instant-${power}`} style={styles.sub}>
            <Crescent power={power} look={look} />
            <Text style={[styles.subText, styles.instant]}>{INSTANT_WORD}</Text>
          </View>
        </>
      ) : (
        <Text style={[styles.subText, kindled && styles.kindledText]}>
          {`${price} · ${powerType(power)}`}
        </Text>
      )}
    </View>
  );
}

/** L'état d'une ligne indisponible, en mot, à la place du type (KB3, KB7, KB10). */
function StateLine({ slot, look }: { readonly slot: PowerSlot; readonly look: KeyLookName }) {
  const { power, availability, instant = false } = slot;
  const state = powerStateText(slot);
  return (
    <View style={styles.sub}>
      {instant && availability !== 'usedThisBattle' ? <Crescent power={power} look={look} /> : null}
      {availability === 'missing' ? (
        <Text style={styles.subText}>{`${slot.cost} Élan ·`}</Text>
      ) : null}
      <Text style={[styles.subText, availability === 'active' && styles.activeText]}>{state}</Text>
      {availability === 'active' && staysActive(power) ? (
        <Text style={styles.subText}>{"· jusqu'à son emploi"}</Text>
      ) : null}
    </View>
  );
}

/**
 * Une ligne de la liste des pouvoirs (#271, KB2 à KB10), en bouton pixel de 64 dp : à gauche
 * l'icône, le nom entier, le coût et le type, ou l'état ; à droite les losanges d'Élan et « Prêt »,
 * ou la coche d'or d'un pouvoir actif. Hachurée quand le pouvoir est indisponible. Relâchée, elle
 * passe toujours le toucher au combat, qui seul décide de lancer ; maintenue, elle montre l'effet.
 */
function PowerRow({
  ref,
  slot,
  uiNow,
  now,
  onCast,
  onTip,
}: {
  readonly ref?: Ref<View>;
  readonly slot: PowerSlot;
  readonly uiNow: () => number;
  readonly now: () => number;
  readonly onCast: (power: PowerKind, touchStartedAt: number, releasedAt: number) => void;
  readonly onTip: (power: PowerKind | null) => void;
}) {
  const { power, availability, kindled = false } = slot;
  const available = availability === 'available';
  const active = availability === 'active';
  const onRelease = useCallback(
    (touchStartedAt: number, releasedAt: number) => onCast(power, touchStartedAt, releasedAt),
    [onCast, power],
  );
  const hold = useMemo(
    () => ({ ms: POWER_HOLD_MS, onHold: () => onTip(power), onHoldEnd: () => onTip(null) }),
    [onTip, power],
  );
  const gesture = useReleaseGesture(powerGestureTestId(power), uiNow, onRelease, hold);
  const hatched = !available && !active;
  const look: KeyLookName = hatched
    ? 'unavailable'
    : active
      ? 'active'
      : kindled
        ? 'kindled'
        : 'surface';
  return (
    <PixelKey
      {...(ref !== undefined && { ref })}
      name={`power-${power}`}
      look={KEY_LOOKS[look]}
      pressable={available}
      gesture={gesture}
      under={roles.night}
      accessible
      accessibilityRole="menuitem"
      accessibilityLabel={powerKeyLabel(slot)}
      accessibilityHint={POWER_TIPS[power]}
      accessibilityState={{ disabled: !available }}
      accessibilityActions={[{ name: 'activate' }, { name: 'longpress', label: "Voir l'effet" }]}
      onAccessibilityAction={({ nativeEvent }) => {
        if (nativeEvent.actionName === 'longpress') onTip(power);
        else if (available) onCast(power, now(), now());
      }}
      testID={`battle-power-button-${power}`}
      style={styles.row}
    >
      {hatched ? (
        <Hatching testID={`battle-power-hatching-${power}`} color={UNAVAILABLE_HATCH} />
      ) : null}
      <View style={[styles.well, kindled && available && styles.kindledWell]}>
        <View style={hatched && styles.faded}>
          <PowerIcon power={power} scale={2} testID={`battle-power-icon-${power}`} />
        </View>
      </View>
      <View style={styles.text}>
        <Text numberOfLines={1} style={[styles.name, hatched && styles.hatchedName]}>
          {TREE_POWER_NAMES[power]}
        </Text>
        {available ? <ReadyLine slot={slot} look={look} /> : <StateLine slot={slot} look={look} />}
      </View>
      <View style={styles.right}>
        {available || availability === 'missing' ? <Pips slot={slot} /> : null}
        {available ? <Text style={styles.ready}>{powerStateText(slot)}</Text> : null}
        {active ? (
          <View style={styles.check}>
            <PixelIcon
              name="check8"
              color={roles.ink}
              testID={`battle-power-active-check-${power}`}
            />
          </View>
        ) : null}
      </View>
    </PixelKey>
  );
}

/**
 * La liste des pouvoirs (#271, maquette 269 : KB2 à KB11), posée sur tout l'écran de combat, en
 * phase du héros : un voile transparent qui la ferme au toucher (il couvre aussi « Pouvoirs » et
 * « Attaquer »), et la liste au-dessus de « Pouvoirs », une ligne par pouvoir équipé dans l'ordre de
 * l'arbre. Le geste retour et l'échappement du lecteur d'écran la ferment aussi, sans rien lancer.
 * La bulle de l'effet du toucher maintenu s'ouvre au-dessus d'elle.
 */
export function PowerList({
  slots,
  uiNow,
  now,
  reducedMotion,
  onCast,
  onDismiss,
  onTip,
}: {
  readonly slots: readonly PowerSlot[];
  readonly uiNow: () => number;
  readonly now: () => number;
  readonly reducedMotion: boolean;
  readonly onCast: (power: PowerKind, touchStartedAt: number, releasedAt: number) => void;
  readonly onDismiss: () => void;
  /** Le toucher maintenu ouvre l'effet d'un pouvoir (une vibration très courte, #235). */
  readonly onTip?: (power: PowerKind) => void;
}) {
  const [tip, setTip] = useState<PowerKind | null>(null);
  const showTip = useCallback(
    (power: PowerKind | null) => {
      setTip(power);
      if (power !== null) onTip?.(power);
    },
    [onTip],
  );
  const cast = useCallback(
    (power: PowerKind, touchStartedAt: number, releasedAt: number) => {
      setTip(null);
      onCast(power, touchStartedAt, releasedAt);
    },
    [onCast],
  );
  // À l'ouverture, le lecteur d'écran va sur la première ligne.
  const firstRow = useRef<View>(null);
  useEffect(() => {
    if (firstRow.current !== null) {
      AccessibilityInfo.sendAccessibilityEvent(firstRow.current, 'focus');
    }
  }, []);
  // Le geste retour d'Android ferme la liste sans quitter l'écran.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onDismiss();
      return true;
    });
    return () => subscription.remove();
  }, [onDismiss]);
  const entering = useMemo(() => powerListEntering(reducedMotion), [reducedMotion]);
  const ready = slots.filter(({ availability }) => availability === 'available').length;
  const tipSlot = slots.find(({ power }) => power === tip);
  return (
    <View pointerEvents="box-none" testID="battle-power-layer" style={StyleSheet.absoluteFill}>
      <Pressable
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        onPress={onDismiss}
        testID="battle-power-list-veil"
        style={StyleSheet.absoluteFill}
      />
      {/* La colonne est modale pour VoiceOver : la bulle de l'effet et la liste, rien d'autre. */}
      <Animated.View
        entering={entering}
        accessibilityViewIsModal
        pointerEvents="box-none"
        testID="battle-power-list-column"
        style={styles.column}
      >
        {tipSlot === undefined ? null : (
          <PowerTip power={tipSlot.power} cost={tipSlot.cost} kindled={tipSlot.kindled === true} />
        )}
        <PixelFrame
          tone="gold"
          background={roles.night}
          under={battleColors.background}
          accessibilityRole="menu"
          accessibilityLabel="Pouvoirs équipés"
          onAccessibilityEscape={onDismiss}
          testID="battle-power-list"
          style={styles.list}
        >
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            testID="battle-power-list-head"
            style={styles.head}
          >
            <Text style={styles.headText}>Pouvoirs équipés</Text>
            <Text style={styles.headText}>{readyCountText(ready, slots.length)}</Text>
          </View>
          {slots.map((slot, index) => (
            <PowerRow
              key={slot.power}
              {...(index === 0 && { ref: firstRow })}
              slot={slot}
              uiNow={uiNow}
              now={now}
              onCast={cast}
              onTip={showTip}
            />
          ))}
        </PixelFrame>
        <View pointerEvents="none" style={styles.notch} />
      </Animated.View>
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  column: {
    position: 'absolute',
    left: ACTION_ZONE_SIDE,
    right: ACTION_ZONE_SIDE,
    bottom: ACTION_ZONE_BOTTOM + KEY_HEIGHT + LIST_GAP,
    gap: 8,
  },
  list: { gap: 6, padding: 10 },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    paddingBottom: 2,
  },
  headText: {
    color: roles.parchment,
    fontFamily: textFont.bold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  // La pointe de la liste, vers « Pouvoirs » (maquette, `.plnotch`).
  notch: {
    position: 'absolute',
    bottom: -LIST_GAP + 2,
    left: 58,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: roles.gold,
  },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 10,
    paddingLeft: 8,
    paddingRight: 10,
    paddingVertical: 8,
  },
  well: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: roles.well,
    borderWidth: 2,
    borderColor: battleColors.secondaryLine,
  },
  kindledWell: { borderColor: roles.ember },
  faded: { opacity: 0.45 },
  text: { flex: 1, minWidth: 0, gap: 2 },
  name: { color: roles.light, fontFamily: pixelFont, fontSize: 16, lineHeight: 19 },
  hatchedName: { color: roles.parchment },
  sub: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  subText: {
    color: roles.parchment,
    fontFamily: textFont.semiBold,
    fontSize: 12.5,
    lineHeight: 16,
  },
  kindledText: { color: '#FFD8B8' },
  activeText: { color: roles.gold },
  instant: { fontFamily: textFont.bold, color: battleColors.onShadowStep },
  right: { alignItems: 'flex-end', gap: 5 },
  pips: { flexDirection: 'row', gap: 5, paddingHorizontal: 2 },
  pip: { width: 9, height: 9, transform: [{ rotate: '45deg' }], borderWidth: 1.5 },
  ready: { color: roles.gold, fontFamily: textFont.bold, fontSize: 12, lineHeight: 15 },
  check: {
    width: 15,
    height: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: roles.gold,
  },
});
// Stryker restore all
