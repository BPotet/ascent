import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { EnemyKind } from '../../../domain/battle/combatants';
import { encounterHintText } from '../format/battleText';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { pixelFont, textFont } from '../pixelArt/pixelTypography';
import { battleColors } from '../theme/battleColors';

/**
 * La bulle de première rencontre d'une Élite à signature (#258, maquette 245, F1, `.hintb`) : la
 * couronne d'Élite et son nom, sa règle, et comment la fermer. Elle ne bloque rien : le premier
 * toucher, où qu'il soit, la ferme (l'écran s'en charge), et elle ne revient pas. Elle est annoncée
 * au lecteur d'écran, qui peut aussi la fermer.
 */
export function EncounterHintBubble({
  enemy,
  onClose,
}: {
  readonly enemy: EnemyKind;
  readonly onClose: () => void;
}) {
  const { title, text, close, speech } = encounterHintText(enemy);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={speech}
      accessibilityHint="Touche pour fermer l'aide."
      accessibilityLiveRegion="polite"
      onPress={onClose}
      testID={`encounter-hint-${enemy}`}
      style={styles.place}
    >
      <View testID="encounter-hint-frame" style={styles.frame}>
        <View style={styles.titleLine}>
          <PixelIcon name="crown8" color={battleColors.elite} testID="encounter-hint-crown" />
          <Text style={styles.title}>{title}</Text>
        </View>
        <Text style={styles.text}>{text}</Text>
        <Text style={styles.close}>{close}</Text>
      </View>
    </Pressable>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  place: { position: 'absolute', left: 12, right: 12, bottom: 8, zIndex: 66, elevation: 12 },
  // `.hintb` : surface relevée, cadre violet d'Élite, ombre d'encre en bas.
  frame: {
    gap: 3,
    paddingTop: 10,
    paddingBottom: 9,
    paddingHorizontal: 12,
    backgroundColor: battleColors.raised,
    borderWidth: 2,
    borderColor: battleColors.elite,
    borderBottomWidth: 4,
  },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { color: battleColors.onRaised, fontFamily: pixelFont, fontSize: 15, lineHeight: 18 },
  text: { color: battleColors.onRaised, fontFamily: textFont.medium, fontSize: 13, lineHeight: 18 },
  close: { color: battleColors.summonLine, fontFamily: textFont.medium, fontSize: 11.5 },
});
