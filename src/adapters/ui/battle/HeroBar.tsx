import { StyleSheet, Text, View } from 'react-native';

import type { HeroState } from '../../../domain/battle/Battle';
import type { HeroKind } from '../../../domain/battle/combatants';
import { MOMENTUM_MAX } from '../../../domain/battle/momentum';
import {
  HERO_NAMES,
  POWER_NAMES,
  bleedChipText,
  heroHpText,
  momentumLabel,
} from '../format/battleText';
import { battleColors } from '../theme/battleColors';
import { BleedChip } from './BleedChip';
import { BulwarkChip } from './BulwarkChip';

/** La part des PV sous laquelle la barre passe en alerte (maquette : 30 %). */
const LOW_HP_RATIO = 0.3;

/** L'Élan en losanges, les pleins d'abord (maquette F1). Décoratif : la barre est lue en entier. */
function MomentumDiamonds({ momentum }: { readonly momentum: number }) {
  return (
    <View style={styles.momentum}>
      <Text style={styles.momentumLabel}>Élan</Text>
      {Array.from({ length: MOMENTUM_MAX }, (_, index) => {
        const full = index < momentum;
        return (
          <View
            key={index}
            testID={full ? 'battle-momentum-full' : 'battle-momentum-empty'}
            style={[styles.diamond, full ? styles.full : styles.empty]}
          />
        );
      })}
    </View>
  );
}

/**
 * La barre du héros : son nom, ses PV et son Élan (C3), et son pouvoir actif. L'étiquette du
 * Rempart montre « Rempart usé » tant que dure le coup qui l'a usé (`bulwarkWorn`, #128).
 */
export function HeroBar({
  hero,
  kind = 'sentinel',
  bulwarkWorn = false,
}: {
  readonly hero: HeroState;
  readonly kind?: HeroKind;
  readonly bulwarkWorn?: boolean;
}) {
  const ratio = hero.hp / hero.maxHp;
  const name = HERO_NAMES[kind];
  const active = [
    ...(hero.bulwark ? [POWER_NAMES.bulwark] : []),
    ...(hero.shadowStep === true ? [POWER_NAMES.shadowStep] : []),
    ...(hero.bleed ? [bleedChipText(hero.bleed.rounds)] : []),
  ];
  const label = `${name}, PV ${hero.hp} sur ${hero.maxHp}, ${momentumLabel(hero.momentum)}${active.map((power) => `, ${power}`).join('')}`;
  return (
    <View accessible accessibilityLabel={label} testID="battle-hero-bar" style={styles.bar}>
      <Text style={styles.name}>{name}</Text>
      <View style={styles.row}>
        <View style={styles.track}>
          <View
            testID="battle-hero-hp"
            style={[styles.hp, ratio < LOW_HP_RATIO && styles.low, { width: `${100 * ratio}%` }]}
          />
        </View>
        <Text style={styles.hpText}>{heroHpText(hero.hp, hero.maxHp)}</Text>
      </View>
      {hero.bulwark || bulwarkWorn ? <BulwarkChip worn={!hero.bulwark} /> : null}
      {hero.bleed ? <BleedChip rounds={hero.bleed.rounds} /> : null}
      <MomentumDiamonds momentum={hero.momentum} />
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  bar: {
    minHeight: 62,
    paddingTop: 8,
    paddingBottom: 4,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  name: { color: battleColors.text, fontSize: 15, lineHeight: 18, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
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
  momentum: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  momentumLabel: { color: battleColors.muted, fontSize: 12, fontWeight: '600', marginRight: 2 },
  diamond: { width: 9, height: 9, transform: [{ rotate: '45deg' }], borderWidth: 1.5 },
  full: { backgroundColor: battleColors.light, borderColor: battleColors.light },
  empty: { borderColor: battleColors.secondaryLine },
});
// Stryker restore all
