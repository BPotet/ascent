import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import type {
  DiscoveryBookSession,
  DiscoveryBookView,
} from '../../../application/useCases/DiscoveryBookSession';
import type { Tier } from '../../../domain/ascent/tiers';
import type { EnemyKind } from '../../../domain/battle/combatants';
import {
  openingTier,
  type BestiaryEntry,
  type BestiarySection,
  type BestiaryTier,
} from '../../../domain/discoveryBook/bestiary';
import { TIER_NAMES } from '../format/ascentText';
import { ENEMY_NAMES } from '../format/battleText';
import {
  BOOK_BACK_LABEL,
  BOOK_ERROR_ALERT,
  BOOK_ERROR_TEXT,
  BOOK_ERROR_TITLE,
  BOOK_LOADING,
  BOOK_RETRY,
  BOOK_TITLE,
  FIRST_USE_BAND,
  NEW_TAG,
  SECTION_TITLES,
  UNKNOWN_NAME,
  bookSubtitle,
  entryLabel,
  entryStatus,
  tierChipLabel,
  tierSummary,
  tierSummaryLabel,
} from '../format/bookText';
import { Screen } from '../components/Screen';
import { AssetRows } from '../pixelArt/AssetRows';
import { artPalette } from '../pixelArt/artPalette';
import { artPixelSize } from '../pixelArt/artPixel';
import { MIN_TARGET_SIZE, PixelButton } from '../pixelArt/PixelButton';
import { PixelFrame } from '../pixelArt/PixelFrame';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { PixelSkeleton } from '../pixelArt/PixelSkeleton';
import { pixelFont, textFont } from '../pixelArt/pixelTypography';
import { PORTRAITS } from '../pixelArt/sprites/atelier/data/portraits';
import { bestiarySilhouette } from '../pixelArt/sprites/silhouettes';
import { useDiscoveryBook } from '../state/useDiscoveryBook';
import { useLargeText } from '../state/useLargeText';

const { roles } = artPalette;
const LINE = artPixelSize(2);
/** Le violet de la porte Élite et le rose de la phase ennemie (maquette 278, `--elite`, `--boss`). */
const ELITE = roles.rarityEpic;
const BOSS = roles.curse;
const TIERS: readonly Tier[] = [1, 2, 3];
/** Les hachures d'une case « ??? » : le trait de la maquette à 28 %. */
const HATCH = 'rgba(62,72,112,0.28)';
/** La marge de l'écran et l'écart entre deux cases (maquette, 16 et 8 dp). */
const GUTTER = 16;
const GAP = 8;

/** La largeur d'une case pour `columns` colonnes, dans la largeur utile de l'écran (328 dp à 360). */
function useTileWidth(columns: number): number {
  const { width } = useWindowDimensions();
  return Math.floor((width - 2 * GUTTER - GAP * (columns - 1)) / columns);
}

/**
 * Des hachures à 45° (maquette 278, `repeating-linear-gradient(135deg, …)`) : celles d'une case
 * « ??? » et de la part rencontrée de la barre d'un palier. Décoratives.
 */
function Hatching({
  color,
  count,
  step,
}: {
  readonly color: string;
  readonly count: number;
  readonly step: number;
}) {
  return (
    <View pointerEvents="none" style={styles.hatching}>
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={[styles.hatch, { left: index * step, backgroundColor: color }]} />
      ))}
    </View>
  );
}

/** L'en-tête : retour, « Le carnet » et, une fois lu, le total des découvertes. */
function Header({
  subtitle,
  onLeave,
}: {
  readonly subtitle: string | null;
  readonly onLeave: () => void;
}) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={BOOK_BACK_LABEL}
        onPress={onLeave}
        style={styles.back}
      >
        <Text style={styles.backText}>‹</Text>
      </Pressable>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>
          {BOOK_TITLE}
        </Text>
        {subtitle !== null && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
    </View>
  );
}

