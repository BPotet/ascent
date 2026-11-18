import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ItemKind } from '../../../domain/ascent/items';
import {
  itemEntryNote,
  type BookItemSlot,
  type BookItems,
  type ItemEntry,
} from '../../../domain/discoveryBook/bookItems';
import { itemEffectLine, itemName } from '../format/ascentText';
import {
  ITEMS_FIRST_USE_BAND,
  ITEMS_TITLE,
  SLOT_TITLES,
  itemRarityLine,
  itemRowLabel,
  itemsSummaryLabel,
  unknownItemLine,
} from '../format/bookItemsText';
import { NEW_TAG, UNKNOWN_NAME } from '../format/bookText';
import { rarityMarks } from '../format/rarityText';
import { artPalette } from '../pixelArt/artPalette';
import { artPixelSize } from '../pixelArt/artPixel';
import { PixelFrame } from '../pixelArt/PixelFrame';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { pixelFont, textFont } from '../pixelArt/pixelTypography';
import { ITEM_IMAGES } from '../pixelArt/sprites/atelier/data/itemImages';
import { assetSprite } from '../pixelArt/sprites/atelier/fullAnimation';
import { toPixelImage } from '../pixelArt/sprites/Sprite';
import { SpriteCanvas } from '../pixelArt/SpriteCanvas';
import { Hatching } from './Hatching';
import { RARITY_COLORS } from './IconWell';

const { roles } = artPalette;
const LINE = artPixelSize(2);
/** Les hachures d'une ligne « ??? » : le trait de la maquette à 28 %. */
const HATCH = 'rgba(62,72,112,0.28)';

/** Le cadre des Objets (C3) : découverts sur le total, la barre d'or, puis par rareté. */
function ItemsFrame({ items }: { readonly items: BookItems }) {
  return (
    <PixelFrame
      accessible
      accessibilityRole="text"
      accessibilityLabel={itemsSummaryLabel(items.discovered, items.total)}
      testID="book-items-frame"
      style={styles.frame}
    >
      <View style={styles.frameRow}>
        <Text style={styles.frameName}>{ITEMS_TITLE}</Text>
        <Text style={styles.frameCount}>
          {`${items.discovered}/${items.total} `}
          <Text style={styles.frameUnit}>{items.discovered > 1 ? 'découverts' : 'découvert'}</Text>
        </Text>
      </View>
      <View style={styles.bar}>
        <View style={[styles.barFilled, { width: `${(100 * items.discovered) / items.total}%` }]} />
      </View>
      <View style={styles.rarities}>
        {items.rarities.map(({ rarity, discovered, total }, index) => (
          <View key={rarity} style={styles.rarityRow}>
            {index > 0 && <Text style={styles.rarityCount}> · </Text>}
            <Text testID={`book-items-rarity-${rarity}`} style={styles.rarityCount}>
              <Text style={{ color: RARITY_COLORS[rarity] }}>{rarityMarks(rarity)}</Text>
              {` ${discovered}/${total}`}
            </Text>
          </View>
        ))}
      </View>
    </PixelFrame>
  );
}

/** L'image validée d'un objet découvert, à 48 dp dans son écrin de 56 dp. */
function ItemWell({ entry }: { readonly entry: ItemEntry }) {
  // Les 11 objets ont leur image validée (test de `BookItemsTab`).
  const image = ITEM_IMAGES[entry.kind]!;
  return (
    <View style={[styles.well, { borderColor: RARITY_COLORS[entry.rarity] }]}>
      <SpriteCanvas
        sprite={`item-${entry.kind}`}
        draw={() => toPixelImage(assetSprite(image))}
        scale={2}
        testID={`book-item-image-${entry.kind}`}
      />
    </View>
  );
}

/** Une ligne découverte : un bouton qui ouvre sa fiche, avec « nouveau » et le cadre d'or. */
function DiscoveredRow({
  entry,
  onOpen,
}: {
  readonly entry: ItemEntry;
  readonly onOpen: (item: ItemKind) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={itemRowLabel(entry, null)}
      onPress={() => onOpen(entry.kind)}
      testID={`book-item-${entry.kind}`}
      style={[styles.row, styles.rowFound, entry.isNew && { borderColor: roles.gold }]}
    >
      <ItemWell entry={entry} />
      <View style={styles.texts}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{itemName(entry.kind)}</Text>
          {entry.isNew && <Text style={styles.newTag}>{NEW_TAG}</Text>}
        </View>
        <Text style={[styles.rarity, { color: RARITY_COLORS[entry.rarity] }]}>
          {itemRarityLine(entry.kind)}
        </Text>
        <Text style={styles.effect}>{itemEffectLine(entry.kind)}</Text>
      </View>
    </Pressable>
  );
}

/**
 * Une ligne inconnue (« ??? ») : son emplacement et « Se débloque au camp » ou « Pas encore
 * trouvé » (O5). Elle n'est pas un bouton.
 */
function UnknownRow({
  entry,
  bought,
}: {
  readonly entry: ItemEntry;
  readonly bought: readonly ItemKind[] | null;
}) {
  const note = itemEntryNote(entry, bought);
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={itemRowLabel(entry, note)}
      testID={`book-item-${entry.kind}`}
      style={[styles.row, styles.rowUnknown]}
    >
      <Hatching color={HATCH} count={70} step={6} />
      <View style={[styles.well, styles.wellUnknown]}>
        <PixelIcon name="qm12" color={roles.line} />
      </View>
      <View style={styles.texts}>
        <Text style={[styles.name, styles.nameUnknown]}>{UNKNOWN_NAME}</Text>
        <View style={styles.nameRow}>
          {note === 'toUnlock' && <PixelIcon name="lock" color={roles.muted} />}
          <Text style={[styles.effect, styles.effectUnknown]}>
            {unknownItemLine(entry.slot, note)}
          </Text>
        </View>
      </View>
    </View>
  );
}

