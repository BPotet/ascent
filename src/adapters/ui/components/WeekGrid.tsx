import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CheckInStatus } from '../../../domain/checkIn/CheckInStatus';
import type { HabitDay } from '../../../domain/checkIn/HabitDay';
import type { Day } from '../../../domain/day/Day';
import type { Difficulty } from '../../../domain/habit/Difficulty';
import type { Habit } from '../../../domain/habit/Habit';
import type { WeeklyTarget } from '../../../domain/habit/WeeklyTarget';
import { checkInStatusLabels, CORRECTED } from '../format/checkInStatus';
import { capitalize } from '../format/formatDay';
import { WEEKDAY_INITIALS } from '../format/formatWeek';
import {
  nextWeeklyTargetText,
  progressChipAccessibilityLabel,
  progressChipText,
  weekCardTargetText,
} from '../format/formatWeeklyTarget';
import { type XpChange, xpChangeOn } from '../state/Experience';
import { colors } from '../theme/colors';
import { radii, spacing } from '../theme/metrics';
import { typography } from '../theme/typography';
import { CheckGlyph, CrossGlyph, DotGlyph, PencilGlyph, SmallCheckGlyph } from './Glyph';
import { editHabitLabel } from '../format/habitDayLabel';
import { CorrectedMark } from './CorrectedMark';
import { DifficultyLabel } from './legacy/DifficultyIcon';
import { HabitDayCell } from './HabitDayCell';
import { TargetBurst } from './legacy/TargetReachedBadge';

/** Cache un élément décoratif au lecteur d'écran (Android et iOS). */
const decorative = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

/**
 * Les jours de la semaine au-dessus des cartes : initiale et numéro, aujourd'hui mis en évidence.
 * Décoratif : chaque case dit son jour au lecteur d'écran.
 */
