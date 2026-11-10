import { Pressable, StyleSheet, Text, View } from 'react-native';

import { POWERS, basePower, type PowerKind } from '../../../domain/battle/powers';
import { kindledCostText } from '../format/oathText';
import { POWER_EFFECTS, TREE_POWER_NAMES, powerType } from '../format/powerText';
import {
  BASE_TAG,
  FIXED_TAG,
  NEW_TAG,
  OFFICE_TAG,
  menuRowLabel,
  type MenuOathLine,
  type MenuRowState,
} from '../format/powersMenuText';
import { artPalette } from '../pixelArt/artPalette';
import { artPixelSize } from '../pixelArt/artPixel';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { pixelFont, textFont } from '../pixelArt/pixelTypography';
import { KindledFlame } from './KindledFlame';
import { PowerIcon } from './PowerIcon';
import { FlipIn, useNudge } from './StepMotion';

const { roles } = artPalette;
const LINE = artPixelSize(2);

/**
 * Le rôle d'une ligne : une case à cocher (`check`) ; ou du texte, sans case, pour un pouvoir
 * équipé d'office (`office`, M4) ou fixé pendant une ascension (`fixed`, M10).
 */
export type PowersMenuRowMode = 'check' | 'office' | 'fixed';

interface RowProps {
  readonly power: PowerKind;
  readonly mode: PowersMenuRowMode;
  readonly checked: boolean;
  /** Attisé (M5) : bordé de braise, la flamme et « Attisé · 2 → 1 Élan ». */
  readonly kindled?: boolean;
  /** La ligne de son Serment (M5, M6). */
  readonly oath?: MenuOathLine;
  /** Un pouvoir nouveau (M8, M9) : « nouveau ». */
  readonly isNew?: boolean;
  /** Équipé tout seul (M8) : un cadre d'or, l'icône qui se retourne. */
  readonly fresh?: boolean;
  /** Le numéro du dernier refus de ce pouvoir (M2) : la ligne se secoue à chaque nouveau numéro. */
  readonly shake?: number;
  readonly onPress: () => void;
}

const OATH_COLORS: Readonly<Record<MenuOathLine['tone'], string>> = {
  kindled: roles.light,
  oath: roles.blue,
  muted: roles.parchment,
};

function rowState(mode: PowersMenuRowMode, checked: boolean): MenuRowState | undefined {
  if (mode === 'office') return 'office';
  if (mode === 'fixed') return checked ? 'fixed' : 'aside';
  return undefined;
}

/** La case à droite : à cocher, « Équipé » en vert, « Fixé » avec le cadenas, ou rien. */
function Box({
  power,
  mode,
  checked,
}: {
  readonly power: PowerKind;
  readonly mode: PowersMenuRowMode;
  readonly checked: boolean;
}) {
  const testID = `powers-menu-row-${power}-tag`;
  if (mode === 'office') {
    return (
      <View testID={testID} style={[styles.tag, styles.officeTag]}>
        <Text style={[styles.tagText, { color: roles.done }]}>{OFFICE_TAG}</Text>
      </View>
    );
  }
  if (mode === 'fixed') {
    return checked ? (
      <View testID={testID} style={[styles.tag, styles.fixedTag]}>
        <PixelIcon name="lock" color={roles.parchment} testID={`powers-menu-row-${power}-lock`} />
        <Text style={[styles.tagText, { color: roles.parchment }]}>{FIXED_TAG}</Text>
      </View>
    ) : null;
  }
  return (
    <View style={[styles.box, { borderWidth: LINE }, checked && styles.boxOn]}>
      {checked ? <PixelIcon name="check8" color={roles.ink} /> : null}
    </View>
  );
}

