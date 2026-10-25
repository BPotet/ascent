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
import { editHabitLabel } from '../format/habitDayLabel';
import { artPalette } from '../pixelArt/artPalette';
import { artPixelSize, notchedCorners } from '../pixelArt/artPixel';
import { HabitDayBox } from '../pixelArt/HabitDayBox';
import { MIN_TARGET_SIZE } from '../pixelArt/PixelButton';
import { type FrameTone, PixelFrame } from '../pixelArt/PixelFrame';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { pixelTypography, textFont } from '../pixelArt/pixelTypography';
import { WeekNotches } from '../pixelArt/WeekNotches';
import { type XpChange, xpChangeOn } from '../state/Experience';
import { useWeekColumnWidth, WEEK_CARD_CHROME } from './cellSize';
import { CorrectedMark } from './CorrectedMark';
import { DifficultyLabel } from './DifficultyIcon';
import { HabitDayCell } from './HabitDayCell';
import { LIGHTING_STEPS, useTargetLighting } from './useTargetLighting';

const { roles } = artPalette;

/** Le pixel d'art, arrondi au pixel physique du téléphone. */
const LINE = artPixelSize(2);

/** Cache un élément décoratif au lecteur d'écran (Android et iOS). */
const decorative = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

/**
 * Les jours de la semaine au-dessus des cartes : l'initiale et le numéro, alignés sur les colonnes
 * des cases (`useWeekColumnWidth`) ; le numéro d'aujourd'hui est sur une plaque d'or crantée.
 * Décoratif : chaque case dit son jour au lecteur d'écran.
 */
