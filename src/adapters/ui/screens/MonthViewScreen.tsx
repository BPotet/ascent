import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { dayDetailOf, type DayDetail } from '../../../application/useCases/getDayDetail';
import type { MonthView } from '../../../application/useCases/getMonthView';
import type { Week } from '../../../domain/week/Week';
import { ADD_HABIT_LABEL } from '../format/addHabit';
import { MONTH_CHROME, useWeekColumnWidth } from '../components/cellSize';
import { CharacterBar } from '../components/CharacterBar';
import { MONTH_DAY_HEIGHT, MonthDaysHeader, MonthGrid, MonthLegend } from '../components/MonthGrid';
import { PeriodNavigator } from '../components/PeriodNavigator';
import { Screen } from '../components/Screen';
import { StateMessage } from '../components/StateMessage';
import { TargetsByWeekSection, WEEK_TARGETS_ROW_HEIGHT } from '../components/TargetsByWeekSection';
import { monthLabel, monthSubtitle, monthTitle } from '../format/formatMonth';
import { useExperience } from '../state/Experience';
import { useMonthView } from '../state/useMonthView';
import { artPalette } from '../pixelArt/artPalette';
import { PixelButton } from '../pixelArt/PixelButton';
import { PixelLink } from '../pixelArt/PixelLink';
import { PixelSkeleton } from '../pixelArt/PixelSkeleton';
import { pixelTypography } from '../pixelArt/pixelTypography';
import { DayDetailSheet } from './DayDetailSheet';

/** Le lien qui ramène au mois en cours (maquette, E6). */
export const BACK_TO_CURRENT_MONTH = 'Revenir à ce mois-ci';

/** L'astuce sous la légende (maquette, E6). */
export const MONTH_HINT = 'Tape un jour pour voir le détail de tes habitudes et corriger un oubli.';

/** Le nombre de semaines du squelette de chargement. */
const SKELETON_WEEKS = 5;

/** Le nombre de lignes grises de la section « Objectifs par semaine » dans le squelette (#27). */
const SKELETON_WEEK_ROWS = 2;

const { roles } = artPalette;

/**
 * Le chargement : l'en-tête du personnage, puis un squelette au pixel d'art qui réserve la place
 * de la navigation, des jours (sur les colonnes de la grille) et des objectifs par semaine (sans
 * clignoter en mouvement réduit).
 */
function LoadingView() {
  const column = useWeekColumnWidth(MONTH_CHROME);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Chargement de tes habitudes"
      accessibilityState={{ busy: true }}
      testID="month-view-loading"
      style={styles.loading}
    >
      <CharacterBar xp={null} change={null} compact />
      <View style={styles.skeletonNav}>
        <PixelSkeleton width={28} height={28} />
        <PixelSkeleton width={140} height={22} />
        <PixelSkeleton width={28} height={28} />
      </View>
      <View style={styles.skeletonGrid}>
        {Array.from({ length: SKELETON_WEEKS }, (_, week) => (
          <View key={week} style={styles.skeletonWeek}>
            {Array.from({ length: 7 }, (_, index) => (
              <View
                key={index}
                testID="month-view-loading-day"
                style={[styles.skeletonDay, { width: column }]}
              >
                <PixelSkeleton width={column - 4} height={MONTH_DAY_HEIGHT - 4} />
              </View>
            ))}
          </View>
        ))}
      </View>
      <View testID="month-view-loading-targets" style={styles.skeletonWeeks}>
        {Array.from({ length: SKELETON_WEEK_ROWS }, (_, index) => (
          <PixelSkeleton key={index} width="100%" height={WEEK_TARGETS_ROW_HEIGHT} />
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
      <Screen layout="top" testID="month-view" background={roles.night}>
        <LoadingView />
      </Screen>
    );
  }

  if (state.status === 'failed') {
    return (
      <Screen layout="top" testID="month-view" background={roles.night}>
        <StateMessage
          alert
          illustration="alert"
          title="Impossible de charger tes habitudes."
          text="Une erreur est survenue en lisant tes données sur ce téléphone."
          action={
            <View style={styles.actions}>
              <PixelButton
                label="Réessayer"
                onPress={() => {
                  void reload();
                  void experience.reload();
                }}
                style={styles.retry}
              />
              {!followsCurrentMonth && (
                <PixelLink label={BACK_TO_CURRENT_MONTH} onPress={goToCurrentMonth} />
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
    <Screen layout="top" testID="month-view" background={roles.night}>
      <CharacterBar xp={experience.xp} change={experience.change} compact />
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
          illustration="character"
          title="Ton mois est vide"
          text="Chaque jour affichera tes habitudes faites dès ta première habitude."
          action={
            onAddHabit && (
              <PixelButton
                label={ADD_HABIT_LABEL}
                icon="plus"
                onPress={onAddHabit}
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
            <View style={styles.back}>
              <PixelLink label={BACK_TO_CURRENT_MONTH} onPress={goToCurrentMonth} />
            </View>
          )}
          <MonthLegend />
          <Text style={[pixelTypography.label, styles.hint]}>{MONTH_HINT}</Text>
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
  list: { paddingHorizontal: 16, paddingTop: 2, paddingBottom: 112, gap: 6 },
  actions: { alignItems: 'center', gap: 4 },
  retry: { minWidth: 180 },
  back: { alignItems: 'center' },
  hint: { color: roles.parchment, paddingHorizontal: 4 },
  loading: { flex: 1 },
  skeletonNav: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  skeletonGrid: { gap: 2, marginHorizontal: 16, marginTop: 22 },
  skeletonWeek: { flexDirection: 'row', justifyContent: 'center' },
  skeletonDay: { height: MONTH_DAY_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  skeletonWeeks: { gap: 8, marginHorizontal: 16, marginTop: 40 },
});
// Stryker restore all