/** Un emplacement (Armes, Armures, Accessoires) : son titre, son compte, sa liste nommée. */
function SlotSection({
  slot,
  bought,
  onOpen,
}: {
  readonly slot: BookItemSlot;
  readonly bought: readonly ItemKind[] | null;
  readonly onOpen: (item: ItemKind) => void;
}) {
  const title = SLOT_TITLES[slot.slot];
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text testID={`book-items-count-${slot.slot}`} style={styles.sectionCount}>
          {`${slot.discovered}/${slot.total}`}
        </Text>
      </View>
      <View
        accessibilityRole="list"
        accessibilityLabel={title}
        testID={`book-items-list-${slot.slot}`}
        style={styles.rows}
      >
        {slot.entries.map((entry) =>
          entry.state === 'discovered' ? (
            <DiscoveredRow key={entry.kind} entry={entry} onOpen={onOpen} />
          ) : (
            <UnknownRow key={entry.kind} entry={entry} bought={bought} />
          ),
        )}
      </View>
    </View>
  );
}

/**
 * L'onglet « Objets » du carnet (`BookItemsTab`, #284, maquette 278, O1, O2, O4) : le bandeau de
 * première utilisation, le cadre des compteurs, puis une section par emplacement, une ligne de
 * 328 × 76 dp par objet, dans l'ordre de rareté. `bought` : les objets à débloquer achetés au Camp,
 * `null` tant qu'il n'est pas lu.
 */
export function BookItemsTab({
  items,
  bought,
  onOpen,
}: {
  readonly items: BookItems;
  readonly bought: readonly ItemKind[] | null;
  readonly onOpen: (item: ItemKind) => void;
}) {
  return (
    <>
      {items.firstUse && (
        <View
          accessible
          role="note"
          testID="book-items-first-use"
          style={[styles.band, { borderWidth: LINE }]}
        >
          <View style={styles.bandDot} />
          <Text style={styles.bandText}>{ITEMS_FIRST_USE_BAND}</Text>
        </View>
      )}
      <ItemsFrame items={items} />
      {items.slots.map((slot) => (
        <SlotSection key={slot.slot} slot={slot} bought={bought} onOpen={onOpen} />
      ))}
    </>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  band: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: roles.raised,
    borderColor: roles.blue,
  },
  bandDot: {
    width: 10,
    height: 10,
    marginTop: 4,
    backgroundColor: roles.blue,
    transform: [{ rotate: '45deg' }],
  },
  bandText: {
    flex: 1,
    fontFamily: textFont.medium,
    fontSize: 13,
    lineHeight: 18,
    color: roles.light,
  },
  frame: { gap: 6, paddingVertical: 10, paddingHorizontal: 12 },
  frameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  frameName: { fontFamily: pixelFont, fontSize: 19, lineHeight: 22, color: roles.light },
  frameCount: { fontFamily: pixelFont, fontSize: 15, lineHeight: 18, color: roles.gold },
  frameUnit: { fontFamily: textFont.medium, fontSize: 12, color: roles.parchment },
  bar: {
    height: 8,
    backgroundColor: roles.well,
    borderWidth: 1,
    borderColor: roles.line,
    overflow: 'hidden',
  },
  barFilled: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: roles.gold },
  rarities: { flexDirection: 'row', flexWrap: 'wrap' },
  rarityRow: { flexDirection: 'row' },
  rarityCount: {
    fontFamily: textFont.medium,
    fontSize: 12.5,
    lineHeight: 17,
    color: roles.parchment,
  },
  section: { gap: 8 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  sectionTitle: {
    fontFamily: textFont.bold,
    fontSize: 11.5,
    lineHeight: 15,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: roles.muted,
  },
  sectionCount: {
    marginLeft: 'auto',
    fontFamily: pixelFont,
    fontSize: 13,
    lineHeight: 16,
    color: roles.parchment,
  },
  rows: { gap: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 76,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: LINE,
  },
  rowFound: { backgroundColor: roles.surface, borderColor: roles.line },
  rowUnknown: { backgroundColor: roles.sunken, borderColor: roles.raised, overflow: 'hidden' },
  well: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: roles.well,
    borderWidth: LINE,
  },
  wellUnknown: { backgroundColor: roles.ink, borderColor: roles.raised },
  texts: { flex: 1, gap: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: {
    flexShrink: 1,
    fontFamily: pixelFont,
    fontSize: 16,
    lineHeight: 19,
    color: roles.light,
  },
  nameUnknown: { letterSpacing: 1.9, color: roles.muted },
  newTag: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    fontFamily: textFont.bold,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: roles.ink,
    backgroundColor: roles.gold,
  },
  rarity: { fontFamily: textFont.bold, fontSize: 12, lineHeight: 16 },
  effect: {
    flexShrink: 1,
    fontFamily: textFont.medium,
    fontSize: 12.5,
    lineHeight: 17,
    color: roles.parchment,
  },
  effectUnknown: { color: roles.muted },
});
// Stryker restore all
