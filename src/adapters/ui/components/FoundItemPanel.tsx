import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';

import { ITEMS, type Equipment, type ItemKind } from '../../../domain/ascent/items';
import {
  SKIP_CHEST_LABEL,
  TAP_TO_SKIP,
  chestAnnouncement,
  itemAnnouncement,
  itemDescription,
  itemText,
  wornText,
} from '../format/ascentText';
import { rarityLine } from '../format/rarityText';
import { artPalette } from '../pixelArt/artPalette';
import { artPixelSize } from '../pixelArt/artPixel';
import { PixelButton } from '../pixelArt/PixelButton';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { pixelFont, pixelTypography, textFont } from '../pixelArt/pixelTypography';
import { CHEST_IMAGE, CHEST_OPEN_IMAGE } from '../pixelArt/sprites/atelier/data/chest';
import { ITEM_IMAGES } from '../pixelArt/sprites/atelier/data/itemImages';
import { assetSprite } from '../pixelArt/sprites/atelier/fullAnimation';
import { itemSilhouette } from '../pixelArt/sprites/itemSilhouettes';
import { toPixelImage } from '../pixelArt/sprites/Sprite';
import { SpriteCanvas } from '../pixelArt/SpriteCanvas';
import { useReducedMotion } from '../state/useReducedMotion';
import { ChestStage } from './ChestStage';
import { useSteps } from './CampFeedback';

const { roles } = artPalette;

/** L'ouverture du Coffre (#227, maquette 208, B1 à B3), en millisecondes. */
export const CHEST_OPEN_MS = 600;
const STEP_MS = 100;
/** Le pas où le coffre s'ouvre (300 ms) et celui où l'objet en sort (600 ms). */
const OPEN_STEP = 3;
const REVEAL_STEP = CHEST_OPEN_MS / STEP_MS;
/** Le dernier pas : la fin du fondu de 100 ms de l'objet. */
const LAST_STEP = REVEAL_STEP + 1;
/** La secousse du coffre fermé, en pixels d'art, sur ses 3 pas (0 à 300 ms). */
const SHAKE = [-0.5, 0.5, -0.5] as const;
const CHEST_SCALE = 4;
const ITEM_SCALE = 3;

export interface FoundItemPanelProps {
  readonly item: ItemKind;
  readonly equipment: Equipment;
  /** Jouer l'ouverture du coffre ; faux, l'objet est montré tout de suite (la reprise). */
  readonly animate: boolean;
  /** L'objet sort d'un Coffre ; faux, il est montré sans coffre (le coffre scellé, #226). */
  readonly chest?: boolean;
  /** D'où vient l'objet, au-dessus du titre : « Du coffre scellé » (#226) ; absent, rien. */
  readonly source?: string;
  readonly onLeave: () => void;
  readonly onEquip: () => void;
}

/**
 * L'écran « Objet trouvé » (#93, #227) : le Coffre s'ouvre tout seul (600 ms, passable d'un
 * toucher), puis l'objet prend sa place, comparé à celui que porte le héros, avec « Laisser » et
 * « Équiper ». Les lignes de l'objet sont là dès le début, invisibles, et les boutons ne sont
 * montés qu'une fois l'objet affiché : un toucher pressé n'équipe ni ne laisse rien. En mouvement
 * réduit, le coffre est montré ouvert, immobile, et l'objet arrive en fondu.
 */
