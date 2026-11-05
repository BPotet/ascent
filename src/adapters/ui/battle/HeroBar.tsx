import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { HeroState } from '../../../domain/battle/Battle';
import type { HeroKind } from '../../../domain/battle/combatants';
import { MOMENTUM_MAX } from '../../../domain/battle/momentum';
import { SECOND_CHANCE_FREEZE_MS, SECOND_CHANCE_MS } from '../../../domain/battle/secondChance';
import {
  HERO_NAMES,
  POWER_NAMES,
  bleedChipText,
  burnLabel,
  heroHpText,
  momentumLabel,
  secondChanceLabel,
} from '../format/battleText';
import { artPalette } from '../pixelArt/artPalette';
import { battleColors } from '../theme/battleColors';
import { BleedChip } from './BleedChip';
import { BulwarkChip } from './BulwarkChip';
import { BurnChip, type BurnRing } from './BurnChip';
import { SecondChanceChip } from './SecondChanceChip';
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

/** La barre se remplit d'or en 700 ms et 7 pas, après le gel (#206, S3). */
const RISE_FILL_MS = 700;
const RISE_FILL_STEPS = 7;

/**
 * La barre du héros pendant le relèvement de la seconde chance (#206, S2, S3) : vide pendant le
 * gel, puis remplie d'or jusqu'à ses PV, en pas ou d'un coup en mouvement réduit, jusqu'à la fin du
 * bandeau. Elle recouvre la barre ordinaire, qui montre déjà les PV du héros relevé.
 */
function RiseFill({
  ratio,
  reducedMotion,
}: {
  readonly ratio: number;
  readonly reducedMotion: boolean;
}) {
  // Les PV et le mouvement du relèvement, figés au montage : une perte de PV ou un Répit plus tard
  // dans le combat ne rejoue jamais la barre d'or (une nouvelle clé la remonte).
  const [target] = useState(ratio);
  const [still] = useState(reducedMotion);
  const cover = useSharedValue(1);
  const fill = useSharedValue(0);
  useEffect(() => {
    cover.set(
      withSequence(withTiming(1, { duration: SECOND_CHANCE_MS }), withTiming(0, { duration: 0 })),
    );
    fill.set(
      withDelay(
        SECOND_CHANCE_FREEZE_MS,
        withTiming(target, {
          duration: still ? 0 : RISE_FILL_MS,
          easing: Easing.steps(RISE_FILL_STEPS),
        }),
      ),
    );
  }, [cover, fill, target, still]);
  // Dépendances explicites : le code instrumenté par Stryker n'est plus reconnu comme worklet.
  const covering = useAnimatedStyle(() => {
    'worklet';
    return { opacity: cover.get() };
  }, [cover]);
  const filled = useAnimatedStyle(() => {
    'worklet';
    return { width: `${100 * fill.get()}%` };
  }, [fill]);
  return (
    <Animated.View testID="battle-hero-rise" style={[styles.riseCover, covering]}>
      <Animated.View testID="battle-hero-rise-gold" style={[styles.riseGold, filled]} />
    </Animated.View>
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
 * (`shadowStepNew`, #173). L'étiquette de la Brûlure est à droite de celle du Saignement, cerclée à
 * chaque prise ou extinction (`burnRing`, #171). La pastille de la seconde chance (#206) est prête
 * ou barrée ; pendant son relèvement (`rise`), la barre se vide puis se remplit d'or.
 */
export function HeroBar({
  hero,
  kind = 'sentinel',
  bulwarkWorn = false,
  shadowStepNew = false,
  burnRing = null,
  rise = null,
  reducedMotion = false,
}: {
  readonly hero: HeroState;
  readonly kind?: HeroKind;
  readonly bulwarkWorn?: boolean;
  readonly shadowStepNew?: boolean;
  readonly burnRing?: BurnRing | null;
  /** Le relèvement de la seconde chance en cours (#206) ; une nouvelle clé le rejoue. */
  readonly rise?: { readonly key: number } | null;
  readonly reducedMotion?: boolean;
}) {
  const ratio = hero.hp / hero.maxHp;
  const name = HERO_NAMES[kind];
  const active = [
    ...(hero.bulwark ? [POWER_NAMES.bulwark] : []),
    ...(hero.bleed ? [bleedChipText(hero.bleed.rounds)] : []),
    ...(hero.burn === undefined ? [] : [burnLabel(hero.burn)]),
    ...(hero.shadowStep === true ? [POWER_NAMES.shadowStep] : []),
    ...(hero.secondChance === undefined ? [] : [secondChanceLabel(hero.secondChance)]),
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
          {rise === null ? null : (
            <RiseFill key={rise.key} ratio={ratio} reducedMotion={reducedMotion} />
          )}
        </View>
        <Text style={styles.hpText}>{heroHpText(hero.hp, hero.maxHp)}</Text>
      </View>
      {hero.bulwark || bulwarkWorn ? <BulwarkChip worn={!hero.bulwark} /> : null}
      {hero.bleed || hero.burn !== undefined ? (
        <View testID="battle-hero-ailments" style={styles.ailments}>
          {hero.bleed ? <BleedChip rounds={hero.bleed.rounds} /> : null}
          {hero.burn === undefined ? null : <BurnChip stacks={hero.burn} ring={burnRing} />}
        </View>
      ) : null}
      {hero.shadowStep === true ? <ShadowStepChip fresh={shadowStepNew} /> : null}
      {hero.secondChance === undefined ? null : (
        <SecondChanceChip used={hero.secondChance === 'used'} />
      )}
      <MomentumDiamonds momentum={hero.momentum} reducedMotion={reducedMotion} />
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  ailments: { flexDirection: 'row', gap: 6 },
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
  riseCover: { ...StyleSheet.absoluteFill, backgroundColor: battleColors.hpTrack },
  riseGold: { height: '100%', borderRadius: 4, backgroundColor: artPalette.roles.gold },
});
// Stryker restore all
