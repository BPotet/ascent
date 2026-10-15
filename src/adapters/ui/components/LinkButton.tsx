import { Pressable, StyleSheet, Text } from 'react-native';

import { colors } from '../theme/colors';
import { MIN_TOUCH_SIZE } from '../theme/metrics';
import { typography } from '../theme/typography';

/** Action discrète en texte, sans fond : « Revenir à cette semaine ». Zone tactile de 44 pt. */
export function LinkButton({
  label,
  onPress,
  testID,
}: {
  readonly label: string;
  readonly onPress: () => void;
  readonly testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      testID={testID}
      style={styles.link}
    >
      <Text style={[typography.link, styles.label]}>{label}</Text>
    </Pressable>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  link: {
    minHeight: MIN_TOUCH_SIZE,
    paddingHorizontal: 4,
    alignSelf: 'center',
    justifyContent: 'center',
  },
  label: { color: colors.accent },
});
// Stryker restore all
