import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { BattleMeasures } from '../../../application/useCases/BattleSession';
import { PARRY_WINDOW_MS, PERFECT_WINDOW_MS } from '../../../domain/battle/rules';
import type { TrialTuning } from '../../../domain/battle/TrialTuning';
import { formatMilliseconds } from '../format/formatMilliseconds';
import { median, p95, type TouchProbeReport } from '../state/touchProbeReport';
import { battleColors } from '../theme/battleColors';

/** Les images comptées pendant les préparations et l'éclat. */
export interface FrameStats {
  readonly frames: number;
  readonly dropped: number;
  readonly worstGap: number;
}

const TUNING_FIELDS: readonly {
  readonly field: keyof TrialTuning;
  readonly label: string;
  readonly what: string;
}[] = [
  { field: 'phaseTransitionMs', label: 'Transition de phase', what: 'la transition de phase' },
  { field: 'stepInMs', label: 'Avancée', what: "l'avancée" },
];

/** Le panneau Réglages d'essai : durées de la transition et de l'avancée, au pas de 50 ms. */
export function TrialTuningPanel({
  tuning,
  onStep,
}: {
  readonly tuning: TrialTuning;
  readonly onStep: (field: keyof TrialTuning, direction: 1 | -1) => void;
}) {
  return (
    <View testID="trial-tuning-panel" style={styles.panel}>
      <Text accessibilityRole="header" style={styles.title}>
        {"Réglages d'essai"}
      </Text>
      {TUNING_FIELDS.map(({ field, label, what }) => (
        <View key={field} style={styles.row}>
          <Text style={styles.label}>{label}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Raccourcir ${what}`}
            onPress={() => onStep(field, -1)}
            style={styles.step}
          >
            <Text style={styles.stepText}>−</Text>
          </Pressable>
          <Text testID={`trial-tuning-${field}`} style={styles.value}>
            {formatMilliseconds(tuning[field])}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Allonger ${what}`}
            onPress={() => onStep(field, 1)}
            style={styles.step}
          >
            <Text style={styles.stepText}>+</Text>
          </Pressable>
        </View>
      ))}
      <Text style={styles.note}>Appliqués au combat suivant.</Text>
    </View>
  );
}

function percent(part: number, whole: number): string {
  return whole === 0 ? '0 %' : `${Math.round((100 * part) / whole)} %`;
}

function spread(values: readonly number[]): string {
  const middle = median(values);
  const high = p95(values);
  return middle === null || high === null
    ? 'aucune mesure'
    : `médiane ${formatMilliseconds(middle)}, p95 ${formatMilliseconds(high)}`;
}

/** La répartition des écarts des appuis jugés, par fenêtre. */
function deltaBuckets(deltas: readonly number[]): string {
  const early = deltas.filter((delta) => delta < -PERFECT_WINDOW_MS).length;
  const perfect = deltas.filter((delta) => Math.abs(delta) <= PERFECT_WINDOW_MS).length;
  const late = deltas.filter((delta) => delta > PERFECT_WINDOW_MS).length;
  return `−${PARRY_WINDOW_MS} à −${PERFECT_WINDOW_MS + 1} : ${early} · ±${PERFECT_WINDOW_MS} : ${perfect} · ${PERFECT_WINDOW_MS + 1} à ${PARRY_WINDOW_MS} : ${late}`;
}

/** Les lignes du panneau Mesures, dans l'ordre de l'affichage et du lecteur d'écran. */
export function measureLines({
  touch,
  session,
  frames,
  soundLatencies,
}: {
  readonly touch: TouchProbeReport;
  readonly session: BattleMeasures;
  readonly frames: FrameStats;
  readonly soundLatencies: readonly number[];
}): string[] {
  const measure = touch.measure;
  return [
    measure === null
      ? 'Toucher → JS : aucun appui'
      : `Toucher → JS (${touch.count} appuis) : médiane ${formatMilliseconds(measure.median)}, p95 ${formatMilliseconds(measure.p95)}`,
    `Méthode recalculée : ${measure === null ? '—' : measure.method}`,
    `Appuis redatés : ${session.redatedPresses}`,
    `Images perdues : ${frames.dropped} sur ${frames.frames} (${percent(frames.dropped, frames.frames)}), pire écart ${formatMilliseconds(frames.worstGap)}`,
    `Latence du son : ${spread(soundLatencies)}`,
    `Écarts jugés (${session.deltas.length}) : ${spread(session.deltas.map(Math.abs))}`,
    `Répartition : ${deltaBuckets(session.deltas)}`,
  ];
}

/** Le panneau Mesures du build de preview, prêt pour une capture d'écran. */
export function BattleMeasuresPanel({ lines }: { readonly lines: readonly string[] }) {
  return (
    <View
      accessible
      accessibilityLabel={`Mesures. ${lines.join('. ')}.`}
      testID="battle-measures-panel"
      style={styles.panel}
    >
      <Text style={styles.title}>Mesures</Text>
      {lines.map((line) => (
        <Text key={line} style={styles.measure}>
          {line}
        </Text>
      ))}
    </View>
  );
}

// Stryker disable all: styles d'un outil d'essai du build de preview.
const styles = StyleSheet.create({
  panel: {
    backgroundColor: battleColors.surface,
    borderWidth: 1,
    borderColor: battleColors.line,
    borderRadius: 20,
    padding: 14,
    gap: 8,
  },
  title: { color: battleColors.text, fontSize: 16, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { flex: 1, color: battleColors.text, fontSize: 14, fontWeight: '500' },
  step: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: battleColors.surfaceRaised,
  },
  stepText: { color: battleColors.text, fontSize: 22, fontWeight: '600' },
  value: {
    minWidth: 80,
    textAlign: 'center',
    color: battleColors.light,
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  note: { color: battleColors.muted, fontSize: 13 },
  measure: { color: battleColors.muted, fontSize: 13, lineHeight: 18 },
});
// Stryker restore all
