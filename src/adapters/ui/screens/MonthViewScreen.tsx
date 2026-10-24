import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { dayDetailOf, type DayDetail } from '../../../application/useCases/getDayDetail';
import type { MonthView } from '../../../application/useCases/getMonthView';
import type { Week } from '../../../domain/week/Week';
import { ADD_HABIT_LABEL } from '../format/addHabit';
import { Button } from '../components/Button';
import { CharacterBar } from '../components/CharacterBar';
import { PlusGlyph } from '../components/Glyph';
import { LinkButton } from '../components/LinkButton';
import { MONTH_DAY_HEIGHT, MonthDaysHeader, MonthGrid, MonthLegend } from '../components/MonthGrid';
import { PeriodNavigator } from '../components/PeriodNavigator';
import { Screen } from '../components/Screen';
import { StateMessage } from '../components/legacy/StateMessage';
import { TargetsByWeekSection, WEEK_TARGETS_ROW_HEIGHT } from '../components/TargetsByWeekSection';
import { monthLabel, monthSubtitle, monthTitle } from '../format/formatMonth';
import { useExperience } from '../state/Experience';
import { useMonthView } from '../state/useMonthView';
import { colors } from '../theme/colors';
import { spacing } from '../theme/metrics';
import { typography } from '../theme/typography';
import { DayDetailSheet } from './DayDetailSheet';

/** Le lien qui ramène au mois en cours (maquette, E6). */
export const BACK_TO_CURRENT_MONTH = 'Revenir à ce mois-ci';

/** L'astuce sous la légende (maquette, E6). */
export const MONTH_HINT = 'Tape un jour pour voir le détail de tes habitudes et corriger un oubli.';

/** Le nombre de jours du squelette de chargement : 5 semaines. */
const SKELETON_DAYS = 35;

/** Le nombre de lignes grises de la section « Objectifs par semaine » dans le squelette (#27). */
const SKELETON_WEEK_ROWS = 2;

function LoadingView() {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Chargement de tes habitudes"
      accessibilityState={{ busy: true }}
      testID="month-view-loading"
      style={styles.loading}
    >
      <CharacterBar xp={null} change={null} />
      <View style={styles.skeletonNav}>
        <View style={[styles.skeleton, styles.skeletonArrow]} />
        <View style={[styles.skeleton, styles.skeletonTitle]} />
        <View style={[styles.skeleton, styles.skeletonArrow]} />
      </View>
      <View style={styles.skeletonGrid}>
        {Array.from({ length: SKELETON_DAYS }, (_, index) => (
          <View key={index} style={[styles.skeleton, styles.skeletonDay]} />
        ))}
      </View>
      <View testID="month-view-loading-targets" style={styles.skeletonWeeks}>
        {Array.from({ length: SKELETON_WEEK_ROWS }, (_, index) => (
          <View key={index} style={[styles.skeleton, styles.skeletonWeek]} />
        ))}
      </View>
    </View>
  );
}

/** Vrai si le joueur n'a aucune habitude : aucun jour du mois n'en montre une. */
const hasNoHabit = (view: MonthView) =>
  view.days.every(({ habits, notStartedHabits }) => habits.length + notStartedHabits.length === 0);

/**
 * Vue Mois (`MonthView`) : le calendrier du mois, ses semaines du lundi au dimanche (R21, R23).
 * Chaque jour montre le compteur « faites / attendues » et un point par habitude attendue, ou le
 * drapeau « Objectifs atteints » sans habitude attendue (#25) ; un jour sans habitude active est
 * neutre, un jour à venir en pointillés ; aujourd'hui est encadré, un jour
 * corrigé porte la pastille « corrigé ». Navigation de mois en mois dans l'historique (R22), et
 * retour au mois en cours. En haut, l'expérience du personnage (R24).
 * États : chargement, erreur de lecture avec « Réessayer », aucune habitude.
 *
 * Sous la grille, sa légende et l'astuce, la section « Objectifs par semaine » (#27) compte, pour chaque
 * semaine du mois jusqu'à la semaine en cours, les habitudes à objectif atteint ; elle n'apparaît
 * pas sans ligne. Toucher une ligne ouvre la Vue Semaine sur cette semaine (`onOpenWeek`).
 *
 * Toucher un jour suivi ouvre son détail (`DayDetailSheet`), tout de suite avec la progression de
 * la semaine de chaque habitude (`dayDetailOf`), où ses habitudes se corrigent ; la Vue Mois se met
 * à jour quand le détail enregistre un changement. `onAddHabit` mène à la création d'une habitude
 * (état vide).
 */
