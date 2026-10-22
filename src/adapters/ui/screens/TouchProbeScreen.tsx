import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { formatMilliseconds } from '../format/formatMilliseconds';
import { TOUCH_PROBE_TARGET, type TouchProbeMeasure } from '../state/touchProbeReport';
import { jsThreadNow, uiThreadNow, useTouchProbe } from '../state/useTouchProbe';
import { colors } from '../theme/colors';
import { radii, spacing } from '../theme/metrics';
import { typography } from '../theme/typography';

/** L'identifiant du geste de la zone d'essai, pour `getByGestureTestId` dans les tests. */
export const TOUCH_PROBE_TAP_TEST_ID = 'touch-probe-tap';

/** Au-delà, le geste échoue ; le toucher a déjà été daté et compté à son début. */
const TAP_MAX_DURATION_MS = 1_000;

export interface TouchProbeScreenProps {
  /** Quitter la sonde (bouton « Fermer »). */
  readonly onClose: () => void;
  /** L'horloge du fil JS, qui date la réception des touchers. Par défaut `performance.now()`. */
  readonly now?: () => number;
  /**
   * L'horloge du fil UI, lue dans le worklet `onBegin` du geste : ce doit être un worklet.
   * Par défaut `performance.now()` du runtime UI.
   */
  readonly uiNow?: () => number;
}

function touchesLabel(count: number): string {
  return `${count} ${count > 1 ? 'appuis' : 'appui'} sur ${TOUCH_PROBE_TARGET}`;
}

/** Les lignes du résultat, dans l'ordre de l'affichage et du lecteur d'écran. */
function resultLines({ median, p95, method }: TouchProbeMeasure): string[] {
  return [
    `Écart médian : ${formatMilliseconds(median)}`,
    `Écart p95 : ${formatMilliseconds(p95)}`,
    `Méthode retenue : ${method}`,
    `Base commune : ${method === 'a' ? 'oui' : 'non'}`,
  ];
}

/**
 * La sonde de toucher, outil du build de preview (voir le glossaire) : 20 touchers sur la zone
 * d'essai mesurent l'écart entre l'instant du toucher (fil UI) et l'horloge JS, et en déduisent
 * la méthode de datation des appuis. Sans maquette : c'est un outil d'essai, jamais montré au joueur.
 * Le canal du build est vérifié par la route, pas ici.
 */
export function TouchProbeScreen({
  onClose,
  now = jsThreadNow,
  uiNow = uiThreadNow,
}: TouchProbeScreenProps) {
  const { report, lastGap, calibration, onBegin, restart } = useTouchProbe({ now, uiNow });
  const tap = useMemo(
    () =>
      Gesture.Tap()
        .withTestId(TOUCH_PROBE_TAP_TEST_ID)
        .maxDuration(TAP_MAX_DURATION_MS)
        .onBegin(onBegin),
    [onBegin],
  );
  // La mesure n'est le résultat qu'une fois l'objectif atteint.
  const result = report.complete ? report.measure : null;

  return (
    <Screen layout="top" testID="touch-probe">
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.titles}>
            <Text accessibilityRole="header" style={[typography.screenTitle, styles.title]}>
              Sonde de toucher
            </Text>
            <Text style={[typography.label, styles.muted]}>Outil du build de preview</Text>
          </View>
          <Button label="Fermer" variant="ghost" onPress={onClose} />
        </View>

        <GestureDetector gesture={tap}>
          <View
            accessible
            accessibilityRole="button"
            accessibilityLabel={`Zone d’essai, touche ici. ${touchesLabel(report.count)}.`}
            testID="touch-probe-target"
            style={styles.target}
          >
            <Text style={[typography.stateTitle, styles.title]}>Touche ici</Text>
            <Text style={[typography.counter, styles.counter]}>
              {report.count} / {TOUCH_PROBE_TARGET}
            </Text>
          </View>
        </GestureDetector>

        <View style={styles.measures}>
          {lastGap === null ? null : (
            <Text style={[typography.body, styles.muted]}>
              Dernier écart : {formatMilliseconds(lastGap)}
            </Text>
          )}
          <Text style={[typography.body, styles.muted]}>
            Décalage calibré :{' '}
            {calibration === undefined ? 'en cours' : formatMilliseconds(calibration.offset)}
          </Text>
        </View>

        {result === null ? null : (
          <>
            <View
              accessible
              accessibilityLabel={`Résultat. ${resultLines(result).join('. ')}.`}
              accessibilityLiveRegion="polite"
              testID="touch-probe-result"
              style={styles.result}
            >
              {resultLines(result).map((line) => (
                <Text key={line} style={[typography.habitName, styles.title]}>
                  {line}
                </Text>
              ))}
            </View>
            <Button label="Recommencer" onPress={restart} />
          </>
        )}
      </View>
    </Screen>
  );
}

// Stryker disable all: apparence d'un outil d'essai.
const styles = StyleSheet.create({
  content: { flex: 1, padding: spacing.xl, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  titles: { flex: 1, gap: spacing.xs },
  title: { color: colors.text },
  muted: { color: colors.muted },
  target: {
    minHeight: 220,
    borderRadius: radii.sheet,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  counter: { color: colors.accent },
  measures: { gap: spacing.xs },
  result: {
    padding: spacing.lg,
    borderRadius: radii.row,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
});
// Stryker restore all