export function WeekDaysHeader({
  days,
  today,
}: {
  readonly days: readonly Day[];
  readonly today: Day;
}) {
  return (
    <View {...decorative} testID="week-days-header" style={styles.daysHeader}>
      {days.map((day, index) => {
        const isToday = day.equals(today);
        return (
          <View key={day.toIsoString()} style={styles.weekday}>
            <Text style={[typography.small, styles.initial, isToday && styles.initialToday]}>
              {WEEKDAY_INITIALS[index]}
            </Text>
            <View
              testID={`weekday-${day.toIsoString()}`}
              style={[styles.number, isToday && styles.numberToday]}
            >
              <Text
                style={[typography.label, styles.numberText, isToday && styles.numberTextToday]}
              >
                {day.dayOfMonth}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** L'objectif et la progression d'une habitude pendant la semaine affichée (E4, #24). */
export interface WeekCardTarget {
  /** L'objectif hebdomadaire de la semaine, `null` pour une semaine d'avant la mise à jour. */
  readonly weeklyTarget: WeeklyTarget | null;
  /** L'objectif de la semaine, `null` sans objectif : pas de puce. */
  readonly weekTarget: number | null;
  readonly weeklyProgress: number;
  readonly targetReached: boolean;
  /** L'objectif des semaines suivantes, dans la semaine en cours seulement. */
  readonly nextWeeklyTarget: WeeklyTarget | null;
  /** Vrai pour la semaine en cours : sa puce non atteinte reste neutre, grise ensuite. */
  readonly currentWeek: boolean;
}

/**
 * La puce de progression, à droite du nom : neutre « 2/5 » pendant la semaine, grise pour une
 * semaine passée non atteinte, verte avec une coche « 3/3 · Objectif atteint ». Jamais de rouge ni
 * de croix. Lue « 3 sur 3, objectif atteint ».
 */
function ProgressChip({
  habit,
  target: { weekTarget, weeklyProgress, targetReached, currentWeek },
  flash,
}: {
  readonly habit: Habit;
  readonly target: WeekCardTarget & { readonly weekTarget: number };
  readonly flash: number | undefined;
}) {
  const shown = { weeklyProgress, weekTarget, targetReached };
  return (
    <TargetBurst flash={targetReached ? flash : undefined}>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={progressChipAccessibilityLabel(shown)}
        testID={`week-progress-${habit.id}`}
        style={[styles.chip, targetReached && styles.chipReached]}
      >
        {targetReached && <SmallCheckGlyph color={colors.doneText} />}
        <Text
          style={[
            styles.chipText,
            targetReached && styles.chipTextReached,
            !targetReached && !currentWeek && styles.chipTextPast,
          ]}
        >
          {progressChipText(shown)}
        </Text>
      </View>
    </TargetBurst>
  );
}

/** L'objectif sous le nom, après la difficulté : « · 3 fois par semaine », et celui de lundi prochain. */
function TargetLine({
  habit,
  target: { weeklyTarget, weekTarget, nextWeeklyTarget, currentWeek },
}: {
  readonly habit: Habit;
  readonly target: WeekCardTarget & {
    readonly weeklyTarget: WeeklyTarget;
    readonly weekTarget: number;
  };
}) {
  const next = nextWeeklyTarget !== null && nextWeeklyTarget !== weeklyTarget;
  return (
    <Text testID={`week-target-${habit.id}`} style={[typography.label, styles.target]}>
      {`· ${weekCardTargetText({ weeklyTarget, weekTarget, currentWeek, createdOn: habit.createdOn })}`}
      {next && (
        <>
          {' · '}
          <Text style={styles.nextTarget}>{nextWeeklyTargetText(nextWeeklyTarget)}</Text>
        </>
      )}
    </Text>
  );
}

/** L'objectif d'une semaine qui en a un. */
function withTarget(
  target: WeekCardTarget | undefined,
): (WeekCardTarget & { readonly weeklyTarget: WeeklyTarget; readonly weekTarget: number }) | null {
  return target !== undefined && target.weeklyTarget !== null && target.weekTarget !== null
    ? { ...target, weeklyTarget: target.weeklyTarget, weekTarget: target.weekTarget }
    : null;
}

/**
 * La carte d'une habitude dans la Vue Semaine : son nom et ses 7 cases, du lundi au dimanche.
 * `onNotStartedPress` reçoit le tap sur une case « hors habitude », pour l'expliquer.
 * `xpChange`, le dernier changement d'expérience, s'envole de la case touchée si elle est ici.
 * Avec `onEdit`, le nom, suivi d'un crayon, est un bouton qui ouvre « Modifier l'habitude » (lu
 * « Modifier l'habitude Cuisiner »). `highlighted` met en évidence une habitude qui vient d'être
 * modifiée. Avec `difficulty`, la difficulté de la semaine affichée est écrite sous le nom, avec son
 * icône (« ▲▲▲ Difficile »), et lue avec son barème.
 * Avec `target` (#24), une semaine qui a un objectif montre la puce de progression à droite du nom,
 * et l'objectif après la difficulté (« · 3 fois par semaine », celui qui vaudra lundi prochain, et
 * l'objectif réduit de la semaine de création) ; l'objectif atteint borde la carte de vert. Quand il
 * vient d'être atteint (`targetFlash`, F1, #26), la puce s'éclaire d'un éclat doré.
 */
export function HabitWeekCard({
  days,
  today,
  difficulty,
  target,
  xpChange = null,
  onToggle,
  onNotStartedPress,
  onEdit,
  highlighted = false,
  targetFlash,
}: {
  readonly days: readonly HabitDay[];
  readonly today: Day;
  /** La difficulté de l'habitude pendant la semaine affichée. */
  readonly difficulty?: Difficulty | undefined;
  /** L'objectif et la progression de la semaine affichée. */
  readonly target?: WeekCardTarget | undefined;
  readonly xpChange?: XpChange | null;
  readonly onToggle: (habitDay: HabitDay) => void;
  readonly onNotStartedPress?: (habitDay: HabitDay) => void;
  readonly onEdit?: (habit: Habit) => void;
  readonly highlighted?: boolean;
  /** Change quand l'objectif de la semaine vient d'être atteint ici : l'éclat de la puce (F1, #26). */
  readonly targetFlash?: number | undefined;
}) {
  const habit = days[0]?.habit;
  if (habit === undefined) {
    return null;
  }
  const shownTarget = withTarget(target);
  return (
    <View testID={`week-card-${habit.id}`} style={styles.card}>
      {shownTarget?.targetReached === true && (
        <View
          pointerEvents="none"
          testID={`week-card-reached-${habit.id}`}
          style={styles.reached}
        />
      )}
      {highlighted && (
        // Un contour posé par-dessus la carte : il ne décale pas les cases, alignées sur l'en-tête.
        <View
          pointerEvents="none"
          testID={`week-card-highlight-${habit.id}`}
          style={styles.highlighted}
        />
      )}
      <View style={styles.nameRow}>
        {onEdit ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={editHabitLabel(habit.name.value)}
            onPress={() => onEdit(habit)}
            testID={`edit-habit-${habit.id}`}
            style={styles.nameButton}
          >
            <Text style={[typography.cardTitle, styles.nameText]}>{habit.name.value}</Text>
            <PencilGlyph color={colors.muted} />
          </Pressable>
        ) : (
          <Text style={[typography.cardTitle, styles.name]}>{habit.name.value}</Text>
        )}
        {shownTarget && <ProgressChip habit={habit} target={shownTarget} flash={targetFlash} />}
      </View>
      {difficulty && (
        <View style={styles.settings}>
          <DifficultyLabel
            difficulty={difficulty}
            color={colors.muted}
            iconColor={colors.difficulty}
            testID={`week-difficulty-${habit.id}`}
          />
          {shownTarget && <TargetLine habit={habit} target={shownTarget} />}
        </View>
      )}
      <View testID="week-cells" style={styles.cells}>
        {days.map((habitDay) => (
          <HabitDayCell
            key={habitDay.day.toIsoString()}
            habitDay={habitDay}
            today={today}
            xpChange={xpChangeOn(xpChange, habitDay)}
            onToggle={onToggle}
            {...(onNotStartedPress && { onNotStartedPress })}
          />
        ))}
      </View>
    </View>
  );
}

const LEGEND: readonly CheckInStatus[] = ['done', 'pending', 'missed', 'upcoming', 'notStarted'];

function LegendMark({ status }: { readonly status: CheckInStatus }) {
  return (
    <View style={[styles.legendCell, legendStyles[status]]}>
      <View style={styles.legendGlyph}>
        {status === 'done' && <CheckGlyph color={colors.onDone} />}
        {status === 'missed' && <CrossGlyph color={colors.onMissed} />}
        {status === 'notStarted' && <DotGlyph color={colors.notStarted} />}
      </View>
    </View>
  );
}

/**
 * La légende des cinq formes et de la marque « corrigé », sous les cartes. Décorative : chaque case
 * dit son état au lecteur d'écran.
 */
export function WeekLegend() {
  return (
    <View {...decorative} style={styles.legend}>
      {LEGEND.map((status) => (
        <View key={status} style={styles.legendItem}>
          <LegendMark status={status} />
          <Text style={[typography.small, styles.legendText]}>
            {capitalize(checkInStatusLabels[status])}
          </Text>
        </View>
      ))}
      <View style={styles.legendItem}>
        <View>
          <LegendMark status="missed" />
          <CorrectedMark size="legend" />
        </View>
        <Text style={[typography.small, styles.legendText]}>{capitalize(CORRECTED)}</Text>
      </View>
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  daysHeader: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    marginHorizontal: spacing.lg,
    paddingHorizontal: 9,
  },
  weekday: { flex: 1, minWidth: 0, alignItems: 'center', gap: 2 },
  initial: { color: colors.muted, fontFamily: typography.cardTitle.fontFamily },
  initialToday: { color: colors.accent },
  number: {
    width: '100%',
    maxWidth: 30,
    height: 24,
    borderRadius: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberToday: { backgroundColor: colors.accent },
  numberText: { color: colors.text, fontFamily: typography.cardTitle.fontFamily },
  numberTextToday: { color: colors.onAccent },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingTop: spacing.xs,
    paddingHorizontal: 9,
    paddingBottom: 10,
    marginBottom: 10,
  },
  highlighted: {
    ...StyleSheet.absoluteFill,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  reached: {
    ...StyleSheet.absoluteFill,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.doneLine,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flex: 1, color: colors.text, minHeight: 44, paddingVertical: 12, paddingHorizontal: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceRaised,
  },
  chipReached: { borderColor: colors.doneLine, backgroundColor: colors.goalSoft },
  chipText: {
    fontFamily: typography.counter.fontFamily,
    fontSize: 13,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
    color: colors.text,
  },
  chipTextReached: { color: colors.doneText },
  chipTextPast: { color: colors.chipPast },
  target: { flexShrink: 1, color: colors.muted },
  nextTarget: { color: colors.correctedMark },
  nameButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    paddingVertical: spacing.xs,
    paddingHorizontal: 2,
  },
  nameText: { flex: 1, color: colors.text },
  settings: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 6,
    marginTop: -2,
    marginBottom: spacing.sm,
    marginHorizontal: 2,
  },
  cells: { flexDirection: 'row', gap: spacing.xs },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 14,
    rowGap: spacing.sm,
    marginTop: 14,
    marginHorizontal: 2,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendCell: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  legendGlyph: { transform: [{ scale: 0.6 }] },
  legendText: { color: colors.muted },
});

const legendStyles = StyleSheet.create({
  done: { backgroundColor: colors.done, borderColor: colors.done },
  pending: { borderColor: colors.accent },
  missed: { backgroundColor: colors.missed, borderColor: 'transparent' },
  upcoming: { borderStyle: 'dashed', borderColor: colors.upcoming },
  notStarted: { borderColor: 'transparent' },
});
// Stryker restore all
