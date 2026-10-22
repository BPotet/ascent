import { useCallback, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { DayDetail } from '../../../application/useCases/getDayDetail';
import type { HabitDay } from '../../../domain/checkIn/HabitDay';
import type { Day } from '../../../domain/day/Day';
import { Button } from '../components/Button';
import { AlertGlyph } from '../components/Glyph';
import { HabitRow } from '../components/HabitRow';
import { targetToastOf, Toast } from '../components/Toast';
import { CHECK_IN_SAVE_FAILED, CORRECTION_SAVE_FAILED } from '../format/checkInMessages';
import { capitalize, formatDayAndMonth } from '../format/formatDay';
import { dayDetailSummary, notStartedHint } from '../format/formatMonth';
import { weekName } from '../format/formatTargetsByWeek';
import type { TargetFeedback } from '../format/targetFeedback';
import { useExperience, xpChangeOn } from '../state/Experience';
import { useDayDetail } from '../state/useDayDetail';
import { useReducedMotion } from '../state/useReducedMotion';
import { targetFlashOn, useTargetFeedback } from '../state/useTargetFeedback';
import { colors } from '../theme/colors';
import { radii, spacing } from '../theme/metrics';
import { typography } from '../theme/typography';

/**
 * Le panneau « détail du jour » (`DayDetail`), ouvert en touchant un jour de la Vue Mois (maquette,
 * E5 et E6) : le jour en toutes lettres, « Aujourd'hui » ou « Jour clos · tu peux corriger un
 * oubli » avec le compteur « faites / attendues », ou « objectifs de la semaine atteints » sans
 * habitude attendue (#25), puis une ligne par habitude active, attendue ou non, avec son état écrit
 * et la marque « corrigé ». Les habitudes créées plus tard sont nommées, « hors habitude ».
 *
 * Chaque habitude qui a un objectif de la semaine montre sa progression de la semaine du jour,
 * jusqu'à aujourd'hui (`today`), et le badge « Objectif atteint » (#27) : « Fait · 2/3 semaine du
 * 12 octobre », ou « 2/3 cette semaine » pour la semaine en cours. Une habitude sans objectif de la
 * semaine (avant la mise à jour) n'en montre pas, comme dans la Vue Semaine. La progression suit la
 * relecture du détail, après l'enregistrement d'un tap, comme dans la Vue Semaine.
 *
 * Une correction qui atteint l'objectif de la semaine joue le même feedback que la Vue Semaine (F1,
 * `useTargetFeedback`, #26) : éclat du badge, message « Objectif atteint · semaine du 12 octobre »
 * au-dessus du panneau, dans le `Modal`, vibration, pastille de la prime dans l'en-tête ; un retour
 * sous l'objectif montre le message discret.
 *
 * Toucher une ligne fait le même geste que la Vue Journée (aujourd'hui) ou corrige le jour clos
 * (R10, sans limite de temps, au barème de la difficulté de sa semaine, marque « corrigé ») : la
 * ligne change tout de suite et « +20 XP » s'envole de sa coche. Si l'enregistrement échoue, la
 * ligne revient en arrière et une alerte propose « Réessayer ». « Fermer », le fond ou le retour du téléphone ferment le panneau.
 */
export function DayDetailSheet({
  opened,
  today,
  onClose,
}: {
  readonly opened: DayDetail;
  /** Aujourd'hui, tel que la Vue Mois l'a lu : il nomme la semaine du jour (« cette semaine »). */
  readonly today: Day;
  readonly onClose: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const { detail, toggle } = useDayDetail(opened);
  const experience = useExperience();
  const [failed, setFailed] = useState<HabitDay | null>(null);
  const testID = `day-detail-${opened.day.toIsoString()}`;
  const [toast, setToast] = useState<(ReturnType<typeof targetToastOf> & { id: number }) | null>(
    null,
  );
  const toastCount = useRef(0);
  const [panelHeight, setPanelHeight] = useState(0);
  const showTargetToast = useCallback((feedback: TargetFeedback) => {
    toastCount.current += 1;
    setToast({ id: toastCount.current, ...targetToastOf(feedback) });
  }, []);
  const hideToast = useCallback(() => setToast(null), []);
  const target = useTargetFeedback({ showToast: showTargetToast });

  const tap = async (habitDay: HabitDay) => {
    setFailed(null);
    setToast(null);
    const outcome = await toggle(habitDay);
    if (outcome.ok) {
      // F1 ou le retour sous l'objectif, comme dans la Vue Semaine (#26).
      target.play(outcome, outcome.habitDay, outcome.isCorrection && outcome.habitDay.corrected);
    } else if (outcome.reason === 'saveFailed') {
      setFailed(habitDay);
    }
  };

  const alert = detail.isToday ? CHECK_IN_SAVE_FAILED : CORRECTION_SAVE_FAILED;
  const progressOf = new Map(detail.progress.map((progress) => [progress.habit.id, progress]));
  const shownWeek = weekName(detail.week, today);

  return (
    <Modal
      transparent
      visible
      animationType={reducedMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
      testID={testID}
    >
      <View accessibilityViewIsModal style={styles.container}>
        <Pressable
          accessible={false}
          onPress={onClose}
          testID="day-detail-scrim"
          style={styles.scrim}
        />
        {/*
          Le message F1 au-dessus du panneau, dans le Modal : rendu par l'écran, il serait caché. Sa
          zone couvre tout l'espace au-dessus du panneau : sur Android, un élément hors des limites
          de son parent n'est vu ni par l'accessibilité (TalkBack) ni par Maestro.
        */}
        <View
          pointerEvents="box-none"
          testID="day-detail-toast-slot"
          style={[styles.toastSlot, { bottom: panelHeight }]}
        >
          {toast !== null && (
            <Toast
              key={toast.id}
              message={toast.message}
              variant={toast.variant}
              target={toast.target}
              announcement={toast.announcement}
              onHide={hideToast}
            />
          )}
        </View>
        <View
          testID="day-detail-panel"
          onLayout={(event) => setPanelHeight(event.nativeEvent.layout.height)}
          style={styles.sheet}
        >
          <ScrollView contentContainerStyle={styles.content} bounces={false}>
            <View style={styles.grab} />
            <Text accessibilityRole="header" style={[typography.sheetTitle, styles.title]}>
              {capitalize(formatDayAndMonth(detail.day))}
            </Text>
            <Text style={[typography.notice, styles.summary]}>{dayDetailSummary(detail)}</Text>
            {detail.habits.map((habitDay) => (
              <HabitRow
                key={habitDay.habit.id}
                habitDay={habitDay}
                weeklyProgress={progressOf.get(habitDay.habit.id)}
                weekLabel={shownWeek}
                targetFlash={targetFlashOn(target.flash, habitDay)}
                compact
                xpChange={xpChangeOn(experience.change, habitDay)}
                onToggle={(touched) => void tap(touched)}
              />
            ))}
            {detail.notStartedHabits.length > 0 && (
              <Text style={[typography.label, styles.hint]}>
                {notStartedHint(detail.notStartedHabits.map(({ habit }) => habit.name.value))}
              </Text>
            )}
            {failed !== null && (
              <View
                accessible
                accessibilityRole="alert"
                accessibilityLabel={alert}
                accessibilityLiveRegion="assertive"
                style={styles.alert}
              >
                <AlertGlyph color={colors.onDangerSoft} />
                <Text style={[typography.toast, styles.alertText]}>{alert}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Réessayer"
                  onPress={() => void tap(failed)}
                  style={styles.retry}
                >
                  <Text style={[typography.link, styles.retryText]}>Réessayer</Text>
                </Pressable>
              </View>
            )}
            <View style={styles.close}>
              <Button label="Fermer" variant="ghost" onPress={onClose} />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  toastSlot: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1 },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: colors.scrim },
  sheet: {
    maxHeight: '85%',
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    borderTopWidth: 1,
    borderColor: colors.line,
  },
  content: { paddingTop: spacing.sm, paddingHorizontal: 20, paddingBottom: 36 },
  grab: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.grab,
    alignSelf: 'center',
    marginBottom: 14,
  },
  title: { color: colors.text, marginBottom: 6 },
  summary: { color: colors.muted, marginBottom: 14 },
  hint: { color: colors.muted, marginTop: spacing.xs, marginHorizontal: 2 },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 10,
    paddingVertical: spacing.xs,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    borderRadius: spacing.md,
    borderWidth: 1,
    borderColor: colors.dangerLine,
    backgroundColor: colors.dangerSoft,
  },
  alertText: { color: colors.onDangerSoft, flex: 1 },
  retry: { minHeight: 44, paddingHorizontal: spacing.md, justifyContent: 'center' },
  retryText: { color: colors.onDangerSoft },
  close: { marginTop: spacing.sm },
});
// Stryker restore all
