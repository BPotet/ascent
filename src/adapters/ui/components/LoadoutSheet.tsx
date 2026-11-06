import { useEffect, useRef, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import type { StartingBlessing } from '../../../domain/ascent/blessings';
import type { BoonKind } from '../../../domain/ascent/boons';
import {
  loadoutSize,
  type Loadout,
  type LoadoutFavor,
  type LoadoutReserves,
} from '../../../domain/ascent/loadout';
import type { Rarity } from '../../../domain/ascent/rarity';
import { blessingCard } from '../format/ascentText';
import { boonCard } from '../format/boonText';
import { gaugeValue } from '../format/gaugeText';
import {
  FAVOR_TITLE,
  LOADOUT_SUBTITLE,
  NO_BLESSING_YET,
  NO_BOON_YET,
  RESERVES_TITLE,
  blessingTag,
  favorHeadingLabel,
  favorRows,
  reserveRows,
  reservesHeadingLabel,
  type StateRowText,
} from '../format/loadoutText';
import { artPalette } from '../pixelArt/artPalette';
import { artPixelSize, notchedCorners } from '../pixelArt/artPixel';
import { PixelButton } from '../pixelArt/PixelButton';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { PixelSheet } from '../pixelArt/PixelSheet';
import { pixelFont, textFont } from '../pixelArt/pixelTypography';
import { KEY_IMAGE } from '../pixelArt/sprites/atelier/data/key';
import { assetSprite } from '../pixelArt/sprites/atelier/fullAnimation';
import { blessingIcon, boonIcon, type GameIcon } from '../pixelArt/sprites/gameIcons';
import { toPixelImage } from '../pixelArt/sprites/Sprite';
import { SpriteCanvas } from '../pixelArt/SpriteCanvas';
import { useReducedMotion } from '../state/useReducedMotion';
import { IconWell, RARITY_COLORS } from './IconWell';
import { LoadoutHeading, LoadoutNone } from './LoadoutChip';
import { SCROLL_HINT_HEIGHT, ScrollHint } from './ScrollHint';

const { roles } = artPalette;

/** Au-delà de ce nombre d'entrées, la liste annonce qu'elle défile (maquette #153). */
const SCROLL_HINT_BEYOND = 3;

/** Une ligne de la feuille : l'écrin, le nom, la rareté au mot et aux losanges, l'effet. */
function LoadoutRow({
  icon,
  rarity,
  name,
  tag,
  effect,
  label,
}: {
  readonly icon: GameIcon;
  readonly rarity: Rarity;
  readonly name: string;
  readonly tag: string;
  readonly effect: string;
  readonly label: string;
}) {
  return (
    <View
      accessible
      accessibilityLabel={label}
      testID="loadout-row"
      style={[styles.row, { borderTopWidth: artPixelSize(2) }]}
    >
      <IconWell icon={icon} rarity={rarity} size="card" />
      <View style={styles.rowText}>
        <Text style={styles.name}>{name}</Text>
        <Text style={[styles.tag, { color: RARITY_COLORS[rarity] }]}>{tag}</Text>
        <Text style={styles.effect}>{effect}</Text>
      </View>
    </View>
  );
}

function BlessingRow({ blessing }: { readonly blessing: StartingBlessing }) {
  const card = blessingCard(blessing);
  return (
    <LoadoutRow
      icon={blessingIcon(blessing.family)}
      rarity={blessing.rarity}
      name={card.name}
      tag={blessingTag(blessing)}
      effect={card.effect}
      label={card.label}
    />
  );
}

function BoonRow({ kind }: { readonly kind: BoonKind }) {
  const card = boonCard(kind);
  return (
    <LoadoutRow
      icon={boonIcon(kind)}
      rarity={card.rarity}
      name={card.name}
      tag={card.tag}
      effect={card.effect}
      label={card.label}
    />
  );
}

/** Les teintes d'une ligne d'état : l'écrin, le glyphe et l'état (#42, #226). */
const STATE_TONES = {
  favor: { well: roles.doneLine, glyph: roles.done },
  gold: { well: roles.goldDark, glyph: roles.gold },
} as const;

/**
 * Une ligne d'état : son glyphe (ou l'image de la clé, #226) dans un écrin sans rareté, vert pour
 * la faveur, à liseré d'or pour les Réserves, ce qu'elle fait, et son état, en gris quand elle a
 * servi ou qu'il n'en reste pas.
 */
function StateRow({ row, testID }: { readonly row: StateRowText; readonly testID: string }) {
  const tone = STATE_TONES[row.tone];
  return (
    <View
      accessible
      accessibilityLabel={row.label}
      testID={testID}
      style={[styles.row, styles.stateRow, { borderTopWidth: artPixelSize(2) }]}
    >
      <View
        style={[
          styles.stateWell,
          { borderWidth: artPixelSize(2), borderColor: row.used ? roles.line : tone.well },
        ]}
      >
        {row.key === 'keys' ? (
          // La clé de l'Atelier, 16 × 16 (#226), atténuée sans clé (E3).
          <SpriteCanvas
            sprite="key"
            draw={() => toPixelImage(assetSprite(KEY_IMAGE))}
            scale={2}
            testID="reserve-key-image"
            style={row.used && styles.usedGlyph}
          />
        ) : (
          <PixelIcon
            name={row.glyph}
            color={tone.glyph}
            testID={row.tone === 'favor' ? 'favor-glyph' : 'reserve-glyph'}
            style={row.used && styles.usedGlyph}
          />
        )}
      </View>
      <View style={styles.rowText}>
        <Text style={styles.name}>{row.name}</Text>
        <Text style={styles.effect}>{row.effect}</Text>
      </View>
      <Text style={[styles.state, { color: tone.glyph }, row.used && styles.stateUsed]}>
        {row.state}
      </Text>
    </View>
  );
}

/**
 * Les Réserves de l'ascension (#226, maquette 208 E1, E3) : un en-tête « Réserves », puis l'Or et
 * les clés, en tête de la feuille, avec ou sans faveur.
 */
function ReservesPart({ reserves }: { readonly reserves: LoadoutReserves }) {
  return (
    <View style={styles.part}>
      <LoadoutHeading title={RESERVES_TITLE} count="" label={reservesHeadingLabel()} />
      {reserveRows(reserves).map((row) => (
        <StateRow key={row.key} row={row} testID={`reserve-row-${row.key}`} />
      ))}
    </View>
  );
}

/**
 * La faveur de l'ascension (#42, maquette 205 E1) : un en-tête « Faveur de l'ascension · +2 », puis
 * ses lignes : les relances, et la seconde chance à +2 (#206).
 */
function FavorPart({ favor }: { readonly favor: LoadoutFavor }) {
  return (
    <View style={styles.part}>
      <LoadoutHeading
        title={FAVOR_TITLE}
        count={gaugeValue(favor.gauge)}
        label={favorHeadingLabel(favor)}
      />
      {favorRows(favor).map((row) => (
        <StateRow key={row.key} row={row} testID={`favor-row-${row.key}`} />
      ))}
    </View>
  );
}

/** Une partie de la feuille : son en-tête et son compte, puis ses lignes ou son message vide. */
function Part({
  title,
  count,
  empty,
  children,
}: {
  readonly title: string;
  readonly count: number;
  readonly empty: string;
  readonly children: ReactNode;
}) {
  return (
    <View style={styles.part}>
      <LoadoutHeading title={title} count={String(count)} label={`${title}, ${count}`} />
      {count === 0 ? <LoadoutNone text={empty} /> : <View>{children}</View>}
    </View>
  );
}

/**
 * La feuille de l'Équipement (#159) : le titre, qui reçoit le focus à l'ouverture, le sous-titre,
 * « Combat en pause » en combat, puis les bénédictions de départ et les bienfaits, chacun avec son
 * icône, sa rareté et son effet, dans une liste qui défile, et « Fermer ». « Fermer », le voile et
 * le geste retour appellent `onClose` ; l'appelant rend le focus au bouton qui l'a ouverte.
 */
export function LoadoutSheet({
  loadout,
  combat,
  visible,
  onClose,
}: {
  readonly loadout: Loadout;
  readonly combat: boolean;
  readonly visible: boolean;
  readonly onClose: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const { height } = useWindowDimensions();
  const title = useRef<Text>(null);
  const line = artPixelSize(2);
  // La ligne des relances compte comme une entrée (#42), les lignes des Réserves aussi (#226).
  const favorCount = loadout.favor === undefined ? 0 : favorRows(loadout.favor).length;
  const reserveCount = loadout.reserves === undefined ? 0 : reserveRows(loadout.reserves).length;
  const many = loadoutSize(loadout) + favorCount + reserveCount > SCROLL_HINT_BEYOND;

  useEffect(() => {
    if (visible && title.current !== null) {
      AccessibilityInfo.sendAccessibilityEvent(title.current, 'focus');
    }
  }, [visible]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType={reducedMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
      testID="loadout-sheet"
    >
      <View style={styles.container}>
        <Pressable
          accessible={false}
          onPress={onClose}
          testID="loadout-sheet-scrim"
          style={styles.scrim}
        />
        <PixelSheet accessibilityViewIsModal style={[styles.sheet, { maxHeight: height * 0.88 }]}>
          <Text ref={title} accessibilityRole="header" style={styles.title}>
            Équipement
          </Text>
          <Text style={styles.subtitle}>{LOADOUT_SUBTITLE}</Text>
          {combat && (
            <View accessible role="status" style={[styles.band, { borderWidth: line }]}>
              <View style={styles.pauseIcon} />
              <Text style={styles.bandText}>Combat en pause</Text>
              {notchedCorners(line).map((corner, index) => (
                <View key={index} pointerEvents="none" style={[styles.corner, corner]} />
              ))}
            </View>
          )}
          <View style={styles.list}>
            <ScrollView
              contentContainerStyle={[styles.listContent, many && styles.listMore]}
              bounces={false}
            >
              {loadout.reserves !== undefined && <ReservesPart reserves={loadout.reserves} />}
              {loadout.favor !== undefined && <FavorPart favor={loadout.favor} />}
              <Part
                title="Bénédictions de départ"
                count={loadout.blessings.length}
                empty={NO_BLESSING_YET}
              >
                {loadout.blessings.map((blessing) => (
                  <BlessingRow key={blessing.family} blessing={blessing} />
                ))}
              </Part>
              <Part title="Bienfaits" count={loadout.boons.length} empty={NO_BOON_YET}>
                {loadout.boons.map((kind) => (
                  <BoonRow key={kind} kind={kind} />
                ))}
              </Part>
            </ScrollView>
            {many && <ScrollHint under={roles.surface} testID="loadout-sheet-more" />}
          </View>
          <PixelButton label="Fermer" variant="secondary" onPress={onClose} />
        </PixelSheet>
      </View>
    </Modal>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: roles.scrim },
  sheet: { paddingTop: 8, paddingHorizontal: 16, paddingBottom: 34, gap: 10 },
  title: { fontFamily: pixelFont, fontSize: 26, lineHeight: 30, color: roles.light },
  subtitle: { fontFamily: textFont.medium, fontSize: 14, lineHeight: 20, color: roles.parchment },
  band: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: roles.raised,
    borderColor: roles.line,
  },
  pauseIcon: {
    width: 12,
    height: 14,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderColor: roles.gold,
  },
  bandText: { fontFamily: textFont.bold, fontSize: 14, lineHeight: 18, color: roles.light },
  corner: { position: 'absolute', backgroundColor: roles.surface },
  list: { flexShrink: 1 },
  listContent: { gap: 6, paddingBottom: 8 },
  // Le dernier bienfait remonte au-dessus du dégradé en fin de défilement.
  listMore: { paddingBottom: SCROLL_HINT_HEIGHT },
  part: { gap: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 8,
    borderTopColor: roles.raised,
  },
  rowText: { flex: 1, gap: 1 },
  name: { fontFamily: pixelFont, fontSize: 18, lineHeight: 22, color: roles.light },
  tag: { fontFamily: textFont.bold, fontSize: 12, lineHeight: 16 },
  effect: { fontFamily: textFont.medium, fontSize: 13, lineHeight: 18, color: roles.parchment },
  stateRow: { alignItems: 'center' },
  stateWell: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: roles.well,
  },
  usedGlyph: { opacity: 0.5 },
  state: { fontFamily: textFont.bold, fontSize: 12, lineHeight: 16 },
  stateUsed: { color: roles.muted },
});
// Stryker restore all
