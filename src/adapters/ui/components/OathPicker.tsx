import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import type { CampHabit, CampView } from '../../../application/useCases/CampSession';
import type { PowerKind } from '../../../domain/battle/powers';
import type { HabitId } from '../../../domain/habit/Habit';
import { RETRY } from '../format/campText';
import {
  GO_TO_DAY,
  HABITS_UNREADABLE,
  NO_HABIT,
  OATH_FAILED,
  OATH_FROM_TOMORROW,
  SWEAR_OATH,
  SWEAR_OFF_LABEL,
  boundElsewhere,
  pickerEmptyIntro,
  pickerIntro,
  swearOnLabel,
} from '../format/oathText';
import { TREE_POWER_NAMES } from '../format/powerText';
import { artPalette } from '../pixelArt/artPalette';
import { artPixelSize } from '../pixelArt/artPixel';
import { PixelButton } from '../pixelArt/PixelButton';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { PixelSheet } from '../pixelArt/PixelSheet';
import { pixelFont, textFont } from '../pixelArt/pixelTypography';
import { useReducedMotion } from '../state/useReducedMotion';

const { roles } = artPalette;
const LINE = artPixelSize(2);

/** Une bande d'information ou d'erreur de la feuille. */
function Band({ tone, children }: { readonly tone: 'info' | 'error'; readonly children: string }) {
  const error = tone === 'error';
  return (
    <View
      accessible
      {...(error && { role: 'alert' as const })}
      style={[
        styles.band,
        {
          borderWidth: LINE,
          borderColor: error ? roles.curse : roles.blue,
          backgroundColor: error ? roles.errorBg : roles.raised,
        },
      ]}
    >
      <Text style={[styles.bandText, { color: error ? roles.pink : roles.light }]}>{children}</Text>
    </View>
  );
}

/**
 * Le choix de l'habitude d'un Serment (#237, maquette 232 : S2 et S3), en feuille : une ligne de
 * 56 dp par habitude, dans l'ordre de création, un toucher pour choisir. Une habitude qui tient le
 * Serment d'un autre pouvoir le dit et ne se choisit pas ; celle du Serment actuel est cochée, et
 * « Prêter serment » reste éteint tant que le choix ne change pas. Sans habitude, la feuille dit où
 * en créer une ; habitudes illisibles, elle propose de les relire.
 */
