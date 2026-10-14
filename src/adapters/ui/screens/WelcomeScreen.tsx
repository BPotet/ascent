import { StyleSheet, Text } from 'react-native';

import { Screen } from '../components/Screen';
import { formatLongDay } from '../format/formatDay';
import { useToday } from '../state/useToday';
import { colors } from '../theme/colors';

/** Écran d'accueil provisoire du socle technique, remplacé par la Vue Journée (#3). */
export function WelcomeScreen() {
  const today = useToday();
  return (
    <Screen testID="welcome-screen">
      <Text accessibilityRole="header" style={styles.title}>
        Ascent
      </Text>
      <Text testID="welcome-today" style={styles.today}>
        {formatLongDay(today)}
      </Text>
    </Screen>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 40, fontWeight: '700', letterSpacing: 1 },
  today: { color: colors.muted, fontSize: 16 },
});
// Stryker restore all