/** Une puce de palier (« Palier 1 · 9/12 »), un onglet ; or quand le palier est complet. */
function TierChip({
  tier,
  selected,
  onPress,
}: {
  readonly tier: BestiaryTier;
  readonly selected: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={tierChipLabel(tier)}
      accessibilityState={{ selected }}
      onPress={onPress}
      testID={`book-tier-chip-${tier.tier}`}
      style={[
        styles.chip,
        { borderWidth: LINE },
        selected && styles.chipSelected,
        tier.complete && styles.chipComplete,
      ]}
    >
      {tier.isNew && <View testID={`book-chip-new-${tier.tier}`} style={styles.diamond} />}
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
        {`Palier ${tier.tier}`}
      </Text>
      <Text style={[styles.chipCount, tier.complete && styles.gold]}>
        {`${tier.filled}/${tier.total}`}
      </Text>
    </Pressable>
  );
}

/** Le cadre d'un palier : son nom, ses pages remplies, la barre (hachurée pour les rencontrés). */
function TierFrame({ tier }: { readonly tier: BestiaryTier }) {
  const filled = (100 * tier.filled) / tier.total;
  const met = (100 * tier.encountered) / tier.total;
  return (
    <PixelFrame
      accessible
      accessibilityLabel={tierSummaryLabel(tier)}
      testID="book-tier-frame"
      style={[styles.frame, tier.complete && { borderColor: roles.gold }]}
    >
      <View style={styles.frameRow}>
        <Text style={styles.frameName}>{TIER_NAMES[tier.tier]}</Text>
        <Text style={styles.frameCount}>
          {`${tier.filled}/${tier.total} `}
          <Text style={styles.frameUnit}>{tier.filled > 1 ? 'pages' : 'page'}</Text>
        </Text>
      </View>
      <View style={styles.bar}>
        <View style={[styles.barFilled, { width: `${filled}%` }]} />
        <View style={[styles.barMet, { left: `${filled}%`, width: `${met}%` }]}>
          <Hatching color={roles.muted} count={60} step={4} />
        </View>
      </View>
      <View style={styles.summary}>
        {tier.complete && <PixelIcon name="check8" color={roles.gold} />}
        <Text style={styles.summaryText}>{tierSummary(tier)}</Text>
      </View>
    </PixelFrame>
  );
}

/** Le portrait en couleurs, la silhouette du carnet ou « ? », dans le puits de la case. */
function Picture({ entry }: { readonly entry: BestiaryEntry }) {
  const boss = entry.category === 'boss';
  const image =
    entry.state === 'defeated'
      ? PORTRAITS[entry.kind]
      : entry.state === 'encountered'
        ? bestiarySilhouette(entry.kind)
        : null;
  return (
    <View
      style={[
        styles.well,
        boss && styles.wellBoss,
        { borderWidth: LINE },
        entry.category === 'elite' && { borderColor: ELITE },
        boss && { borderColor: BOSS },
        entry.state === 'unknown' && styles.wellUnknown,
      ]}
    >
      {image === null ? (
        <PixelIcon name="qm12" color={roles.line} />
      ) : (
        <AssetRows
          image={image}
          scale={3}
          testID={`book-${entry.state === 'defeated' ? 'portrait' : 'silhouette'}-${entry.kind}`}
        />
      )}
    </View>
  );
}

/**
 * Une case du Bestiaire (B1 à B3) : vaincu (portrait en couleurs, « Vaincu », coche), rencontré
 * (silhouette, nom, « Rencontré », œil), inconnu (« ??? », hachures). Couronne d'une Élite, crâne
 * d'un boss, « nouveau » et cadre d'or. Aucun état n'est dit par la couleur seule. Sans `onOpen`
 * (#283 la fournira), la case n'est pas un bouton.
 */
