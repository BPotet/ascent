import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import type { CampSession, CampView } from '../../../application/useCases/CampSession';
import type { CampOfferEntry } from '../../../domain/ascent/camp';
import { POWER_TREES, type PowerTreeCode } from '../../../domain/ascent/powerTree';
import type { Unlock } from '../../../domain/ascent/unlocks';
import type { HeroKind } from '../../../domain/battle/combatants';
import { MinusFloat, Spark } from '../components/CampFeedback';
import { Screen } from '../components/Screen';
import { IconWell, RARITY_COLORS } from '../components/IconWell';
import { PowerIcon } from '../components/PowerIcon';
import { Toast } from '../components/Toast';
import {
  ALL_UNLOCKED_BAND,
  CAMP_BACK_LABEL,
  CAMP_TITLE,
  FLAME_KEEPER_NAME,
  NEXT_ASCENT_STAMP,
  RETRY,
  SHEET_ERROR,
  UNLOCKED_STAMP,
  UNLOCKS_HEADING,
  availableShardsText,
  buyLabel,
  cardLabel,
  confirmText,
  keeperLine,
  keeperRule,
  missingLabel,
  missingText,
  purseLabel,
  runBand,
  sheetLine,
  sheetTitle,
  unlockCard,
  unlockedAnnouncement,
  unlockedToast,
} from '../format/campText';
import { shardText } from '../format/ascentText';
import { HERO_NAMES } from '../format/battleText';
import { powerTreeCardLabel } from '../format/powerText';
import { AssetRows } from '../pixelArt/AssetRows';
import { artPalette } from '../pixelArt/artPalette';
import { artPixelSize } from '../pixelArt/artPixel';
import { MIN_TARGET_SIZE, PixelButton } from '../pixelArt/PixelButton';
import { PixelFrame } from '../pixelArt/PixelFrame';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { PixelSheet } from '../pixelArt/PixelSheet';
import { PixelSkeleton } from '../pixelArt/PixelSkeleton';
import { pixelFont, textFont } from '../pixelArt/pixelTypography';
import { CAMP_FIRE_IMAGE } from '../pixelArt/sprites/atelier/data/campFire';
import { FLAME_KEEPER_IMAGE } from '../pixelArt/sprites/atelier/data/flameKeeper';
import { ITEM_IMAGES } from '../pixelArt/sprites/atelier/data/itemImages';
import { PORTRAITS } from '../pixelArt/sprites/atelier/data/portraits';
import { boonIcon, type GameIcon } from '../pixelArt/sprites/gameIcons';
import { useCamp } from '../state/useCamp';
import { useReducedMotion } from '../state/useReducedMotion';

const { roles } = artPalette;
const LINE = artPixelSize(2);

/** Les icônes du catalogue, validées dans l'Atelier (#195) : celles des objets et de Cœur de braise. */
const UNLOCK_ICONS: Readonly<Record<Unlock, GameIcon>> = {
  huntingSpear: { sprite: 'item-image:huntingSpear', image: ITEM_IMAGES.huntingSpear! },
  watchBell: { sprite: 'item-image:watchBell', image: ITEM_IMAGES.watchBell! },
  emberHeart: boonIcon('emberHeart'),
  flamberge: { sprite: 'item-image:flamberge', image: ITEM_IMAGES.flamberge! },
};

/** Le dernier déblocage de la visite : sa carte, l'envol et le message (C6, C7). */
interface Fresh {
  readonly id: number;
  readonly unlock: Unlock;
  readonly price: number;
  readonly message: string;
  readonly announcement: string;
}

/** Un bandeau : bleu d'information, vert « fait » ou rose d'erreur (maquette 40, `.band`). */
function Band({
  tone,
  text,
  role,
}: {
  readonly tone: 'info' | 'done' | 'error';
  readonly text: string;
  readonly role?: 'alert';
}) {
  const look = BANDS[tone];
  return (
    <View
      accessible
      {...(role !== undefined && { role })}
      style={[
        styles.band,
        { borderWidth: LINE, borderColor: look.line, backgroundColor: look.background },
      ]}
    >
      <View style={[styles.bandDot, { backgroundColor: look.dot }]} />
      <Text style={[styles.bandText, { color: look.text }]}>{text}</Text>
    </View>
  );
}

