import { type ReactNode, useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';

import type { HabitDay } from '../../../domain/checkIn/HabitDay';
import type { Difficulty } from '../../../domain/habit/Difficulty';
import { checkInStatusLabels } from '../format/checkInStatus';
import { capitalize } from '../format/formatDay';
import { type WeeklyProgressShown, weeklyProgressText } from '../format/formatWeeklyTarget';
import { editHabitLabel, habitDayAccessibilityLabel } from '../format/habitDayLabel';
import { artPalette } from '../pixelArt/artPalette';
import { HabitDayBox } from '../pixelArt/HabitDayBox';
import { MIN_TARGET_SIZE } from '../pixelArt/PixelButton';
import { type FrameTone, PixelFrame } from '../pixelArt/PixelFrame';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { pixelTypography } from '../pixelArt/pixelTypography';
import { BURST_FRAMES, burstSprite, type BurstFrame } from '../pixelArt/sprites/burstSprite';
import { toPixelImage } from '../pixelArt/sprites/Sprite';
import { SpriteCanvas } from '../pixelArt/SpriteCanvas';
import { useArtFrames } from '../pixelArt/useArtFrames';
import { WeekNotches } from '../pixelArt/WeekNotches';
import { useReducedMotion } from '../state/useReducedMotion';
import type { ShownXpChange } from '../state/xpFeedback';
import { DifficultyLabel } from './DifficultyIcon';
import { TargetReachedBadge } from './TargetReachedBadge';
import { XpFloat } from './XpFloat';

const { roles } = artPalette;

/** Les images où la coche est relevée d'un pixel d'art, au début de l'étincelle (rebond). */
const LIFTED_FRAMES = 2;

/**
 * L'étincelle d'une habitude qui passe à « fait » : 3 images autour de la case, à 12 images par
 * seconde, puis plus rien. Pendant ses 2 premières images, la case (`children`) dessine sa coche
 * un pixel d'art plus haut. Décorative.
 */
function Burst({ children }: { readonly children: (lifted: boolean) => ReactNode }) {
  const frame = useArtFrames(BURST_FRAMES + 1);
  return (
    <>
      {children(frame < LIFTED_FRAMES)}
      {frame < BURST_FRAMES && (
        <SpriteCanvas
          sprite={`burst-${frame}`}
          draw={() => toPixelImage(burstSprite(frame as BurstFrame))}
          scale={2}
          testID="habit-burst"
          style={styles.burst}
        />
      )}
    </>
  );
}

/** La ligne écrite sous le nom : l'état en gras et sa couleur, puis la progression de la semaine. */
function StatusLine({
  statusText,
  progressText,
  done,
  testID,
}: {
  readonly statusText: string;
  readonly progressText: string | undefined;
  readonly done: boolean;
  readonly testID: string | undefined;
}) {
  return (
    <Text {...(testID !== undefined && { testID })} style={[pixelTypography.label, styles.sub]}>
      <Text style={[pixelTypography.statusWord, { color: done ? roles.done : roles.gold }]}>
        {statusText}
      </Text>
      {progressText !== undefined && ` · ${progressText}`}
    </Text>
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
 */
export function HabitRow({
  habitDay,
  difficulty,
  weeklyProgress,
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
  readonly highlighted?: boolean;
  readonly xpChange?: ShownXpChange | undefined;
  /** Change quand l'objectif de la semaine vient d'être atteint ici : le badge s'allume (F1). */
  readonly targetFlash?: number | undefined;
  readonly onToggle?: (habitDay: HabitDay) => void;
  readonly onEdit?: (habitDay: HabitDay) => void;
  /** La place de la ligne dans la liste, quand elle change (la Vue Journée révèle une habitude créée). */
  readonly onLayout?: (event: LayoutChangeEvent) => void;
}) {
  const { habit, status, editable } = habitDay;
  const done = status === 'done';
  const reached = weeklyProgress?.targetReached === true;
  const reducedMotion = useReducedMotion();
  const [bursts, setBursts] = useState(0);

  const press = () => {
    if (status !== 'done' && !reducedMotion) {
      setBursts((count) => count + 1);
    }
    onToggle?.(habitDay);
  };

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
        accessibilityLabel={habitDayAccessibilityLabel({ habitDay, difficulty, weeklyProgress })}
        accessibilityState={{ checked: done, disabled: !editable }}
        disabled={!editable}
        onPress={press}
        testID={`habit-row-${habit.id}`}
        style={styles.row}
      >
        <View style={styles.boxSlot}>
          {bursts > 0 ? <Burst key={bursts}>{box}</Burst> : box(false)}
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
              progressText={weeklyProgress && weeklyProgressText(weeklyProgress)}
              done={done}
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
  burst: { position: 'absolute', left: -10, top: -10 },
  texts: { flex: 1, minWidth: 0, gap: 4 },
  name: { color: roles.light },
  subLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  sub: { color: roles.parchment, flexShrink: 1 },
  more: {
    width: MIN_TARGET_SIZE,
    minHeight: MIN_TARGET_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
// Stryker restore all