export function OathPicker({
  power,
  habits,
  oaths,
  error,
  onSwear,
  onRetryHabits,
  onGoToDay,
  onClose,
}: {
  readonly power: PowerKind;
  readonly habits: readonly CampHabit[] | null;
  readonly oaths: CampView['oaths'];
  /** Le dernier Serment n'a pas pu être enregistré. */
  readonly error: boolean;
  readonly onSwear: (habit: HabitId) => void;
  readonly onRetryHabits: () => void;
  /** Va à la Vue Journée ; absent, la feuille ne propose pas d'y aller. */
  readonly onGoToDay?: () => void;
  readonly onClose: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const { height } = useWindowDimensions();
  const title = useRef<Text>(null);
  const current = oaths[power]?.habit ?? null;
  const [chosen, setChosen] = useState<HabitId | null>(current);

  useEffect(() => {
    if (title.current !== null) AccessibilityInfo.sendAccessibilityEvent(title.current, 'focus');
  }, []);

  const boundTo = (habit: HabitId) =>
    (Object.entries(oaths) as [PowerKind, { readonly habit: HabitId }][]).find(
      ([other, oath]) => other !== power && oath.habit === habit,
    )?.[0];

  const body = () => {
    if (habits === null) {
      return (
        <>
          <Band tone="error">{HABITS_UNREADABLE}</Band>
          <PixelButton label={RETRY} onPress={onRetryHabits} />
        </>
      );
    }
    if (habits.length === 0) {
      return (
        <>
          <Text style={styles.line}>{pickerEmptyIntro(power)}</Text>
          <Band tone="info">{NO_HABIT}</Band>
          {onGoToDay === undefined ? null : (
            <PixelButton label={GO_TO_DAY} variant="secondary" onPress={onGoToDay} />
          )}
        </>
      );
    }
    const choice = habits.find(({ id }) => id === chosen);
    const ready = choice !== undefined && chosen !== current;
    return (
      <>
        <Text style={styles.line}>{pickerIntro(power)}</Text>
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="Habitudes"
          testID="oath-habits"
          style={styles.list}
        >
          {habits.map(({ id, name }) => {
            const other = boundTo(id);
            const selected = id === chosen;
            return (
              <Pressable
                key={id}
                accessibilityRole="radio"
                accessibilityLabel={
                  other === undefined ? name : `${name}, déjà liée à ${TREE_POWER_NAMES[other]}`
                }
                accessibilityState={{ checked: selected, disabled: other !== undefined }}
                disabled={other !== undefined}
                onPress={() => setChosen(id)}
                testID={`oath-habit-${id}`}
                style={[
                  styles.row,
                  { borderWidth: LINE, borderColor: selected ? roles.gold : roles.line },
                ]}
              >
                <View
                  style={[
                    styles.radio,
                    { borderWidth: LINE, borderColor: selected ? roles.gold : roles.line },
                  ]}
                >
                  {selected ? <View style={styles.radioDot} /> : null}
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.name, other !== undefined && styles.taken]}>{name}</Text>
                  {other === undefined ? null : (
                    <Text style={styles.other}>{boundElsewhere(other)}</Text>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
        {error ? <Band tone="error">{OATH_FAILED}</Band> : null}
        <View style={styles.note}>
          <PixelIcon name="info" color={roles.blue} />
          <Text style={styles.noteText}>{OATH_FROM_TOMORROW}</Text>
        </View>
        <PixelButton
          label={ready ? swearOnLabel(choice.name) : SWEAR_OFF_LABEL}
          text={SWEAR_OATH}
          icon="oath8"
          disabled={!ready}
          onPress={() => {
            if (ready) onSwear(choice.id);
          }}
          testID="oath-swear"
        />
      </>
    );
  };

  return (
    <Modal
      transparent
      visible
      animationType={reducedMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
      testID="oath-picker-modal"
    >
      <View style={styles.container}>
        <Pressable accessible={false} onPress={onClose} style={styles.scrim} />
        <PixelSheet
          accessibilityViewIsModal
          accessibilityLabel={`${SWEAR_OATH} : ${TREE_POWER_NAMES[power]}`}
          testID="oath-picker"
          style={[styles.sheet, { maxHeight: height * 0.9 }]}
        >
          <View style={styles.titleRow}>
            <Text ref={title} accessibilityRole="header" style={styles.title}>
              {SWEAR_OATH}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fermer"
              onPress={onClose}
              style={styles.close}
            >
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>
          {body()}
        </PixelSheet>
      </View>
    </Modal>
  );
}

// Stryker disable all: valeurs purement visuelles, vérifiées par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: roles.scrim },
  sheet: { paddingTop: 12, paddingHorizontal: 16, paddingBottom: 30, gap: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { flex: 1, fontFamily: pixelFont, fontSize: 24, lineHeight: 28, color: roles.light },
  close: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontFamily: pixelFont, fontSize: 26, lineHeight: 30, color: roles.light },
  line: { fontFamily: textFont.medium, fontSize: 13, lineHeight: 18, color: roles.parchment },
  list: { gap: 6 },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: roles.surface,
  },
  radio: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: roles.well,
  },
  radioDot: { width: 10, height: 10, backgroundColor: roles.gold },
  rowText: { flex: 1, gap: 1 },
  name: { fontFamily: textFont.semiBold, fontSize: 15, lineHeight: 19, color: roles.light },
  taken: { color: roles.muted },
  other: { fontFamily: textFont.medium, fontSize: 12, lineHeight: 16, color: roles.blue },
  band: { padding: 10 },
  bandText: { fontFamily: textFont.medium, fontSize: 13, lineHeight: 18 },
  note: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  noteText: {
    flex: 1,
    fontFamily: textFont.medium,
    fontSize: 12.5,
    lineHeight: 17,
    color: roles.parchment,
  },
});
// Stryker restore all