/** « Déjà dans la tour » (vert) ou « Dès ta prochaine ascension » (bleu), sans bouton. */
function Stamp({ next }: { readonly next: boolean }) {
  return (
    <View
      testID={next ? 'camp-stamp-next' : 'camp-stamp-unlocked'}
      style={[
        styles.stamp,
        { borderWidth: LINE },
        next ? styles.stampNext : { backgroundColor: roles.doneBg, borderColor: roles.doneLine },
      ]}
    >
      <PixelIcon name={next ? 'dot8' : 'check8'} color={next ? roles.blue : roles.done} />
      <Text style={[styles.stampText, { color: next ? roles.light : roles.done }]}>
        {next ? NEXT_ASCENT_STAMP : UNLOCKED_STAMP}
      </Text>
    </View>
  );
}

/** Le prix sur un bouton : l'Éclat, puis le nombre. */
function Price({
  price,
  color,
  suffix,
}: {
  readonly price: number;
  readonly color: string;
  readonly suffix?: string;
}) {
  return (
    <View style={styles.price}>
      <PixelIcon name="shard8" color={color} />
      <Text style={[styles.priceText, { color }]}>
        {suffix === undefined ? price : `${price} ${suffix}`}
      </Text>
    </View>
  );
}

/**
 * Une carte du catalogue (C4) : l'écrin, le nom, le type et la rareté, l'effet, la condition, lus
 * d'un trait avec l'état ; puis l'action : « Débloquer · 40 », un bouton éteint qui garde son prix
 * et dit ce qu'il manque, ou le tampon de son état.
 */
function UnlockCardView({
  entry,
  fresh,
  onBuy,
  buttonRef,
  labelRef,
}: {
  readonly entry: CampOfferEntry;
  readonly fresh: boolean;
  readonly onBuy: () => void;
  readonly buttonRef: (view: View | null) => void;
  readonly labelRef: (view: View | null) => void;
}) {
  const { unlock, price, state } = entry;
  const card = unlockCard(unlock);
  const off = state.kind === 'missing';
  return (
    <PixelFrame testID={`camp-card-${unlock}`} style={styles.card}>
      <View style={styles.cardTop}>
        <View style={off && styles.dim}>
          {fresh && <View testID="camp-fresh" style={styles.freshRing} />}
          <IconWell icon={UNLOCK_ICONS[unlock]} rarity={card.rarity} size="card" />
          {fresh && <Spark />}
        </View>
        <View
          ref={labelRef}
          accessible
          accessibilityLabel={cardLabel(card, state, price)}
          style={styles.cardText}
        >
          <Text style={styles.cardName}>{card.name}</Text>
          <Text style={[styles.cardTag, { color: RARITY_COLORS[card.rarity] }]}>{card.tag}</Text>
          <Text style={styles.cardEffect}>{card.effect}</Text>
          {card.note !== null && <Text style={styles.cardNote}>{card.note}</Text>}
        </View>
      </View>
      {state.kind === 'unlocked' || state.kind === 'nextAscent' ? (
        <Stamp next={state.kind === 'nextAscent'} />
      ) : state.kind === 'affordable' ? (
        <PixelButton ref={buttonRef} label={buyLabel(card, price)} onPress={onBuy}>
          <View style={styles.buy}>
            <Text style={styles.buyText}>Débloquer ·</Text>
            <Price price={price} color={roles.ink} />
          </View>
        </PixelButton>
      ) : (
        <>
          <PixelButton
            label={missingLabel(card, price, state.missing)}
            onPress={() => undefined}
            disabled
          >
            <Price price={price} color={roles.muted} suffix="Éclats" />
          </PixelButton>
          <Text style={styles.missing}>{missingText(state.missing)}</Text>
        </>
      )}
    </PixelFrame>
  );
}

/**
 * La carte de l'arbre de pouvoirs d'un héros (#235, C1) : son portrait, ses 5 pouvoirs en
 * miniature (à lui en couleur, les autres éteints) et le compte des débloqués.
 */
