import type { Ref } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { PowerNodeState } from '../../../domain/ascent/powerTree';
import type { PowerKind } from '../../../domain/battle/powers';
import { TREE_POWER_NAMES, nodeLabel, nodeStateText, powerTypeLine } from '../format/powerText';
import { oathLabel } from '../format/oathText';
import { artPalette } from '../pixelArt/artPalette';
import { artPixelSize, notchedCorners } from '../pixelArt/artPixel';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { pixelFont, textFont } from '../pixelArt/pixelTypography';
import { useReducedMotion } from '../state/useReducedMotion';
import { useSteps } from './CampFeedback';
import { PowerIcon } from './PowerIcon';

const { roles } = artPalette;
const LINE = artPixelSize(2);

// Stryker disable all: valeurs purement visuelles, vérifiées par la conformité aux maquettes (barrière 10 bis).
/**
 * La bordure et le mot de chaque état (maquette 232, section 1) : or pour ce qui est équipé, or
 * foncé pour ce qui se débloque, trait sombre pour ce qui manque, hachures pour un verrou. Jamais
 * la couleur seule : l'état est toujours écrit.
 */
const LOOKS: Readonly<
  Record<
    PowerNodeState['kind'],
    { readonly line: string; readonly word: string; readonly bg: string }
  >
> = {
  base: { line: roles.gold, word: roles.gold, bg: roles.surface },
  unlocked: { line: roles.gold, word: roles.gold, bg: roles.surface },
  nextAscent: { line: roles.blue, word: roles.light, bg: roles.surface },
  affordable: { line: roles.goldDark, word: roles.shard, bg: roles.surface },
  missing: { line: roles.line, word: roles.parchment, bg: roles.surface },
  locked: { line: roles.line, word: roles.parchment, bg: roles.sunken },
};

/** Un pouvoir à soi mais pas équipé (#236, A3) : coche verte, trait sombre, « Débloqué ». */
const LEFT_OUT = { line: roles.line, word: roles.light, bg: roles.surface } as const;
// Stryker restore all

// Stryker disable all: durées et amplitudes de la maquette (D1, `.node.fresh`), mutées seulement avec `mutation:ui`.
/** Le nœud s'allume en 3 pas sur 600 ms (`light`), l'anneau s'ouvre en 6 pas sur 900 ms (`ring`). */
const LIGHT_STEPS = 3;
const LIGHT_STEP_MS = 200;
const RING_STEPS = 6;
const RING_STEP_MS = 150;
/** L'anneau culmine à 40 % de son animation, puis reste à 35 % ; il part de 40 % de sa taille. */
const RING_PEAK = 0.4;
const RING_REST = 0.35;
const RING_FROM = 0.4;
// Stryker restore all

/** L'éclat de l'icône d'un nœud tout juste débloqué, de 0 (ombre) à 1 ; d'un coup en mouvement réduit. */
export function unlockLight(frame: number, reducedMotion: boolean): number {
  return reducedMotion ? 1 : Math.min(frame, LIGHT_STEPS) / LIGHT_STEPS;
}

/**
 * L'anneau d'or derrière un nœud tout juste débloqué, à l'image `frame` (0 à 6) : il grandit et
 * s'éclaire jusqu'à 40 %, puis pâlit à 35 %. En mouvement réduit, il apparaît en fondu, sans grandir.
 */
export function unlockRing(
  frame: number,
  reducedMotion: boolean,
): { readonly opacity: number; readonly scale: number } {
  const progress = Math.min(frame, RING_STEPS) / RING_STEPS;
  if (reducedMotion) return { opacity: progress, scale: 1 };
  const opacity =
    progress <= RING_PEAK
      ? progress / RING_PEAK
      : 1 - ((1 - RING_REST) * (progress - RING_PEAK)) / (1 - RING_PEAK);
  return { opacity, scale: 1 - (1 - RING_FROM) * (1 - progress) };
}

/** L'anneau d'or d'un nœud tout juste débloqué (D1). Décoratif. */
function UnlockRing({ code }: { readonly code: PowerKind }) {
  const reduced = useReducedMotion();
  const { opacity, scale } = unlockRing(useSteps(RING_STEPS, RING_STEP_MS), reduced);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      testID={`power-node-ring-${code}`}
      style={[styles.ring, { opacity, transform: [{ scale }] }]}
    />
  );
}

/** L'icône d'un nœud tout juste débloqué, qui passe de l'ombre à la couleur (D1). */
function LightingIcon({ code }: { readonly code: PowerKind }) {
  const reduced = useReducedMotion();
  const light = unlockLight(useSteps(LIGHT_STEPS, LIGHT_STEP_MS), reduced);
  return (
    <View style={{ opacity: SHADOW_OPACITY + (1 - SHADOW_OPACITY) * light }}>
      <PowerIcon power={code} scale={3} saturation={light} />
    </View>
  );
}

