import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { artPalette } from '../pixelArt/artPalette';
import { artPixelSize } from '../pixelArt/artPixel';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { pixelTypography } from '../pixelArt/pixelTypography';
import type { IconName } from '../pixelArt/sprites/icons';

const { roles } = artPalette;

/** Le pixel d'art, arrondi au pixel physique du téléphone (traits, crans, pas des envols). */
const LINE = artPixelSize(2);

/**
 * Les onglets de la barre d'onglets : leur libellé et leur icône (maquette, « Barre d'onglets »).
 * Un onglet de plus (Tour, épique #30) n'est qu'une ligne de plus ici, avec son icône.
 */
const TABS = {
  day: { label: 'Journée', icon: 'tDay' },
  week: { label: 'Semaine', icon: 'tWeek' },
  month: { label: 'Mois', icon: 'tMonth' },
  // La tour (prototype #91, build de preview seulement) : icône provisoire.
  tower: { label: 'Tour', icon: 'iAttack' },
} as const satisfies Record<string, { readonly label: string; readonly icon: IconName }>;

/** Les vues que la barre d'onglets propose. */
export type TabKey = keyof typeof TABS;

/** Le libellé de chaque onglet. */
export const TAB_LABELS = Object.fromEntries(
  Object.entries(TABS).map(([tab, { label }]) => [tab, label]),
) as Readonly<Record<TabKey, string>>;

/**
 * Barre d'onglets (`TabBar`) en bas de l'écran, à portée du pouce : une vue par onglet (`tabs`,
 * dans l'ordre), avec son icône en pixels de 24 dp et son libellé en police de texte. L'onglet de la
 * vue affichée (`current`) a un fond, un trait d'or de 4 dp en haut et un libellé en gras, pas
 * seulement une couleur, et il est « sélectionné » pour le lecteur d'écran. Chaque onglet fait 56 dp
 * de haut. Toucher un onglet appelle `onSelect` : c'est l'assemblage (routes) qui change de vue.
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
      style={[styles.bar, { paddingBottom: Math.max(bottom, 8) }]}
    >
      <View style={styles.line} />
      <View style={styles.shade} />
      {tabs.map((tab) => {
        const selected = tab === current;
        const { label, icon } = TABS[tab];
        return (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            onPress={() => onSelect(tab)}
            testID={`tab-${tab}`}
            style={[styles.tab, selected && styles.selected]}
          >
            {selected && <View testID={`tab-line-${tab}`} style={styles.activeLine} />}
            <PixelIcon
              name={icon}
              color={selected ? roles.gold : roles.muted}
              secondColor={selected ? roles.light : roles.parchment}
              testID={`tab-icon-${tab}`}
            />
            <Text
              style={[
                selected ? pixelTypography.tabActive : pixelTypography.tab,
                { color: selected ? roles.gold : roles.parchment },
              ]}
            >
              {label}
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
    gap: 4,
    paddingTop: 6,
    paddingHorizontal: 8,
    backgroundColor: roles.night,
  },
  line: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: LINE,
    backgroundColor: roles.line,
  },
  shade: {
    position: 'absolute',
    top: LINE,
    left: 0,
    right: 0,
    height: LINE,
    backgroundColor: roles.ink,
  },
  tab: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderWidth: LINE,
    borderColor: 'transparent',
  },
  selected: { backgroundColor: roles.surface, borderColor: roles.line },
  activeLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2 * LINE,
    backgroundColor: roles.gold,
  },
});
// Stryker restore all