function PowerTreeCard({
  hero,
  view,
  onOpen,
}: {
  readonly hero: HeroKind;
  readonly view: CampView;
  readonly onOpen: () => void;
}) {
  const { base, paths } = POWER_TREES[hero];
  const codes: readonly PowerTreeCode[] = [base, ...paths.flatMap(({ ranks }) => ranks)];
  const tree = view.trees[hero];
  const owned = (code: PowerTreeCode) => {
    const kind = tree.nodes.find((node) => node.code === code)?.state.kind;
    return kind === 'base' || kind === 'unlocked' || kind === 'nextAscent';
  };
  const portrait = PORTRAITS[hero];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={powerTreeCardLabel(hero, tree.unlocked)}
      onPress={onOpen}
      testID={`camp-tree-${hero}`}
    >
      <PixelFrame style={styles.treeCard}>
        {portrait === null ? null : <AssetRows image={portrait} scale={2} />}
        <View style={styles.cardText}>
          <Text style={styles.cardName}>{HERO_NAMES[hero]}</Text>
          <View style={styles.minis}>
            {codes.map((code) => (
              <PowerIcon key={code} power={code} scale={1} off={!owned(code)} />
            ))}
          </View>
          <Text style={styles.treeCount}>
            <Text style={styles.calcNumber}>{tree.unlocked}</Text> sur 5 débloqués
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </PixelFrame>
    </Pressable>
  );
}

/**
 * La feuille de confirmation (C5, C8) : l'objet en grand, son prix, ce qu'il restera, et quand il
 * entre dans la tour. Le titre reçoit le focus à l'ouverture. En cas d'échec, elle reste ouverte et
 * propose « Réessayer ».
 */
