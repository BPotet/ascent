import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Rarity } from '../../../domain/ascent/rarity';
import {
  keysEntryAnnouncement,
  keysEntryLines,
  keysEntryTitle,
  keysEntryUse,
  type KeysEntrySources,
} from '../format/sealedChestText';
import { artPalette } from '../pixelArt/artPalette';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { pixelFont, pixelTypography, textFont } from '../pixelArt/pixelTypography';
import { KEY_IMAGE } from '../pixelArt/sprites/atelier/data/key';
import { assetSprite } from '../pixelArt/sprites/atelier/fullAnimation';
import { toPixelImage } from '../pixelArt/sprites/Sprite';
import { SpriteCanvas } from '../pixelArt/SpriteCanvas';
import { useReducedMotion } from '../state/useReducedMotion';
import { useSteps } from './CampFeedback';

const { roles } = artPalette;

/** L'entrée dans la tour (#226, maquette 208 F4), en millisecondes, passable d'un toucher. */
export const KEYS_ENTRY_MS = 1_200;
/** « +3 clés » grandit en 3 pas, sur 320 ms. */
const GROW_STEPS = 3;
const GROW_STEP_MS = 320 / GROW_STEPS;
const GROWTH = [0.7, 0.8, 0.9, 1] as const;

export const TAP_TO_GO_ON = 'Touche pour continuer';

/**
 * L'entrée dans la tour avec des clés (#226, F4, F5) : la clé à ×4, « +3 clés » qui grandit, une
 * ligne par source (la faveur, Fortune et sa rareté), à quoi elles servent, et une annonce polie ;
 * puis l'ascension continue, après 1 200 ms ou au premier toucher. En mouvement réduit, « +3 clés »
 * apparaît sans grandir.
 */
export function KeysEntry({
  sources,
  fortuneRarity,
  onDone,
}: {
  readonly sources: KeysEntrySources;
  readonly fortuneRarity: Rarity | null;
  readonly onDone: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const step = useSteps(GROW_STEPS, GROW_STEP_MS);
  const total = sources.favor + sources.fortune;
  const done = useRef(false);
  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(keysEntryAnnouncement(sources));
    const timer = setTimeout(finish, KEYS_ENTRY_MS);
    return () => clearTimeout(timer);
    // L'entrée s'annonce et se minute une fois, à l'affichage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scale = reducedMotion ? 1 : GROWTH[step]!;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Continuer"
      onPress={finish}
      style={styles.entry}
      testID="keys-entry"
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        testID="keys-entry-key"
      >
        <SpriteCanvas sprite="key" draw={() => toPixelImage(assetSprite(KEY_IMAGE))} scale={4} />
      </View>
      <Text testID="keys-entry-total" style={[styles.total, { transform: [{ scale }] }]}>
        {keysEntryTitle(total)}
      </Text>
      <View style={styles.lines}>
        {keysEntryLines(sources, fortuneRarity).map((line) => (
          <View key={line.source} style={styles.line}>
            <PixelIcon name="key8" color={roles.gold} />
            <Text style={styles.text}>{`${line.count} ${line.source}`}</Text>
            {line.rarity !== undefined && <Text style={styles.rarity}>{line.rarity}</Text>}
          </View>
        ))}
      </View>
      <Text style={styles.use}>{keysEntryUse(total)}</Text>
      <Text style={styles.tap}>{TAP_TO_GO_ON}</Text>
    </Pressable>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  entry: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  total: { fontFamily: pixelFont, fontSize: 32, lineHeight: 38, color: roles.gold },
  lines: { gap: 6, alignSelf: 'stretch' },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  text: { fontFamily: textFont.medium, fontSize: 15, lineHeight: 20, color: roles.light },
  rarity: {
    marginLeft: 'auto',
    fontFamily: textFont.bold,
    fontSize: 12,
    lineHeight: 16,
    color: roles.rarityRare,
  },
  use: { ...pixelTypography.body, color: roles.parchment, textAlign: 'center' },
  tap: { ...pixelTypography.body, color: roles.muted, textAlign: 'center' },
});
// Stryker restore all
