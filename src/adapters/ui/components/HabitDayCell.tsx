import { useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import type { CheckInStatus } from '../../../domain/checkIn/CheckInStatus';
import type { HabitDay } from '../../../domain/checkIn/HabitDay';
import type { Day } from '../../../domain/day/Day';
import { checkInStatusLabels } from '../format/checkInStatus';
import { formatDayAndMonth } from '../format/formatDay';
import { useReducedMotion } from '../state/useReducedMotion';
import { colors } from '../theme/colors';
import { MIN_TOUCH_SIZE } from '../theme/metrics';
import { CheckGlyph, CrossGlyph, DotGlyph } from './Glyph';
import { bounce } from './HabitRow';

/** Ce qu'une case de la Vue Semaine lit au lecteur d'écran quand un tap ne la change pas. */
export const UNAVAILABLE = 'indisponible';

/**
 * La forme de chaque état, jamais la couleur seule (maquette, « Accessibilité ») : coche (fait),
 * contour plein (à faire), croix sur fond plein (pas fait), pointillés (à venir), point seul (hors
 * habitude).
 */
function Mark({ status }: { readonly status: CheckInStatus }) {
  switch (status) {
    case 'done':
      return <CheckGlyph color={colors.onDone} />;
    case 'missed':
      return <CrossGlyph color={colors.onMissed} />;
    case 'notStarted':
      return <DotGlyph color={colors.notStarted} />;
    case 'pending':
      return <View testID="pending-ring" style={styles.pendingRing} />;
    default:
      return null;
  }
}

/**
 * Case d'une habitude un jour donné dans la Vue Semaine. C'est un interrupteur : le toucher appelle
 * `onToggle` et fait rebondir la case (sauf mouvement réduit), seulement si la case est modifiable.
 * Le lecteur d'écran lit « Cuisiner, mercredi 14 octobre, pas fait », suivi de « indisponible »
 * quand un tap ne la change pas. Un « fait » gardé sur un jour après `today` (horloge reculée, R7)
 * est atténué.
 */
export function HabitDayCell({
  habitDay,
  today,
  onToggle,
}: {
  readonly habitDay: HabitDay;
  readonly today: Day;
  readonly onToggle?: (habitDay: HabitDay) => void;
}) {
  const { habit, day, status, editable } = habitDay;
  const reducedMotion = useReducedMotion();
  const [scale] = useState(() => new Animated.Value(1));
  const label = [habit.name.value, formatDayAndMonth(day), checkInStatusLabels[status]]
    .concat(editable ? [] : [UNAVAILABLE])
    .join(', ');

  const press = () => {
    if (!reducedMotion) {
      bounce(scale);
    }
    onToggle?.(habitDay);
  };

  return (
    <Animated.View style={[styles.slot, { transform: [{ scale }] }]}>
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityState={{ checked: status === 'done', disabled: !editable }}
        disabled={!editable}
        onPress={press}
        testID={`cell-${habit.id}-${day.toIsoString()}`}
        style={[
          styles.cell,
          styles[status],
          status === 'done' && day.isAfter(today) && styles.dimmed,
        ]}
      >
        <Mark status={status} />
      </Pressable>
    </Animated.View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  slot: { flex: 1 },
  cell: {
    aspectRatio: 1,
    minHeight: MIN_TOUCH_SIZE,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  done: { backgroundColor: colors.done, borderColor: colors.done },
  pending: { borderColor: colors.accent },
  pendingRing: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.pendingRing,
  },
  missed: { backgroundColor: colors.missed, borderColor: 'transparent' },
  upcoming: { borderStyle: 'dashed', borderColor: colors.upcoming },
  notStarted: { borderColor: 'transparent' },
  dimmed: { opacity: 0.6 },
});
// Stryker restore all
