import { useCallback, useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Day } from '../../../domain/day/Day';
import { WEEKLY_TARGETS, type WeeklyTarget } from '../../../domain/habit/WeeklyTarget';
import { creationWeekTargetOf } from '../../../domain/habit/WeekSettings';
import {
  creationWeekNote,
  weeklyTargetOptionLabel,
  weeklyTargetPhrase,
} from '../format/formatWeeklyTarget';
import { useLargeText } from '../state/useLargeText';
import { colors } from '../theme/colors';
import { MIN_TOUCH_SIZE, radii } from '../theme/metrics';
import { typography } from '../theme/typography';

/** Le titre du bloc, et le nom du groupe pour le lecteur d'écran. */
export const WEEKLY_TARGET_TITLE = 'Objectif hebdomadaire';

/** Taille d'une pastille (maquette, « Accessibilité ») : 44 × 44 pt, au plus. */
const PILL_SIZE = 44;
/** L'écart minimal entre deux pastilles, quand la rangée est trop étroite pour 7 × 44 pt. */
const PILL_MIN_GAP = 2;
/** Taille d'un bouton du compteur en grand texte : 56 pt. */
const STEP_SIZE = 56;

/** L'objectif voisin de `value`, dans l'ordre de `WEEKLY_TARGETS`, s'il existe. */
function neighbour(value: WeeklyTarget, step: -1 | 1): WeeklyTarget | undefined {
  return WEEKLY_TARGETS[WEEKLY_TARGETS.indexOf(value) + step];
}

/**
 * La taille des pastilles d'après la largeur de leur rangée : 44 pt quand les sept y tiennent
 * (maquette, 390 pt), sinon elles se partagent la largeur (écran de 320 dp). En dessous de 44 pt,
 * la zone de toucher est complétée jusqu'à 44 pt par un `hitSlop`.
 */
export function pillSizeFor(rowWidth: number): number {
  const count = WEEKLY_TARGETS.length;
  const shared = Math.floor((rowWidth - (count - 1) * PILL_MIN_GAP) / count);
  return Math.max(0, Math.min(PILL_SIZE, shared));
}

function usePillSize(): {
  readonly size: number;
  readonly onLayout: (event: LayoutChangeEvent) => void;
} {
  const [size, setSize] = useState(PILL_SIZE);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setSize(pillSizeFor(event.nativeEvent.layout.width));
  }, []);
  return { size, onLayout };
}

