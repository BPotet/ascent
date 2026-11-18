import { useMemo } from 'react';
import {
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type PanResponderCallbacks,
} from 'react-native';

import { ITEMS, type ItemKind } from '../../../domain/ascent/items';
import { itemDescription, itemEffectLine, itemName } from '../format/ascentText';
import { CLOSE, ITEM_SHEET_NOTE, itemRarityLine, itemSheetLabel } from '../format/bookItemsText';
import { artPalette } from '../pixelArt/artPalette';
import { MIN_TARGET_SIZE } from '../pixelArt/PixelButton';
import { PixelSheet } from '../pixelArt/PixelSheet';
import { pixelFont, textFont } from '../pixelArt/pixelTypography';
import { ITEM_IMAGES } from '../pixelArt/sprites/atelier/data/itemImages';
import { assetSprite } from '../pixelArt/sprites/atelier/fullAnimation';
import { toPixelImage } from '../pixelArt/sprites/Sprite';
import { SpriteCanvas } from '../pixelArt/SpriteCanvas';
import { useReducedMotion } from '../state/useReducedMotion';
import { RARITY_COLORS } from './IconWell';

const { roles } = artPalette;

/** Au-delà de ce glissement vers le bas, en dp, la fiche se ferme (D11). */
const SWIPE_DISTANCE = 80;
/** Au-delà de cette vitesse vers le bas, en dp par ms, la fiche se ferme (D11). */
const SWIPE_SPEED = 0.5;
/** Le glissement à partir duquel la fiche prend le geste, en dp. */
const SWIPE_START = 8;

/**
 * Glisser vers le bas ferme la fiche (`closesOnSwipe`, D11) : vers le bas, au-delà de 80 dp ou à
 * plus de 0,5 dp/ms.
 */
export function closesOnSwipe(dy: number, vy: number): boolean {
  return dy > 0 && (dy > SWIPE_DISTANCE || vy > SWIPE_SPEED);
}

/**
 * Les gestionnaires du glissement vers le bas de la fiche (D11) : elle ne prend qu'un geste
 * vertical vers le bas, jamais un toucher ni un geste de côté, et se ferme au relâcher selon
 * `closesOnSwipe`.
 */
export function swipeDownToClose(onClose: () => void): PanResponderCallbacks {
  return {
    onMoveShouldSetPanResponder: (_, { dx, dy }) => dy > SWIPE_START && dy > Math.abs(dx),
    onPanResponderRelease: (_, { dy, vy }) => {
      if (closesOnSwipe(dy, vy)) onClose();
    },
  };
}

/**
 * La fiche d'un objet découvert (`ItemSheet`, #284, maquette 278, O3) : une feuille avec l'image à
 * 96 dp dans l'écrin de 112 dp à la couleur de sa rareté, son nom, sa rareté, son effet en or, sa
 * description et la phrase de la maquette. « Fermer », le retour Android, le voile ou un glissement
 * vers le bas la ferment.
 */
export function ItemSheet({
  item,
  onClose,
}: {
  readonly item: ItemKind;
  readonly onClose: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const { height } = useWindowDimensions();
  const swipe = useMemo(() => PanResponder.create(swipeDownToClose(onClose)), [onClose]);
  const rarity = RARITY_COLORS[ITEMS[item].rarity];
  // Les 11 objets ont leur image validée (test de `BookItemsTab`).
  const image = ITEM_IMAGES[item]!;
  return (
    <Modal
      transparent
      visible
      animationType={reducedMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
      testID="item-sheet-modal"
    >
      <View style={styles.container}>
        <Pressable
          accessible={false}
          onPress={onClose}
          testID="item-sheet-scrim"
          style={styles.scrim}
        />
        <PixelSheet
          {...swipe.panHandlers}
          accessibilityViewIsModal
          accessibilityLabel={itemSheetLabel(item)}
          testID="item-sheet"
          style={[styles.sheet, { maxHeight: height * 0.9 }]}
        >
          <View style={styles.titleRow}>
            <Text accessibilityRole="header" style={styles.title}>
              {itemName(item)}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={CLOSE}
              onPress={onClose}
              style={styles.close}
            >
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>
          <View style={[styles.well, { borderColor: rarity }]}>
            <SpriteCanvas
              sprite={`item-${item}`}
              draw={() => toPixelImage(assetSprite(image))}
              scale={4}
              testID="item-sheet-image"
            />
          </View>
          <Text style={[styles.rarity, { color: rarity }]}>{itemRarityLine(item)}</Text>
          <Text style={styles.effect}>{itemEffectLine(item)}</Text>
          <Text style={styles.lore}>{itemDescription(item)}</Text>
          <Text style={styles.note}>{ITEM_SHEET_NOTE}</Text>
        </PixelSheet>
      </View>
    </Modal>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: roles.scrim },
  sheet: {
    alignItems: 'center',
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 30,
    gap: 8,
    backgroundColor: roles.night,
  },
  titleRow: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1, fontFamily: pixelFont, fontSize: 24, lineHeight: 28, color: roles.light },
  close: {
    minWidth: MIN_TARGET_SIZE,
    minHeight: MIN_TARGET_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { fontFamily: pixelFont, fontSize: 26, lineHeight: 30, color: roles.light },
  well: {
    width: 112,
    height: 112,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: roles.well,
  },
  rarity: { fontFamily: textFont.bold, fontSize: 14, lineHeight: 18 },
  effect: {
    textAlign: 'center',
    fontFamily: textFont.semiBold,
    fontSize: 14.5,
    lineHeight: 20,
    color: roles.gold,
  },
  lore: {
    alignSelf: 'stretch',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderLeftWidth: 3,
    borderLeftColor: roles.goldDark,
    backgroundColor: roles.sunken,
    fontFamily: textFont.regular,
    fontStyle: 'italic',
    fontSize: 14.5,
    lineHeight: 22,
    color: roles.light,
  },
  note: {
    textAlign: 'center',
    fontFamily: textFont.medium,
    fontSize: 13,
    lineHeight: 18,
    color: roles.muted,
  },
});
// Stryker restore all