export function MonthViewScreen({
  onAddHabit,
  onOpenWeek,
}: {
  readonly onAddHabit?: () => void;
  readonly onOpenWeek?: (week: Week) => void;
}) {
  const { state, followsCurrentMonth, previous, next, goToCurrentMonth, reload } = useMonthView();
  const experience = useExperience();
  const [opened, setOpened] = useState<DayDetail | null>(null);

  if (state.status === 'loading') {
    return (
      <Screen layout="top" testID="month-view">
        <LoadingView />
      </Screen>
    );
  }

  if (state.status === 'failed') {
    return (
      <Screen layout="top" testID="month-view">
        <StateMessage
          alert
          illustration="alert"
          title="Impossible de charger tes habitudes."
          text="Une erreur est survenue en lisant tes données sur ce téléphone."
          action={
            <View style={styles.actions}>
              <Button
                label="Réessayer"
                onPress={() => {
                  void reload();
                  void experience.reload();
                }}
              />
              {!followsCurrentMonth && (
                <LinkButton label={BACK_TO_CURRENT_MONTH} onPress={goToCurrentMonth} />
              )}
            </View>
          }
          testID="month-view-error"
        />
      </Screen>
    );
  }

  const { view } = state;
  return (
    <Screen layout="top" testID="month-view">
      <CharacterBar xp={experience.xp} change={experience.change} />
      <PeriodNavigator
        title={monthTitle(view.month)}
        subtitle={monthSubtitle(view)}
        label={monthLabel(view.month, view)}
        previousLabel="Mois précédent"
        nextLabel="Mois suivant"
        canGoPrevious={view.canGoPrevious}
        canGoNext={view.canGoNext}
        onPrevious={previous}
        onNext={next}
      />
      {hasNoHabit(view) ? (
        <StateMessage
          illustration="summit"
          title="Ton mois est vide"
          text="Chaque jour affichera tes habitudes faites dès ta première habitude."
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
          testID="month-view-empty"
        />
      ) : (
        <ScrollView contentContainerStyle={styles.list} testID="month-view-list">
          <MonthDaysHeader />
          <MonthGrid
            weeks={view.weeks}
            onOpen={(monthDay) => setOpened(dayDetailOf(monthDay, view.targetsByWeek))}
          />
          {!view.isCurrentMonth && (
            <LinkButton label={BACK_TO_CURRENT_MONTH} onPress={goToCurrentMonth} />
          )}
          <MonthLegend />
          <Text style={[typography.label, styles.hint]}>{MONTH_HINT}</Text>
          <TargetsByWeekSection
            rows={view.targetsByWeek}
            today={view.today}
            onOpenWeek={onOpenWeek}
          />
        </ScrollView>
      )}
      {opened !== null && (
        <DayDetailSheet
          key={opened.day.toIsoString()}
          opened={opened}
          today={view.today}
          onClose={() => setOpened(null)}
        />
      )}
    </Screen>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 112 },
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
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginHorizontal: spacing.lg,
    marginTop: 40,
  },
  skeletonDay: { width: '13.2%', height: MONTH_DAY_HEIGHT, borderRadius: 12 },
  skeletonWeeks: { gap: spacing.sm, marginHorizontal: spacing.lg, marginTop: 44 },
  skeletonWeek: { height: WEEK_TARGETS_ROW_HEIGHT, borderRadius: 14 },
});
// Stryker restore all
