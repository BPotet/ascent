import { type ReactNode, useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Modal,
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
import { useKeyboardVisible } from '../state/useKeyboardVisible';
import { useReducedMotion } from '../state/useReducedMotion';
import { colors } from '../theme/colors';
import { radii, spacing } from '../theme/metrics';
import { typography } from '../theme/typography';

export const TOO_LONG_MESSAGE = `Le nom compte ${MAX_HABIT_NAME_LENGTH} caractères au plus.`;
export const EMPTY_NAME_MESSAGE = 'Le nom ne peut pas être vide.';

/** Pourquoi le nom saisi n'a pas été enregistré : un refus de règle, ou l'enregistrement a échoué. */
export type HabitNameFailure = 'empty' | 'tooLong' | 'duplicate' | 'limit' | 'saveFailed';

/** Le message d'un refus, sous le champ. Le doublon nomme l'habitude qui porte déjà ce nom. */
function refusalMessage(
  reason: Exclude<HabitNameFailure, 'saveFailed'>,
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
      return EMPTY_NAME_MESSAGE;
  }
}

/** Le nom tel qu'il serait enregistré, ou `null` s'il ne respecte pas la règle. */
function cleanedName(raw: string): string | null {
  try {
    return HabitName.parse(raw).value;
  } catch {
    return null;
  }
}

/**
 * Le panneau du bas où l'on saisit le nom d'une habitude, commun à « Nouvelle habitude » et à
 * « Modifier l'habitude » : mêmes règles et mêmes messages. Le compteur suit la règle du domaine
 * (`habitNameLength`) ; un nom trop long collé est gardé tel quel et expliqué, sans être tronqué.
 * Après un refus ou un échec d'enregistrement, la saisie est conservée.
 *
 * - `initialName` : le nom de départ. S'il n'est pas vide (modification), l'enregistrement reste
 *   désactivé tant que rien n'a changé (ni le nom une fois nettoyé, ni les réglages), et un nom
 *   effacé est expliqué.
 * - `settings` : le bloc des réglages (« Difficulté »), sous le nom ; `settingsChanged` dit si
 *   les réglages choisis diffèrent de ceux de départ. Ils sont gardés par l'écran qui les affiche,
 *   donc conservés après un refus ou un échec.
 * - `onSubmit` enregistre le nom saisi ; il renvoie le motif d'un refus ou d'un échec, ou `null`
 *   quand le nom est enregistré (le panneau est alors fermé par l'écran).
 * - `alert` : un message d'erreur venu d'ailleurs (lecture de la suppression), sous le champ.
 * - `footer` : ce qui suit les actions (« Supprimer l'habitude »).
 */
export function HabitNameSheet({
  testID,
  title,
  submitLabel,
  submitTestID,
  saveFailedMessage,
  habits,
  initialName = '',
  settings,
  settingsChanged = false,
  autoFocus,
  alert = null,
  footer,
  onSubmit,
  onClose,
}: {
  readonly testID: string;
  readonly title: string;
  readonly submitLabel: string;
  readonly submitTestID: string;
  readonly saveFailedMessage: string;
  /** Les autres habitudes, pour nommer celle qui porte déjà le nom saisi. */
  readonly habits: readonly Habit[];
  readonly initialName?: string;
  readonly settings?: ReactNode;
  readonly settingsChanged?: boolean;
  readonly autoFocus: boolean;
  readonly alert?: string | null;
  readonly footer?: ReactNode;
  readonly onSubmit: (rawName: string) => Promise<HabitNameFailure | null>;
  readonly onClose: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const keyboardVisible = useKeyboardVisible();
  const [name, setName] = useState(initialName);
  const [failure, setFailure] = useState<HabitNameFailure | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const editing = initialName !== '';
  const length = habitNameLength(name);
  const tooLong = length > MAX_HABIT_NAME_LENGTH;
  const emptied = editing && length === 0;
  const unchanged = editing && cleanedName(name) === initialName && !settingsChanged;
  const refusal = failure === null || failure === 'saveFailed' ? null : failure;
  const fieldError = refusal
    ? refusalMessage(refusal, name, habits)
    : tooLong
      ? TOO_LONG_MESSAGE
      : emptied
        ? EMPTY_NAME_MESSAGE
        : null;
  const canSubmit = length > 0 && !tooLong && !unchanged && refusal === null && !submitting;
  const alertMessage = failure === 'saveFailed' ? saveFailedMessage : alert;

  useEffect(() => {
    if (fieldError !== null) {
      AccessibilityInfo.announceForAccessibility(fieldError);
    }
  }, [fieldError]);

  const changeName = (text: string) => {
    setName(text);
    setFailure(null);
  };

  const submit = () => {
    if (!canSubmit) {
      return;
    }
    setSubmitting(true);
    void onSubmit(name).then((outcome) => {
      setSubmitting(false);
      setFailure(outcome);
    });
  };

  return (
    <Modal
      transparent
      visible
      animationType={reducedMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
      testID={`${testID}-sheet`}
    >
      {/*
        « padding » sur iOS comme sur Android : l'application est affichée bord à bord, la fenêtre
        ne rétrécit donc pas quand le clavier s'ouvre ; c'est le panneau qui remonte au-dessus.
      */}
      <KeyboardAvoidingView
        behavior="padding"
        style={styles.container}
        testID={`${testID}-keyboard-avoiding`}
      >
        <Pressable
          accessible={false}
          onPress={onClose}
          testID={`${testID}-scrim`}
          style={styles.scrim}
        />
        <View
          accessibilityViewIsModal
          style={[styles.sheet, keyboardVisible && styles.sheetAboveKeyboard]}
          testID={`${testID}-sheet-content`}
        >
          <View style={styles.grab} />
          <Text accessibilityRole="header" style={[typography.sheetTitle, styles.title]}>
            {title}
          </Text>
          <Text nativeID={`${testID}-name-label`} style={[typography.label, styles.label]}>
            Nom de l’habitude
          </Text>
          <TextInput
            accessibilityLabel="Nom de l’habitude"
            accessibilityLabelledBy={`${testID}-name-label`}
            autoFocus={autoFocus}
            autoCapitalize="sentences"
            autoComplete="off"
            onChangeText={changeName}
            onSubmitEditing={submit}
            placeholder="Ex. Cuisiner"
            placeholderTextColor={colors.placeholder}
            returnKeyType="done"
            submitBehavior="submit"
            testID={`${testID}-name`}
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
          {settings}
          {alertMessage !== null && (
            <View
              accessible
              accessibilityRole="alert"
              accessibilityLabel={alertMessage}
              accessibilityLiveRegion="assertive"
              style={styles.alert}
            >
              <AlertGlyph color={colors.onDangerSoft} />
              <Text style={[typography.toast, styles.alertText]}>{alertMessage}</Text>
            </View>
          )}
          <View style={styles.actions}>
            <View style={styles.action}>
              <Button label="Annuler" variant="ghost" onPress={onClose} />
            </View>
            <View style={styles.action}>
              <Button
                label={submitLabel}
                onPress={submit}
                disabled={!canSubmit}
                testID={submitTestID}
              />
            </View>
          </View>
          {footer}
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
  /** Sans clavier, le bas du panneau laisse la place à la barre du téléphone ; avec, il se resserre. */
  sheetAboveKeyboard: { paddingBottom: spacing.lg },
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
