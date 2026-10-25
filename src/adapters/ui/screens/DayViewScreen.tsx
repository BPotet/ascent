import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { DayView, DayViewHabit } from '../../../application/useCases/getDayView';
import type { HabitDay } from '../../../domain/checkIn/HabitDay';
import type { Day } from '../../../domain/day/Day';
import type { Habit, HabitId } from '../../../domain/habit/Habit';
import type { Week } from '../../../domain/week/Week';
import { MAX_HABITS } from '../../../domain/habit/HabitRules';
import { AddHabitButton } from '../components/AddHabitButton';
import { CharacterBar } from '../components/CharacterBar';
import { DayHeader } from '../components/DayHeader';
import { GoalsReachedNotice } from '../components/GoalsReachedNotice';
import { HabitRow } from '../components/HabitRow';
import { Notice } from '../components/Notice';
import { Screen } from '../components/Screen';
import { StateMessage } from '../components/StateMessage';
import { Toast } from '../components/Toast';
import { WhatsNewCard } from '../components/WhatsNewCard';
import { YesterdayReminderBanner } from '../components/YesterdayReminderBanner';
import { ADD_HABIT_LABEL, HABIT_LIMIT_MESSAGE } from '../format/addHabit';
import { CHECK_IN_SAVE_FAILED, correctionMessage } from '../format/checkInMessages';
import { formatDayAndMonth } from '../format/formatDay';
import type { WeeklyProgressShown } from '../format/formatWeeklyTarget';
import type { TargetFeedback } from '../format/targetFeedback';
import {
  targetToastOf,
  type ToastAction,
  type ToastTarget,
  type ToastVariant,
} from '../format/toast';
import { useCheckInHint } from '../state/useCheckInHint';
import { useCreateHabit } from '../state/useCreateHabit';
import { useDayView } from '../state/useDayView';
import { type XpChange, useExperience, xpChangeOn } from '../state/Experience';
import {
  type TargetFlash,
  targetFlashOn,
  updatedTargetPlay,
  useTargetFeedback,
} from '../state/useTargetFeedback';
import { useTodayChange } from '../state/useTodayChange';
import { useWhatsNewCard } from '../state/useWhatsNewCard';
import { useYesterdayReminder } from '../state/useYesterdayReminder';
import { artPalette } from '../pixelArt/artPalette';
import { PixelButton } from '../pixelArt/PixelButton';
import { PixelFrame } from '../pixelArt/PixelFrame';
import { pixelTypography } from '../pixelArt/pixelTypography';
import { PixelSkeleton } from '../pixelArt/PixelSkeleton';
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
  /** Le feedback « Objectif atteint » (#26) : sa forme, son texte et son annonce. */
  readonly variant?: ToastVariant;
  readonly target?: ToastTarget;
  readonly announcement?: string;
}

const { roles } = artPalette;

/** Le nombre de lignes que réserve le squelette de chargement. */
const SKELETON_ROWS = 5;

/**
 * Le chargement : l'en-tête du personnage tout de suite, et un squelette au pixel d'art qui réserve
 * la place du titre, du compteur et des lignes (sans clignoter en mouvement réduit).
 */
function LoadingView({ xp }: { readonly xp: number | null }) {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Chargement de tes habitudes"
      accessibilityState={{ busy: true }}
      testID="day-view-loading"
      style={styles.loading}
    >
      <CharacterBar xp={xp} change={null} />
      <View>
        <View style={styles.loadingHeader}>
          <View>
            <PixelSkeleton width={150} height={26} />
            <View style={styles.skeletonGap} />
            <PixelSkeleton width={120} height={12} />
          </View>
          <PixelSkeleton width={80} height={22} />
        </View>
        <View style={styles.list}>
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <PixelFrame key={index} style={styles.skeletonRow}>
              <PixelSkeleton width={44} height={44} />
              <View style={styles.skeletonTexts}>
                <PixelSkeleton width="62%" height={14} />
                <View testID="day-view-loading-secondary-line">
                  <PixelSkeleton width="44%" height={10} />
                </View>
              </View>
            </PixelFrame>
          ))}
        </View>
      </View>
    </View>
  );
}

/** La progression de la semaine affichée sur une ligne, si sa semaine a un objectif. */
function weeklyProgressShownOf({
  weeklyProgress,
  weekSettings: { weekTarget },
  targetReached,
}: DayViewHabit): WeeklyProgressShown | undefined {
  return weekTarget === null ? undefined : { weeklyProgress, weekTarget, targetReached };
}

/** La place d'une ligne dans la liste : son haut et sa hauteur, en dp. */
interface RowPlace {
  readonly y: number;
  readonly height: number;
}

/** La hauteur du bouton flottant avant sa mesure : 56 dp. */
const FAB_HEIGHT = 56;

