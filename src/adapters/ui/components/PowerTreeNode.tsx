import type { Ref } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { PowerNodeState, PowerTreeCode } from '../../../domain/ascent/powerTree';
import { TREE_POWER_NAMES, nodeLabel, nodeStateText, powerTypeLine } from '../format/powerText';
import { artPalette } from '../pixelArt/artPalette';
import { artPixelSize, notchedCorners } from '../pixelArt/artPixel';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { pixelFont, textFont } from '../pixelArt/pixelTypography';
import { PowerIcon } from './PowerIcon';

const { roles } = artPalette;
const LINE = artPixelSize(2);

// Stryker disable all: valeurs purement visuelles, vérifiées par la conformité aux maquettes (barrière 10 bis).
/**
 * La bordure et le mot de chaque état (maquette 232, section 1) : or pour ce qui est équipé, or
 * foncé pour ce qui se débloque, trait sombre pour ce qui manque, hachures pour un verrou ou
 * « Bientôt ». Jamais la couleur seule : l'état est toujours écrit.
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
  soon: { line: roles.line, word: roles.parchment, bg: roles.sunken },
};
// Stryker restore all

/**
 * Un nœud de l'arbre de pouvoirs (#235, maquette 232) : l'icône à ×3, le nom, le coût et le type,
 * puis l'état en mot. Toucher un nœud ouvre sa fiche, quel que soit son état. Son trait d'or
 * s'éclaire juste après un déblocage (`fresh`, D1).
 */
export function PowerTreeNode({
  code,
  state,
  fresh = false,
  onPress,
  ref,
}: {
  readonly code: PowerTreeCode;
  readonly state: PowerNodeState;
  readonly fresh?: boolean;
  readonly onPress: () => void;
  readonly ref?: Ref<View>;
}) {
  const look = LOOKS[state.kind];
  const off = state.kind === 'locked' || state.kind === 'soon';
  const owned = state.kind === 'base' || state.kind === 'unlocked';
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={nodeLabel(code, state)}
      onPress={onPress}
      testID={`power-node-${code}`}
      style={[
        styles.node,
        { borderWidth: LINE, borderColor: look.line, backgroundColor: look.bg },
        fresh && styles.fresh,
      ]}
    >
      {owned ? (
        <View testID={`power-node-tick-${code}`} style={styles.tick}>
          <PixelIcon name="check8" color={roles.ink} />
        </View>
      ) : null}
      <View style={off && styles.off}>
        <PowerIcon power={code} scale={3} off={off} />
      </View>
      <Text numberOfLines={2} style={styles.name}>
        {TREE_POWER_NAMES[code]}
      </Text>
      <Text style={styles.type}>{powerTypeLine(code)}</Text>
      <View style={styles.stateRow}>
        {state.kind === 'locked' ? <PixelIcon name="lock" color={roles.parchment} /> : null}
        {state.kind === 'affordable' ? <PixelIcon name="shard8" color={roles.shard} /> : null}
        <Text style={[styles.state, { color: look.word }]}>{nodeStateText(state, code)}</Text>
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
  off: { opacity: 0.55 },
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
