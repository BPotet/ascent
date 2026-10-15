import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';
import { spacing } from '../theme/metrics';
import { typography } from '../theme/typography';

/** Les vues que la barre d'onglets propose. */
export type TabKey = 'day' | 'week' | 'month';

/** Le libellé de chaque onglet (maquette, « Barre d'onglets »). */
export const TAB_LABELS: Readonly<Record<TabKey, string>> = {
  day: 'Journée',
  week: 'Semaine',
  month: 'Mois',
};

// Stryker disable all: pictogrammes purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const RAYS = [0, 45, 90, 135];

function DayIcon({ color }: { readonly color: string }) {
  return (
    <View style={icons.box}>
      {RAYS.map((angle) => (
        <View key={angle} style={[icons.ray, { transform: [{ rotate: `${angle}deg` }] }]}>
          <View style={[icons.rayEnd, { backgroundColor: color }]} />
          <View style={[icons.rayEnd, { backgroundColor: color }]} />
        </View>
      ))}
      <View style={[icons.sun, { borderColor: color }]} />
    </View>
  );
}

function WeekIcon({ color }: { readonly color: string }) {
  return (
    <View style={[icons.week, { borderColor: color }]}>
      {[0, 1, 2].map((index) => (
        <View key={index} style={[icons.weekLine, { backgroundColor: color }]} />
      ))}
    </View>
  );
}

function MonthIcon({ color }: { readonly color: string }) {
  return (
    <View style={icons.box}>
      <View style={[icons.month, { borderColor: color }]}>
        <View style={[icons.monthTop, { backgroundColor: color }]} />
        <View style={icons.monthDots}>
          {[0, 1, 2, 3, 4].map((index) => (
            <View key={index} style={[icons.monthDot, { backgroundColor: color }]} />
          ))}
        </View>
      </View>
    </View>
  );
}

const ICONS: Readonly<Record<TabKey, (props: { readonly color: string }) => ReactElement>> = {
  day: DayIcon,
  week: WeekIcon,
  month: MonthIcon,
};
// Stryker restore all

/**
 * Barre d'onglets en bas de l'écran, à portée du pouce : une vue par onglet (`tabs`, dans l'ordre).
 * L'onglet de la vue affichée (`current`) a un fond et un libellé en gras, pas seulement une couleur,
 * et il est « sélectionné » pour le lecteur d'écran. Toucher un onglet appelle `onSelect` : c'est
 * l'assemblage (routes) qui change de vue.
 */
export function TabBar({
  tabs,
  current,
  onSelect,
}: {
  readonly tabs: readonly TabKey[];
  readonly current: TabKey;
  readonly onSelect: (tab: TabKey) => void;
}) {
  const { bottom } = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      testID="tab-bar"
      style={[styles.bar, { paddingBottom: Math.max(bottom, spacing.sm) }]}
    >
      {tabs.map((tab) => {
        const selected = tab === current;
        const color = selected ? colors.accent : colors.muted;
        const Icon = ICONS[tab];
        return (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityLabel={TAB_LABELS[tab]}
            accessibilityState={{ selected }}
            onPress={() => onSelect(tab)}
            testID={`tab-${tab}`}
            style={styles.tab}
          >
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              testID={`tab-icon-${tab}`}
              style={[styles.icon, selected && styles.iconSelected]}
            >
              <Icon color={color} />
            </View>
            <Text
              style={[
                selected ? typography.tabActive : typography.tab,
                selected ? styles.labelSelected : styles.label,
              ]}
            >
              {TAB_LABELS[tab]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingTop: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.tabBar,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  tab: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: 14,
  },
  icon: {
    width: 58,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSelected: { backgroundColor: colors.tabActiveSoft },
  label: { color: colors.muted },
  labelSelected: { color: colors.text },
});

const icons = StyleSheet.create({
  box: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  sun: { width: 9, height: 9, borderRadius: 4.5, borderWidth: 2 },
  ray: {
    position: 'absolute',
    width: 2,
    height: 19,
    justifyContent: 'space-between',
  },
  rayEnd: { width: 2, height: 2.4, borderRadius: 1 },
  week: {
    width: 18,
    height: 14,
    borderRadius: 3,
    borderWidth: 2,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  weekLine: { width: 1.6, height: '100%' },
  month: { width: 18, height: 16, borderRadius: 3, borderWidth: 2, overflow: 'hidden' },
  monthTop: { height: 2.5 },
  monthDots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    paddingTop: 2,
    paddingHorizontal: 1.5,
  },
  monthDot: { width: 2.4, height: 2, borderRadius: 1 },
});
// Stryker restore all