function Tile({
  entry,
  width,
  onOpen,
}: {
  readonly entry: BestiaryEntry;
  readonly width: number;
  readonly onOpen?: (kind: EnemyKind) => void;
}) {
  const unknown = entry.state === 'unknown';
  const content = (
    <>
      {entry.category !== 'enemy' && (
        <View
          style={[styles.badge, entry.category === 'elite' ? styles.badgeElite : styles.badgeBoss]}
        >
          <PixelIcon
            name={entry.category === 'elite' ? 'crown8' : 'skull'}
            color={entry.category === 'elite' ? ELITE : BOSS}
          />
        </View>
      )}
      {entry.isNew && (
        <Text testID={`book-entry-new-${entry.kind}`} style={styles.newTag}>
          {NEW_TAG}
        </Text>
      )}
      <Picture entry={entry} />
      <Text
        numberOfLines={2}
        style={[
          styles.name,
          unknown && styles.nameUnknown,
          entry.state === 'encountered' && styles.nameMet,
        ]}
      >
        {unknown ? UNKNOWN_NAME : ENEMY_NAMES[entry.kind]}
      </Text>
      <View style={styles.status}>
        {entry.state === 'defeated' && <PixelIcon name="check8" color={roles.done} />}
        {entry.state === 'encountered' && <PixelIcon name="eye8" color={roles.parchment} />}
        <Text
          style={[
            styles.statusText,
            entry.state === 'defeated' && { color: roles.done },
            entry.state === 'encountered' && { color: roles.parchment },
          ]}
        >
          {entryStatus(entry)}
        </Text>
      </View>
    </>
  );
  const style = [
    styles.tile,
    entry.category === 'boss' && styles.tileBoss,
    { width, borderWidth: LINE },
    unknown && styles.tileUnknown,
    entry.isNew && { borderColor: roles.gold },
  ];
  if (onOpen !== undefined && !unknown) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={entryLabel(entry)}
        onPress={() => onOpen(entry.kind)}
        testID={`book-entry-${entry.kind}`}
        style={style}
      >
        {content}
      </Pressable>
    );
  }
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={entryLabel(entry)}
      testID={`book-entry-${entry.kind}`}
      style={style}
    >
      {unknown && <Hatching color={HATCH} count={40} step={6} />}
      {content}
    </View>
  );
}

const SECTION_ICONS = { enemy: 'swords8', elite: 'crown8', boss: 'skull' } as const;

/** Une section d'un palier (Ennemis, Élites, Boss) : son titre, son compte, sa grille nommée. */
function Section({
  section,
  columns,
  onOpen,
}: {
  readonly section: BestiarySection;
  readonly columns: number;
  readonly onOpen?: (kind: EnemyKind) => void;
}) {
  const color =
    section.category === 'elite' ? ELITE : section.category === 'boss' ? BOSS : roles.muted;
  const title = SECTION_TITLES[section.category];
  const width = useTileWidth(section.category === 'boss' ? 2 : columns);
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <PixelIcon name={SECTION_ICONS[section.category]} color={color} />
        <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
        <Text testID={`book-section-count-${section.category}`} style={styles.sectionCount}>
          {`${section.filled}/${section.total}`}
        </Text>
      </View>
      <View
        accessibilityRole="list"
        accessibilityLabel={title}
        testID={`book-section-${section.category}`}
        style={styles.grid}
      >
        {section.entries.map((entry) => (
          <Tile
            key={entry.kind}
            entry={entry}
            width={width}
            {...(onOpen !== undefined && { onOpen })}
          />
        ))}
      </View>
    </View>
  );
}

/** Le chargement du carnet (B7) : des blocs gris à la place des puces, du cadre et des cases. */
function Loading() {
  return (
    <View style={styles.body}>
      <View style={styles.chips}>
        {TIERS.map((tier) => (
          <View key={tier} style={styles.fill}>
            <PixelSkeleton width="100%" height={52} testID="book-loading" />
          </View>
        ))}
      </View>
      <PixelSkeleton width="100%" height={78} testID="book-loading" />
      <View style={styles.grid}>
        {Array.from({ length: 6 }, (_, index) => (
          <PixelSkeleton key={index} width="31%" height={142} testID="book-loading" />
        ))}
      </View>
      <Text accessibilityLiveRegion="polite" role="status" style={styles.srOnly}>
        {BOOK_LOADING}
      </Text>
    </View>
  );
}

/** La lecture ratée (B8) : le texte rassure et propose de réessayer. */
function Failure({
  onRetry,
  onLeave,
}: {
  readonly onRetry: () => void;
  readonly onLeave: () => void;
}) {
  return (
    <View testID="book-error" style={styles.failure}>
      <View style={styles.failureIcon}>
        <PixelIcon name="book12" color={roles.muted} />
      </View>
      <Text style={styles.failureTitle}>{BOOK_ERROR_TITLE}</Text>
      <Text style={styles.failureText}>{BOOK_ERROR_TEXT}</Text>
      <PixelButton label={BOOK_RETRY} onPress={onRetry} />
      <PixelButton label={BOOK_BACK_LABEL} variant="secondary" onPress={onLeave} />
      <Text accessibilityLiveRegion="assertive" role="alert" style={styles.srOnly}>
        {BOOK_ERROR_ALERT}
      </Text>
    </View>
  );
}

