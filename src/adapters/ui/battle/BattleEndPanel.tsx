import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { BattleOutcome } from '../../../domain/battle/BattleEvent';
import { Button } from '../components/Button';
import { endLine, endTitle, respiteText } from '../format/battleText';
import { battleColors } from '../theme/battleColors';

/**
 * L'écran de fin du combat d'essai : gagné (avec le répit regagné, C11) ou perdu, « Rejouer » (le
 * combat repart du début) et « Quitter ». Dans le build de preview, les panneaux d'essai suivent
 * (`children`). Il occupe la place laissée sous la scène, et ses panneaux défilent : la scène ne
 * rétrécit jamais sous le bas des plaques des ennemis.
 */
export function BattleEndPanel({
  outcome,
  respite,
  onReplay,
  onClose,
  children,
}: {
  readonly outcome: BattleOutcome;
  /** Les PV regagnés par le répit, `null` sans répit. */
  readonly respite: number | null;
  readonly onReplay: () => void;
  readonly onClose: () => void;
  readonly children?: ReactNode;
}) {
  return (
    <ScrollView testID="battle-end" style={styles.panel} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text
          accessibilityRole="header"
          style={[styles.title, outcome === 'victory' ? styles.victory : styles.defeat]}
        >
          {endTitle(outcome)}
        </Text>
        <Text style={styles.line}>{endLine(outcome)}</Text>
        {respite === null ? null : <Text style={styles.respite}>{respiteText(respite)}</Text>}
      </View>
      <View style={styles.actions}>
        <View style={styles.action}>
          <Button label="Quitter" variant="ghost" onPress={onClose} />
        </View>
        <View style={styles.action}>
          <Button label="Rejouer" onPress={onReplay} />
        </View>
      </View>
      {children}
    </ScrollView>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  panel: { flex: 1 },
  content: { padding: 16, paddingBottom: 34, gap: 12 },
  card: {
    backgroundColor: battleColors.surface,
    borderWidth: 1,
    borderColor: battleColors.line,
    borderRadius: 20,
    padding: 14,
    gap: 4,
  },
  title: { fontSize: 26, lineHeight: 30, fontWeight: '700' },
  victory: { color: battleColors.light },
  defeat: { color: battleColors.miss },
  line: { color: battleColors.muted, fontSize: 14, lineHeight: 20 },
  respite: { color: battleColors.text, fontSize: 14, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1 },
});
// Stryker restore all
