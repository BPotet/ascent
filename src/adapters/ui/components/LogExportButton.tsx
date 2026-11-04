import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { LogExport } from '../../../application/useCases/exportAscentLog';
import {
  EMPTY_LOG_LINE,
  EXPORT_ERROR_LINE,
  EXPORT_LABEL,
  PREPARING_LABEL,
  exportHint,
  ignoredLogsLine,
  logCountLine,
} from '../format/ascentLogText';
import { artPalette } from '../pixelArt/artPalette';
import { MIN_TARGET_SIZE } from '../pixelArt/PixelButton';
import { PixelRows } from '../pixelArt/PixelIcon';
import { textFont } from '../pixelArt/pixelTypography';
import { useAscentLogExport } from '../state/useAscentLogExport';

const { roles } = artPalette;

/** L'icône « exporter » : une flèche qui sort d'un plateau, 8 × 8 pixels d'art. */
const EXPORT_ICON = [
  '...XX...',
  '..XXXX..',
  '.XXXXXX.',
  '...XX...',
  '...XX...',
  'X..XX..X',
  'X......X',
  'XXXXXXXX',
] as const;

/** Le pictogramme « ! » des lignes d'erreur et de journal ignoré : la couleur n'est jamais seule. */
const MARK_ICON = ['.XX.', '.XX.', '.XX.', '....', '.XX.'] as const;

function Line({
  text,
  color,
  mark = false,
  role,
  hidden = false,
}: {
  readonly text: string;
  readonly color: string;
  readonly mark?: boolean;
  readonly role?: 'alert';
  readonly hidden?: boolean;
}) {
  return (
    <View
      accessible={!hidden}
      accessibilityRole={role}
      accessibilityLabel={text}
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'yes'}
      accessibilityLiveRegion={role === 'alert' ? 'assertive' : 'none'}
      style={styles.line}
    >
      {mark ? <PixelRows rows={MARK_ICON} color={color} /> : null}
      <Text style={[styles.lineText, { color }]}>{text}</Text>
    </View>
  );
}

/**
 * Le bouton discret « Exporter le journal » (#196, maquette 193) : sans fond, l'icône « exporter »,
 * le libellé parchemin souligné de pointillés, 48 dp de haut sur toute la largeur. Grisé quand le
 * journal est vide, « Préparation du journal » quand la préparation dépasse 300 ms. Dessous, la
 * ligne d'état : l'erreur (rouge), les journaux ignorés (or), ou, avec `showCount`, le compte (lu
 * dans l'indice du bouton, pas une seconde fois).
 */
export function LogExportButton({
  logExport,
  revision,
  showCount,
  active = true,
}: {
  readonly logExport: LogExport;
  /** Change avec l'ascension : le statut est relu. */
  readonly revision?: unknown;
  readonly showCount: boolean;
  /** L'écran est affiché ; faux, l'erreur et les journaux ignorés sont effacés. */
  readonly active?: boolean;
}) {
  const { status, exporting, preparing, failed, ignored, onExport } = useAscentLogExport(
    logExport,
    revision,
    active,
  );
  const empty = status?.count === 0;
  const disabled = empty || exporting;
  const color = preparing ? roles.gold : empty ? roles.muted : roles.parchment;
  let line = null;
  if (failed) {
    line = <Line text={EXPORT_ERROR_LINE} color={roles.error} mark role="alert" />;
  } else if (ignored > 0) {
    line = <Line text={ignoredLogsLine(ignored)} color={roles.gold} mark />;
  } else if (empty) {
    line = <Line text={EMPTY_LOG_LINE} color={roles.muted} hidden />;
  } else if (showCount && status !== null) {
    line = <Line text={logCountLine(status)} color={roles.muted} hidden />;
  }
  return (
    <View style={styles.block} testID="log-export">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={preparing ? PREPARING_LABEL : EXPORT_LABEL}
        accessibilityHint={
          preparing
            ? undefined
            : empty
              ? EMPTY_LOG_LINE
              : status === null
                ? undefined
                : exportHint(status)
        }
        accessibilityState={{ disabled, busy: exporting }}
        disabled={disabled}
        onPress={onExport}
        style={styles.button}
      >
        {preparing ? (
          <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no">
            {[1, 0.6, 0.3].map((opacity) => (
              <View key={opacity} style={[styles.dot, { opacity }]} />
            ))}
          </View>
        ) : (
          <PixelRows rows={EXPORT_ICON} color={color} />
        )}
        <Text style={[styles.label, { color }, !preparing && !empty && styles.underlined]}>
          {preparing ? PREPARING_LABEL : EXPORT_LABEL}
        </Text>
      </Pressable>
      {line}
    </View>
  );
}

// Stryker disable all: valeurs purement visuelles, vérifiées par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  block: { alignSelf: 'stretch', gap: 4 },
  button: {
    minHeight: MIN_TARGET_SIZE,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 12,
  },
  label: { fontFamily: textFont.semiBold, fontSize: 14, lineHeight: 17, flexShrink: 1 },
  underlined: {
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
    textDecorationColor: roles.line,
  },
  dots: { flexDirection: 'row', gap: 3 },
  dot: { width: 4, height: 4, backgroundColor: roles.gold },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  lineText: { fontFamily: textFont.medium, fontSize: 13, lineHeight: 18, textAlign: 'center' },
});
