import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { BoonKind } from '../../../domain/ascent/boons';
import { Button } from '../components/Button';
import { boonCard } from '../format/boonText';
import { battleColors } from '../theme/battleColors';

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
      style={[styles.card, checked && styles.checked]}
    >
      <Text style={[styles.tag, { color }]}>{card.tag}</Text>
      <Text style={styles.name}>{card.name}</Text>
      <Text style={styles.effect}>{card.effect}</Text>
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
        <Button label="Continuer" onPress={() => onChoose(selected)} />
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
      <Button label="Prendre" disabled={selected === null} onPress={() => setTaken(true)} />
    </View>
  );
}

// Stryker disable all: styles d'un écran de prototype.
const styles = StyleSheet.create({
  body: { flex: 1, padding: 16, paddingBottom: 34, gap: 12 },
  center: { flex: 1, justifyContent: 'center', gap: 12 },
  list: { gap: 8 },
  title: { color: battleColors.light, fontSize: 22, fontWeight: '700', textAlign: 'center' },
  sub: { color: battleColors.muted, fontSize: 14, textAlign: 'center' },
  card: {
    minHeight: 88,
    padding: 12,
    gap: 4,
    backgroundColor: battleColors.surface,
    borderWidth: 2,
    borderColor: battleColors.line,
  },
  checked: { borderColor: battleColors.light, backgroundColor: battleColors.surfaceRaised },
  tag: { fontSize: 12, fontWeight: '700' },
  name: { color: battleColors.text, fontSize: 18, fontWeight: '700' },
  effect: { color: battleColors.muted, fontSize: 14 },
});
// Stryker restore all
