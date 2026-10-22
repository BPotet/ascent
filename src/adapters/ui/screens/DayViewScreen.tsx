import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { DayView, DayViewHabit } from '../../../application/useCases/getDayView';
import type { HabitDay } from '../../../domain/checkIn/HabitDay';
import type { Day } from '../../../domain/day/Day';
import type { Habit, HabitId } from '../../../domain/habit/Habit';
import type { Week } from '../../../domain/week/Week';
import { MAX_HABITS } from '../../../domain/habit/HabitRules';
import { ADD_HABIT_LABEL, AddHabitButton, HABIT_LIMIT_MESSAGE } from '../components/AddHabitButton';
import { Button } from '../components/Button';
import { CharacterBar } from '../components/CharacterBar';
import { DayHeader } from '../components/DayHeader';
import { PlusGlyph } from '../components/Glyph';
import { HabitRow } from '../components/HabitRow';
import { Notice } from '../components/Notice';
import { Screen } from '../components/Screen';
import { StateMessage } from '../components/StateMessage';
import { WhatsNewCard } from '../components/WhatsNewCard';
import { YesterdayReminderBanner } from '../components/YesterdayReminderBanner';
import { Toast, type ToastAction } from '../components/Toast';
import { CHECK_IN_SAVE_FAILED, correctionMessage } from '../format/checkInMessages';
import { formatDayAndMonth } from '../format/formatDay';
import type { WeeklyProgressShown } from '../format/formatWeeklyTarget';
import { useCheckInHint } from '../state/useCheckInHint';
import { useCreateHabit } from '../state/useCreateHabit';
import { useDayView } from '../state/useDayView';
import { type XpChange, useExperience, xpChangeOn } from '../state/Experience';
import { useTodayChange } from '../state/useTodayChange';
import { useWhatsNewCard } from '../state/useWhatsNewCard';
import { useYesterdayReminder } from '../state/useYesterdayReminder';
import { colors } from '../theme/colors';
import { radii, spacing } from '../theme/metrics';
import { typography } from '../theme/typography';
import {
  type DeletedHabit,
  deletedMessage,
  HabitEditing,
  type UpdatedHabit,
  updatedMessage,
} from './HabitEditing';
import { NewHabitSheet } from './NewHabitSheet';

/** Durée de la mise en évidence d'une habitude créée ou modifiée, comme dans la maquette. */
export const HIGHLIGHT_DURATION_MS = 1800;

/**
 * L'aide au premier usage, qui explique le tap (maquette, E1 « Première habitude créée ») ; elle
 * reste vraie pour toutes les difficultés (texte fixé par le PM, #23).
 */
export const CHECK_IN_HINT =
  'Tape ton habitude quand c’est fait : ton personnage gagne de l’XP selon sa difficulté.';

/** L'encouragement quand toutes les habitudes du jour sont faites (maquette, E1 « Toutes faites »). */
export const ALL_DONE_MESSAGE = 'Toutes tes habitudes du jour sont faites. Belle ascension\u00a0!';

const newDayMessage = (day: Day) => `Nouvelle journée : ${formatDayAndMonth(day)}.`;

/** L'habitude mise en évidence ; `reveal` fait défiler jusqu'à elle (créée, en bas de la liste). */
interface Highlight {
  readonly id: HabitId;
  readonly reveal: boolean;
}

