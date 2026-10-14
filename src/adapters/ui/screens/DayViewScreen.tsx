import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { DayView } from '../../../application/useCases/getDayView';
import type { Habit, HabitId } from '../../../domain/habit/Habit';
import { MAX_HABITS } from '../../../domain/habit/HabitRules';
import { ADD_HABIT_LABEL, AddHabitButton, HABIT_LIMIT_MESSAGE } from '../components/AddHabitButton';
import { Button } from '../components/Button';
import { DayHeader } from '../components/DayHeader';
import { PlusGlyph } from '../components/Glyph';
import { HabitRow } from '../components/HabitRow';
import { Screen } from '../components/Screen';
import { StateMessage } from '../components/StateMessage';
import { Toast } from '../components/Toast';
import { useCreateHabit } from '../state/useCreateHabit';
import { useDayView } from '../state/useDayView';
import { colors } from '../theme/colors';
import { radii, spacing } from '../theme/metrics';
import { typography } from '../theme/typography';
import { NewHabitSheet } from './NewHabitSheet';

/** Durée de la mise en évidence d'une habitude qui vient d'être créée, comme dans la maquette. */
export const HIGHLIGHT_DURATION_MS = 1800;

function LoadingView() {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Chargement de tes habitudes"
      accessibilityState={{ busy: true }}
      testID="day-view-loading"
      style={styles.loading}
    >
      <View style={styles.loadingHeader}>
        <View>
          <View style={[styles.skeleton, styles.skeletonTitle]} />
          <View style={[styles.skeleton, styles.skeletonDate]} />
        </View>
        <View style={[styles.skeleton, styles.skeletonCount]} />
      </View>
      {[0, 1, 2, 3].map((index) => (
        <View key={index} style={styles.skeletonRow}>
          <View style={[styles.skeleton, styles.skeletonCheck]} />
          <View style={styles.skeletonTexts}>
            <View style={[styles.skeleton, styles.skeletonName]} />
            <View style={[styles.skeleton, styles.skeletonStatus]} />
          </View>
        </View>
      ))}
    </View>
  );
}

function HabitList({
  view,
  highlighted,
}: {
  readonly view: DayView;
  readonly highlighted: HabitId | null;
}) {
  const scroll = useRef<ScrollView>(null);
  const doneCount = view.habits.filter(({ status }) => status === 'done').length;
  const activeCount = view.habits.length;
  const count = view.habitCount;
  return (
    <>
      <DayHeader day={view.day} doneCount={doneCount} activeCount={activeCount} />
      <ScrollView
        ref={scroll}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => {
          if (highlighted !== null) {
            scroll.current?.scrollToEnd();
          }
        }}
        testID="day-view-list"
      >
        {view.habits.map((habitDay) => (
          <HabitRow
            key={habitDay.habit.id}
            habitDay={habitDay}
            highlighted={habitDay.habit.id === highlighted}
          />
        ))}
        <View style={styles.section}>
          <Text style={[typography.label, styles.sectionTitle]}>Habitudes</Text>
          <Text
            accessibilityLabel={`${count} ${count > 1 ? 'habitudes' : 'habitude'} sur ${MAX_HABITS}`}
            style={[typography.label, view.canAddHabit ? styles.sectionCount : styles.full]}
          >
            {`${count}/${MAX_HABITS}`}
          </Text>
        </View>
      </ScrollView>
    </>
  );
}

/**
 * Vue Journée (`DayView`), l'écran d'accueil : aujourd'hui et ses habitudes, et l'ajout d'une
 * habitude par le panneau « Nouvelle habitude ». États : chargement, erreur de lecture avec
 * « Réessayer », vide, liste, limite de 10 habitudes.
 */
export function DayViewScreen() {
  const { state, reload, refresh } = useDayView();
  const create = useCreateHabit();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [highlighted, setHighlighted] = useState<HabitId | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (highlighted === null) {
      return;
    }
    const timer = setTimeout(() => setHighlighted(null), HIGHLIGHT_DURATION_MS);
    return () => clearTimeout(timer);
  }, [highlighted]);

  const hideToast = useCallback(() => setToast(null), []);
  const openSheet = () => setSheetOpen(true);
  const closeSheet = () => setSheetOpen(false);
  const created = (habit: Habit) => {
    setSheetOpen(false);
    setHighlighted(habit.id);
    setToast('Habitude créée');
    void refresh();
  };

  if (state.status === 'loading') {
    return (
      <Screen layout="top" testID="day-view">
        <LoadingView />
      </Screen>
    );
  }

  if (state.status === 'failed') {
    return (
      <Screen layout="top" testID="day-view">
        <StateMessage
          alert
          illustration="alert"
          title="Impossible de charger tes habitudes."
          text="Une erreur est survenue en lisant tes données sur ce téléphone."
          action={<Button label="Réessayer" onPress={() => void reload()} />}
          testID="day-view-error"
        />
      </Screen>
    );
  }

  const { view } = state;
  const empty = view.habitCount === 0;
  return (
    <Screen layout="top" testID="day-view">
      {empty ? (
        <StateMessage
          illustration="summit"
          title="Aucune habitude pour l’instant"
          text="Crée ta première habitude et commence à gagner de l’expérience."
          action={
            <Button
              label={ADD_HABIT_LABEL}
              onPress={openSheet}
              icon={<PlusGlyph color={colors.onAccent} />}
              testID="add-habit"
            />
          }
          testID="day-view-empty"
        />
      ) : (
        <>
          <HabitList view={view} highlighted={highlighted} />
          <AddHabitButton
            canAddHabit={view.canAddHabit}
            onPress={openSheet}
            onLimitPress={() => setToast(HABIT_LIMIT_MESSAGE)}
          />
        </>
      )}
      {toast !== null && <Toast message={toast} onHide={hideToast} aboveButton={!empty} />}
      {sheetOpen && (
        <NewHabitSheet
          habits={view.habits.map(({ habit }) => habit)}
          onCreate={create}
          onCreated={created}
          onClose={closeSheet}
        />
      )}
    </Screen>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: 112 },
  section: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 6,
    marginHorizontal: 2,
  },
  sectionTitle: { color: colors.muted },
  sectionCount: { color: colors.muted },
  full: { color: colors.xp, fontWeight: '600' },
  loading: { flex: 1 },
  loadingHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginHorizontal: spacing.lg,
    paddingTop: 6,
    paddingBottom: spacing.sm,
    marginBottom: spacing.md,
  },
  skeleton: { backgroundColor: colors.skeleton, borderRadius: spacing.sm },
  skeletonTitle: { width: 150, height: 24 },
  skeletonDate: { width: 120, height: 13, marginTop: spacing.sm },
  skeletonCount: { width: 90, height: 20 },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: spacing.lg,
    marginBottom: 10,
    paddingVertical: spacing.lg,
    paddingHorizontal: 14,
    borderRadius: radii.row,
    backgroundColor: colors.surface,
  },
  skeletonCheck: { width: 44, height: 44, borderRadius: 22 },
  skeletonTexts: { flex: 1 },
  skeletonName: { width: '65%', height: 14 },
  skeletonStatus: { width: '30%', height: 11, marginTop: spacing.sm },
});
// Stryker restore all
