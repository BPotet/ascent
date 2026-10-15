import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { AlertGlyph } from '../components/Glyph';
import { formatXpChange } from '../format/formatXp';
import type { DeleteHabitOutcome } from '../state/useEditHabit';
import { useReducedMotion } from '../state/useReducedMotion';
import { colors } from '../theme/colors';
import { radii, spacing } from '../theme/metrics';
import { typography } from '../theme/typography';

export const DELETE_FAILED = 'La suppression a échoué. Réessaie.';

/** Le titre de la fenêtre : il nomme l'habitude (maquette, E8). */
export const deleteHabitTitle = (name: string) => `Supprimer « ${name} » ?`;

/**
 * Ce que dit la fenêtre (maquette, E8) : les suivis effacés, l'expérience des jours passés
 * conservée et, si l'habitude est « fait » aujourd'hui, l'expérience retirée (−10 XP).
 */
export function deleteHabitBody(xpRemoved: number): string {
  const kept = 'Son historique sera effacé. L’expérience gagnée les jours passés reste acquise';
  return xpRemoved > 0
    ? `${kept} ; seule celle d’aujourd’hui est retirée (${formatXpChange(-xpRemoved)}).`
    : `${kept}.`;
}

/**
 * Fenêtre de confirmation de la suppression d'une habitude (#6). Elle nomme l'habitude et dit ce
 * qui est effacé, conservé et retiré. « Annuler » est l'action par défaut : il vient en premier et
 * le lecteur d'écran s'y place à l'ouverture ; le fond et le retour du téléphone annulent aussi.
 * « Supprimer » est signalé comme définitif autrement que par la couleur (libellé et indication
 * lue par le lecteur d'écran).
 *
 * `onConfirm` supprime l'habitude : le résultat est passé à `onDeleted`, ou à `onGone` si elle
 * n'existe plus. En cas d'échec, la fenêtre reste ouverte, l'explique, et « Supprimer » devient
 * « Réessayer ».
 */
export function DeleteHabitDialog({
  name,
  xpRemoved,
  onConfirm,
  onDeleted,
  onGone,
  onCancel,
}: {
  readonly name: string;
  readonly xpRemoved: number;
  readonly onConfirm: () => Promise<DeleteHabitOutcome>;
  readonly onDeleted: (deleted: Extract<DeleteHabitOutcome, { ok: true }>) => void;
  readonly onGone: () => void;
  readonly onCancel: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const cancel = useRef<View>(null);
  const [failed, setFailed] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (cancel.current !== null) {
      AccessibilityInfo.sendAccessibilityEvent(cancel.current, 'focus');
    }
  }, []);

  const confirm = () => {
    if (deleting) {
      return;
    }
    setDeleting(true);
    void onConfirm().then((outcome) => {
      setDeleting(false);
      if (outcome.ok) {
        onDeleted(outcome);
      } else if (outcome.reason === 'unknownHabit') {
        onGone();
      } else {
        setFailed(true);
      }
    });
  };

  return (
    <Modal
      transparent
      visible
      animationType={reducedMotion ? 'none' : 'fade'}
      onRequestClose={onCancel}
      testID="delete-habit-dialog"
    >
      <View style={styles.container}>
        <Pressable
          accessible={false}
          onPress={onCancel}
          testID="delete-habit-scrim"
          style={styles.scrim}
        />
        <View accessibilityViewIsModal style={styles.dialog}>
          <Text accessibilityRole="header" style={[typography.sheetTitle, styles.title]}>
            {deleteHabitTitle(name)}
          </Text>
          <Text style={[typography.body, styles.body]}>{deleteHabitBody(xpRemoved)}</Text>
          {failed && (
            <View
              accessible
              accessibilityRole="alert"
              accessibilityLabel={DELETE_FAILED}
              accessibilityLiveRegion="assertive"
              style={styles.alert}
            >
              <AlertGlyph color={colors.onDangerSoft} />
              <Text style={[typography.toast, styles.alertText]}>{DELETE_FAILED}</Text>
            </View>
          )}
          <View style={styles.actions}>
            <View style={styles.action}>
              <Button ref={cancel} label="Annuler" variant="ghost" onPress={onCancel} />
            </View>
            <View style={styles.action}>
              <Button
                label={failed ? 'Réessayer' : 'Supprimer'}
                variant="danger"
                hint={`Supprime définitivement «\u00a0${name}\u00a0» et ses suivis.`}
                disabled={deleting}
                onPress={confirm}
                testID="confirm-delete-habit"
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: colors.scrim },
  dialog: {
    backgroundColor: colors.surface,
    borderRadius: radii.sheet,
    borderWidth: 1,
    borderColor: colors.line,
    paddingTop: spacing.xl,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  title: { color: colors.text, marginBottom: spacing.lg },
  body: { color: colors.muted },
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
