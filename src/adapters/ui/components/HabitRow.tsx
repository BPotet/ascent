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
import { CheckGlyph, CrossGlyph, MoreGlyph } from './Glyph';
import { CORRECTED, CorrectedMark } from './CorrectedMark';
import { XpFloat } from './XpFloat';

/** Le libellé, pour le lecteur d'écran, de l'action qui ouvre « Modifier l'habitude ». */
export const editHabitLabel = (name: string) => `Modifier l’habitude ${name}`;

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
 * `highlighted` met en évidence une habitude qui vient d'être créée ou renommée. `xpChange` fait
 * s'envoler « +10 XP » (ou « −10 XP ») de la coche, après un tap enregistré.
 *
 * Dans le détail d'un jour de la Vue Mois (`compact`, ligne plus basse), la ligne montre aussi
 * « pas fait » (croix sur fond plein) et la marque « corrigé » (pastille sur la coche et mot écrit,
 * lu par le lecteur d'écran), comme la maquette (E5, E6).
 *
 * Avec `onEdit`, un bouton « ⋯ » à droite de la ligne ouvre « Modifier l'habitude » : c'est une
 * cible distincte de l'interrupteur (44 pt au moins), lue « Modifier l'habitude Cuisiner ».
 */
export function HabitRow({
  habitDay,
  highlighted = false,
  xpChange,
  onToggle,
  onEdit,
  compact = false,
}: {
  readonly habitDay: HabitDay;
  readonly highlighted?: boolean;
  readonly compact?: boolean;
  readonly xpChange?: ShownXpChange | undefined;
  readonly onToggle?: (habitDay: HabitDay) => void;
  readonly onEdit?: (habitDay: HabitDay) => void;
}) {
  const { habit, day, status, editable, corrected } = habitDay;
  const statusLabel = checkInStatusLabels[status];
  const done = status === 'done';
  const missed = status === 'missed';
  const label = [habit.name.value, formatDayAndMonth(day), statusLabel]
    .concat(corrected ? [CORRECTED] : [])
    .join(', ');
  const reducedMotion = useReducedMotion();
  const [scale] = useState(() => new Animated.Value(1));

  const press = () => {
    if (!reducedMotion) {
      bounce(scale);
    }
    onToggle?.(habitDay);
  };

  return (
    <View
      testID={`habit-card-${habit.id}`}
      style={[styles.card, done && styles.done, highlighted && styles.highlighted]}
    >
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityState={{ checked: done, disabled: !editable }}
        disabled={!editable}
        onPress={press}
        testID={`habit-row-${habit.id}`}
        style={[styles.row, compact && styles.rowCompact]}
      >
        <Animated.View
          testID={`habit-check-${habit.id}`}
          style={[
            styles.check,
            compact && styles.checkCompact,
            done && styles.checkDone,
            missed && styles.checkMissed,
            { transform: [{ scale }] },
          ]}
        >
          {done && <CheckGlyph color={colors.onDone} />}
          {missed && <CrossGlyph color={colors.onMissed} />}
          {corrected && <CorrectedMark size="row" />}
          <XpFloat change={xpChange} reducedMotion={reducedMotion} />
        </Animated.View>
        <View style={styles.texts}>
          <Text style={[typography.habitName, styles.name]}>{habit.name.value}</Text>
          <View style={styles.statusLine}>
            <Text style={[typography.label, styles.status, done && styles.statusDone]}>
              {capitalize(statusLabel)}
            </Text>
            {corrected && (
              <View style={styles.correctedText}>
                <View style={styles.correctedDot} />
                <Text style={[typography.label, styles.corrected]}>{CORRECTED}</Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
      {onEdit && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={editHabitLabel(habit.name.value)}
          onPress={() => onEdit(habitDay)}
          testID={`edit-habit-${habit.id}`}
          style={[styles.more, done && styles.moreDone]}
        >
          <MoreGlyph color={colors.muted} />
        </Pressable>
      )}
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    marginBottom: 10,
    borderRadius: radii.row,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
  },
  row: {
    flex: 1,
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: spacing.sm,
  },
  rowCompact: { minHeight: 64 },
  more: {
    width: 52,
    minHeight: MIN_TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: colors.line,
  },
  moreDone: { borderLeftColor: colors.doneDivider },
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
  checkCompact: { width: 40, height: 40, borderRadius: 20 },
  checkDone: { backgroundColor: colors.done, borderColor: colors.done },
  checkMissed: { backgroundColor: colors.missed, borderColor: 'transparent' },
  texts: { flex: 1, gap: 2 },
  name: { color: colors.text },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  status: { color: colors.muted },
  correctedText: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  correctedDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.correctedMark },
  corrected: { color: colors.correctedMark },
  statusDone: { color: colors.doneText },
});
// Stryker restore all