/**
 * Le carnet de découvertes (`DiscoveryBookScreen`, #282, maquette 278, B1 à B9) : un écran poussé,
 * « Le carnet » et le total des découvertes, puis le Bestiaire, un palier à la fois (celui de
 * l'ascension en cours `currentTier`, sinon du dernier combat, sinon le palier 1) : ses puces en
 * onglets, son cadre, et ses sections Ennemis, Élites et Boss. L'en-tête garde la place des
 * onglets du carnet ; #284 y ajoutera « Objets ».
 *
 * La sortie du carnet (retour, geste retour, perte du focus, démontage) efface les marques
 * « nouveau » (B16). `onOpenEntry` (#283) fera d'une case vaincue ou rencontrée un bouton.
 */
export function DiscoveryBookScreen({
  book,
  currentTier,
  onLeave,
  focused = true,
  onOpenEntry,
}: {
  readonly book: DiscoveryBookSession;
  readonly currentTier: Tier | null;
  readonly onLeave: () => void;
  /** L'écran est affiché ; il reste monté quand on le quitte par un geste ou un onglet. */
  readonly focused?: boolean;
  readonly onOpenEntry?: (kind: EnemyKind) => void;
}) {
  const view = useDiscoveryBook(book);
  const large = useLargeText();
  const [chosen, setChosen] = useState<Tier | null>(null);

  useEffect(() => {
    if (!focused) void book.leave();
  }, [focused, book]);
  useEffect(() => () => void book.leave(), [book]);

  return (
    <Screen layout="top" background={roles.night} testID="discovery-book">
      <Header
        subtitle={
          view.status === 'ready' ? bookSubtitle(view.bestiary.filled, view.bestiary.total) : null
        }
        onLeave={onLeave}
      />
      {view.status === 'loading' && <Loading />}
      {view.status === 'failed' && <Failure onRetry={() => void book.load()} onLeave={onLeave} />}
      {view.status === 'ready' && (
        <Bestiary
          view={view}
          tier={chosen ?? openingTier(currentTier, view.lastTier)}
          onTier={setChosen}
          columns={large ? 2 : 3}
          {...(onOpenEntry !== undefined && { onOpen: onOpenEntry })}
        />
      )}
    </Screen>
  );
}