function ConfirmSheet({
  entry,
  view,
  error,
  onConfirm,
  onCancel,
}: {
  readonly entry: CampOfferEntry;
  readonly view: CampView;
  readonly error: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const { height } = useWindowDimensions();
  const title = useRef<Text>(null);
  const card = unlockCard(entry.unlock);

  useEffect(() => {
    if (title.current !== null) AccessibilityInfo.sendAccessibilityEvent(title.current, 'focus');
  }, []);

  return (
    <Modal
      transparent
      visible
      animationType={reducedMotion ? 'none' : 'slide'}
      onRequestClose={onCancel}
      testID="camp-sheet"
    >
      <View style={styles.sheetContainer}>
        <Pressable accessible={false} onPress={onCancel} style={styles.scrim} />
        <PixelSheet accessibilityViewIsModal style={[styles.sheet, { maxHeight: height * 0.9 }]}>
          <Text ref={title} accessibilityRole="header" style={styles.sheetTitle}>
            {sheetTitle(entry.unlock)}
          </Text>
          <View accessible style={styles.sheetRow}>
            <IconWell icon={UNLOCK_ICONS[entry.unlock]} rarity={card.rarity} size="large" />
            <View style={styles.cardText}>
              <Text style={styles.cardName}>{card.name}</Text>
              <Text style={[styles.cardTag, { color: RARITY_COLORS[card.rarity] }]}>
                {card.tag}
              </Text>
              <Text style={styles.cardEffect}>{card.effect}</Text>
              {card.note !== null && <Text style={styles.cardNote}>{card.note}</Text>}
            </View>
          </View>
          <View style={[styles.priceGrid, { borderWidth: LINE }]}>
            <Text style={styles.priceLabel}>Prix</Text>
            <Price price={entry.price} color={roles.shard} />
            <Text style={styles.priceLabel}>Il te restera</Text>
            <Text style={styles.priceLeft}>{shardText(view.availableShards - entry.price)}</Text>
          </View>
          <Text style={styles.sheetLine}>{sheetLine(view.ascentInProgress)}</Text>
          {error && <Band tone="error" text={SHEET_ERROR} role="alert" />}
          {/* Un camp en lecture seule n'enregistrera jamais l'achat : pas de « Réessayer ». */}
          {!(error && view.readOnly) && (
            <PixelButton label={error ? RETRY : confirmText(entry.price)} onPress={onConfirm} />
          )}
          <PixelButton label="Annuler" variant="secondary" onPress={onCancel} />
        </PixelSheet>
      </View>
    </Modal>
  );
}

/**
 * Le camp (`Camp`, #40, maquette 40, C3 à C10) : le Gardien de la flamme et le feu, sa phrase, les
 * Éclats disponibles, puis les cartes du catalogue. Toucher « Débloquer · N » ouvre la feuille de
 * confirmation ; l'achat enregistré fait descendre le solde (« −N » envolé), passer la carte au vert
 * et changer la phrase du Gardien, avec un message de 4 s et une annonce polie. ‹ appelle `onLeave`.
 */
export function CampScreen({
  camp,
  onLeave,
  onOpenTree = () => undefined,
}: {
  readonly camp: CampSession;
  readonly onLeave: () => void;
  /** Ouvre l'arbre de pouvoirs d'un héros (#235). */
  readonly onOpenTree?: (hero: HeroKind) => void;
}) {
  const view = useCamp(camp);
  const [sheet, setSheet] = useState<Unlock | null>(null);
  const [error, setError] = useState(false);
  const [fresh, setFresh] = useState<Fresh | null>(null);
  const [bought, setBought] = useState(false);
  const buttons = useRef(new Map<Unlock, View | null>());
  const labels = useRef(new Map<Unlock, View | null>());
  const loading = view.status === 'loading';
  const allUnlocked = view.offer.every(
    ({ state }) => state.kind !== 'affordable' && state.kind !== 'missing',
  );
  const firstVisit =
    view.shardTotal === 0 && view.offer.every(({ state }) => state.kind === 'missing');
  const entry = view.offer.find(({ unlock }) => unlock === sheet);
  const hideToast = useCallback(() => setFresh(null), []);

  const focus = (target: View | null | undefined) => {
    if (target !== null && target !== undefined) {
      AccessibilityInfo.sendAccessibilityEvent(target, 'focus');
    }
  };
  const open = (unlock: Unlock) => {
    setError(false);
    setSheet(unlock);
  };
  const cancel = () => {
    const unlock = sheet;
    setSheet(null);
    setError(false);
    if (unlock !== null) focus(buttons.current.get(unlock));
  };
  const confirm = async () => {
    if (entry === undefined) return;
    const result = await camp.unlock(entry.unlock);
    if (result === 'failed') {
      setError(true);
      return;
    }
    if (result === 'refused') return;
    const after = camp.view();
    const next = after.offer.some(
      ({ unlock, state }) => unlock === entry.unlock && state.kind === 'nextAscent',
    );
    setSheet(null);
    setError(false);
    setBought(true);
    setFresh({
      id: (fresh?.id ?? 0) + 1,
      unlock: entry.unlock,
      price: entry.price,
      message: unlockedToast(entry.unlock, next),
      announcement: unlockedAnnouncement(entry.unlock, after.availableShards, next),
    });
    focus(labels.current.get(entry.unlock));
  };

  return (
    <Screen layout="top" background={roles.night} testID="camp">
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={CAMP_BACK_LABEL}
          onPress={onLeave}
          style={styles.back}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>
          {CAMP_TITLE}
        </Text>
        {loading ? (
          <PixelSkeleton width={72} height={40} testID="camp-skeleton" />
        ) : (
          <View
            accessible
            accessibilityLabel={availableShardsText(view.availableShards)}
            style={[styles.balance, { borderWidth: LINE }, fresh !== null && styles.balancePulse]}
          >
            <PixelIcon name="shard8" color={roles.shard} secondColor={roles.light} />
            <Text style={styles.balanceText}>{view.availableShards}</Text>
          </View>
        )}
      </View>
      <ScrollView
        testID="camp-scroll"
        accessibilityState={{ busy: loading }}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.scene}>
          <AssetRows image={CAMP_FIRE_IMAGE} scale={3} style={styles.fire} testID="camp-fire" />
          <AssetRows
            image={FLAME_KEEPER_IMAGE}
            scale={3}
            style={styles.keeper}
            testID="camp-flame-keeper"
          />
        </View>
        <PixelFrame style={styles.say}>
          <Text style={styles.who}>{FLAME_KEEPER_NAME}</Text>
          <Text style={styles.quote}>
            {loading
              ? keeperLine({
                  firstVisit: false,
                  allUnlocked: false,
                  ascentInProgress: false,
                  bought: false,
                })
              : keeperLine({
                  firstVisit,
                  allUnlocked,
                  ascentInProgress: view.ascentInProgress,
                  bought,
                })}
          </Text>
          <Text style={styles.rule}>{keeperRule(!loading && firstVisit)}</Text>
        </PixelFrame>
        {view.place !== null && <Band tone="info" text={runBand(view.place)} />}
        {loading ? (
          <PixelSkeleton width="100%" height={84} testID="camp-skeleton" />
        ) : (
          <PixelFrame
            testID="camp-purse"
            accessible
            accessibilityLabel={purseLabel(view.availableShards, view.shardTotal)}
            style={styles.purse}
          >
            <Text style={styles.purseLabel}>Éclats disponibles</Text>
            <View style={styles.purseRow}>
              <View style={styles.big}>
                <PixelIcon name="shard12" color={roles.shard} secondColor={roles.light} />
                <Text style={styles.bigText}>{view.availableShards}</Text>
                {fresh !== null && <MinusFloat key={fresh.id} amount={fresh.price} />}
              </View>
              <Text style={styles.calc}>
                <Text style={styles.calcNumber}>{view.shardTotal}</Text>
                {' gagnés\n'}
                <Text style={styles.calcNumber}>{view.shardTotal - view.availableShards}</Text>
                {' dépensés'}
              </Text>
            </View>
          </PixelFrame>
        )}
        {!loading && (
          <>
            <View style={styles.heading}>
              <Text style={styles.headingText}>Arbres de pouvoirs</Text>
              {!view.powerTreesSeen && <Text style={styles.newTag}>nouveau</Text>}
            </View>
            {(['sentinel', 'wanderer'] as const).map((hero) => (
              <PowerTreeCard key={hero} hero={hero} view={view} onOpen={() => onOpenTree(hero)} />
            ))}
          </>
        )}
        {!loading && allUnlocked && <Band tone="done" text={ALL_UNLOCKED_BAND} />}
        <View style={styles.heading}>
          <Text style={styles.headingText}>{UNLOCKS_HEADING}</Text>
          {!loading && <Text style={styles.headingCount}>{view.offer.length}</Text>}
        </View>
        {loading
          ? [0, 1, 2].map((index) => (
              <PixelSkeleton key={index} width="100%" height={150} testID="camp-skeleton" />
            ))
          : view.offer.map((item) => (
              <UnlockCardView
                key={item.unlock}
                entry={item}
                fresh={fresh?.unlock === item.unlock}
                onBuy={() => open(item.unlock)}
                buttonRef={(element) => buttons.current.set(item.unlock, element)}
                labelRef={(element) => labels.current.set(item.unlock, element)}
              />
            ))}
      </ScrollView>
      {fresh !== null && (
        <Toast
          key={fresh.id}
          message={fresh.message}
          announcement={fresh.announcement}
          variant="done"
          onHide={hideToast}
        />
      )}
      {entry !== undefined && (
        <ConfirmSheet
          entry={entry}
          view={view}
          error={error}
          onConfirm={() => void confirm()}
          onCancel={cancel}
        />
      )}
    </Screen>
  );
}

