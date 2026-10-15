import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { WeekView } from '../../../application/useCases/getWeekView';
import type { HabitDay } from '../../../domain/checkIn/HabitDay';
import type { Day } from '../../../domain/day/Day';
import { isClosedDay } from '../../../domain/day/DayClosing';
import { Week } from '../../../domain/week/Week';
import { ADD_HABIT_LABEL } from '../components/AddHabitButton';
import { Button } from '../components/Button';
import { useCellHeight } from '../components/cellSize';
import { PlusGlyph } from '../components/Glyph';
import { LinkButton } from '../components/LinkButton';
import { PeriodNavigator } from '../components/PeriodNavigator';
import { Screen } from '../components/Screen';
import { StateMessage } from '../components/StateMessage';
import { Toast, type ToastAction } from '../components/Toast';
import { HabitWeekCard, WeekDaysHeader, WeekLegend } from '../components/WeekGrid';
import {
  CHECK_IN_SAVE_FAILED,
  CORRECTION_SAVE_FAILED,
  correctedMessage,
  correctionMessage,
  notStartedMessage,
} from '../format/checkInMessages';
import { formatWeekRange, HISTORY_START, weekLabel, weekTitle } from '../format/formatWeek';
import { useWeekView } from '../state/useWeekView';
import { colors } from '../theme/colors';
import { radii, spacing } from '../theme/metrics';
import { typography } from '../theme/typography';

/** Le lien qui ramène à la semaine en cours (maquette, E4 « Semaine dernière »). */
export const BACK_TO_CURRENT_WEEK = 'Revenir à cette semaine';

/** Une semaine demandée par une autre vue ; chaque nouvel `id` l'affiche de nouveau. */
export interface WeekRequest {
  readonly week: Week;
  readonly id: string | number;
}

/** L'astuce sous la légende : tout jour passé se corrige (maquette, E4 et E5). */
export const CORRECTION_HINT = 'Tape une case d’un jour passé pour corriger un oubli.';

interface ToastContent {
  readonly id: number;
  readonly message: string;
  readonly action?: ToastAction;
}

/** Une case du squelette, de la même taille qu'une vraie case (`useCellHeight`). */
function SkeletonCell() {
  const { height, onLayout } = useCellHeight();
  return (
    <View onLayout={onLayout} testID="skeleton-cell" style={styles.skeletonSlot}>
      <View style={[styles.skeleton, styles.skeletonCell, { height }]} />
    </View>
  );
}