export function WeekDaysHeader({
  days,
  today,
}: {
  readonly days: readonly Day[];
  readonly today: Day;
}) {
  const column = useWeekColumnWidth(WEEK_CARD_CHROME);
  return (
    <View {...decorative} testID="week-days-header" style={styles.daysHeader}>
      {days.map((day, index) => {
        const isToday = day.equals(today);
        const iso = day.toIsoString();
        return (
          <View
            key={iso}
            testID={`weekday-column-${iso}`}
            style={[styles.weekday, { width: column }]}
          >
            <Text style={[styles.initial, isToday && styles.initialToday]}>
              {WEEKDAY_INITIALS[index]}
            </Text>
            <View testID={`weekday-${iso}`} style={[styles.number, isToday && styles.numberToday]}>
              <Text style={[styles.numberText, isToday && styles.numberTextToday]}>
                {day.dayOfMonth}
              </Text>
              {isToday &&
                notchedCorners(LINE).map((corner, place) => (
                  <View key={place} style={[styles.corner, corner]} />
                ))}
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
 * La puce de progression (`ProgressChip`), à droite du nom : avant l'objectif, les crans de la
 * semaine puis « 2/3 », gris pour une semaine passée non atteinte ; à l'objectif atteint, le drapeau
 * et « 3/3 · Objectif atteint », en or. Jamais de rouge ni de croix. Lue « 3 sur 3, objectif
 * atteint ». Quand l'objectif vient d'être atteint (`flash`), elle s'allume en 3 paliers.
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
  const { step, lighting } = useTargetLighting(targetReached ? flash : undefined);
  const chip = (
    <PixelFrame
      accessible
      accessibilityRole="image"
      accessibilityLabel={progressChipAccessibilityLabel(shown)}
      variant="inset"
      tone={targetReached ? 'goldDark' : 'default'}
      under={roles.surface}
      {...(targetReached && { background: roles.goldBg })}
      testID={`week-progress-${habit.id}`}
      style={[styles.chip, targetReached && { borderColor: LIGHTING_STEPS[step] }]}
    >
      {targetReached ? (
        <PixelIcon
          name="flag8"
          color={roles.gold}
          secondColor={roles.parchment}
          testID="flag-icon"
        />
      ) : (
        <WeekNotches done={weeklyProgress} target={weekTarget} reached={false} />
      )}
      <Text
        style={[
          styles.chipText,
          targetReached && styles.chipTextReached,
          !targetReached && !currentWeek && styles.chipTextPast,
        ]}
      >
        {progressChipText(shown)}
      </Text>
    </PixelFrame>
  );
  return lighting ? (
    <View pointerEvents="none" testID="target-burst">
      {chip}
    </View>
  ) : (
    chip
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
    <Text testID={`week-target-${habit.id}`} style={[pixelTypography.label, styles.target]}>
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

/** Le trait d'une carte : or si elle est mise en évidence, or sombre à l'objectif atteint. */
function toneOf(highlighted: boolean, reached: boolean): FrameTone {
  if (highlighted) {
    return 'gold';
  }
  return reached ? 'goldDark' : 'default';
}

/**
 * La carte d'une habitude dans la Vue Semaine, dans l'identité pixel art (E4) : un cadre cranté
 * avec son nom et ses 7 cases, du lundi au dimanche, alignées sur l'en-tête des jours.
 * `onNotStartedPress` reçoit le tap sur une case « hors habitude », pour l'expliquer.
 * `xpChange`, le dernier changement d'expérience, s'envole de la case touchée si elle est ici.
 * Avec `onEdit`, le nom, suivi d'un crayon, est un bouton qui ouvre « Modifier l'habitude » (lu
 * « Modifier l'habitude Cuisiner »). `highlighted` borde d'or une habitude qui vient d'être
 * modifiée. Avec `difficulty`, la difficulté de la semaine affichée est écrite sous le nom, avec ses
 * sommets (« Difficile »), et lue avec son barème.
 * Avec `target` (#24), une semaine qui a un objectif montre la puce de progression à droite du nom,
 * et l'objectif après la difficulté (« · 3 fois par semaine », celui qui vaudra lundi prochain, et
 * l'objectif réduit de la semaine de création) ; l'objectif atteint borde la carte d'or sombre.
 * Quand il vient d'être atteint (`targetFlash`, F1, #26), la puce s'allume en 3 paliers.
 * Les repères `week-card-reached-…` et `week-card-highlight-…` sont posés sur la carte, sans fond et
 * sans toucher : ils ne décalent pas les cases.
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
  /** Change quand l'objectif de la semaine vient d'être atteint ici : l'allumage de la puce (F1). */
  readonly targetFlash?: number | undefined;
}) {
  const column = useWeekColumnWidth(WEEK_CARD_CHROME);
  const habit = days[0]?.habit;
  if (habit === undefined) {
    return null;
  }
  const shownTarget = withTarget(target);
  const reached = shownTarget?.targetReached === true;
  return (
    <PixelFrame
      tone={toneOf(highlighted, reached)}
      testID={`week-card-${habit.id}`}
      style={styles.card}
    >
      {reached && (
        <View pointerEvents="none" testID={`week-card-reached-${habit.id}`} style={styles.marker} />
      )}
      {highlighted && (
        <View
          pointerEvents="none"
          testID={`week-card-highlight-${habit.id}`}
          style={styles.marker}
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
            <Text style={[pixelTypography.habitName, styles.nameText]}>{habit.name.value}</Text>
            <PixelIcon
              name="pencil"
              color={roles.muted}
              secondColor={roles.gold}
              testID="pencil-icon"
            />
          </Pressable>
        ) : (
          <Text style={[pixelTypography.habitName, styles.name]}>{habit.name.value}</Text>
        )}
        {shownTarget && <ProgressChip habit={habit} target={shownTarget} flash={targetFlash} />}
      </View>
      {difficulty && (
        <View style={styles.settings}>
          <DifficultyLabel difficulty={difficulty} testID={`week-difficulty-${habit.id}`} />
          {shownTarget && <TargetLine habit={habit} target={shownTarget} />}
        </View>
      )}
      <View testID="week-cells" style={styles.cells}>
        {days.map((habitDay) => (
          <HabitDayCell
            key={habitDay.day.toIsoString()}
            habitDay={habitDay}
            today={today}
            columnWidth={column}
            xpChange={xpChangeOn(xpChange, habitDay)}
            onToggle={onToggle}
            {...(onNotStartedPress && { onNotStartedPress })}
          />
        ))}
      </View>
    </PixelFrame>
  );
}

const LEGEND: readonly CheckInStatus[] = ['done', 'pending', 'missed', 'upcoming', 'notStarted'];

/**
 * La légende des cinq états et de la marque « corrigé », sous les cartes, avec des cases de 24 dp.
 * Décorative : chaque case dit son état au lecteur d'écran.
 */
export function WeekLegend() {
  return (
    <View {...decorative} style={styles.legend}>
      {LEGEND.map((status) => (
        <View key={status} style={styles.legendItem}>
          <HabitDayBox status={status} size={24} under={roles.night} testID="legend-box" />
          <Text style={styles.legendText}>{capitalize(checkInStatusLabels[status])}</Text>
        </View>
      ))}
      <View style={styles.legendItem}>
        <View>
          <HabitDayBox status="done" size={24} under={roles.night} testID="legend-box" />
          <CorrectedMark size="legend" />
        </View>
        <Text style={styles.legendText}>{capitalize(CORRECTED)}</Text>
      </View>
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  daysHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  weekday: { alignItems: 'center', gap: 2 },
  initial: { fontFamily: textFont.semiBold, fontSize: 12, lineHeight: 15, color: roles.muted },
  initialToday: { color: roles.gold },
  number: { paddingHorizontal: 6, paddingVertical: 1 },
  numberToday: { backgroundColor: roles.gold },
  numberText: {
    fontFamily: textFont.bold,
    fontSize: 15,
    lineHeight: 19,
    color: roles.parchment,
    textAlign: 'center',
  },
  numberTextToday: { color: roles.ink },
  corner: { position: 'absolute', backgroundColor: roles.night },
  card: { paddingTop: 8, paddingBottom: 8, paddingHorizontal: 2, gap: 4 },
  marker: { ...StyleSheet.absoluteFill },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 6 },
  name: { flex: 1, minHeight: MIN_TARGET_SIZE, paddingVertical: 13, color: roles.light },
  nameButton: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: MIN_TARGET_SIZE,
  },
  nameText: { flexShrink: 1, color: roles.light },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  chipText: {
    fontFamily: textFont.bold,
    fontSize: 13,
    lineHeight: 16,
    fontVariant: ['tabular-nums'],
    color: roles.light,
  },
  chipTextReached: { color: roles.gold },
  chipTextPast: { color: roles.muted },
  target: { flexShrink: 1, color: roles.parchment },
  nextTarget: { color: roles.blue },
  settings: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 6,
    paddingHorizontal: 6,
  },
  cells: { flexDirection: 'row', justifyContent: 'center' },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 14,
    rowGap: 8,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontFamily: textFont.medium, fontSize: 12, lineHeight: 15, color: roles.parchment },
});
// Stryker restore all
