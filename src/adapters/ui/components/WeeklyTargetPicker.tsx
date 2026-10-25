import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Day } from '../../../domain/day/Day';
import { WEEKLY_TARGETS, type WeeklyTarget } from '../../../domain/habit/WeeklyTarget';
import { creationWeekTargetOf } from '../../../domain/habit/WeekSettings';
import {
  creationWeekNote,
  weeklyTargetOptionLabel,
  weeklyTargetPhrase,
} from '../format/formatWeeklyTarget';
import { useLargeText } from '../state/useLargeText';
import { artPalette } from '../pixelArt/artPalette';
import { artPixelSize } from '../pixelArt/artPixel';
import { PixelChoice } from '../pixelArt/PixelChoice';
import { pixelTypography, textFont } from '../pixelArt/pixelTypography';

const { roles } = artPalette;

/** Le titre du bloc, et le nom du groupe pour le lecteur d'écran. */
export const WEEKLY_TARGET_TITLE = 'Objectif hebdomadaire';

/** Taille d'un bouton du compteur en grand texte : 56 dp. */
const STEP_SIZE = 56;

/** L'objectif voisin de `value`, dans l'ordre de `WEEKLY_TARGETS`, s'il existe. */
function neighbour(value: WeeklyTarget, step: -1 | 1): WeeklyTarget | undefined {
  return WEEKLY_TARGETS[WEEKLY_TARGETS.indexOf(value) + step];
}

/**
 * Les sept options, de 1 à 7, en groupe radio : elles se partagent la rangée (48 dp de haut au
 * moins), sans zone de toucher qui dépasse la leur ; la choisie est remplie d'or, avec sa coche.
 */
function Pills({
  value,
  onChange,
}: {
  readonly value: WeeklyTarget;
  readonly onChange: (target: WeeklyTarget) => void;
}) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={WEEKLY_TARGET_TITLE}
      testID="weekly-target-picker"
      style={styles.pills}
    >
      {WEEKLY_TARGETS.map((target) => (
        <PixelChoice
          key={target}
          label={weeklyTargetOptionLabel(target)}
          text={String(target)}
          filled
          checked={target === value}
          onPress={() => onChange(target)}
          testID={`weekly-target-option-${target}`}
        />
      ))}
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
        style={[styles.step, { borderWidth: LINE }, less === undefined && styles.stepDisabled]}
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
        style={[styles.step, { borderWidth: LINE }, more === undefined && styles.stepDisabled]}
      >
        <Text style={styles.stepText}>+</Text>
      </Pressable>
    </View>
  );
}

/**
 * Le bloc « Objectif » des panneaux « Nouvelle habitude » (E2) et « Modifier l'habitude » (E3),
 * dans l'identité pixel art : sept options de 1 à 7 (`PixelChoice`), la choisie remplie d'or avec
 * sa coche et un texte en gras, puis la phrase qui confirme le choix
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
    <View style={styles.block}>
      <Text style={styles.title}>{WEEKLY_TARGET_TITLE}</Text>
      {largeText ? (
        <Stepper value={value} onChange={onChange} />
      ) : (
        <Pills value={value} onChange={onChange} />
      )}
      <Text testID="weekly-target-phrase" style={styles.phrase}>
        {weeklyTargetPhrase(value)}
        {note && <Text style={styles.note}>{` · ${note}`}</Text>}
      </Text>
    </View>
  );
}

/** Le pixel d'art, arrondi au pixel physique du téléphone. */
const LINE = artPixelSize(2);

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  block: { gap: 6 },
  title: { fontFamily: textFont.semiBold, fontSize: 13, lineHeight: 17, color: roles.parchment },
  pills: { flexDirection: 'row', gap: 4 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  step: {
    width: STEP_SIZE,
    height: STEP_SIZE,
    borderColor: roles.line,
    backgroundColor: roles.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDisabled: { opacity: 0.45 },
  stepText: { ...pixelTypography.screenTitle, color: roles.light },
  value: { ...pixelTypography.screenTitle, color: roles.light, minWidth: 30, textAlign: 'center' },
  phrase: {
    fontFamily: textFont.semiBold,
    fontSize: 14,
    lineHeight: 20,
    color: roles.light,
    minHeight: 20,
  },
  note: { fontFamily: textFont.medium, fontSize: 13, color: roles.parchment },
});
// Stryker restore all
