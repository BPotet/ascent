import { useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import type { PowerNodeState, PowerTreeCode } from '../../../domain/ascent/powerTree';
import { powerPath, powerPrice } from '../../../domain/ascent/powerTree';
import { RETRY, SHEET_ERROR } from '../format/campText';
import {
  PATH_NAMES,
  POWER_EFFECTS,
  TREE_POWER_NAMES,
  basePowerBand,
  powerCost,
  powerPlace,
  powerType,
  shardsText,
  staysActive,
} from '../format/powerText';
import { artPalette } from '../pixelArt/artPalette';
import { artPixelSize } from '../pixelArt/artPixel';
import { PixelButton } from '../pixelArt/PixelButton';
import { PixelSheet } from '../pixelArt/PixelSheet';
import { pixelFont, textFont } from '../pixelArt/pixelTypography';
import { useReducedMotion } from '../state/useReducedMotion';
import { PowerIcon } from './PowerIcon';

const { roles } = artPalette;
const LINE = artPixelSize(2);

/** Un bandeau de la fiche : bleu d'information, vert « à soi », gris d'un verrou, rose d'erreur. */
function SheetBand({
  tone,
  children,
  role,
}: {
  readonly tone: 'info' | 'done' | 'plain' | 'error';
  readonly children: string;
  readonly role?: 'alert';
}) {
  const look = BANDS[tone];
  return (
    <View
      accessible
      {...(role !== undefined && { role })}
      style={[styles.band, { borderWidth: LINE, borderColor: look.line, backgroundColor: look.bg }]}
    >
      <Text style={[styles.bandText, { color: look.text }]}>{children}</Text>
    </View>
  );
}

/**
 * La fiche d'un pouvoir (#235, maquette F1 à F5), en feuille, quel que soit l'état du nœud : son
 * icône à ×4, sa place dans l'arbre, son coût, son type et son effet ; puis le prix, « Il te
 * restera » et « Débloquer pour 30 Éclats », ou ce qui manque, le verrou (« Voir … »), « Bientôt »
 * ou « Débloqué ». En cas d'échec, elle reste ouverte et propose « Réessayer ». Aucun bouton de
 * vente : un déblocage est pour toujours.
 */
export function PowerSheet({
  code,
  state,
  availableShards,
  ascentInProgress,
  readOnly,
  error,
  onUnlock,
  onSee,
  onClose,
}: {
  readonly code: PowerTreeCode;
  readonly state: PowerNodeState;
  readonly availableShards: number;
  readonly ascentInProgress: boolean;
  readonly readOnly: boolean;
  readonly error: boolean;
  readonly onUnlock: () => void;
  readonly onSee: (code: PowerTreeCode) => void;
  readonly onClose: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const { height } = useWindowDimensions();
  const title = useRef<Text>(null);
  const name = TREE_POWER_NAMES[code];
  const price = powerPrice(code);
  const { effect, more } = POWER_EFFECTS[code];

  useEffect(() => {
    if (title.current !== null) AccessibilityInfo.sendAccessibilityEvent(title.current, 'focus');
  }, [code]);

  const priceBox = (
    <View
      accessible
      accessibilityLabel={`Prix ${price} Éclats. Il te restera ${shardsText(Math.max(0, availableShards - price))}.`}
      style={[styles.priceGrid, { borderWidth: LINE }]}
    >
      <Text style={styles.priceLabel}>Prix</Text>
      <Text style={styles.priceValue}>{price}</Text>
      <Text style={styles.priceLabel}>Il te restera</Text>
      <Text style={styles.priceLeft}>
        {availableShards >= price ? shardsText(availableShards - price) : '—'}
      </Text>
    </View>
  );

  const block = () => {
    if (error) {
      return (
        <>
          {priceBox}
          <SheetBand tone="error" role="alert">
            {SHEET_ERROR}
          </SheetBand>
          {readOnly ? null : <PixelButton label={RETRY} onPress={onUnlock} />}
        </>
      );
    }
    switch (state.kind) {
      case 'affordable':
        return (
          <>
            {priceBox}
            <Text style={styles.line}>
              {ascentInProgress
                ? "Dès ta prochaine ascension. L'ascension en cours ne change pas."
                : 'Il rejoint tes pouvoirs dès ta prochaine ascension, pour toujours.'}
            </Text>
            <PixelButton label={`Débloquer pour ${price} Éclats`} onPress={onUnlock} />
          </>
        );
      case 'missing':
        return (
          <>
            {priceBox}
            <PixelButton
              label={`Débloquer, indisponible : il manque ${shardsText(state.missing)}`}
              text={`Il manque ${shardsText(state.missing)}`}
              onPress={() => undefined}
              disabled
            />
            <Text style={styles.line}>
              Les Éclats se gagnent en battant une Élite, un boss, et au Sommet.
            </Text>
          </>
        );
      case 'locked': {
        const path = powerPath(code);
        return (
          <>
            <SheetBand tone="plain">
              {`Verrouillé. Débloque d'abord ${TREE_POWER_NAMES[state.after]}, le rang 1 de la voie ${path === null ? '' : PATH_NAMES[path]}.`}
            </SheetBand>
            <PixelButton
              label={`Voir ${TREE_POWER_NAMES[state.after]}`}
              variant="secondary"
              onPress={() => onSee(state.after)}
            />
          </>
        );
      }
      case 'soon':
        return (
          <SheetBand tone="info">
            Pas encore dans la tour : il arrive avec une prochaine version.
          </SheetBand>
        );
      case 'base':
        return <SheetBand tone="done">{basePowerBand(code)}</SheetBand>;
      case 'nextAscent':
        return <SheetBand tone="info">Débloqué. Équipé dès ta prochaine ascension.</SheetBand>;
      case 'unlocked':
        return <SheetBand tone="done">Débloqué. Équipé à ta prochaine ascension.</SheetBand>;
    }
  };

  const off = state.kind === 'locked' || state.kind === 'soon';
  return (
    <Modal
      transparent
      visible
      animationType={reducedMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
      testID="power-sheet-modal"
    >
      <View style={styles.container}>
        <Pressable accessible={false} onPress={onClose} style={styles.scrim} />
        <PixelSheet
          accessibilityViewIsModal
          accessibilityLabel={`Fiche du pouvoir ${name}`}
          testID="power-sheet"
          style={[styles.sheet, { maxHeight: height * 0.9 }]}
        >
          <View style={styles.titleRow}>
            <Text ref={title} accessibilityRole="header" style={styles.title}>
              {name}
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
          <View style={styles.top}>
            <PowerIcon power={code} scale={4} off={off} />
            <View style={styles.topText}>
              <Text style={styles.place}>{powerPlace(code)}</Text>
              <View style={styles.tags}>
                <Text style={[styles.tag, styles.cost]}>{`${powerCost(code)} Élan`}</Text>
                <Text style={styles.tag}>{powerType(code)}</Text>
                {staysActive(code) ? <Text style={styles.tag}>Reste actif</Text> : null}
              </View>
            </View>
          </View>
          <Text style={styles.effect}>{effect}</Text>
          <Text style={styles.more}>{more}</Text>
          {block()}
        </PixelSheet>
      </View>
    </Modal>
  );
}

// Stryker disable all: valeurs purement visuelles, vérifiées par la conformité aux maquettes (barrière 10 bis).
const BANDS = {
  info: { line: roles.blue, bg: roles.raised, text: roles.light },
  done: { line: roles.doneLine, bg: roles.doneBg, text: roles.light },
  plain: { line: roles.line, bg: roles.sunken, text: roles.parchment },
  error: { line: roles.curse, bg: roles.errorBg, text: roles.pink },
} as const;

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: roles.scrim },
  sheet: { paddingTop: 12, paddingHorizontal: 16, paddingBottom: 30, gap: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { flex: 1, fontFamily: pixelFont, fontSize: 24, lineHeight: 28, color: roles.light },
  close: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontFamily: pixelFont, fontSize: 26, lineHeight: 30, color: roles.light },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  topText: { flex: 1, gap: 6 },
  place: { fontFamily: textFont.semiBold, fontSize: 13, lineHeight: 17, color: roles.parchment },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    fontFamily: textFont.bold,
    fontSize: 12,
    lineHeight: 16,
    color: roles.light,
    backgroundColor: roles.raised,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  cost: { color: roles.gold },
  effect: { fontFamily: textFont.medium, fontSize: 15, lineHeight: 21, color: roles.light },
  more: { fontFamily: textFont.medium, fontSize: 13, lineHeight: 18, color: roles.parchment },
  band: { padding: 10 },
  bandText: { fontFamily: textFont.medium, fontSize: 13, lineHeight: 18 },
  line: {
    fontFamily: textFont.medium,
    fontSize: 13,
    lineHeight: 18,
    color: roles.parchment,
    textAlign: 'center',
  },
  priceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: roles.sunken,
    borderColor: roles.line,
  },
  priceLabel: {
    width: '60%',
    fontFamily: textFont.medium,
    fontSize: 14,
    lineHeight: 22,
    color: roles.parchment,
  },
  priceValue: {
    width: '40%',
    textAlign: 'right',
    fontFamily: pixelFont,
    fontSize: 18,
    lineHeight: 22,
    color: roles.shard,
  },
  priceLeft: {
    width: '40%',
    textAlign: 'right',
    fontFamily: pixelFont,
    fontSize: 18,
    lineHeight: 22,
    color: roles.light,
  },
});
// Stryker restore all
