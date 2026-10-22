import { StyleSheet, Text, View } from 'react-native';

import type { HeroState } from '../../../domain/battle/Battle';
import { HERO_NAME, heroHpText } from '../format/battleText';
import { battleColors } from '../theme/battleColors';

/** La part des PV sous laquelle la barre passe en alerte (maquette : 30 %). */
const LOW_HP_RATIO = 0.3;

/** La barre du héros : son nom et ses PV (sans Élan dans #31, la hauteur reste de 62 pt). */
export function HeroBar({ hero }: { readonly hero: HeroState }) {
  const ratio = hero.hp / hero.maxHp;
  return (
    <View
      accessible
      accessibilityLabel={`${HERO_NAME}, PV ${hero.hp} sur ${hero.maxHp}`}
      testID="battle-hero-bar"
      style={styles.bar}
    >
      <Text style={styles.name}>{HERO_NAME}</Text>
      <View style={styles.row}>
        <View style={styles.track}>
          <View
            style={[styles.hp, ratio < LOW_HP_RATIO && styles.low, { width: `${100 * ratio}%` }]}
          />
        </View>
        <Text style={styles.hpText}>{heroHpText(hero.hp, hero.maxHp)}</Text>
      </View>
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  bar: {
    minHeight: 62,
    paddingTop: 10,
    paddingBottom: 6,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  name: { color: battleColors.text, fontSize: 15, lineHeight: 18, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
  track: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: battleColors.hpTrack,
    overflow: 'hidden',
  },
  hp: { height: '100%', borderRadius: 4, backgroundColor: battleColors.heroHp },
  low: { backgroundColor: battleColors.heroHpLow },
  hpText: {
    color: battleColors.text,
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
// Stryker restore all
