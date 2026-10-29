import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { BoonKind } from '../../../domain/ascent/boons';
import { boonCard } from '../format/boonText';
import { artPalette } from '../pixelArt/artPalette';
import { PixelButton } from '../pixelArt/PixelButton';
import { PixelFrame } from '../pixelArt/PixelFrame';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { pixelFont, pixelTypography, textFont } from '../pixelArt/pixelTypography';
import { battleColors } from '../theme/battleColors';

const { roles } = artPalette;

function BoonOption({
  kind,
  checked,
  onPress,
}: {
  readonly kind: BoonKind;
  readonly checked: boolean;
  readonly onPress: () => void;
}) {
  const card = boonCard(kind);
  const color = battleColors.rarity[card.rarity];
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={card.label}
      accessibilityState={{ checked, selected: checked }}
      onPress={onPress}
      style={styles.card}
    >
      <PixelFrame
        tone={checked ? 'gold' : 'default'}
        {...(checked && { background: roles.goldBg })}
        style={styles.frame}
      >
        <Text style={[styles.tag, { color }]}>{card.tag}</Text>
        <Text style={[styles.name, checked && styles.checkedName]}>{card.name}</Text>
        <Text style={styles.effect}>{card.effect}</Text>
        {checked && (
          <View pointerEvents="none" style={styles.tick}>
            <PixelIcon name="check8" color={roles.ink} testID="boon-tick" />
          </View>
        )}
      </PixelFrame>
    </Pressable>
  );
}

/**
 * Le choix d'un bienfait (prototype #92, maquette B1 à B3) : 3 cartes, toucher une carte puis
 * « Prendre » ; puis le bienfait obtenu, et « Continuer » le garde pour l'ascension.
 */
export function BoonChoicePanel({
  offer,
  onChoose,
}: {
  readonly offer: readonly BoonKind[];
  readonly onChoose: (index: number) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [taken, setTaken] = useState(false);

  if (taken && selected !== null) {
    const card = boonCard(offer[selected]!);
    return (
      <View style={styles.body} testID="boon-obtained">
        <View style={styles.center}>
          <Text style={[styles.tag, { color: battleColors.rarity[card.rarity] }]}>{card.tag}</Text>
          <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.title}>
            {card.name}
          </Text>
          <Text style={styles.effect}>{card.effect}</Text>
          <Text style={styles.sub}>Bienfait obtenu.</Text>
        </View>
        <PixelButton label="Continuer" onPress={() => onChoose(selected)} />
      </View>
    );
  }

  return (
    <View style={styles.body} testID="boon-choice">
      <ScrollView contentContainerStyle={styles.list}>
        <Text accessibilityRole="header" style={styles.title}>
          Choisis un bienfait
        </Text>
        <Text style={styles.sub}>
          Un seul des trois. Il dure jusqu&apos;à la fin de l&apos;ascension.
        </Text>
        <View accessibilityRole="radiogroup" accessibilityLabel="Bienfaits" style={styles.list}>
          {offer.map((kind, index) => (
            <BoonOption
              key={kind}
              kind={kind}
              checked={selected === index}
              onPress={() => setSelected(index)}
            />
          ))}
        </View>
      </ScrollView>
      <PixelButton label="Prendre" disabled={selected === null} onPress={() => setTaken(true)} />
    </View>
  );
}

// Stryker disable all: styles d'un écran de prototype.
const styles = StyleSheet.create({
  body: { flex: 1, padding: 16, paddingBottom: 34, gap: 12 },
  center: { flex: 1, justifyContent: 'center', gap: 12 },
  list: { gap: 8 },
  title: {
    fontFamily: pixelFont,
    fontSize: 22,
    lineHeight: 26,
    color: roles.light,
    textAlign: 'center',
  },
  sub: { ...pixelTypography.body, fontSize: 14, color: roles.parchment, textAlign: 'center' },
  card: { minHeight: 88 },
  frame: { flexGrow: 1, gap: 3, paddingVertical: 12, paddingLeft: 14, paddingRight: 40 },
  tag: { fontFamily: textFont.bold, fontSize: 12, lineHeight: 16 },
  name: { fontFamily: pixelFont, fontSize: 20, lineHeight: 24, color: roles.light },
  checkedName: { color: roles.gold },
  effect: { fontFamily: textFont.medium, fontSize: 14, lineHeight: 20, color: roles.parchment },
  tick: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: roles.gold,
  },
});
// Stryker restore all
