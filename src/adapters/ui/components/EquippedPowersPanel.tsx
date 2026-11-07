import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { EQUIPPED_POWER_SLOTS } from '../../../domain/ascent/powerTree';
import type { HeroKind } from '../../../domain/battle/combatants';
import { POWERS, basePower, powerOrder, type PowerKind } from '../../../domain/battle/powers';
import {
  POWER_EFFECTS,
  TREE_POWER_NAMES,
  fullSlotsBand,
  missingChoiceText,
  panelHeading,
  powerType,
} from '../format/powerText';
import { artPalette } from '../pixelArt/artPalette';
import { artPixelSize } from '../pixelArt/artPixel';
import { PixelButton } from '../pixelArt/PixelButton';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { PixelSheet } from '../pixelArt/PixelSheet';
import { pixelFont, textFont } from '../pixelArt/pixelTypography';
import { useReducedMotion } from '../state/useReducedMotion';
import { PowerIcon } from './PowerIcon';

const { roles } = artPalette;
const LINE = artPixelSize(2);

/** Une ligne de 64 dp par pouvoir possédé : toute la ligne coche ou décoche (H4). */
function PowerRow({
  power,
  checked,
  onPress,
}: {
  readonly power: PowerKind;
  readonly checked: boolean;
  readonly onPress: () => void;
}) {
  const { effect } = POWER_EFFECTS[power];
  const name = TREE_POWER_NAMES[power];
  const type = powerType(power);
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={`${name}, ${POWERS[power].cost} Élan, ${type}. ${effect}`}
      onPress={onPress}
      testID={`equipped-powers-row-${power}`}
      style={[styles.row, { borderWidth: LINE }, checked && styles.rowOn]}
    >
      <PowerIcon power={power} scale={2} />
      <View style={styles.rowText}>
        <View style={styles.nameLine}>
          <Text style={styles.name}>{name}</Text>
          {power === basePower(POWERS[power].hero) ? <Text style={styles.base}>base</Text> : null}
        </View>
        <Text style={styles.effect}>{`${POWERS[power].cost} Élan · ${type}`}</Text>
        <Text style={styles.effect}>{effect}</Text>
      </View>
      <View style={[styles.box, { borderWidth: LINE }, checked && styles.boxOn]}>
        {checked ? <PixelIcon name="check8" color={roles.ink} /> : null}
      </View>
    </Pressable>
  );
}

/**
 * Le panneau « Pouvoirs équipés · n sur 3 » du Choix du héros (#236, maquette H4 à H6) : tous les
 * pouvoirs possédés du héros, dans l'ordre de l'arbre, cochés ou non. Un toucher coche ou décoche ;
 * plein, un 4e choix est refusé et un bandeau dit quoi faire (H5) ; « Valider » attend exactement
 * min(3, possédés) pouvoirs (H6). Le pouvoir de base se décoche comme les autres.
 */
export function EquippedPowersPanel({
  hero,
  owned,
  selected,
  onValidate,
  onClose,
}: {
  readonly hero: HeroKind;
  readonly owned: readonly PowerKind[];
  readonly selected: readonly PowerKind[];
  readonly onValidate: (powers: readonly PowerKind[]) => void;
  readonly onClose: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const { height } = useWindowDimensions();
  const [draft, setDraft] = useState<readonly PowerKind[]>(selected);
  const [full, setFull] = useState<PowerKind | null>(null);
  const slots = Math.min(EQUIPPED_POWER_SLOTS, owned.length);
  const missing = slots - draft.length;
  const toggle = (power: PowerKind) => {
    if (draft.includes(power)) {
      setFull(null);
      setDraft(draft.filter((each) => each !== power));
    } else if (draft.length >= slots) {
      setFull(power);
    } else {
      setFull(null);
      setDraft([...draft, power]);
    }
  };
  return (
    <Modal
      transparent
      visible
      animationType={reducedMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <Pressable accessible={false} onPress={onClose} style={styles.scrim} />
        <PixelSheet
          accessibilityViewIsModal
          accessibilityLabel="Pouvoirs équipés"
          testID="equipped-powers-panel"
          style={[styles.sheet, { maxHeight: height * 0.92 }]}
        >
          <View style={styles.titleRow}>
            <Text accessibilityRole="header" style={styles.title}>
              Pouvoirs équipés
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
          <View style={styles.headingRow}>
            <Text style={styles.heading}>{panelHeading(hero)}</Text>
            <Text accessibilityLiveRegion="polite" role="status" style={styles.count}>
              {`${draft.length} sur ${slots}`}
            </Text>
          </View>
          <ScrollView contentContainerStyle={styles.rows}>
            {powerOrder(hero, owned).map((power) => (
              <PowerRow
                key={power}
                power={power}
                checked={draft.includes(power)}
                onPress={() => toggle(power)}
              />
            ))}
          </ScrollView>
          {full === null ? null : (
            <View
              accessible
              accessibilityLiveRegion="polite"
              role="status"
              style={[styles.band, { borderWidth: LINE }]}
            >
              <Text style={styles.bandText}>{fullSlotsBand(full)}</Text>
            </View>
          )}
          {missing > 0 ? (
            <PixelButton
              label={`Valider, indisponible : ${missingChoiceText(missing).toLowerCase()}`}
              text={missingChoiceText(missing)}
              onPress={() => undefined}
              disabled
            />
          ) : (
            <PixelButton label="Valider" onPress={() => onValidate(powerOrder(hero, draft))} />
          )}
        </PixelSheet>
      </View>
    </Modal>
  );
}

// Stryker disable all: valeurs purement visuelles, vérifiées par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: roles.scrim },
  sheet: { paddingTop: 12, paddingHorizontal: 16, paddingBottom: 30, gap: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { flex: 1, fontFamily: pixelFont, fontSize: 24, lineHeight: 28, color: roles.light },
  close: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontFamily: pixelFont, fontSize: 26, lineHeight: 30, color: roles.light },
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heading: { fontFamily: textFont.semiBold, fontSize: 13, lineHeight: 17, color: roles.parchment },
  count: { fontFamily: textFont.bold, fontSize: 13, lineHeight: 17, color: roles.gold },
  rows: { gap: 6 },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderColor: roles.line,
    backgroundColor: roles.surface,
  },
  rowOn: { borderColor: roles.gold, backgroundColor: roles.goldBg },
  rowText: { flex: 1, gap: 1 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontFamily: textFont.bold, fontSize: 14, lineHeight: 18, color: roles.light },
  base: {
    fontFamily: textFont.bold,
    fontSize: 10.5,
    lineHeight: 13,
    color: roles.parchment,
    backgroundColor: roles.raised,
    paddingHorizontal: 4,
  },
  effect: { fontFamily: textFont.medium, fontSize: 12, lineHeight: 16, color: roles.parchment },
  box: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: roles.line,
    backgroundColor: roles.sunken,
  },
  boxOn: { borderColor: roles.gold, backgroundColor: roles.gold },
  band: { padding: 10, borderColor: roles.blue, backgroundColor: roles.raised },
  bandText: { fontFamily: textFont.medium, fontSize: 13, lineHeight: 18, color: roles.light },
});
// Stryker restore all