/** Les sept pastilles, de 1 à 7, en groupe radio. */
function Pills({
  value,
  onChange,
}: {
  readonly value: WeeklyTarget;
  readonly onChange: (target: WeeklyTarget) => void;
}) {
  const { size, onLayout } = usePillSize();
  const slop = Math.max(0, Math.ceil((MIN_TOUCH_SIZE - size) / 2));
  return (
    <View
      onLayout={onLayout}
      accessibilityRole="radiogroup"
      accessibilityLabel={WEEKLY_TARGET_TITLE}
      testID="weekly-target-picker"
      style={styles.pills}
    >
      {WEEKLY_TARGETS.map((target) => {
        const selected = target === value;
        return (
          <Pressable
            key={target}
            accessibilityRole="radio"
            accessibilityLabel={weeklyTargetOptionLabel(target)}
            accessibilityState={{ checked: selected, selected }}
            onPress={() => onChange(target)}
            hitSlop={slop}
            testID={`weekly-target-option-${target}`}
            style={[
              styles.pill,
              { width: size, height: size, borderRadius: size / 2 },
              selected && styles.pillSelected,
            ]}
          >
            <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{target}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Le compteur « − 3 + » du grand texte : deux boutons de 56 pt pour les doigts, et pour le lecteur
 * d'écran un seul réglage (« Objectif hebdomadaire, 3 fois par semaine »), qu'on monte ou descend.
 */
function Stepper({
  value,
  onChange,
}: {
  readonly value: WeeklyTarget;
  readonly onChange: (target: WeeklyTarget) => void;
}) {
  const less = neighbour(value, -1);
  const more = neighbour(value, 1);
  const go = (target: WeeklyTarget | undefined) => {
    if (target !== undefined) {
      onChange(target);
    }
  };
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={WEEKLY_TARGET_TITLE}
      accessibilityValue={{
        min: WEEKLY_TARGETS[0],
        max: WEEKLY_TARGETS.at(-1),
        now: value,
        text: weeklyTargetOptionLabel(value),
      }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={({ nativeEvent: { actionName } }) => {
        if (actionName === 'increment') {
          go(more);
        } else if (actionName === 'decrement') {
          go(less);
        }
      }}
      testID="weekly-target-stepper"
      style={styles.stepper}
    >
      <Pressable
        accessibilityState={{ disabled: less === undefined }}
        disabled={less === undefined}
        onPress={() => go(less)}
        testID="weekly-target-less"
        style={[styles.step, less === undefined && styles.stepDisabled]}
      >
        <Text style={styles.stepText}>−</Text>
      </Pressable>
      <Text testID="weekly-target-value" style={styles.value}>
        {value}
      </Text>
      <Pressable
        accessibilityState={{ disabled: more === undefined }}
        disabled={more === undefined}
        onPress={() => go(more)}
        testID="weekly-target-more"
        style={[styles.step, more === undefined && styles.stepDisabled]}
      >
        <Text style={styles.stepText}>+</Text>
      </Pressable>
    </View>
  );
}

/**
 * Le bloc « Objectif » des panneaux « Nouvelle habitude » (E2) et « Modifier l'habitude » (E7) :
 * sept pastilles de 1 à 7 (44 × 44 pt, moins sur un écran étroit), la choisie pleine, puis la phrase qui confirme le choix
 * (« 3 fois par semaine », « Tous les jours »).
 *
 * Avec `creationDay` (aujourd'hui, quand c'est le jour de création de l'habitude), la phrase annonce
 * l'objectif de la semaine de création quand il est réduit aux jours restants (R6, maquette E2
 * « Semaine de création réduite ») : « Tous les jours · cette semaine : 5, à partir d’aujourd’hui ».
 *
 * Pour le lecteur d'écran, un groupe radio « Objectif hebdomadaire » dont chaque option est lue
 * « 3 fois par semaine », et 7 « 7 fois par semaine, tous les jours ». En grand texte, les pastilles
 * laissent place à un compteur « − 3 + » (maquette, « Accessibilité »).
 */
export function WeeklyTargetPicker({
  value,
  onChange,
  creationDay,
}: {
  readonly value: WeeklyTarget;
  readonly onChange: (target: WeeklyTarget) => void;
  /** Aujourd'hui, si c'est le jour de création de l'habitude ; sinon, rien n'est annoncé. */
  readonly creationDay?: Day | undefined;
}) {
  const largeText = useLargeText();
  const note =
    creationDay &&
    creationWeekNote({
      weeklyTarget: value,
      creationWeekTarget: creationWeekTargetOf(value, creationDay),
    });
  return (
    <View>
      <Text style={[typography.label, styles.title]}>{WEEKLY_TARGET_TITLE}</Text>
      {largeText ? (
        <Stepper value={value} onChange={onChange} />
      ) : (
        <Pills value={value} onChange={onChange} />
      )}
      <Text testID="weekly-target-phrase" style={[typography.notice, styles.phrase]}>
        {weeklyTargetPhrase(value)}
        {note && <Text style={styles.note}>{` · ${note}`}</Text>}
      </Text>
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  title: { color: colors.muted, fontWeight: '600', marginTop: 10, marginBottom: 6 },
  pills: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pill: {
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  pillText: { ...typography.button, color: colors.text },
  pillTextSelected: { color: colors.onAccent, fontWeight: '700' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  step: {
    width: STEP_SIZE,
    height: STEP_SIZE,
    borderRadius: radii.button + 2,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDisabled: { opacity: 0.45 },
  stepText: { ...typography.screenTitle, color: colors.text },
  value: { ...typography.screenTitle, color: colors.text, minWidth: 30, textAlign: 'center' },
  phrase: { color: colors.text, marginTop: 8, minHeight: 20 },
  note: { color: colors.muted },
});
// Stryker restore all
