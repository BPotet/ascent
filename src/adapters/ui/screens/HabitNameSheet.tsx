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
import { HABIT_LIMIT_MESSAGE } from '../format/addHabit';
import { artPalette } from '../pixelArt/artPalette';
import { PixelButton } from '../pixelArt/PixelButton';
import { PixelFrame } from '../pixelArt/PixelFrame';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { PixelSheet } from '../pixelArt/PixelSheet';
import { pixelFont, textFont } from '../pixelArt/pixelTypography';
import { useKeyboardVisible } from '../state/useKeyboardVisible';
import { useReducedMotion } from '../state/useReducedMotion';

const { roles } = artPalette;

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
 * « Modifier l'habitude » : mêmes règles et mêmes messages. Dans l'identité pixel art (E2, E3) :
 * un panneau cranté (`PixelSheet`), le titre en police pixel, le champ dans un cadre creux, d'or
 * quand il a le focus et rouge quand le nom est refusé, l'erreur avec son icône, et le bouton
 * principal hachuré tant qu'il est indisponible. Le compteur suit la règle du domaine
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
  const [focused, setFocused] = useState(autoFocus);

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
        <PixelSheet
          accessibilityViewIsModal
          style={[styles.sheet, keyboardVisible && styles.sheetAboveKeyboard]}
          testID={`${testID}-sheet-content`}
        >
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <Text nativeID={`${testID}-name-label`} style={styles.label}>
            Nom de l’habitude
          </Text>
          <PixelFrame
            variant="inset"
            tone={fieldError !== null ? 'error' : focused ? 'gold' : 'default'}
            under={roles.surface}
            testID={`${testID}-name-frame`}
            style={styles.fieldFrame}
          >
            <TextInput
              accessibilityLabel="Nom de l’habitude"
              accessibilityLabelledBy={`${testID}-name-label`}
              autoFocus={autoFocus}
              autoCapitalize="sentences"
              autoComplete="off"
              onBlur={() => setFocused(false)}
              onChangeText={changeName}
              onFocus={() => setFocused(true)}
              onSubmitEditing={submit}
              placeholder="Ex. Cuisiner"
              placeholderTextColor={roles.muted}
              returnKeyType="done"
              selectionColor={roles.gold}
              submitBehavior="submit"
              testID={`${testID}-name`}
              value={name}
              style={styles.field}
            />
          </PixelFrame>
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
                  <PixelIcon name="alert8" color={roles.error} testID="field-error-icon" />
                  <Text style={styles.errorText}>{fieldError}</Text>
                </View>
              )}
            </View>
            <Text
              accessibilityLabel={`${length} caractères sur ${MAX_HABIT_NAME_LENGTH}`}
              style={[styles.count, tooLong && styles.countOver]}
            >
              {`${length}/${MAX_HABIT_NAME_LENGTH}`}
            </Text>
          </View>
          {settings}
          {alertMessage !== null && (
            <PixelFrame
              accessible
              accessibilityRole="alert"
              accessibilityLabel={alertMessage}
              accessibilityLiveRegion="assertive"
              tone="error"
              background={roles.errorBg}
              under={roles.surface}
              style={styles.alert}
            >
              <PixelIcon name="alert" color={roles.error} />
              <Text style={styles.alertText}>{alertMessage}</Text>
            </PixelFrame>
          )}
          <View style={styles.actions}>
            <PixelButton
              label="Annuler"
              variant="secondary"
              onPress={onClose}
              style={styles.action}
            />
            <PixelButton
              label={submitLabel}
              onPress={submit}
              disabled={!canSubmit}
              testID={submitTestID}
              style={styles.action}
            />
          </View>
          {footer}
        </PixelSheet>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: roles.scrim },
  sheet: { paddingTop: 6, paddingHorizontal: 16, paddingBottom: 36, gap: 10 },
  /** Sans clavier, le bas du panneau laisse la place à la barre du téléphone ; avec, il se resserre. */
  sheetAboveKeyboard: { paddingBottom: 16 },
  title: { fontFamily: pixelFont, fontSize: 22, lineHeight: 26, color: roles.light },
  label: { fontFamily: textFont.semiBold, fontSize: 13, lineHeight: 17, color: roles.parchment },
  fieldFrame: { paddingHorizontal: 14 },
  field: {
    minHeight: 52,
    fontFamily: textFont.medium,
    fontSize: 16,
    color: roles.light,
    paddingVertical: 0,
  },
  help: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    minHeight: 16,
    marginTop: -4,
  },
  error: { flex: 1 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  errorText: {
    flex: 1,
    fontFamily: textFont.semiBold,
    fontSize: 12,
    lineHeight: 16,
    color: roles.error,
  },
  count: { fontFamily: textFont.medium, fontSize: 12, lineHeight: 16, color: roles.parchment },
  countOver: { color: roles.error },
  alert: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10 },
  alertText: {
    flex: 1,
    fontFamily: textFont.semiBold,
    fontSize: 13,
    lineHeight: 18,
    color: roles.pink,
  },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  action: { flex: 1 },
});
// Stryker restore all
