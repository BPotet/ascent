import type { Ref } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EQUIPPED_POWER_SLOTS } from '../../../domain/ascent/powerTree';
import { POWERS, type PowerKind } from '../../../domain/battle/powers';
import {
  CARD_LOCKED_NOTE,
  CHANGE_LINK,
  HERO_SHORT_NAMES,
  NEW_TAG,
  POWERS_MENU_TITLE,
  SEE_LINK,
  cardLabel,
  slotsText,
  waitingNote,
  type CardLabelRow,
} from '../format/powersMenuText';
import { artPalette } from '../pixelArt/artPalette';
import { artPixelSize } from '../pixelArt/artPixel';
import { AssetRows } from '../pixelArt/AssetRows';
import { PixelFrame } from '../pixelArt/PixelFrame';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { pixelFont, textFont } from '../pixelArt/pixelTypography';
import { PORTRAITS } from '../pixelArt/sprites/atelier/data/portraits';
import { useLargeText } from '../state/useLargeText';
import { PowerIcon } from './PowerIcon';
import { FlipIn, STEP_MS } from './StepMotion';

const { roles } = artPalette;
const LINE = artPixelSize(2);

/** Une ligne de la carte : un héros, ses pouvoirs équipés et ceux qui sont attisés. */
export type EquippedPowersCardRow = CardLabelRow;

/** Les cases changées par le dernier « Valider » (T5) : `id` rejoue leur retournement. */
export interface FreshCells {
  readonly id: number;
  readonly powers: readonly PowerKind[];
}

/** Une mini-case : l'icône d'un pouvoir, bordée de braise s'il est attisé, d'or s'il vient de changer. */
function Cell({
  power,
  kindled,
  fresh,
  order,
}: {
  readonly power: PowerKind;
  readonly kindled: boolean;
  readonly fresh: FreshCells | undefined;
  /** Le rang de la case dans sa ligne : chaque case part 90 ms après la précédente. */
  readonly order: number;
}) {
  const changed = fresh?.powers.includes(power) === true;
  const cell = (
    <View
      testID={`powers-card-cell-${power}`}
      style={[
        styles.cell,
        { borderWidth: LINE },
        kindled && styles.kindled,
        changed && styles.fresh,
      ]}
    >
      <PowerIcon power={power} scale={2} />
    </View>
  );
  if (fresh === undefined || !changed) return cell;
  return (
    <FlipIn key={fresh.id} delayMs={order * STEP_MS} testID={`powers-card-flip-${power}`}>
      {cell}
    </FlipIn>
  );
}

function HeroRow({
  row: { hero, powers, kindled },
  fresh,
  large,
}: {
  readonly row: EquippedPowersCardRow;
  readonly fresh: FreshCells | undefined;
  readonly large: boolean;
}) {
  const portrait = PORTRAITS[hero];
  // L'ordre de l'arbre, quel que soit l'ordre du choix.
  const sorted = [...powers].sort((left, right) => POWERS[left].order - POWERS[right].order);
  return (
    <View testID={`powers-card-row-${hero}`} style={styles.heroRow}>
      <View testID={`powers-card-who-${hero}`} style={[styles.who, large && styles.whoLarge]}>
        {portrait === null ? null : (
          <AssetRows image={portrait} scale={1} testID={`powers-card-portrait-${hero}`} />
        )}
        <Text style={styles.heroName}>{HERO_SHORT_NAMES[hero]}</Text>
      </View>
      <View style={styles.cells}>
        {sorted.map((power, index) => (
          <Cell
            key={power}
            power={power}
            kindled={kindled.includes(power)}
            fresh={fresh}
            order={index}
          />
        ))}
        {Array.from({ length: EQUIPPED_POWER_SLOTS - sorted.length }, (_, index) => (
          <View
            key={`free-${index}`}
            testID={`powers-card-free-${sorted.length + index}`}
            style={[styles.cell, styles.free, { borderWidth: LINE }]}
          >
            {/* Les hachures de la place libre (maquette : 2 dp toutes les 6 dp, à 135°). */}
            <View
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              testID={`powers-card-free-${sorted.length + index}-hatching`}
              style={styles.hatching}
            >
              {Array.from({ length: 12 }, (_, stripe) => (
                <View key={stripe} style={styles.hatch} />
              ))}
            </View>
          </View>
        ))}
      </View>
      <Text style={styles.count}>{slotsText(powers.length)}</Text>
    </View>
  );
}