/** L'ombre d'où part l'icône qui s'allume (maquette : `brightness(.55)`). */
const SHADOW_OPACITY = 0.55;

/**
 * Un nœud de l'arbre de pouvoirs (#235, maquette 232) : l'icône à ×3, le nom, le coût et le type,
 * puis l'état en mot. Toucher un nœud ouvre sa fiche, quel que soit son état. Juste après un
 * déblocage (`fresh`, D1), son trait d'or s'éclaire, son icône s'allume et un anneau d'or s'ouvre.
 * Un pouvoir à soi laissé hors des 3 pouvoirs équipés (`equipped` faux, #236, A3) prend la coche
 * verte et « Débloqué ».
 */
export function PowerTreeNode({
  code,
  state,
  fresh = false,
  equipped = true,
  sworn,
  onPress,
  ref,
}: {
  readonly code: PowerKind;
  readonly state: PowerNodeState;
  readonly fresh?: boolean;
  /** Le pouvoir est dans la présélection du Choix du héros (#236) ; vrai par défaut. */
  readonly equipped?: boolean;
  /** L'habitude du Serment du pouvoir, non rompu (#237, S7) : le chaînon bleu, en haut à gauche. */
  readonly sworn?: string | undefined;
  readonly onPress: () => void;
  readonly ref?: Ref<View>;
}) {
  const owned = state.kind === 'base' || state.kind === 'unlocked';
  const look = owned && !equipped ? LEFT_OUT : LOOKS[state.kind];
  const off = state.kind === 'locked';
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={
        sworn === undefined
          ? nodeLabel(code, state, equipped)
          : `${nodeLabel(code, state, equipped)}, ${oathLabel(sworn)}`
      }
      onPress={onPress}
      testID={`power-node-${code}`}
      style={[
        styles.node,
        { borderWidth: LINE, borderColor: look.line, backgroundColor: look.bg },
        fresh && styles.fresh,
      ]}
    >
      {fresh ? <UnlockRing code={code} /> : null}
      {owned ? (
        <View
          testID={`power-node-tick-${code}`}
          style={[styles.tick, !equipped && styles.leftOutTick]}
        >
          <PixelIcon name="check8" color={roles.ink} />
        </View>
      ) : null}
      {sworn === undefined ? null : (
        <View testID={`power-node-oath-${code}`} style={[styles.oath, { borderWidth: 1 }]}>
          <PixelIcon name="oath8" color={roles.blue} />
        </View>
      )}
      {fresh ? (
        <LightingIcon code={code} />
      ) : (
        <View style={off && styles.off}>
          <PowerIcon power={code} scale={3} off={off} />
        </View>
      )}
      <Text numberOfLines={2} style={styles.name}>
        {TREE_POWER_NAMES[code]}
      </Text>
      <Text style={styles.type}>{powerTypeLine(code)}</Text>
      <View style={styles.stateRow}>
        {state.kind === 'locked' ? <PixelIcon name="lock" color={roles.parchment} /> : null}
        {state.kind === 'affordable' ? <PixelIcon name="shard8" color={roles.shard} /> : null}
        <Text style={[styles.state, { color: look.word }]}>
          {nodeStateText(state, code, equipped)}
        </Text>
      </View>
      {notchedCorners(LINE).map((corner, index) => (
        <View key={index} pointerEvents="none" style={[styles.corner, corner]} />
      ))}
    </Pressable>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  node: {
    flex: 1,
    minHeight: 128,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  fresh: { borderColor: roles.gold, backgroundColor: roles.goldBg },
  ring: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: roles.gold,
  },
  off: { opacity: 0.55 },
  oath: {
    position: 'absolute',
    top: 4,
    left: 4,
    padding: 2,
    borderColor: roles.blue,
    backgroundColor: roles.sunken,
  },
  tick: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: roles.gold,
  },
  leftOutTick: { backgroundColor: roles.done },
  name: {
    fontFamily: pixelFont,
    fontSize: 16,
    lineHeight: 18,
    color: roles.light,
    textAlign: 'center',
  },
  type: { fontFamily: textFont.semiBold, fontSize: 11.5, lineHeight: 15, color: roles.muted },
  stateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  state: { fontFamily: textFont.bold, fontSize: 12, lineHeight: 16, textAlign: 'center' },
  corner: { position: 'absolute', backgroundColor: roles.night },
});
// Stryker restore all
