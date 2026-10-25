import { Pressable, StyleSheet, View } from 'react-native';

import type { HabitDay } from '../../../domain/checkIn/HabitDay';
import type { Day } from '../../../domain/day/Day';
import { habitDayCellAccessibilityLabel } from '../format/habitDayLabel';
import { HabitDayBox } from '../pixelArt/HabitDayBox';
import { MIN_TARGET_SIZE } from '../pixelArt/PixelButton';
import type { ShownXpChange } from '../state/xpFeedback';
import { Burst, useBurst } from './Burst';
import { MAX_COLUMN_WIDTH } from './cellSize';
import { CorrectedMark } from './CorrectedMark';
import { XpFloat } from './XpFloat';

/** La taille de la case dessinée, centrée dans sa cible (maquette E4, `.cs`). */
const BOX_SIZE = 40;

/**
 * Case d'une habitude un jour donné dans la Vue Semaine, dans l'identité pixel art (E4) : la case
 * dessinée de 40 × 40 dp (`HabitDayBox`), centrée dans une cible aussi large que sa colonne
 * (`columnWidth`, 48 dp au plus) et haute de 48 dp au moins, sans `hitSlop` : un tap ne touche
 * jamais le jour voisin. Chaque état a son signe en plus de sa couleur : coche, croix, point,
 * tiret, cadre d'or « à faire ». Une case corrigée porte la marque « corrigé » en coin (R13).
 *
 * C'est un interrupteur : le toucher appelle `onToggle`, seulement si la case est modifiable
 * (aujourd'hui, ou un jour clos à corriger). Une case « hors habitude » ne change pas, mais un tap
 * appelle `onNotStartedPress` pour l'expliquer ; une case « à venir » ne réagit pas. Le lecteur
 * d'écran lit la même annonce qu'avant #73 (`habitDayCellAccessibilityLabel`). Un « fait » gardé sur
 * un jour après `today` (horloge reculée, R7) est atténué.
 *
 * Retours de jeu, ceux de la Vue Journée : le tap qui passe la case à « fait » joue l'étincelle et relève
 * sa coche d'un pixel d'art pendant 2 images (`Burst`), jamais par une mise à l'échelle ;
 * `xpChange` fait s'envoler le changement d'expérience (« +20 XP », ou « −20 XP »). Rien de tout
 * cela en mouvement réduit.
 */
export function HabitDayCell({
  habitDay,
  today,
  columnWidth = MAX_COLUMN_WIDTH,
  xpChange,
  onToggle,
  onNotStartedPress,
}: {
  readonly habitDay: HabitDay;
  readonly today: Day;
  /** La largeur de la colonne de la case (`weekColumnWidth`). */
  readonly columnWidth?: number;
  readonly xpChange?: ShownXpChange | undefined;
  readonly onToggle?: (habitDay: HabitDay) => void;
  readonly onNotStartedPress?: (habitDay: HabitDay) => void;
}) {
  const { habit, day, status, editable, corrected } = habitDay;
  const { bursts, tap } = useBurst(status);
  const iso = day.toIsoString();
  const explainsTap = !editable && status === 'notStarted' && onNotStartedPress !== undefined;

  const press = () => {
    if (!editable) {
      onNotStartedPress?.(habitDay);
      return;
    }
    tap();
    onToggle?.(habitDay);
  };

  const box = (lifted: boolean) => (
    <HabitDayBox
      status={status}
      size={BOX_SIZE}
      lifted={lifted}
      testID={`cell-box-${habit.id}-${iso}`}
    />
  );

  return (
    <View testID={`cell-slot-${habit.id}-${iso}`} style={{ width: columnWidth }}>
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel={habitDayCellAccessibilityLabel(habitDay)}
        accessibilityState={{ checked: status === 'done', disabled: !editable }}
        // Annoncée « indisponible », une case « hors habitude » reçoit quand même le tap qui l'explique.
        {...(!explainsTap && { disabled: !editable })}
        onPress={press}
        testID={`cell-${habit.id}-${iso}`}
        style={[styles.cell, status === 'done' && day.isAfter(today) && styles.dimmed]}
      >
        {/*
          Sur Android, une vue annoncée désactivée (`accessibilityState.disabled`) n'est jamais la
          cible d'un toucher, mais ses enfants peuvent l'être : cette surface, réelle et aussi grande
          que la case, reçoit le tap qui explique une case « hors habitude ».
        */}
        <View collapsable={false} testID={`cell-touch-${habit.id}-${iso}`} style={styles.surface}>
          <View style={styles.boxSlot}>
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
        </View>
      </Pressable>
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  cell: { width: '100%', minHeight: MIN_TARGET_SIZE },
  surface: {
    width: '100%',
    minHeight: MIN_TARGET_SIZE,
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxSlot: { width: BOX_SIZE, height: BOX_SIZE },
  burst: { left: -12, top: -12 },
  dimmed: { opacity: 0.6 },
});
// Stryker restore all
