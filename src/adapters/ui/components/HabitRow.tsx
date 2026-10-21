import { useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import type { HabitDay } from '../../../domain/checkIn/HabitDay';
import { checkInStatusLabels } from '../format/checkInStatus';
import { capitalize, formatDayAndMonth } from '../format/formatDay';
import { useReducedMotion } from '../state/useReducedMotion';
import { colors } from '../theme/colors';
import { MIN_TOUCH_SIZE, radii, spacing } from '../theme/metrics';
import { typography } from '../theme/typography';
import type { ShownXpChange } from './CharacterBar';
import { CheckGlyph } from './Glyph';
import { XpFloat } from './XpFloat';

/** Durée du rebond de la coche quand on touche une habitude, comme dans la maquette. */
export const BOUNCE_DURATION_MS = 320;

/** Le rebond : la coche (ou la case) grossit puis revient, sur `BOUNCE_DURATION_MS` au total. */
export function bounce(scale: Animated.Value): void {
  const grow = Math.round(BOUNCE_DURATION_MS * 0.4);
  Animated.sequence([
    Animated.timing(scale, { toValue: 1.18, duration: grow, useNativeDriver: true }),
    Animated.timing(scale, {
      toValue: 1,
      duration: BOUNCE_DURATION_MS - grow,
      useNativeDriver: true,
    }),
  ]).start();
}

/**
 * Ligne d'une habitude dans la Vue Journée : son nom et l'état du suivi, écrit en toutes lettres,
 * avec une coche quand elle est « fait ». Toute la ligne est un interrupteur : la toucher appelle
 * `onToggle`, si la case est modifiable, et fait rebondir la coche (sauf mouvement réduit).
 * `highlighted` met en évidence une habitude qui vient d'être créée. `xpChange` fait s'envoler
 * « +10 XP » (ou « −10 XP ») de la coche, après un tap enregistré.
 */
export function HabitRow({
  habitDay,
  highlighted = false,
  xpChange,
  onToggle,
}: {
  readonly habitDay: HabitDay;
  readonly highlighted?: boolean;
  readonly xpChange?: ShownXpChange | undefined;
  readonly onToggle?: (habitDay: HabitDay) => void;
}) {
  const { habit, day, status, editable } = habitDay;
  const statusLabel = checkInStatusLabels[status];
  const done = status === 'done';
  const reducedMotion = useReducedMotion();
  const [scale] = useState(() => new Animated.Value(1));

  const press = () => {
    if (!reducedMotion) {
      bounce(scale);
    }
    onToggle?.(habitDay);
  };

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={`${habit.name.value}, ${formatDayAndMonth(day)}, ${statusLabel}`}
      accessibilityState={{ checked: done, disabled: !editable }}
      disabled={!editable}
      onPress={press}
      testID={`habit-row-${habit.id}`}
      style={[styles.row, done && styles.done, highlighted && styles.highlighted]}
    >
      <Animated.View style={[styles.check, done && styles.checkDone, { transform: [{ scale }] }]}>
        {done && <CheckGlyph color={colors.onDone} />}
        <XpFloat change={xpChange} reducedMotion={reducedMotion} />
      </Animated.View>
      <View style={styles.texts}>
        <Text style={[typography.habitName, styles.name]}>{habit.name.value}</Text>
        <Text style={[typography.label, styles.status, done && styles.statusDone]}>
          {capitalize(statusLabel)}
        </Text>
      </View>
    </Pressable>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 76,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: spacing.sm,
    marginBottom: 10,
    borderRadius: radii.row,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
  },
  done: { borderColor: colors.doneLine, backgroundColor: colors.doneSoft },
  highlighted: {
    borderColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  check: {
    width: MIN_TOUCH_SIZE,
    height: MIN_TOUCH_SIZE,
    borderRadius: MIN_TOUCH_SIZE / 2,
    borderWidth: 2.5,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: { backgroundColor: colors.done, borderColor: colors.done },
  texts: { flex: 1, gap: 2 },
  name: { color: colors.text },
  status: { color: colors.muted },
  statusDone: { color: colors.doneText },
});
// Stryker restore all
