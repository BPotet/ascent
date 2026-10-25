import { type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';

import type { HabitDay } from '../../../domain/checkIn/HabitDay';
import type { Difficulty } from '../../../domain/habit/Difficulty';
import { checkInStatusLabels, CORRECTED } from '../format/checkInStatus';
import { capitalize } from '../format/formatDay';
import { type WeeklyProgressShown, weeklyProgressText } from '../format/formatWeeklyTarget';
import { editHabitLabel, habitDayAccessibilityLabel } from '../format/habitDayLabel';
import { artPalette } from '../pixelArt/artPalette';
import { HabitDayBox } from '../pixelArt/HabitDayBox';
import { MIN_TARGET_SIZE } from '../pixelArt/PixelButton';
import { type FrameTone, PixelFrame } from '../pixelArt/PixelFrame';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { pixelTypography, textFont } from '../pixelArt/pixelTypography';
import { WeekNotches } from '../pixelArt/WeekNotches';
import type { ShownXpChange } from '../state/xpFeedback';
import { Burst, useBurst } from './Burst';
import { CorrectedMark } from './CorrectedMark';
import { DifficultyLabel } from './DifficultyIcon';
import { TargetReachedBadge } from './TargetReachedBadge';
import { XpFloat } from './XpFloat';

const { roles } = artPalette;

/** La ligne écrite sous le nom : l'état en gras et sa couleur, puis la progression de la semaine. */
function StatusLine({
  statusText,
  progressText,
  done,
  corrected,
  testID,
}: {
  readonly statusText: string;
  readonly progressText: string | undefined;
  readonly done: boolean;
  readonly corrected: boolean;
  readonly testID: string | undefined;
}) {
  return (
    <>
      <Text {...(testID !== undefined && { testID })} style={[pixelTypography.label, styles.sub]}>
        <Text style={[pixelTypography.statusWord, { color: done ? roles.done : roles.gold }]}>
          {statusText}
        </Text>
        {progressText !== undefined && ` · ${progressText}`}
      </Text>
      {corrected && <Text style={styles.corrected}>{CORRECTED}</Text>}
    </>
  );
}

/** Le trait du cadre d'une ligne : or si elle est mise en évidence, vert si elle est faite. */
function toneOf(highlighted: boolean, done: boolean, reached: boolean): FrameTone {
  if (highlighted) {
    return 'gold';
  }
  if (done) {
    return 'done';
  }
  return reached ? 'goldDark' : 'default';
}

/**
 * Ligne d'une habitude dans la Vue Journée, dans l'identité pixel art (E1, #72) : la case dessinée
 * (`HabitDayBox`), le nom en police de texte, l'état écrit en toutes lettres, la difficulté de la
 * semaine (sommets et nom), puis les crans de la semaine et « 2/5 cette semaine », et le badge
 * « Objectif atteint ». Toute la ligne est un interrupteur, de 72 dp au moins : la toucher appelle
 * `onToggle`, si la case est modifiable. Le lecteur d'écran lit la même annonce qu'avant #72
 * (`habitDayAccessibilityLabel`).
 *
 * Retours de jeu (F1), à 12 images par seconde : une habitude qui passe à « fait » fait éclater une
 * étincelle de 3 images autour de la case, dont la coche est relevée d'un pixel d'art pendant 2
 * images ; « +10 XP » s'envole de la case après un tap enregistré (`xpChange`, `XpFloat`) ; le badge
 * s'allume en 3 paliers quand l'objectif vient d'être atteint (`targetFlash`). Au retour en
 * arrière, ni étincelle ni rebond. En mouvement réduit, aucune de ces images : l'état final
 * s'affiche tout de suite.
 *
 * `highlighted` borde d'or une habitude qui vient d'être créée ou modifiée. Avec `onEdit`, le bouton
 * « ⋯ » de 48 × 48 dp, à droite, ouvre « Modifier l'habitude ».
 *
 * Dans le Détail du jour (#73), la progression est celle de la semaine du jour, que `weekLabel`
 * nomme (« Fait · 2/3 semaine du 12 octobre ») ; par défaut, « cette semaine ». Un jour corrigé
 * porte la marque « corrigé » sur sa case et le mot « corrigé » dans sa ligne d'état, lu dans
 * l'annonce. Un jour de la Vue Journée n'est jamais corrigé.
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
  onLayout,
}: {
  readonly habitDay: HabitDay;
  /** La difficulté de la semaine du jour affiché ; sans elle, la ligne n'en montre pas. */
  readonly difficulty?: Difficulty | undefined;
  /** La progression de la semaine en cours ; sans elle, la ligne n'en montre pas. */
  readonly weeklyProgress?: WeeklyProgressShown | undefined;
  /** La semaine de la progression (« semaine du 12 octobre ») ; par défaut, « cette semaine ». */
  readonly weekLabel?: string | undefined;
  readonly highlighted?: boolean;
  readonly xpChange?: ShownXpChange | undefined;
  /** Change quand l'objectif de la semaine vient d'être atteint ici : le badge s'allume (F1). */
  readonly targetFlash?: number | undefined;
  readonly onToggle?: (habitDay: HabitDay) => void;
  readonly onEdit?: (habitDay: HabitDay) => void;
  /** La place de la ligne dans la liste, quand elle change (la Vue Journée révèle une habitude créée). */
  readonly onLayout?: (event: LayoutChangeEvent) => void;
}) {
  const { habit, status, editable, corrected } = habitDay;
  const done = status === 'done';
  const reached = weeklyProgress?.targetReached === true;
  const { bursts, tap } = useBurst(status);

  const box = (lifted: boolean) => (
    <HabitDayBox status={status} lifted={lifted} testID={`habit-check-${habit.id}`} />
  );

  return (
    <PixelFrame
      tone={toneOf(highlighted, done, reached)}
      {...(onLayout !== undefined && { onLayout })}
      testID={`habit-card-${habit.id}`}
      style={styles.card}
    >
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel={habitDayAccessibilityLabel({
          habitDay,
          difficulty,
          weeklyProgress,
          weekLabel,
        })}
        accessibilityState={{ checked: done, disabled: !editable }}
        disabled={!editable}
        onPress={() => {
          tap();
          onToggle?.(habitDay);
        }}
        testID={`habit-row-${habit.id}`}
        style={styles.row}
      >
        <View testID={`habit-box-slot-${habit.id}`} style={styles.boxSlot}>
          {bursts > 0 ? (
            <Burst key={bursts} style={styles.burst}>
              {box}
            </Burst>
          ) : (
            box(false)
          )}
          {corrected && <CorrectedMark />}
          <XpFloat change={xpChange} />
        </View>
        <View style={styles.texts}>
          <Text style={[pixelTypography.habitName, styles.name]}>{habit.name.value}</Text>
          <View style={styles.subLine}>
            {difficulty && (
              <DifficultyLabel difficulty={difficulty} testID={`habit-difficulty-${habit.id}`} />
            )}
            <StatusLine
              statusText={capitalize(checkInStatusLabels[status])}
              progressText={weeklyProgress && weeklyProgressText(weeklyProgress, weekLabel)}
              done={done}
              corrected={corrected}
              testID={weeklyProgress && `habit-progress-${habit.id}`}
            />
          </View>
          {weeklyProgress && (
            <View style={styles.subLine}>
              <WeekNotches
                done={weeklyProgress.weeklyProgress}
                target={weeklyProgress.weekTarget}
                reached={reached}
              />
              {reached && (
                <TargetReachedBadge
                  flash={targetFlash}
                  testID={`habit-target-reached-${habit.id}`}
                />
              )}
            </View>
          )}
        </View>
      </Pressable>
      {onEdit && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={editHabitLabel(habit.name.value)}
          onPress={() => onEdit(habitDay)}
          testID={`edit-habit-${habit.id}`}
          style={styles.more}
        >
          <PixelIcon name="more" color={roles.parchment} />
        </Pressable>
      )}
    </PixelFrame>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  card: { flexDirection: 'row' },
  row: {
    flex: 1,
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 4,
  },
  boxSlot: { width: 44, height: 44 },
  burst: { left: -10, top: -10 },
  texts: { flex: 1, minWidth: 0, gap: 4 },
  name: { color: roles.light },
  subLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  sub: { color: roles.parchment, flexShrink: 1 },
  corrected: {
    fontFamily: textFont.semiBold,
    fontSize: 11,
    lineHeight: 15,
    color: roles.blue,
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
    textDecorationColor: roles.blue,
  },
  more: {
    width: MIN_TARGET_SIZE,
    minHeight: MIN_TARGET_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
// Stryker restore all