function RowBody({
  power,
  mode,
  checked,
  kindled = false,
  oath,
  isNew = false,
  fresh = false,
  shake,
  onPress,
}: RowProps) {
  const nudge = useNudge(shake !== undefined);
  const lit = kindled && checked;
  const name = TREE_POWER_NAMES[power];
  const type = powerType(power);
  const icon = (
    <View
      style={[
        styles.well,
        { borderWidth: LINE },
        (checked || fresh) && styles.wellOn,
        lit && styles.wellLit,
      ]}
    >
      <PowerIcon power={power} scale={2} />
    </View>
  );
  const state = rowState(mode, checked);
  const label = menuRowLabel(power, {
    kindled: lit,
    ...(oath !== undefined && { oath: oath.text }),
    isNew,
    ...(state !== undefined && { state }),
  });
  const style = [
    styles.row,
    { borderWidth: LINE, transform: [{ translateX: nudge }] },
    checked && styles.rowOn,
    lit && styles.rowLit,
    fresh && styles.rowOn,
  ];
  const content = (
    <>
      {fresh ? <FlipIn testID={`powers-menu-row-${power}-icon`}>{icon}</FlipIn> : icon}
      <View style={styles.text}>
        <View style={styles.nameLine}>
          <Text style={styles.name}>{name}</Text>
          {power === basePower(POWERS[power].hero) ? (
            <Text style={styles.base}>{BASE_TAG}</Text>
          ) : null}
          {isNew ? <Text style={styles.newTag}>{NEW_TAG}</Text> : null}
        </View>
        {lit ? (
          <View style={styles.kindledLine}>
            <KindledFlame testID={`powers-menu-row-${power}-flame`} />
            <Text style={[styles.effect, styles.kindledText]}>
              {`Attisé · ${kindledCostText(power)} · ${type}`}
            </Text>
          </View>
        ) : (
          <Text style={styles.effect}>{`${POWERS[power].cost} Élan · ${type}`}</Text>
        )}
        <Text numberOfLines={2} style={styles.effect}>
          {POWER_EFFECTS[power].effect}
        </Text>
        {oath === undefined ? null : (
          <View style={styles.oathLine}>
            {oath.tone === 'kindled' ? (
              <PixelIcon name="flame8" color={roles.ember} />
            ) : (
              <PixelIcon name="oath8" color={OATH_COLORS[oath.tone]} />
            )}
            <Text style={[styles.oathText, { color: OATH_COLORS[oath.tone] }]}>{oath.text}</Text>
          </View>
        )}
      </View>
      <Box power={power} mode={mode} checked={checked} />
    </>
  );
  const testID = `powers-menu-row-${power}`;
  // Équipé d'office ou fixé : du texte, sans rôle de case ni toucher.
  if (mode !== 'check') {
    return (
      <View accessible accessibilityLabel={label} testID={testID} style={style}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={onPress}
      testID={testID}
      style={style}
    >
      {content}
    </Pressable>
  );
}

/**
 * La ligne d'un pouvoir possédé au menu des pouvoirs (#270, reprise du panneau de #236) : 64 dp au
 * moins, toute la ligne coche ou décoche. Son icône, son nom (« base » pour le pouvoir de base,
 * « nouveau » pour un pouvoir nouveau), son coût et son type, son effet et la ligne de son Serment.
 * Équipé d'office ou fixé, c'est du texte, sans rôle de case. Aucun état n'est dit par la couleur
 * seule : or pour l'équipé, vert pour l'équipé d'office, braise pour l'attisé, bleu pour le Serment.
 */
export function PowersMenuRow(props: RowProps) {
  // Chaque refus remonte la ligne : sa secousse repart de zéro.
  return <RowBody key={props.shake ?? 0} {...props} />;
}

// Stryker disable all: valeurs purement visuelles, vérifiées par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
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
  rowOn: { borderColor: roles.gold },
  rowLit: { borderColor: roles.ember },
  well: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: roles.line,
    backgroundColor: roles.well,
  },
  wellOn: { borderColor: roles.gold },
  wellLit: { borderColor: roles.ember },
  text: { flex: 1, gap: 1 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { fontFamily: pixelFont, fontSize: 15, lineHeight: 18, color: roles.light },
  base: {
    fontFamily: textFont.bold,
    fontSize: 11,
    lineHeight: 14,
    color: roles.parchment,
    backgroundColor: roles.raised,
    paddingHorizontal: 5,
  },
  newTag: {
    fontFamily: textFont.bold,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: roles.ink,
    backgroundColor: roles.gold,
    paddingHorizontal: 5,
  },
  effect: { fontFamily: textFont.medium, fontSize: 12.5, lineHeight: 17, color: roles.parchment },
  kindledLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  kindledText: { color: roles.light },
  oathLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginTop: 2 },
  oathText: { flex: 1, fontFamily: textFont.semiBold, fontSize: 12, lineHeight: 16 },
  box: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: roles.line,
    backgroundColor: roles.well,
  },
  boxOn: { borderColor: roles.gold, backgroundColor: roles.gold },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
  },
  officeTag: { backgroundColor: roles.doneBg, borderColor: roles.doneLine },
  fixedTag: { backgroundColor: roles.sunken, borderColor: roles.line },
  tagText: { fontFamily: textFont.bold, fontSize: 11, lineHeight: 14 },
});
// Stryker restore all
