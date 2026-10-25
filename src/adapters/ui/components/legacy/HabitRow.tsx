import { useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import type { HabitDay } from '../../../../domain/checkIn/HabitDay';
import type { Difficulty } from '../../../../domain/habit/Difficulty';
import { checkInStatusLabels, CORRECTED } from '../../format/checkInStatus';
import { capitalize } from '../../format/formatDay';
import { type WeeklyProgressShown, weeklyProgressText } from '../../format/formatWeeklyTarget';
import { editHabitLabel, habitDayAccessibilityLabel } from '../../format/habitDayLabel';
import { useReducedMotion } from '../../state/useReducedMotion';
import type { ShownXpChange } from '../../state/xpFeedback';
import { colors } from '../../theme/colors';
import { MIN_TOUCH_SIZE, radii, spacing } from '../../theme/metrics';
import { typography } from '../../theme/typography';
import { bounce } from '../bounce';
import { CheckGlyph, CrossGlyph, MoreGlyph } from '../Glyph';
import { CorrectedMark } from '../CorrectedMark';
import { DifficultyLabel } from './DifficultyIcon';
import { TargetReachedBadge } from './TargetReachedBadge';
import { XpFloat } from './XpFloat';

/**
 * Ligne d'une habitude dans la Vue Journée : son nom et l'état du suivi, écrit en toutes lettres,
 * avec une coche quand elle est « fait ». Toute la ligne est un interrupteur : la toucher appelle
 * `onToggle`, si la case est modifiable, et fait rebondir la coche (sauf mouvement réduit).
 * `highlighted` met en évidence une habitude qui vient d'être créée ou modifiée. `xpChange` fait
 * s'envoler le changement d'expérience (« +20 XP », ou « −20 XP ») de la coche, après un tap
 * enregistré.
 *
 * Avec `difficulty` (Vue Journée, E1), la ligne secondaire commence par l'icône et le nom de la
 * difficulté de la semaine (« ▲▲▲ Difficile · À faire ») ; le lecteur d'écran l'entend après l'état,
 * avec ce que rapporte une case « fait » : « …, à faire, Difficile, 20 XP par suivi ».
 *
 * Avec `weeklyProgress` (Vue Journée, #24, E1), l'état est suivi de la progression de la semaine :
 * « ▲▲▲ Difficile · À faire · 2/3 cette semaine », « Fait · 3/3 cette semaine » à l'objectif tout
 * juste atteint, et « Fait · 4 fois cette semaine » au-delà (maquette E1, décision PM du 22 octobre
 * 2026) ; elle passe à la ligne en grand texte.
 * L'objectif atteint ajoute dessous le badge « Objectif atteint » (drapeau, texte et liseré verts,
 * `TargetReachedBadge`), avec un éclat doré quand il vient d'être atteint (`targetFlash`, F1, #26) ;
 * la ligne reste tapable. Rien ne marque un objectif non atteint. Le lecteur d'écran entend la
 * progression après l'état, puis la difficulté, puis « objectif atteint » :
 * « Courir 5 km, …, à faire, 2 sur 3 cette semaine, Difficile, 20 XP par suivi ».
 *
 * Dans le détail d'un jour de la Vue Mois (`compact`, ligne plus basse), la ligne montre aussi
 * « pas fait » (croix sur fond plein) et la marque « corrigé » (pastille sur la coche et mot écrit,
 * lu par le lecteur d'écran), comme la maquette (E5, E6). La progression y est celle de la semaine
 * du jour, que `weekLabel` nomme (#27) : « Fait · 2/3 semaine du 12 octobre » ; par défaut, « cette
 * semaine ».
 *
 * Avec `onEdit`, un bouton « ⋯ » à droite de la ligne ouvre « Modifier l'habitude » : c'est une
 * cible distincte de l'interrupteur (44 pt au moins), lue « Modifier l'habitude Cuisiner ».
 */
export function HabitRow({
  habitDay,
  difficulty,
  weeklyProgress,
  weekLabel,
  highlighted = false,
  xpChange,
  targetFlash,
  onToggle,
  onEdit,
  compact = false,
}: {
  readonly habitDay: HabitDay;
  /** La difficulté de la semaine du jour affiché ; sans elle, la ligne n'en montre pas. */
  readonly difficulty?: Difficulty | undefined;
  /** La progression de la semaine en cours ; sans elle, la ligne n'en montre pas. */
  readonly weeklyProgress?: WeeklyProgressShown | undefined;
  /** La semaine de la progression (« semaine du 12 octobre ») ; par défaut, « cette semaine ». */
  readonly weekLabel?: string | undefined;
  readonly highlighted?: boolean;
  readonly compact?: boolean;
  readonly xpChange?: ShownXpChange | undefined;
  /** Change quand l'objectif de la semaine vient d'être atteint ici : l'éclat du badge (F1, #26). */
  readonly targetFlash?: number | undefined;
  readonly onToggle?: (habitDay: HabitDay) => void;
  readonly onEdit?: (habitDay: HabitDay) => void;
}) {
  const { habit, status, editable, corrected } = habitDay;
  const statusLabel = checkInStatusLabels[status];
  const done = status === 'done';
  const missed = status === 'missed';
  const reached = weeklyProgress?.targetReached === true;
  const label = habitDayAccessibilityLabel({ habitDay, difficulty, weeklyProgress, weekLabel });
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
            {difficulty && (
              <>
                <DifficultyLabel
                  difficulty={difficulty}
                  color={done ? colors.doneText : colors.muted}
                  iconColor={done ? colors.doneText : colors.difficulty}
                  testID={`habit-difficulty-${habit.id}`}
                />
                <Text style={[typography.label, styles.status, done && styles.statusDone]}>·</Text>
              </>
            )}
            <Text
              {...(weeklyProgress && { testID: `habit-progress-${habit.id}` })}
              style={[typography.label, styles.status, done && styles.statusDone, styles.progress]}
            >
              {weeklyProgress
                ? `${capitalize(statusLabel)} · ${weeklyProgressText(weeklyProgress, weekLabel)}`
                : capitalize(statusLabel)}
            </Text>
            {corrected && (
              <View style={styles.correctedText}>
                <View style={styles.correctedDot} />
                <Text style={[typography.label, styles.corrected]}>{CORRECTED}</Text>
              </View>
            )}
          </View>
          {reached && (
            <TargetReachedBadge flash={targetFlash} testID={`habit-target-reached-${habit.id}`} />
          )}
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
  statusLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  status: { color: colors.muted },
  correctedText: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  correctedDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.correctedMark },
  corrected: { color: colors.correctedMark },
  statusDone: { color: colors.doneText },
  progress: { flexShrink: 1 },
});
// Stryker restore all