// Stryker disable all: valeurs purement visuelles, vérifiées par la conformité aux maquettes (barrière 10 bis).
const BANDS = {
  info: { line: roles.blue, background: roles.raised, dot: roles.blue, text: roles.light },
  done: { line: roles.doneLine, background: roles.doneBg, dot: roles.done, text: roles.light },
  error: { line: roles.curse, background: roles.errorBg, dot: roles.error, text: roles.pink },
} as const;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 56,
    paddingLeft: 8,
    paddingRight: 12,
  },
  back: {
    minWidth: MIN_TARGET_SIZE,
    minHeight: MIN_TARGET_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { fontFamily: pixelFont, fontSize: 28, lineHeight: 32, color: roles.light },
  title: { flex: 1, fontFamily: pixelFont, fontSize: 26, lineHeight: 30, color: roles.light },
  balance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 10,
    backgroundColor: roles.sunken,
    borderColor: roles.line,
  },
  balancePulse: { borderColor: roles.shard },
  balanceText: { fontFamily: pixelFont, fontSize: 22, lineHeight: 26, color: roles.shard },
  scroll: { paddingHorizontal: 16, paddingBottom: 96, gap: 12 },
  scene: {
    height: 150,
    marginHorizontal: -16,
    overflow: 'hidden',
    backgroundColor: roles.night,
    borderBottomWidth: 24,
    borderBottomColor: roles.goldBg,
  },
  fire: { position: 'absolute', left: 78, bottom: 10 },
  keeper: { position: 'absolute', left: 186, bottom: 6 },
  say: { gap: 2, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12 },
  who: { fontFamily: textFont.bold, fontSize: 13, lineHeight: 18, color: roles.gold },
  quote: { fontFamily: textFont.medium, fontSize: 15, lineHeight: 21, color: roles.light },
  rule: {
    marginTop: 6,
    fontFamily: textFont.medium,
    fontSize: 13,
    lineHeight: 18,
    color: roles.parchment,
  },
  band: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 10 },
  bandDot: { width: 10, height: 10, marginTop: 4, transform: [{ rotate: '45deg' }] },
  bandText: { flex: 1, fontFamily: textFont.medium, fontSize: 13, lineHeight: 18 },
  purse: { gap: 4, paddingHorizontal: 14, paddingVertical: 12 },
  purseLabel: {
    fontFamily: textFont.bold,
    fontSize: 12,
    lineHeight: 16,
    color: roles.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  purseRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  big: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bigText: { fontFamily: pixelFont, fontSize: 36, lineHeight: 40, color: roles.shard },
  calc: {
    fontFamily: textFont.medium,
    fontSize: 13,
    lineHeight: 18,
    color: roles.parchment,
    textAlign: 'right',
  },
  calcNumber: { fontFamily: textFont.semiBold, color: roles.light },
  heading: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  headingText: {
    fontFamily: textFont.bold,
    fontSize: 12,
    lineHeight: 16,
    color: roles.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  headingCount: { fontFamily: textFont.semiBold, fontSize: 12, lineHeight: 16, color: roles.muted },
  card: { gap: 10, padding: 12 },
  treeCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, minHeight: 72 },
  minis: { flexDirection: 'row', gap: 4 },
  treeCount: { fontFamily: textFont.medium, fontSize: 13, lineHeight: 18, color: roles.parchment },
  chevron: { fontFamily: pixelFont, fontSize: 26, lineHeight: 30, color: roles.muted },
  newTag: {
    fontFamily: textFont.bold,
    fontSize: 11,
    lineHeight: 16,
    color: roles.ink,
    backgroundColor: roles.gold,
    paddingHorizontal: 6,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  dim: { opacity: 0.55 },
  freshRing: {
    position: 'absolute',
    top: -2 * LINE,
    left: -2 * LINE,
    right: -2 * LINE,
    bottom: -2 * LINE,
    borderWidth: LINE,
    borderColor: roles.gold,
  },
  cardText: { flex: 1, gap: 2 },
  cardName: { fontFamily: pixelFont, fontSize: 19, lineHeight: 22, color: roles.light },
  cardTag: { fontFamily: textFont.bold, fontSize: 12, lineHeight: 16 },
  cardEffect: { fontFamily: textFont.medium, fontSize: 14, lineHeight: 20, color: roles.light },
  cardNote: { fontFamily: textFont.medium, fontSize: 13, lineHeight: 18, color: roles.parchment },
  buy: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  buyText: { fontFamily: textFont.bold, fontSize: 15, lineHeight: 19, color: roles.ink },
  price: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  priceText: { fontFamily: pixelFont, fontSize: 18, lineHeight: 22 },
  missing: {
    marginTop: -2,
    textAlign: 'center',
    fontFamily: textFont.semiBold,
    fontSize: 13,
    lineHeight: 18,
    color: roles.parchment,
  },
  stamp: {
    minHeight: MIN_TARGET_SIZE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  stampNext: { backgroundColor: roles.raised, borderColor: roles.blue },
  stampText: { fontFamily: textFont.bold, fontSize: 15, lineHeight: 19 },
  sheetContainer: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: roles.scrim },
  sheet: { paddingTop: 12, paddingHorizontal: 16, paddingBottom: 30, gap: 12 },
  sheetTitle: { fontFamily: pixelFont, fontSize: 24, lineHeight: 28, color: roles.light },
  sheetRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
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
  priceLeft: {
    width: '40%',
    textAlign: 'right',
    fontFamily: pixelFont,
    fontSize: 18,
    lineHeight: 22,
    color: roles.light,
  },
  sheetLine: { fontFamily: textFont.medium, fontSize: 15, lineHeight: 22, color: roles.parchment },
});
// Stryker restore all