/**
 * L'espace réservé sous la dernière ligne de la liste, au moins : le bouton flottant « Ajouter une
 * habitude » et, au-dessus de lui, le message d'une habitude créée (à 84 dp du bas, sur deux
 * lignes : 60 dp), plus un écart de 8 dp. Une habitude créée est révélée au-dessus des deux.
 */
export const LIST_BOTTOM_SPACE = 152;

/** Le délai après lequel le défilement de révélation vérifie qu'il a bien eu lieu. */
export const REVEAL_CHECK_MS = 120;

/** Le nombre de défilements de révélation, au plus, pour une même habitude créée. */
const REVEAL_ATTEMPTS = 5;

/**
 * L'espace sous la dernière ligne de la liste : `LIST_BOTTOM_SPACE`, ou plus si le bouton flottant
 * grandit avec le texte (la marge du bas de l'écran, 16, le bouton, `fabHeight`, mesuré, et un
 * écart, 8). Le libellé « Habitudes » reste ainsi au-dessus du bouton, en bas de la liste.
 */
export function listBottomSpaceOf(fabHeight: number | undefined): number {
  return Math.max(LIST_BOTTOM_SPACE, 16 + (fabHeight ?? FAB_HEIGHT) + 8);
}

/**
 * Le défilement qui montre une ligne sous le bord de l'écran, sous le bouton flottant ou sous le
 * message de création, juste assez pour voir son bas au-dessus d'eux (`bottomSpace`,
 * `listBottomSpaceOf`) ; `null` si elle est déjà visible (ou si la hauteur visible n'est pas encore
 * connue).
 */
export function revealOffsetOf(
  { y, height }: RowPlace,
  shown: { readonly offset: number; readonly height: number },
  bottomSpace: number,
): number | null {
  const bottom = y + height + bottomSpace;
  if (shown.height === 0 || bottom <= shown.offset + shown.height) {
    return null;
  }
  return bottom - shown.height;
}

