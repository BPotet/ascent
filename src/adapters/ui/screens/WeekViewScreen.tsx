import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import type { WeekView } from '../../../application/useCases/getWeekView';
import type { HabitDay } from '../../../domain/checkIn/HabitDay';
import { Week } from '../../../domain/week/Week';
import { ADD_HABIT_LABEL } from '../components/AddHabitButton';
import { Button } from '../components/Button';
import { PlusGlyph } from '../components/Glyph';
import { LinkButton } from '../components/LinkButton';
import { PeriodNavigator } from '../components/PeriodNavigator';
import { Screen } from '../components/Screen';
import { StateMessage } from '../components/StateMessage';
import { Toast, type ToastAction } from '../components/Toast';
import { HabitWeekCard, WeekDaysHeader, WeekLegend } from '../components/WeekGrid';
import { formatWeekRange, HISTORY_START, weekLabel, weekTitle } from '../format/formatWeek';
import { useWeekView } from '../state/useWeekView';
import { colors } from '../theme/colors';
import { radii, spacing } from '../theme/metrics';
import { CHECK_IN_SAVE_FAILED, correctionMessage } from './DayViewScreen';

/** Le lien qui ramène à la semaine en cours (maquette, E4 « Semaine dernière »). */
export const BACK_TO_CURRENT_WEEK = 'Revenir à cette semaine';

interface ToastContent {
  readonly id: number;
  readonly message: string;
  readonly action?: ToastAction;
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
              <View key={cell} style={[styles.skeleton, styles.skeletonCell]} />
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
 * Seule une case modifiable réagit au tap (dans cette story, celle d'aujourd'hui) : comme dans la
 * Vue Journée, elle change tout de suite, revient en arrière si l'enregistrement échoue, et un
 * message propose « Réessayer ». `onAddHabit` mène à la création d'une habitude (état vide).
 */
export function WeekViewScreen({ onAddHabit }: { readonly onAddHabit?: () => void }) {
  const { state, followsCurrentWeek, previous, next, goToCurrentWeek, reload, toggle } =
    useWeekView();
  const [toast, setToast] = useState<ToastContent | null>(null);
  const toastCount = useRef(0);

  const showToast = useCallback((message: string, action?: ToastAction) => {
    toastCount.current += 1;
    setToast({ id: toastCount.current, message, ...(action && { action }) });
  }, []);
  const hideToast = useCallback(() => setToast(null), []);

  const tap = useCallback(
    (habitDay: HabitDay): Promise<void> => {
      async function attempt(): Promise<void> {
        setToast(null);
        const outcome = await toggle(habitDay);
        if (outcome.ok && outcome.isCorrection) {
          showToast(correctionMessage(outcome.habitDay.day));
        } else if (!outcome.ok && outcome.reason === 'saveFailed') {
          showToast(CHECK_IN_SAVE_FAILED, { label: 'Réessayer', onPress: () => void attempt() });
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
                onToggle={(habitDay) => void tap(habitDay)}
              />
            ))}
            <WeekLegend />
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
  skeletonCell: { flex: 1, aspectRatio: 1, borderRadius: 12 },
});
// Stryker restore all
