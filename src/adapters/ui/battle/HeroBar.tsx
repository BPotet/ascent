import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

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
import { ShadowStepChip } from './ShadowStepChip';

/** La part des PV sous laquelle la barre passe en alerte (maquette : 30 %). */
const LOW_HP_RATIO = 0.3;

/** Un losange d'Élan dépensé se vide en 150 ms (#173, maquette E2). */
const DRAIN_MS = 150;

/**
 * Un losange d'Élan : son plein apparaît d'un coup ; dépensé, il se vide après les losanges à sa
 * gauche, un à un, ou tous ensemble en mouvement réduit (#173).
 */
function Diamond({
  index,
  momentum,
  reducedMotion,
}: {
  readonly index: number;
  readonly momentum: number;
  readonly reducedMotion: boolean;
}) {
  const full = index < momentum;
  const fill = useSharedValue(full ? 1 : 0);
  useEffect(() => {
    if (full) {
      fill.set(1);
      return;
    }
    const delay = reducedMotion ? 0 : (index - momentum) * DRAIN_MS;
    fill.set(withDelay(delay, withTiming(0, { duration: DRAIN_MS })));
  }, [fill, full, index, momentum, reducedMotion]);
  // Dépendances explicites : le code instrumenté par Stryker n'est plus reconnu comme worklet.
  const shown = useAnimatedStyle(() => {
    'worklet';
    return { opacity: fill.get() };
  }, [fill]);
  return (
    <View
      testID={full ? 'battle-momentum-full' : 'battle-momentum-empty'}
      style={[styles.diamond, styles.empty]}
    >
      <Animated.View testID="battle-momentum-fill" style={[styles.full, shown]} />
    </View>
  );
}

/** L'Élan en losanges, les pleins d'abord (maquette F1). Décoratif : la barre est lue en entier. */
function MomentumDiamonds({
  momentum,
  reducedMotion,
}: {
  readonly momentum: number;
  readonly reducedMotion: boolean;
}) {
  return (
    <View style={styles.momentum}>
      <Text style={styles.momentumLabel}>Élan</Text>
      {Array.from({ length: MOMENTUM_MAX }, (_, index) => (
        <Diamond key={index} index={index} momentum={momentum} reducedMotion={reducedMotion} />
      ))}
    </View>
  );
}

/**
 * La barre du héros : son nom, ses PV et son Élan (C3), et son pouvoir actif. L'étiquette du
 * Rempart montre « Rempart usé » tant que dure le coup qui l'a usé (`bulwarkWorn`, #128) ; celle
 * de Pas de l'ombre reste jusqu'à son emploi, son trait éclairé juste après le lancer
 * (`shadowStepNew`, #173).
 */
export function HeroBar({
  hero,
  kind = 'sentinel',
  bulwarkWorn = false,
  shadowStepNew = false,
  reducedMotion = false,
}: {
  readonly hero: HeroState;
  readonly kind?: HeroKind;
  readonly bulwarkWorn?: boolean;
  readonly shadowStepNew?: boolean;
  readonly reducedMotion?: boolean;
}) {
  const ratio = hero.hp / hero.maxHp;
  const name = HERO_NAMES[kind];
  const active = [
    ...(hero.bulwark ? [POWER_NAMES.bulwark] : []),
    ...(hero.bleed ? [bleedChipText(hero.bleed.rounds)] : []),
    ...(hero.shadowStep === true ? [POWER_NAMES.shadowStep] : []),
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
      {hero.shadowStep === true ? <ShadowStepChip fresh={shadowStepNew} /> : null}
      <MomentumDiamonds momentum={hero.momentum} reducedMotion={reducedMotion} />
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
  // Le plein couvre aussi le trait du losange.
  full: {
    position: 'absolute',
    top: -1.5,
    left: -1.5,
    right: -1.5,
    bottom: -1.5,
    backgroundColor: battleColors.light,
  },
  empty: { borderColor: battleColors.secondaryLine },
});
// Stryker restore all
