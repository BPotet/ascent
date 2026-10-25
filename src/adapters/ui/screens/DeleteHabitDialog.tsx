import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatXpChange } from '../format/formatXp';
import { artPalette } from '../pixelArt/artPalette';
import { PixelButton } from '../pixelArt/PixelButton';
import { PixelFrame } from '../pixelArt/PixelFrame';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { pixelFont, pixelTypography, textFont } from '../pixelArt/pixelTypography';
import type { DeleteHabitOutcome } from '../state/useEditHabit';
import { useReducedMotion } from '../state/useReducedMotion';

const { roles } = artPalette;

export const DELETE_FAILED = 'La suppression a échoué. Réessaie.';

/** Le titre de la fenêtre : il nomme l'habitude (maquette, E8). */
export const deleteHabitTitle = (name: string) => `Supprimer « ${name} » ?`;

/**
 * Ce que dit la fenêtre (maquette, E8) : les suivis effacés, l'expérience des jours passés
 * conservée et, si l'habitude est « fait » aujourd'hui, l'expérience retirée, au barème de la
 * difficulté de la semaine en cours (−20 XP en Difficile). Quand la prime d'objectif de la semaine
 * tombe avec ce suivi (`targetBonusRemoved`, #26), la fenêtre l'annonce aussi, avec le total : « Sont
 * retirés le suivi d'aujourd'hui (−10 XP) et la prime de cette semaine (−15 XP), l'objectif n'étant
 * plus atteint : −25 XP en tout. »
 */
export function deleteHabitBody(xpRemoved: number, targetBonusRemoved = 0): string {
  const kept = 'Ses suivis seront effacés. L’expérience gagnée les jours passés reste acquise';
  if (targetBonusRemoved > 0) {
    const checkIn = formatXpChange(-(xpRemoved - targetBonusRemoved));
    const bonus = formatXpChange(-targetBonusRemoved);
    return (
      `${kept}. Sont retirés le suivi d’aujourd’hui (${checkIn}) et la prime de cette semaine ` +
      `(${bonus}), l’objectif n’étant plus atteint\u00a0: ${formatXpChange(-xpRemoved)} en tout.`
    );
  }
  return xpRemoved > 0
    ? `${kept}\u00a0; seule celle d’aujourd’hui est retirée (${formatXpChange(-xpRemoved)}).`
    : `${kept}.`;
}

/**
 * Fenêtre de confirmation de la suppression d'une habitude (#6), dans un cadre relevé de
 * l'identité pixel art (E3) : le titre en police pixel, le texte en police de texte, « Annuler » à
 * gauche et « Supprimer » à droite, en rouge d'erreur avec son libellé. Elle nomme l'habitude et
 * dit ce qui est effacé, conservé et retiré. « Annuler » est l'action par défaut : il vient en premier et
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
  targetBonusRemoved = 0,
  onConfirm,
  onDeleted,
  onGone,
  onCancel,
}: {
  readonly name: string;
  readonly xpRemoved: number;
  /** La part de `xpRemoved` qui vient de la prime d'objectif qui tombe (#26). */
  readonly targetBonusRemoved?: number;
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
        <PixelFrame
          accessibilityViewIsModal
          variant="raised"
          under="transparent"
          testID="delete-habit-dialog-frame"
          style={styles.dialog}
        >
          <Text accessibilityRole="header" style={styles.title}>
            {deleteHabitTitle(name)}
          </Text>
          <Text style={[pixelTypography.body, styles.body]}>
            {deleteHabitBody(xpRemoved, targetBonusRemoved)}
          </Text>
          {failed && (
            <PixelFrame
              accessible
              accessibilityRole="alert"
              accessibilityLabel={DELETE_FAILED}
              accessibilityLiveRegion="assertive"
              tone="error"
              background={roles.errorBg}
              under={roles.raised}
              style={styles.alert}
            >
              <PixelIcon name="alert" color={roles.error} />
              <Text style={styles.alertText}>{DELETE_FAILED}</Text>
            </PixelFrame>
          )}
          <View style={styles.actions}>
            <PixelButton
              ref={cancel}
              label="Annuler"
              variant="secondary"
              onPress={onCancel}
              style={styles.action}
            />
            <PixelButton
              label={failed ? 'Réessayer' : 'Supprimer'}
              variant="danger"
              accessibilityHint={`Supprime définitivement «\u00a0${name}\u00a0» et ses suivis.`}
              disabled={deleting}
              onPress={confirm}
              testID="confirm-delete-habit"
              style={styles.action}
            />
          </View>
        </PixelFrame>
      </View>
    </Modal>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: roles.scrim },
  dialog: { paddingTop: 18, paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  title: { fontFamily: pixelFont, fontSize: 21, lineHeight: 26, color: roles.light },
  body: { color: roles.parchment },
  alert: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10 },
  alertText: {
    flex: 1,
    fontFamily: textFont.semiBold,
    fontSize: 13,
    lineHeight: 18,
    color: roles.pink,
  },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1 },
});
// Stryker restore all