export function FoundItemPanel({
  item,
  equipment,
  animate,
  chest = true,
  source,
  onLeave,
  onEquip,
}: FoundItemPanelProps) {
  const reducedMotion = useReducedMotion();
  const [skipped, setSkipped] = useState(!animate || !chest);
  const step = useSteps(skipped ? 0 : LAST_STEP, STEP_MS);
  const current = skipped ? LAST_STEP : step;
  const revealed = current >= REVEAL_STEP;
  const opacity = revealed ? (current >= LAST_STEP ? 1 : 0.5) : 0;

  const announced = useRef(false);
  useEffect(() => {
    if (!revealed || announced.current) return;
    // Sorti d'un Coffre (#227), ou révélé par le coffre scellé (#226) : l'objet est annoncé.
    if (chest) {
      announced.current = true;
      AccessibilityInfo.announceForAccessibility(chestAnnouncement(item));
    } else if (source !== undefined) {
      announced.current = true;
      AccessibilityInfo.announceForAccessibility(`${itemAnnouncement(item)}.`);
    }
  }, [revealed, chest, source, item]);

  const { slot, rarity } = ITEMS[item];
  const description = itemDescription(item);
  const image = ITEM_IMAGES[item];
  const opened = reducedMotion || current >= OPEN_STEP;
  const hiddenUntilRevealed = {
    accessibilityElementsHidden: !revealed,
    importantForAccessibility: revealed ? ('auto' as const) : ('no-hide-descendants' as const),
  };

  const picture =
    image === undefined ? (
      <SpriteCanvas
        sprite={`item-silhouette-${slot}`}
        draw={() => toPixelImage(itemSilhouette(slot))}
        scale={ITEM_SCALE}
        testID="item-silhouette"
      />
    ) : (
      // L'image validée dans l'Atelier (#119), à la place de la silhouette provisoire.
      <SpriteCanvas
        sprite={`item-${item}`}
        draw={() => toPixelImage(assetSprite(image))}
        scale={ITEM_SCALE}
        testID="item-image"
      />
    );

  return (
    <View style={styles.center}>
      {source !== undefined && (
        <View style={styles.source}>
          <PixelIcon name="lock" color={roles.muted} />
          <Text style={styles.sourceText}>{source}</Text>
        </View>
      )}
      <Text accessibilityRole="header" style={styles.title}>
        Objet trouvé
      </Text>
      <View style={chest && styles.slot}>
        {revealed ? (
          <View style={[styles.picture, { opacity }]}>{picture}</View>
        ) : (
          <ChestStage
            name="chest"
            closed={CHEST_IMAGE}
            open={CHEST_OPEN_IMAGE}
            scale={CHEST_SCALE}
            opened={opened}
            shake={opened ? 0 : SHAKE[current]!}
            glow={reducedMotion ? 1 : Math.max(0, current - OPEN_STEP + 1) / OPEN_STEP}
          />
        )}
      </View>
      <View testID="found-item-reveal" style={[styles.lines, { opacity }]} {...hiddenUntilRevealed}>
        {rarity === 'epic' && (
          // Un objet Épique (#195) : sa rareté en losanges et en mot, à la couleur Épique.
          <Text style={styles.epic}>{rarityLine(rarity)}</Text>
        )}
        <Text style={styles.gold}>{itemText(item)}</Text>
        {description !== null && <Text style={styles.line}>{description}</Text>}
        <Text style={styles.line}>{`Tu portes : ${wornText(equipment, slot)}`}</Text>
        <Text style={styles.line}>Un objet laissé ne revient pas.</Text>
        {revealed && (
          <View style={styles.row}>
            <PixelButton
              label="Laisser"
              variant="secondary"
              onPress={onLeave}
              style={styles.half}
            />
            <PixelButton label="Équiper" onPress={onEquip} style={styles.half} />
          </View>
        )}
      </View>
      {revealed ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={SKIP_CHEST_LABEL}
          onPress={() => setSkipped(true)}
          style={styles.skip}
          testID="chest-skip"
        >
          <Text style={styles.tap}>{TAP_TO_SKIP}</Text>
        </Pressable>
      )}
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'stretch', padding: 24, gap: 12 },
  source: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  sourceText: { ...pixelTypography.body, color: roles.muted },
  title: {
    fontFamily: pixelFont,
    fontSize: 22,
    lineHeight: 26,
    color: roles.light,
    textAlign: 'center',
  },
  // La place de l'image : la hauteur du coffre, pour que rien ne saute quand l'objet en sort.
  slot: { minHeight: CHEST_IMAGE.h * artPixelSize(CHEST_SCALE), justifyContent: 'center' },
  picture: { alignSelf: 'center' },
  lines: { gap: 12 },
  line: { ...pixelTypography.body, color: roles.parchment, textAlign: 'center' },
  epic: { fontFamily: textFont.bold, fontSize: 12, lineHeight: 16, color: roles.rarityEpic },
  gold: {
    fontFamily: pixelFont,
    fontSize: 18,
    lineHeight: 22,
    color: roles.gold,
    textAlign: 'center',
  },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  half: { flex: 1 },
  skip: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'flex-end',
    paddingBottom: 30,
  },
  tap: { ...pixelTypography.body, color: roles.parchment, textAlign: 'center' },
});
// Stryker restore all
