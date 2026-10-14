import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { Habit } from '../../../domain/habit/Habit';
import { HabitName, habitNameLength, MAX_HABIT_NAME_LENGTH } from '../../../domain/habit/HabitName';
import { HABIT_LIMIT_MESSAGE } from '../components/AddHabitButton';
import { Button } from '../components/Button';
import { AlertGlyph } from '../components/Glyph';
import type { CreateHabitFailure, CreateHabitOutcome } from '../state/useCreateHabit';
import { useReducedMotion } from '../state/useReducedMotion';
import { colors } from '../theme/colors';
import { radii, spacing } from '../theme/metrics';
import { typography } from '../theme/typography';

const TOO_LONG_MESSAGE = `Le nom compte ${MAX_HABIT_NAME_LENGTH} caractères au plus.`;
const SAVE_FAILED_MESSAGE = 'L’habitude n’a pas pu être créée. Réessaie.';

/** Le message d'un refus, sous le champ. Le doublon nomme l'habitude qui porte déjà ce nom. */
function refusalMessage(
  reason: Exclude<CreateHabitFailure, 'saveFailed'>,
  typed: string,
  habits: readonly Habit[],
): string {
  switch (reason) {
    case 'duplicate': {
      const name = HabitName.parse(typed);
      const existing = habits.find((habit) => habit.name.sameAs(name))?.name ?? name;
      return `Tu as déjà une habitude « ${existing.value} ».`;
    }
    case 'tooLong':
      return TOO_LONG_MESSAGE;
    case 'limit':
      return HABIT_LIMIT_MESSAGE;
    case 'empty':
      return 'Le nom ne peut pas être vide.';
  }
}

/**
 * Panneau du bas « Nouvelle habitude » : un seul champ, clavier ouvert. Le compteur suit la règle
 * du domaine (`habitNameLength`) ; un nom trop long collé est gardé tel quel et expliqué, sans être
 * tronqué. Après un refus ou un échec d'enregistrement, la saisie est conservée.
 */
export function NewHabitSheet({
  habits,
  onCreate,
  onCreated,
  onClose,
}: {
  readonly habits: readonly Habit[];
  readonly onCreate: (rawName: string) => Promise<CreateHabitOutcome>;
  readonly onCreated: (habit: Habit) => void;
  readonly onClose: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const [name, setName] = useState('');
  const [failure, setFailure] = useState<CreateHabitFailure | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const length = habitNameLength(name);
  const tooLong = length > MAX_HABIT_NAME_LENGTH;
  const refusal = failure === null || failure === 'saveFailed' ? null : failure;
  const fieldError = refusal
    ? refusalMessage(refusal, name, habits)
    : tooLong
      ? TOO_LONG_MESSAGE
      : null;
  const canCreate = length > 0 && !tooLong && refusal === null && !submitting;

  useEffect(() => {
    if (fieldError !== null) {
      AccessibilityInfo.announceForAccessibility(fieldError);
    }
  }, [fieldError]);

  const changeName = (text: string) => {
    setName(text);
    setFailure(null);
  };

  const create = () => {
    if (!canCreate) {
      return;
    }
    setSubmitting(true);
    void onCreate(name).then((outcome) => {
      setSubmitting(false);
      if (outcome.ok) {
        onCreated(outcome.habit);
      } else {
        setFailure(outcome.reason);
      }
    });
  };

  return (
    <Modal
      transparent
      visible
      animationType={reducedMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
      testID="new-habit-sheet"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <Pressable
          accessible={false}
          onPress={onClose}
          testID="new-habit-scrim"
          style={styles.scrim}
        />
        <View accessibilityViewIsModal style={styles.sheet}>
          <View style={styles.grab} />
          <Text accessibilityRole="header" style={[typography.sheetTitle, styles.title]}>
            Nouvelle habitude
          </Text>
          <Text nativeID="new-habit-name-label" style={[typography.label, styles.label]}>
            Nom de l’habitude
          </Text>
          <TextInput
            accessibilityLabel="Nom de l’habitude"
            accessibilityLabelledBy="new-habit-name-label"
            autoFocus
            autoCapitalize="sentences"
            autoComplete="off"
            onChangeText={changeName}
            onSubmitEditing={create}
            placeholder="Ex. Cuisiner"
            placeholderTextColor={colors.placeholder}
            returnKeyType="done"
            submitBehavior="submit"
            testID="new-habit-name"
            value={name}
            style={[typography.input, styles.field, fieldError !== null && styles.invalid]}
          />
          <View style={styles.help}>
            <View style={styles.error}>
              {fieldError !== null && (
                <View
                  accessible
                  accessibilityRole="alert"
                  accessibilityLabel={fieldError}
                  accessibilityLiveRegion="assertive"
                  style={styles.errorRow}
                >
                  <AlertGlyph color={colors.danger} size={14} />
                  <Text style={[typography.label, styles.errorText]}>{fieldError}</Text>
                </View>
              )}
            </View>
            <Text
              accessibilityLabel={`${length} caractères sur ${MAX_HABIT_NAME_LENGTH}`}
              style={[typography.label, tooLong ? styles.countOver : styles.count]}
            >
              {`${length}/${MAX_HABIT_NAME_LENGTH}`}
            </Text>
          </View>
          {failure === 'saveFailed' && (
            <View
              accessible
              accessibilityRole="alert"
              accessibilityLabel={SAVE_FAILED_MESSAGE}
              accessibilityLiveRegion="assertive"
              style={styles.alert}
            >
              <AlertGlyph color={colors.onDangerSoft} />
              <Text style={[typography.toast, styles.alertText]}>{SAVE_FAILED_MESSAGE}</Text>
            </View>
          )}
          <View style={styles.actions}>
            <View style={styles.action}>
              <Button label="Annuler" variant="ghost" onPress={onClose} />
            </View>
            <View style={styles.action}>
              <Button
                label="Créer l’habitude"
                onPress={create}
                disabled={!canCreate}
                testID="create-habit"
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: colors.scrim },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    borderTopWidth: 1,
    borderColor: colors.line,
    paddingTop: spacing.sm,
    paddingHorizontal: 20,
    paddingBottom: 36,
  },
  grab: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.grab,
    alignSelf: 'center',
    marginBottom: 14,
  },
  title: { color: colors.text, marginBottom: spacing.lg },
  label: { color: colors.muted, marginBottom: 6 },
  field: {
    height: 52,
    paddingHorizontal: 14,
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: radii.field,
    backgroundColor: colors.background,
    color: colors.text,
  },
  invalid: { borderColor: colors.danger },
  help: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minHeight: 22,
    marginTop: 6,
  },
  error: { flex: 1 },
  errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  errorText: { color: colors.danger, flex: 1 },
  count: { color: colors.muted },
  countOver: { color: colors.danger },
  alert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.md,
    borderWidth: 1,
    borderColor: colors.dangerLine,
    backgroundColor: colors.dangerSoft,
  },
  alertText: { color: colors.onDangerSoft, flex: 1 },
  actions: { flexDirection: 'row', gap: 10, marginTop: spacing.lg },
  action: { flex: 1 },
});
// Stryker restore all