function HabitList({
  view,
  bottomSpace,
  highlighted,
  xpChange,
  targetFlash,
  showHint,
  whatsNew,
  reminder,
  onToggle,
  onEdit,
}: {
  readonly view: DayView;
  /** L'espace réservé sous la liste, pour le bouton et le message (`listBottomSpaceOf`). */
  readonly bottomSpace: number;
  readonly highlighted: Highlight | null;
  readonly xpChange: XpChange | null;
  readonly targetFlash: TargetFlash | null;
  readonly showHint: boolean;
  readonly whatsNew: ReactNode;
  readonly reminder: ReactNode;
  readonly onToggle: (habitDay: HabitDay) => void;
  readonly onEdit: (row: DayViewHabit) => void;
}) {
  const scroll = useRef<ScrollView>(null);
  /** La place de chaque ligne dans la liste, et la partie de la liste à l'écran. */
  const rows = useRef(new Map<HabitId, RowPlace>());
  const shown = useRef({ offset: 0, height: 0 });
  /** La hauteur du contenu de la liste, telle que la liste l'a reçue. */
  const contentHeight = useRef(0);
  /** L'habitude créée déjà révélée (ou laissée au joueur) : elle ne bouge plus sous son doigt. */
  const revealed = useRef<HabitId | null>(null);
  /** Les défilements déjà demandés pour l'habitude créée, et la vérification à venir. */
  const attempts = useRef<{ id: HabitId | null; count: number }>({ id: null, count: 0 });
  const check = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(check.current), []);
  // Une habitude créée, en bas de la liste, n'y est montrée que si elle est sous le bord de
  // l'écran, sous le bouton ou sous le message de création, et juste assez : les encarts du haut
  // (aide, « Toutes faites ») restent à l'écran. Le défilement est immédiat.
  // Sous Android, il peut être demandé avant que la ligne ne soit montée : il s'arrête alors au
  // bas de l'ancien contenu, sans erreur ni nouvel événement. Il est donc vérifié par la position
  // reçue (`onScroll`) et redemandé, au prochain événement de mise en page ou après
  // `REVEAL_CHECK_MS`, `REVEAL_ATTEMPTS` fois au plus. Il est fini dès que la ligne est à l'écran,
  // ou dès que le joueur fait défiler la liste lui-même.
  const reveal = () => {
    if (highlighted?.reveal !== true || revealed.current === highlighted.id) {
      return;
    }
    const { id } = highlighted;
    const row = rows.current.get(id);
    if (row === undefined || shown.current.height === 0) {
      return;
    }
    const wanted = revealOffsetOf(row, shown.current, bottomSpace);
    if (wanted === null) {
      revealed.current = id;
      return;
    }
    // Pas plus loin que le contenu connu : il grandira, et le défilement suivra.
    const reachable =
      contentHeight.current > 0 ? contentHeight.current - shown.current.height : wanted;
    const target = Math.min(wanted, reachable);
    if (target <= shown.current.offset + 1) {
      return;
    }
    if (attempts.current.id !== id) {
      attempts.current = { id, count: 0 };
    }
    if (attempts.current.count >= REVEAL_ATTEMPTS) {
      revealed.current = id;
      return;
    }
    attempts.current.count += 1;
    scroll.current?.scrollTo({ y: target, animated: false });
    clearTimeout(check.current);
    check.current = setTimeout(reveal, REVEAL_CHECK_MS);
  };
  const { doneCount, expectedCount } = view;
  const activeCount = view.habits.length;
  // Seules les habitudes attendues comptent (#25) : sans aucune, « Objectifs de la semaine
  // atteints » remplace « Toutes faites ».
  const allDone = expectedCount > 0 && doneCount === expectedCount;
  const goalsReached = activeCount > 0 && expectedCount === 0;
  const count = view.habitCount;
  // « Toutes faites » et « Objectifs de la semaine atteints » apparaissent en haut de la liste : la
  // liste y remonte s'ils naissent au-dessus de la partie à l'écran.
  const topMoment = allDone || goalsReached;
  useEffect(() => {
    if (topMoment && shown.current.offset > 0) {
      scroll.current?.scrollTo({ y: 0, animated: true });
    }
  }, [topMoment]);
  return (
    <>
      <DayHeader
        day={view.day}
        doneCount={doneCount}
        expectedCount={expectedCount}
        activeCount={activeCount}
      />
      <ScrollView
        ref={scroll}
        contentContainerStyle={[styles.list, styles.fill, { paddingBottom: bottomSpace }]}
        onContentSizeChange={(_width, height) => {
          contentHeight.current = height;
          reveal();
        }}
        onLayout={({ nativeEvent }) => {
          shown.current = { ...shown.current, height: nativeEvent.layout.height };
        }}
        onScroll={({ nativeEvent }) => {
          shown.current = { ...shown.current, offset: nativeEvent.contentOffset.y };
          // La position reçue confirme (ou non) le défilement de révélation en cours.
          if (attempts.current.id === highlighted?.id) {
            reveal();
          }
        }}
        onScrollBeginDrag={() => {
          // Le joueur fait défiler lui-même : la révélation s'arrête là.
          revealed.current = highlighted?.id ?? null;
        }}
        scrollEventThrottle={16}
        testID="day-view-list"
      >
        {whatsNew}
        {reminder}
        {goalsReached && <GoalsReachedNotice />}
        {allDone && <Notice kind="celebration" text={ALL_DONE_MESSAGE} testID="all-done" />}
        {showHint && <Notice kind="hint" text={CHECK_IN_HINT} testID="check-in-hint" />}
        {view.habits.map((habitDay) => (
          <HabitRow
            key={habitDay.habit.id}
            habitDay={habitDay}
            difficulty={habitDay.weekSettings.difficulty}
            weeklyProgress={weeklyProgressShownOf(habitDay)}
            highlighted={habitDay.habit.id === highlighted?.id}
            xpChange={xpChangeOn(xpChange, habitDay)}
            targetFlash={targetFlashOn(targetFlash, habitDay)}
            onToggle={onToggle}
            onEdit={() => onEdit(habitDay)}
            onLayout={({ nativeEvent: { layout } }) => {
              rows.current.set(habitDay.habit.id, { y: layout.y, height: layout.height });
              if (habitDay.habit.id === highlighted?.id) {
                reveal();
              }
            }}
          />
        ))}
        <View testID="day-view-section" style={styles.section}>
          <Text style={[pixelTypography.label, styles.sectionTitle]}>Habitudes</Text>
          <Text
            accessibilityLabel={`${count} ${count > 1 ? 'habitudes' : 'habitude'} sur ${MAX_HABITS}`}
            style={[pixelTypography.label, view.canAddHabit ? styles.sectionCount : styles.full]}
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
 * L'en-tête compte les habitudes faites sur les habitudes attendues (« 1/2 faites », #25) : une
 * habitude dont l'objectif de la semaine est atteint et qui n'est pas faite aujourd'hui reste dans
 * la liste, avec son badge, tapable, mais ne compte pas ; touchée, elle compte de nouveau tout de
 * suite. « Toutes faites » ne porte que sur les habitudes attendues ; sans aucune, « Atteints » et
 * le message « Objectifs de la semaine atteints » le remplacent, sans célébration.
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
 * Un tap qui atteint l'objectif de la semaine joue F1 (#26, `useTargetFeedback`) : badge
 * « Objectif atteint » avec un éclat doré, seconde pastille « +15 XP prime », message en bas
 * « Objectif de la semaine atteint · Courir 5 km 3/3 · +15 XP prime », seconde vibration. Un tap qui
 * repasse sous l'objectif retire le badge, avec « −15 XP prime » en gris et un message discret, sans
 * vibration. Après « Enregistrer » dans « Modifier l'habitude », F1 se joue aussi quand l'objectif,
 * baissé le jour de création, est atteint. Le message ne masque jamais la barre d'onglets.
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
  const [fabHeight, setFabHeight] = useState<number | undefined>(undefined);

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

  const showTargetToast = useCallback((feedback: TargetFeedback) => {
    toastCount.current += 1;
    setToast({ id: toastCount.current, ...targetToastOf(feedback) });
  }, []);
  const target = useTargetFeedback({ showToast: showTargetToast });
  const { play } = target;

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
          // F1 ou le retour sous l'objectif remplace le message de la correction (#26).
          const played = play(
            outcome,
            outcome.habitDay,
            outcome.isCorrection && outcome.habitDay.corrected,
          );
          if (outcome.isCorrection && !played) {
            showToast(correctionMessage(outcome.habitDay.day));
          }
        } else if (outcome.reason === 'saveFailed') {
          showToast(CHECK_IN_SAVE_FAILED, { label: 'Réessayer', onPress: () => void attempt() });
        }
      }
      return attempt();
    },
    [toggle, dismissHint, showToast, play],
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
  const created = (habit: Habit, message: string) => {
    setSheetOpen(false);
    setHighlighted({ id: habit.id, reveal: true });
    showToast(message);
    void refresh();
  };
  const closeEditing = () => setEditing(null);
  const updated = (outcome: UpdatedHabit, today: Day) => {
    setEditing(null);
    setHighlighted({ id: outcome.habit.id, reveal: false });
    // L'objectif, baissé le jour de création, est atteint : F1 remplace « Habitude modifiée » (E7).
    const played =
      outcome.targetReachedChange === 'reached' &&
      play(updatedTargetPlay(outcome, today), { habit: outcome.habit, day: today });
    if (!played) {
      showToast(updatedMessage(outcome));
    }
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
      <Screen layout="top" testID="day-view" background={roles.night}>
        <LoadingView xp={experience.xp} />
      </Screen>
    );
  }

  if (state.status === 'failed') {
    return (
      <Screen layout="top" testID="day-view" background={roles.night}>
        <CharacterBar xp={experience.xp} change={null} />
        <StateMessage
          alert
          illustration="alert"
          title="Impossible de charger tes habitudes."
          text="Une erreur est survenue en lisant tes données sur ce téléphone."
          action={
            <PixelButton
              label="Réessayer"
              onPress={() => {
                void reload();
                void experience.reload();
              }}
              style={styles.retry}
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
    <Screen layout="top" testID="day-view" background={roles.night}>
      <CharacterBar xp={experience.xp} change={experience.change} />
      {empty ? (
        <StateMessage
          illustration="character"
          title="Aucune habitude pour l’instant"
          text="Crée ta première habitude et commence à gagner de l’expérience."
          action={
            <PixelButton
              label={ADD_HABIT_LABEL}
              icon="plus"
              onPress={openSheet}
              testID="add-habit"
            />
          }
          testID="day-view-empty"
        />
      ) : (
        <>
          <HabitList
            view={view}
            bottomSpace={listBottomSpaceOf(fabHeight)}
            highlighted={highlighted}
            xpChange={experience.change}
            targetFlash={target.flash}
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
                  expectedCount={reminder.expectedCount}
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
            onLayout={({ nativeEvent }) => setFabHeight(nativeEvent.layout.height)}
          />
        </>
      )}
      {toast !== null && (
        <Toast
          key={toast.id}
          message={toast.message}
          {...(toast.action && { action: toast.action })}
          {...(toast.variant && { variant: toast.variant })}
          {...(toast.target && { target: toast.target })}
          {...(toast.announcement !== undefined && { announcement: toast.announcement })}
          onHide={hideToast}
          aboveButton={!empty}
        />
      )}
      {sheetOpen && (
        <NewHabitSheet
          habits={view.habits.map(({ habit }) => habit)}
          today={view.day}
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
          today={view.day}
          onUpdated={(outcome) => updated(outcome, view.day)}
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
  list: { paddingHorizontal: 16, paddingTop: 4, gap: 8 },
  /** La liste prend toute la hauteur visible, même courte : sa marge basse reste réservée. */
  fill: { flexGrow: 1 },
  section: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginHorizontal: 2,
  },
  sectionTitle: {
    color: roles.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
  },
  sectionCount: { color: roles.muted, fontSize: 12 },
  full: { color: roles.gold, fontSize: 12 },
  retry: { minWidth: 180 },
  loading: { flex: 1 },
  loadingHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  skeletonGap: { height: 8 },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 72,
    padding: 12,
  },
  skeletonTexts: { flex: 1, gap: 8 },
});
// Stryker restore all
