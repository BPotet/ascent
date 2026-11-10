import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { HeroKind } from '../../../domain/battle/combatants';
import { HERO_SHORT_NAMES, tabCount, tabLabel, type TabBadge } from '../format/powersMenuText';
import { artPalette } from '../pixelArt/artPalette';
import { artPixelSize } from '../pixelArt/artPixel';
import { AssetRows } from '../pixelArt/AssetRows';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { textFont } from '../pixelArt/pixelTypography';
import { PORTRAITS } from '../pixelArt/sprites/atelier/data/portraits';

const { roles } = artPalette;
const LINE = artPixelSize(2);
const HEROES_IN_TABS: readonly HeroKind[] = ['sentinel', 'wanderer'];

/** Le badge d'un onglet : « 3/3 », en or quand le choix est à compléter ; ou le cadenas (M10). */
function Badge({ badge, testID }: { readonly badge: TabBadge; readonly testID: string }) {
  if (badge === 'locked') {
    return (
      <View testID={`${testID}-badge`} style={[styles.badge, styles.lockBadge]}>
        <PixelIcon name="lock" color={roles.parchment} testID={`${testID}-lock`} />
      </View>
    );
  }
  return (
    <View testID={`${testID}-badge`} style={[styles.badge, badge.toComplete && styles.warn]}>
      <Text style={[styles.count, badge.toComplete && styles.warnText]}>
        {tabCount(badge.count)}
      </Text>
    </View>
  );
}

/**
 * Les onglets des deux héros (#270, extraits de l'arbre de pouvoirs #235) : 48 dp de haut, le
 * portrait et le nom, l'onglet ouvert en or. Au menu des pouvoirs, chacun porte son badge : le
 * compte « n/3 », en or quand le choix est à compléter, ou le cadenas du héros de l'ascension ; son
 * libellé lu le dit (« L'Errante, 2 pouvoirs équipés sur 3, choix à compléter »).
 */
export function HeroTabs({
  hero,
  onSelect,
  testIDPrefix,
  badges,
}: {
  readonly hero: HeroKind;
  readonly onSelect: (hero: HeroKind) => void;
  /** Le début du `testID` de chaque onglet, suivi du héros. */
  readonly testIDPrefix: string;
  readonly badges?: Readonly<Record<HeroKind, TabBadge>>;
}) {
  return (
    <View role="tablist" accessibilityLabel="Héros" style={styles.tabs}>
      {HEROES_IN_TABS.map((kind) => {
        const portrait = PORTRAITS[kind];
        const selected = kind === hero;
        const badge = badges?.[kind];
        const testID = `${testIDPrefix}-${kind}`;
        return (
          <Pressable
            key={kind}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            {...(badge !== undefined && { accessibilityLabel: tabLabel(kind, badge) })}
            onPress={() => onSelect(kind)}
            testID={testID}
            style={[styles.tab, { borderWidth: LINE }, selected && styles.tabOn]}
          >
            {portrait === null ? null : <AssetRows image={portrait} scale={1} />}
            <Text style={[styles.tabText, selected && styles.tabTextOn]}>
              {HERO_SHORT_NAMES[kind]}
            </Text>
            {badge === undefined ? null : <Badge badge={badge} testID={testID} />}
          </Pressable>
        );
      })}
    </View>
  );
}

// Stryker disable all: valeurs purement visuelles, vérifiées par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  tab: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderColor: roles.line,
    backgroundColor: roles.surface,
  },
  tabOn: { borderColor: roles.gold, backgroundColor: roles.goldBg },
  tabText: { fontFamily: textFont.bold, fontSize: 14, lineHeight: 18, color: roles.parchment },
  tabTextOn: { color: roles.gold },
  badge: {
    minWidth: 30,
    height: 22,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: roles.line,
    backgroundColor: roles.sunken,
  },
  lockBadge: { flexDirection: 'row' },
  warn: { backgroundColor: roles.gold, borderColor: roles.gold },
  count: { fontFamily: textFont.bold, fontSize: 12, lineHeight: 14, color: roles.light },
  warnText: { color: roles.ink },
});
// Stryker restore all
