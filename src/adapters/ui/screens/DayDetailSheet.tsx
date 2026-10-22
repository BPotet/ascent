import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { DayDetail } from '../../../application/useCases/getDayDetail';
import type { HabitDay } from '../../../domain/checkIn/HabitDay';
import { Button } from '../components/Button';
import { AlertGlyph } from '../components/Glyph';
import { HabitRow } from '../components/HabitRow';
import { CHECK_IN_SAVE_FAILED, CORRECTION_SAVE_FAILED } from '../format/checkInMessages';
import { capitalize, formatDayAndMonth } from '../format/formatDay';
import { dayDetailSummary, notStartedHint } from '../format/formatMonth';
import { useExperience, xpChangeOn } from '../state/Experience';
import { useDayDetail } from '../state/useDayDetail';
import { useReducedMotion } from '../state/useReducedMotion';
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
 * Toucher une ligne fait le même geste que la Vue Journée (aujourd'hui) ou corrige le jour clos
 * (R10, sans limite de temps, au barème de la difficulté de sa semaine, marque « corrigé ») : la
 * ligne change tout de suite et « +20 XP » s'envole de sa coche. Si l'enregistrement échoue, la
 * ligne revient en arrière et une alerte propose « Réessayer ». « Fermer », le fond ou le retour du téléphone ferment le panneau.
 */
export function DayDetailSheet({
  opened,
  onClose,
}: {
  readonly opened: DayDetail;
  readonly onClose: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const { detail, toggle } = useDayDetail(opened);
  const experience = useExperience();
  const [failed, setFailed] = useState<HabitDay | null>(null);
  const testID = `day-detail-${opened.day.toIsoString()}`;

  const tap = async (habitDay: HabitDay) => {
    setFailed(null);
    const outcome = await toggle(habitDay);
    if (!outcome.ok && outcome.reason === 'saveFailed') {
      setFailed(habitDay);
    }
  };

  const alert = detail.isToday ? CHECK_IN_SAVE_FAILED : CORRECTION_SAVE_FAILED;

  return (
    <Modal
      transparent
      visible
      animationType={reducedMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
      testID={testID}
    >
      <View style={styles.container}>
        <Pressable
          accessible={false}
          onPress={onClose}
          testID="day-detail-scrim"
          style={styles.scrim}
        />
        <View accessibilityViewIsModal style={styles.sheet}>
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