function LoadingView() {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Chargement de tes habitudes"
      accessibilityState={{ busy: true }}
      testID="week-view-loading"
      style={styles.loading}
    >
      <View style={styles.skeletonNav}>
        <View style={[styles.skeleton, styles.skeletonArrow]} />
        <View style={[styles.skeleton, styles.skeletonTitle]} />
        <View style={[styles.skeleton, styles.skeletonArrow]} />
      </View>
      {[0, 1, 2, 3].map((card) => (
        <View key={card} style={styles.skeletonCard}>
          <View style={[styles.skeleton, styles.skeletonName]} />
          <View style={styles.skeletonCells}>
            {[0, 1, 2, 3, 4, 5, 6].map((cell) => (
              <SkeletonCell key={cell} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function Navigator({
  view,
  onPrevious,
  onNext,
}: {
  readonly view: WeekView;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
}) {
  const current = Week.containing(view.today);
  const historyStart = !view.canGoPrevious && !view.isCurrentWeek;
  const range = formatWeekRange(view.week);
  return (
    <PeriodNavigator
      title={weekTitle(view.week, current)}
      subtitle={historyStart ? `${range} · ${HISTORY_START}` : range}
      label={weekLabel(view.week, current, historyStart)}
      previousLabel="Semaine précédente"
      nextLabel="Semaine suivante"
      canGoPrevious={view.canGoPrevious}
      canGoNext={view.canGoNext}
      onPrevious={onPrevious}
      onNext={onNext}
    />
  );
}

/**
 * Vue Semaine (`WeekView`) : une carte par habitude existante, dans l'ordre de création, avec ses
 * 7 cases du lundi au dimanche et l'état de chacune (R8, R21) ; aujourd'hui est mis en évidence.
 * Navigation de semaine en semaine dans l'historique (R22), et retour à la semaine en cours.
 * États : chargement, erreur de lecture avec « Réessayer », aucune habitude.
 *
 * Une case modifiable réagit au tap : aujourd'hui, ou un jour clos à corriger (correction, sans
 * limite de temps, R10). Comme dans la Vue Journée, elle change tout de suite, revient en arrière
 * (état et marque « corrigé ») si l'enregistrement échoue, et un message propose « Réessayer ».
 * Une correction est confirmée par un message, et la case porte ou perd la marque « corrigé » (R13).
 * Un tap sur une case « hors habitude » l'explique ; une case « à venir » ne réagit pas.
 * `onAddHabit` mène à la création d'une habitude (état vide). `weekRequest` affiche une semaine
 * demandée par une autre vue (« Corriger » du rappel d'hier), à chaque nouvel `id`.
 */
export function WeekViewScreen({
  onAddHabit,
  weekRequest,
}: {
  readonly onAddHabit?: () => void;
  readonly weekRequest?: WeekRequest | undefined;
}) {
  const { state, followsCurrentWeek, previous, next, goToCurrentWeek, showWeek, reload, toggle } =
    useWeekView();
  const [seenRequest, setSeenRequest] = useState<WeekRequest['id'] | undefined>(undefined);
  if (weekRequest !== undefined && weekRequest.id !== seenRequest) {
    setSeenRequest(weekRequest.id);
    showWeek(weekRequest.week);
  }
  const [toast, setToast] = useState<ToastContent | null>(null);
  const toastCount = useRef(0);

  const showToast = useCallback((message: string, action?: ToastAction) => {
    toastCount.current += 1;
    setToast({ id: toastCount.current, message, ...(action && { action }) });
  }, []);
  const hideToast = useCallback(() => setToast(null), []);

  /** Un tap sur `habitDay`, la vue étant affichée pour `today`. */
  const tap = useCallback(
    (habitDay: HabitDay, today: Day): Promise<void> => {
      // Une case d'aujourd'hui touchée juste après minuit est aussi une correction (R10).
      const shownClosed = isClosedDay(habitDay.day, today);
      async function attempt(): Promise<void> {
        setToast(null);
        const outcome = await toggle(habitDay);
        if (outcome.ok && outcome.isCorrection) {
          showToast(
            shownClosed
              ? correctedMessage(outcome.habitDay)
              : correctionMessage(outcome.habitDay.day),
          );
        } else if (!outcome.ok && outcome.reason === 'saveFailed') {
          showToast(shownClosed ? CORRECTION_SAVE_FAILED : CHECK_IN_SAVE_FAILED, {
            label: 'Réessayer',
            onPress: () => void attempt(),
          });
        }
      }
      return attempt();
    },
    [toggle, showToast],
  );

  if (state.status === 'loading') {
    return (
      <Screen layout="top" testID="week-view">
        <LoadingView />
      </Screen>
    );
  }

  if (state.status === 'failed') {
    return (
      <Screen layout="top" testID="week-view">
        <StateMessage
          alert
          illustration="alert"
          title="Impossible de charger tes habitudes."
          text="Une erreur est survenue en lisant tes données sur ce téléphone."
          action={
            <View style={styles.actions}>
              <Button label="Réessayer" onPress={() => void reload()} />
              {!followsCurrentWeek && (
                <LinkButton label={BACK_TO_CURRENT_WEEK} onPress={goToCurrentWeek} />
              )}
            </View>
          }
          testID="week-view-error"
        />
      </Screen>
    );
  }

  const { view } = state;
  return (
    <Screen layout="top" testID="week-view">
      <Navigator view={view} onPrevious={previous} onNext={next} />
      {view.rows.length === 0 ? (
        <StateMessage
          illustration="summit"
          title="Ta semaine est vide"
          text="Elle se remplira dès ta première habitude."
          action={
            onAddHabit && (
              <Button
                label={ADD_HABIT_LABEL}
                onPress={onAddHabit}
                icon={<PlusGlyph color={colors.onAccent} />}
                testID="add-habit"
              />
            )
          }
          testID="week-view-empty"
        />
      ) : (
        <>
          <WeekDaysHeader days={view.week.days()} today={view.today} />
          <ScrollView contentContainerStyle={styles.list} testID="week-view-list">
            {!view.isCurrentWeek && (
              <LinkButton label={BACK_TO_CURRENT_WEEK} onPress={goToCurrentWeek} />
            )}
            {view.rows.map((row) => (
              <HabitWeekCard
                key={row.habit.id}
                days={row.days}
                today={view.today}
                onToggle={(habitDay) => void tap(habitDay, view.today)}
                onNotStartedPress={(habitDay) => showToast(notStartedMessage(habitDay))}
              />
            ))}
            <WeekLegend />
            <Text style={[typography.label, styles.hint]}>{CORRECTION_HINT}</Text>
          </ScrollView>
        </>
      )}
      {toast !== null && (
        <Toast
          key={toast.id}
          message={toast.message}
          {...(toast.action && { action: toast.action })}
          onHide={hideToast}
        />
      )}
    </Screen>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: 112 },
  actions: { alignItems: 'center', gap: spacing.xs },
  hint: { color: colors.muted, marginTop: 10, marginHorizontal: 2 },
  loading: { flex: 1 },
  skeleton: { backgroundColor: colors.skeleton, borderRadius: spacing.sm },
  skeletonNav: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.sm,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  skeletonArrow: { width: 28, height: 28 },
  skeletonTitle: { width: 120, height: 16 },
  skeletonCard: {
    marginHorizontal: spacing.lg,
    marginTop: 10,
    paddingVertical: spacing.md,
    paddingHorizontal: 9,
    borderRadius: radii.row,
    backgroundColor: colors.surface,
  },
  skeletonName: { width: '55%', height: 14, marginTop: 6, marginBottom: spacing.lg },
  skeletonCells: { flexDirection: 'row', gap: spacing.xs },
  skeletonSlot: { flex: 1, minWidth: 0 },
  skeletonCell: { width: '100%', borderRadius: 12 },
});
// Stryker restore all