interface ToastContent {
  /** Change à chaque message, pour l'annoncer et le montrer en entier même s'il se répète. */
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
      testID="day-view-loading"
      style={styles.loading}
    >
      <CharacterBar xp={null} change={null} />
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
            <View testID="day-view-loading-secondary-line" style={styles.skeletonLine}>
              <View style={[styles.skeleton, styles.skeletonIcon]} />
              <View style={[styles.skeleton, styles.skeletonStatus]} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

/** La progression de la semaine d'une ligne, si sa semaine a un objectif. */
function weeklyProgressOf({
  weeklyProgress,
  weekSettings: { weekTarget },
  targetReached,
}: DayViewHabit): WeeklyProgressShown | undefined {
  return weekTarget === null ? undefined : { weeklyProgress, weekTarget, targetReached };
}

function HabitList({
  view,
  highlighted,
  xpChange,
  showHint,
  whatsNew,
  reminder,
  onToggle,
  onEdit,
}: {
  readonly view: DayView;
  readonly highlighted: Highlight | null;
  readonly xpChange: XpChange | null;
  readonly showHint: boolean;
  readonly whatsNew: ReactNode;
  readonly reminder: ReactNode;
  readonly onToggle: (habitDay: HabitDay) => void;
  readonly onEdit: (row: DayViewHabit) => void;
}) {
  const scroll = useRef<ScrollView>(null);
  const { doneCount } = view;
  const activeCount = view.habits.length;
  const allDone = activeCount > 0 && doneCount === activeCount;
  const count = view.habitCount;
  return (
    <>
      <DayHeader day={view.day} doneCount={doneCount} activeCount={activeCount} />
      <ScrollView
        ref={scroll}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => {
          if (highlighted?.reveal === true) {
            scroll.current?.scrollToEnd();
          }
        }}
        testID="day-view-list"
      >
        {whatsNew}
        {reminder}
        {allDone && <Notice kind="celebration" text={ALL_DONE_MESSAGE} testID="all-done" />}
        {showHint && <Notice kind="hint" text={CHECK_IN_HINT} testID="check-in-hint" />}
        {view.habits.map((habitDay) => (
          <HabitRow
            key={habitDay.habit.id}
            habitDay={habitDay}
            difficulty={habitDay.weekSettings.difficulty}
            weeklyProgress={weeklyProgressOf(habitDay)}
            highlighted={habitDay.habit.id === highlighted?.id}
            xpChange={xpChangeOn(xpChange, habitDay)}
            onToggle={onToggle}
            onEdit={() => onEdit(habitDay)}
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
 *
 * Un tap sur une habitude la passe à « fait » ou la remet à « à faire » ; si l'enregistrement
 * échoue, elle revient à son état et un message propose « Réessayer ». L'aide au premier usage
 * disparaît au premier « fait ». La vue passe seule au nouveau jour (minuit, retour au premier
 * plan) et l'annonce.
 *
 * Chaque ligne montre la difficulté de l'habitude cette semaine (icône), son état et sa progression
 * de la semaine (« À faire · 2/3 cette semaine »), et le badge « Objectif atteint » (E1, #24). Le
 * squelette de chargement prévoit cette ligne secondaire, pour que rien ne saute à l'affichage.
 *
 * Le bouton « ⋯ » d'une habitude ouvre « Modifier l'habitude » (`HabitEditing`), prérempli avec
 * ses réglages de la semaine : modifiée, elle est mise en évidence et la variation de l'expérience
 * est montrée ; supprimée, elle disparaît et l'expérience retirée est montrée. Un message confirme
 * l'un ou l'autre ; la vue se recharge (état vide après la dernière, limite de 10).
 *
 * `newHabitRequest` ouvre le panneau « Nouvelle habitude » chaque fois qu'il prend une nouvelle
 * valeur (l'état vide de la Vue Semaine mène ici pour créer une habitude).
 *
 * En haut, l'expérience du personnage (R24) ; un tap enregistré la fait monter ou descendre, avec
 * son feedback : « +20 XP » (au barème de la difficulté) s'envole de la coche (`Experience`,
 * `CharacterBar`).
 *
 * Tout en haut de la liste, la Carte de nouveauté (#24) invite le joueur qui avait des habitudes
 * avant la mise à jour à régler leur difficulté et leur objectif : « Régler » ouvre « Modifier
 * l'habitude » sur la première habitude de la liste ; « Régler » comme « Fermer » la retirent pour
 * toujours.
 *
 * En haut de la liste, le rappel d'hier (« Hier : 1/2 faites ») propose de corriger hier :
 * « Corriger » appelle `onCorrectYesterday` avec la semaine d'hier, à ouvrir dans la Vue Semaine.
 */
export function DayViewScreen({
  newHabitRequest,
  onCorrectYesterday,
}: {
  readonly newHabitRequest?: string | number | undefined;
  readonly onCorrectYesterday?: ((week: Week) => void) | undefined;
} = {}) {
  const { state, reload, refresh, toggle } = useDayView();
  const experience = useExperience();
  const { reminder, dismiss: dismissReminder } = useYesterdayReminder();
  const create = useCreateHabit();
  const hint = useCheckInHint();
  const whatsNew = useWhatsNewCard();
  const [sheetOpen, setSheetOpen] = useState(false);

  const [seenRequest, setSeenRequest] = useState<string | number | undefined>(undefined);
  if (newHabitRequest !== seenRequest) {
    setSeenRequest(newHabitRequest);
    if (newHabitRequest !== undefined) {
      setSheetOpen(true);
    }
  }
  const [highlighted, setHighlighted] = useState<Highlight | null>(null);
  const [editing, setEditing] = useState<DayViewHabit | null>(null);
  const [toast, setToast] = useState<ToastContent | null>(null);
  const toastCount = useRef(0);

  const showToast = useCallback((message: string, action?: ToastAction) => {
    toastCount.current += 1;
    setToast({ id: toastCount.current, message, ...(action && { action }) });
  }, []);

  useTodayChange((today) => {
    void refresh();
    showToast(newDayMessage(today));
  });

  const { dismiss: dismissHint } = hint;
  const tap = useCallback(
    (habitDay: HabitDay): Promise<void> => {
      async function attempt(): Promise<void> {
        setToast(null);
        const outcome = await toggle(habitDay);
        if (outcome.ok) {
          if (outcome.habitDay.status === 'done') {
            void dismissHint();
          }
          if (outcome.isCorrection) {
            showToast(correctionMessage(outcome.habitDay.day));
          }
        } else if (outcome.reason === 'saveFailed') {
          showToast(CHECK_IN_SAVE_FAILED, { label: 'Réessayer', onPress: () => void attempt() });
        }
      }
      return attempt();
    },
    [toggle, dismissHint, showToast],
  );

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
    setHighlighted({ id: habit.id, reveal: true });
    showToast('Habitude créée');
    void refresh();
  };
  const closeEditing = () => setEditing(null);
  const updated = (outcome: UpdatedHabit) => {
    setEditing(null);
    setHighlighted({ id: outcome.habit.id, reveal: false });
    showToast(updatedMessage(outcome));
    void refresh();
  };
  const deleted = ({ xpRemoved }: DeletedHabit) => {
    setEditing(null);
    showToast(deletedMessage(xpRemoved));
    void refresh();
  };
  const gone = () => {
    setEditing(null);
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
          action={
            <Button
              label="Réessayer"
              onPress={() => {
                void reload();
                void experience.reload();
              }}
            />
          }
          testID="day-view-error"
        />
      </Screen>
    );
  }

  const { view } = state;
  const empty = view.habitCount === 0;
  return (
    <Screen layout="top" testID="day-view">
      <CharacterBar xp={experience.xp} change={experience.change} />
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
          <HabitList
            view={view}
            highlighted={highlighted}
            xpChange={experience.change}
            showHint={hint.visible}
            whatsNew={
              whatsNew.visible && (
                <WhatsNewCard
                  onAdjust={() => {
                    void whatsNew.dismiss();
                    setEditing(view.habits[0] ?? null);
                  }}
                  onClose={() => void whatsNew.dismiss()}
                />
              )
            }
            reminder={
              reminder && (
                <YesterdayReminderBanner
                  doneCount={reminder.doneCount}
                  activeCount={reminder.activeCount}
                  {...(onCorrectYesterday && {
                    onCorrect: () => onCorrectYesterday(reminder.week),
                  })}
                  onDismiss={() => void dismissReminder()}
                />
              )
            }
            onToggle={(habitDay) => void tap(habitDay)}
            onEdit={setEditing}
          />
          <AddHabitButton
            canAddHabit={view.canAddHabit}
            onPress={openSheet}
            onLimitPress={() => showToast(HABIT_LIMIT_MESSAGE)}
          />
        </>
      )}
      {toast !== null && (
        <Toast
          key={toast.id}
          message={toast.message}
          {...(toast.action && { action: toast.action })}
          onHide={hideToast}
          aboveButton={!empty}
        />
      )}
      {sheetOpen && (
        <NewHabitSheet
          habits={view.habits.map(({ habit }) => habit)}
          onCreate={create}
          onCreated={created}
          onClose={closeSheet}
        />
      )}
      {editing !== null && (
        <HabitEditing
          habit={editing.habit}
          settings={editing}
          habits={view.habits.map(({ habit }) => habit)}
          onUpdated={updated}
          onDeleted={deleted}
          onGone={gone}
          onClose={closeEditing}
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
  skeletonLine: { flexDirection: 'row', gap: 6, marginTop: spacing.sm },
  skeletonIcon: { width: 20, height: 11 },
  skeletonStatus: { width: '46%', height: 11 },
});
// Stryker restore all