function Bestiary({
  view,
  tier,
  onTier,
  columns,
  onOpen,
}: {
  readonly view: Extract<DiscoveryBookView, { status: 'ready' }>;
  readonly tier: Tier;
  readonly onTier: (tier: Tier) => void;
  readonly columns: number;
  readonly onOpen?: (kind: EnemyKind) => void;
}) {
  const shown = view.bestiary.tiers.find((each) => each.tier === tier)!;
  return (
    <>
      <View
        accessibilityRole="tablist"
        accessibilityLabel="Paliers"
        testID="book-tier-chips"
        style={styles.chips}
      >
        {view.bestiary.tiers.map((each) => (
          <TierChip
            key={each.tier}
            tier={each}
            selected={each.tier === tier}
            onPress={() => onTier(each.tier)}
          />
        ))}
      </View>
      <ScrollView testID="book-scroll" contentContainerStyle={styles.body}>
        {view.bestiary.firstUse && (
          <View
            accessible
            role="note"
            testID="book-first-use"
            style={[styles.band, { borderWidth: LINE }]}
          >
            <View style={styles.bandDot} />
            <Text style={styles.bandText}>{FIRST_USE_BAND}</Text>
          </View>
        )}
        <TierFrame tier={shown} />
        {shown.sections.map((section) => (
          <Section
            key={section.category}
            section={section}
            columns={columns}
            {...(onOpen !== undefined && { onOpen })}
          />
        ))}
      </ScrollView>
    </>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 56,
    paddingLeft: 4,
    paddingRight: GUTTER,
  },
  back: {
    minWidth: MIN_TARGET_SIZE,
    minHeight: MIN_TARGET_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { fontFamily: pixelFont, fontSize: 28, lineHeight: 32, color: roles.light },
  heading: { flex: 1 },
  title: { fontFamily: pixelFont, fontSize: 24, lineHeight: 28, color: roles.light },
  subtitle: { fontFamily: textFont.medium, fontSize: 13, lineHeight: 17, color: roles.parchment },
  chips: { flexDirection: 'row', gap: 6, paddingHorizontal: GUTTER, paddingTop: 8 },
  fill: { flex: 1 },
  chip: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    backgroundColor: roles.sunken,
    borderColor: roles.line,
  },
  chipSelected: { backgroundColor: roles.raised, borderColor: roles.gold },
  chipComplete: { borderColor: roles.gold },
  chipLabel: {
    fontFamily: textFont.semiBold,
    fontSize: 12,
    lineHeight: 15,
    color: roles.parchment,
  },
  chipLabelSelected: { color: roles.gold },
  chipCount: {
    fontFamily: pixelFont,
    fontSize: 16,
    lineHeight: 18,
    color: roles.light,
    fontVariant: ['tabular-nums'],
  },
  gold: { color: roles.gold },
  diamond: {
    position: 'absolute',
    top: 7,
    right: 8,
    width: 8,
    height: 8,
    backgroundColor: roles.gold,
    transform: [{ rotate: '45deg' }],
  },
  body: { gap: 10, paddingHorizontal: GUTTER, paddingTop: 10, paddingBottom: 24 },
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
  frameName: {
    flexShrink: 1,
    fontFamily: pixelFont,
    fontSize: 19,
    lineHeight: 22,
    color: roles.light,
  },
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
  barMet: { position: 'absolute', top: 0, bottom: 0, overflow: 'hidden' },
  hatching: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  hatch: {
    position: 'absolute',
    top: -40,
    bottom: -40,
    width: 2,
    transform: [{ rotate: '45deg' }],
  },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryText: {
    flex: 1,
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
  },
  sectionCount: {
    marginLeft: 'auto',
    fontFamily: pixelFont,
    fontSize: 13,
    lineHeight: 16,
    color: roles.parchment,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tile: {
    minHeight: 142,
    alignItems: 'center',
    gap: 5,
    paddingVertical: 9,
    paddingHorizontal: 4,
    backgroundColor: roles.surface,
    borderColor: roles.line,
  },
  tileBoss: { minHeight: 160 },
  tileUnknown: { backgroundColor: roles.sunken, borderColor: roles.raised, overflow: 'hidden' },
  well: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: roles.well,
    borderColor: roles.line,
  },
  wellBoss: { width: 96, height: 96 },
  wellUnknown: { backgroundColor: roles.sunken, borderColor: roles.raised },
  badge: {
    position: 'absolute',
    left: 6,
    top: 6,
    zIndex: 1,
    padding: 1,
    borderWidth: 1,
  },
  badgeElite: { backgroundColor: '#241C36', borderColor: ELITE },
  badgeBoss: { backgroundColor: '#2E1520', borderColor: BOSS },
  newTag: {
    position: 'absolute',
    right: 5,
    top: 5,
    zIndex: 2,
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
  name: {
    minHeight: 31,
    paddingHorizontal: 2,
    textAlign: 'center',
    fontFamily: textFont.semiBold,
    fontSize: 12.5,
    lineHeight: 15.5,
    color: roles.light,
  },
  nameMet: { color: roles.parchment },
  nameUnknown: {
    fontFamily: pixelFont,
    fontSize: 15,
    lineHeight: 31,
    letterSpacing: 1.8,
    color: roles.muted,
  },
  status: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusText: { fontFamily: textFont.bold, fontSize: 11, lineHeight: 14, color: roles.muted },
  failure: { flex: 1, justifyContent: 'center', gap: 14, paddingHorizontal: GUTTER },
  failureIcon: { alignSelf: 'center', transform: [{ scale: 2 }], marginBottom: 12 },
  failureTitle: {
    textAlign: 'center',
    fontFamily: pixelFont,
    fontSize: 22,
    lineHeight: 26,
    color: roles.light,
  },
  failureText: {
    textAlign: 'center',
    fontFamily: textFont.regular,
    fontSize: 14,
    lineHeight: 20,
    color: roles.parchment,
  },
  srOnly: { position: 'absolute', width: 1, height: 1, overflow: 'hidden' },
});
// Stryker restore all