/**
 * La carte « Pouvoirs équipés » du pied de la tour (#270, maquette 269, T1, T4 à T8), au gabarit de
 * la carte de la jauge : cadre cranté, petit titre en capitales, lien d'or à droite. Une seule cible
 * (`button`) qui ouvre le menu des pouvoirs ; les icônes ne sont pas des cibles à part. Une ligne par
 * héros (portrait, mini-cases dans l'ordre de l'arbre, « Place libre » hachurée, « n sur 3 ») ; une
 * note d'or par pouvoir en attente d'une place (T4) ; « nouveau » à la première visite (T8). Pendant
 * une ascension (T6) : le héros parti seul, le cadenas, « Voir ». Après « Valider » (T5), les cases
 * changées se retournent l'une après l'autre et gardent un cadre d'or. À 200 %, le nom du héros
 * passe sous son portrait.
 */
export function EquippedPowersCard({
  rows,
  waiting,
  locked = false,
  isNew = false,
  fresh,
  onPress,
  ref,
}: {
  readonly rows: readonly EquippedPowersCardRow[];
  /** Les pouvoirs nouveaux qui attendent une place (T4). */
  readonly waiting: readonly PowerKind[];
  readonly locked?: boolean;
  readonly isNew?: boolean;
  readonly fresh?: FreshCells | undefined;
  readonly onPress: () => void;
  readonly ref?: Ref<View>;
}) {
  const large = useLargeText();
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={cardLabel({ rows, waiting, locked })}
      onPress={onPress}
      testID="equipped-powers-card"
    >
      <PixelFrame style={styles.card} {...(locked && { background: roles.sunken })}>
        <View testID="powers-card-head" style={styles.head}>
          <View style={styles.titleLine}>
            <Text style={styles.title}>{POWERS_MENU_TITLE}</Text>
            {isNew ? <Text style={styles.newTag}>{NEW_TAG}</Text> : null}
          </View>
          <View style={styles.linkLine}>
            {locked ? (
              <PixelIcon name="lock" color={roles.parchment} testID="powers-card-lock" />
            ) : null}
            <Text style={[styles.link, locked && styles.lockedLink]}>
              {locked ? SEE_LINK : CHANGE_LINK}
            </Text>
            <PixelIcon name="right" color={locked ? roles.parchment : roles.gold} />
          </View>
        </View>
        {rows.map((row) => (
          <HeroRow key={row.hero} row={row} fresh={fresh} large={large} />
        ))}
        {waiting.map((power) => (
          <View key={power} testID={`powers-card-waiting-${power}`} style={styles.note}>
            <Text style={styles.newTag}>{NEW_TAG}</Text>
            <Text style={styles.noteText}>{waitingNote(power)}</Text>
          </View>
        ))}
        {locked ? (
          <Text style={[styles.noteText, styles.lockedNote]}>{CARD_LOCKED_NOTE}</Text>
        ) : null}
      </PixelFrame>
    </Pressable>
  );
}

// Stryker disable all: valeurs purement visuelles, vérifiées par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  card: { gap: 6, paddingTop: 10, paddingBottom: 10, paddingHorizontal: 12, minHeight: 104 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: {
    fontFamily: textFont.bold,
    fontSize: 11.5,
    lineHeight: 15,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: roles.muted,
  },
  linkLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  link: { fontFamily: textFont.semiBold, fontSize: 13, lineHeight: 17, color: roles.gold },
  lockedLink: { color: roles.parchment },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36 },
  who: { width: 104, flexDirection: 'row', alignItems: 'center', gap: 6 },
  whoLarge: { flexDirection: 'column', alignItems: 'flex-start', gap: 2 },
  heroName: {
    flexShrink: 1,
    fontFamily: pixelFont,
    fontSize: 14,
    lineHeight: 17,
    color: roles.light,
  },
  cells: { flexDirection: 'row', gap: 4 },
  cell: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: roles.line,
    backgroundColor: roles.well,
  },
  kindled: { borderColor: roles.ember },
  fresh: { borderColor: roles.gold, backgroundColor: roles.goldBg },
  free: { backgroundColor: 'transparent', overflow: 'hidden' },
  hatching: {
    position: 'absolute',
    top: -12,
    bottom: -12,
    left: -12,
    flexDirection: 'row',
    gap: 4,
    transform: [{ skewX: '-45deg' }],
  },
  hatch: { width: 2, height: '100%', backgroundColor: 'rgba(62,72,112,0.35)' },
  count: {
    marginLeft: 'auto',
    fontFamily: textFont.bold,
    fontSize: 13,
    lineHeight: 17,
    color: roles.parchment,
  },
  note: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  noteText: {
    flexShrink: 1,
    fontFamily: textFont.semiBold,
    fontSize: 12.5,
    lineHeight: 17,
    color: roles.gold,
  },
  lockedNote: { color: roles.parchment },
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
});
// Stryker restore all
