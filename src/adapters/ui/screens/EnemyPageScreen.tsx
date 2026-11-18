import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { DiscoveryBookSession } from '../../../application/useCases/DiscoveryBookSession';
import type { EnemyKind } from '../../../domain/battle/combatants';
import type { EnemyPage, PageMechanic } from '../../../domain/discoveryBook/enemyPage';
import { ATTACKS } from '../../../domain/battle/attacks';
import { ENEMY_NAMES } from '../format/battleText';
import { ENEMY_PAGES } from '../format/codex/enemyPages';
import {
  HIDDEN_LORE,
  HIDDEN_PAGE_LABEL,
  LORE_TITLE,
  MECHANICS_TITLE,
  NO_MECHANIC,
  PAGE_BACK_LABEL,
  PAGE_FILLED,
  PHASE_2_PORTRAIT,
  hiddenPageSentence,
  pageCategory,
  pageFilledAnnouncement,
  pageIdentityLabel,
  pageMechanicsText,
  pagePhasesText,
  pageStatus,
  pageSubtitle,
  pageTierLine,
  type MoveChip,
  type MoveText,
  type PhaseText,
} from '../format/enemyPageText';
import { Screen } from '../components/Screen';
import { AssetRows } from '../pixelArt/AssetRows';
import { artPalette } from '../pixelArt/artPalette';
import { artPixelSize, type ArtScale } from '../pixelArt/artPixel';
import { MIN_TARGET_SIZE } from '../pixelArt/PixelButton';
import { PixelFrame } from '../pixelArt/PixelFrame';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { pixelFont, textFont } from '../pixelArt/pixelTypography';
import { PHASE_2_PORTRAITS } from '../pixelArt/sprites/atelier/data/portraits';
import type { AssetImage } from '../pixelArt/sprites/atelier/fullAnimation';
import { battleImage } from '../pixelArt/sprites/battle/battleCharacters';
import { TIER_BACKDROPS } from '../pixelArt/sprites/battle/tierBackdrops';
import { battleSilhouette } from '../pixelArt/sprites/silhouettes';
import { useReducedMotion } from '../state/useReducedMotion';

const { roles } = artPalette;
const LINE = artPixelSize(2);
const GUTTER = 16;
/** Le violet de la porte Élite et le rose de la phase ennemie (maquette 278, `--elite`, `--boss`). */
const ELITE = roles.rarityEpic;
const BOSS = roles.curse;

/** « Page remplie » (F5) : les couleurs remplacent la silhouette de bas en haut, 4 pas de 120 ms. */
export const FILL_STEP_MS = 120;
const FILL_STEPS = 4;

/** La scène de la page (maquette 278, `.stage`) : 186 dp de haut, le fond du palier à ×4. */
const STAGE_HEIGHT = 186;
const BACKDROP_SCALE = 4;
/** Les lignes du fond de palier montrées derrière l'ennemi : le sol et le bas des murs. */
const BACKDROP_ROWS = [85, 132] as const;

/** La bande du fond du palier montrée sur la scène (une image fixe, sans Skia, D8). */
function backdropBand(tier: EnemyPage['tier']): AssetImage {
  const backdrop = TIER_BACKDROPS[tier];
  const rows = backdrop.rows.slice(...BACKDROP_ROWS);
  return { w: backdrop.w, h: rows.length, palette: backdrop.palette, rows };
}

/** Un boss de 62 pixels d'art ne tient pas à ×3 sur la scène : il passe à ×2. */
const figureScale = (image: AssetImage): ArtScale => (image.h * 3 <= STAGE_HEIGHT - 12 ? 3 : 2);

/** La teinte, le fond et l'icône de chaque mécanique (maquette 278, `TR`), ceux du combat. */
const MECHANIC_STYLES: Readonly<
  Record<
    PageMechanic,
    { readonly color: string; readonly background: string; readonly icon: IconKey }
  >
> = {
  selfRevive: { color: '#8FB8C9', background: '#14262E', icon: 'iRaise' },
  support: { color: '#6FD3A0', background: '#15302A', icon: 'iRaise' },
  exhume: { color: '#C9C2B0', background: '#262A36', icon: 'iExhume' },
  summon: { color: '#E0607A', background: '#2E1520', icon: 'skull' },
  thorns: { color: '#FFC4CC', background: '#3A1420', icon: 'thorn8' },
  sanctuary: { color: '#B4C8E0', background: '#1E2A3A', icon: 'ward8' },
  aura: { color: '#FFE680', background: '#2A2610', icon: 'candle8' },
  swarm: { color: '#C3C7D3', background: '#262A36', icon: 'diamond8' },
  emberBurst: { color: '#FFC9A3', background: '#3A2014', icon: 'ember8' },
  momentumTheft: { color: '#F2D49B', background: '#262A36', icon: 'diamond8' },
  charge: { color: '#E8B98A', background: '#2E2114', icon: 'iCharge' },
  sweep: { color: '#5EE6D0', background: '#0F2B2C', icon: 'sweep8' },
  phaseShift: { color: '#E0607A', background: '#2E1520', icon: 'skull' },
};
type IconKey = Parameters<typeof PixelIcon>[0]['name'];

/** Les puces d'un coup (maquette 278, `.mchip`) : Saignement, Brûlure, Charge. */
const CHIP_STYLES: Readonly<
  Record<
    MoveChip['kind'],
    { readonly color: string; readonly background: string; readonly line: string }
  >
> = {
  bleed: { color: '#FFC4CC', background: '#3A1420', line: '#C8344A' },
  burn: { color: '#FFC9A3', background: '#3A2014', line: '#D9733A' },
  charge: { color: '#FFE2C4', background: '#2E2114', line: '#E8B98A' },
};
const PERILOUS_CHIP = { color: '#FFD0D0', background: '#3A1416', line: roles.curse };
const SWEEP_CHIP = { color: '#C8FFF6', background: '#0F2B2C', line: '#5EE6D0' };

/** Le pas courant du remplissage : de 0 à 4 pas de 120 ms, ou 4 aussitôt sans remplissage. */
function useFillStep(filling: boolean): number {
  const [step, setStep] = useState(filling ? 0 : FILL_STEPS);
  useEffect(() => {
    if (!filling) return;
    const timers = Array.from({ length: FILL_STEPS }, (_, index) =>
      setTimeout(() => setStep(index + 1), (index + 1) * FILL_STEP_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [filling]);
  return step;
}

/**
 * L'ennemi sur la scène : sa silhouette (page cachée), son image de combat (page remplie), ou, la
 * première fois, ses couleurs qui remplacent la silhouette de bas en haut ; en mouvement réduit, en
 * fondu, sans glisser, avec les mêmes durées.
 */
function Figure({
  page,
  filling,
  step,
}: {
  readonly page: EnemyPage;
  readonly filling: boolean;
  readonly step: number;
}) {
  const reducedMotion = useReducedMotion();
  const image = battleImage(page.kind);
  const scale = figureScale(image);
  if (page.state === 'encountered') {
    return (
      <AssetRows
        image={battleSilhouette(page.kind)}
        scale={scale}
        testID={`enemy-page-silhouette-${page.kind}`}
      />
    );
  }
  const colors = <AssetRows image={image} scale={scale} testID={`enemy-page-image-${page.kind}`} />;
  if (!filling) return colors;
  const size = artPixelSize(scale);
  const width = image.w * size;
  const height = image.h * size;
  const done = step / FILL_STEPS;
  return (
    <View style={{ width, height }}>
      <AssetRows
        image={battleSilhouette(page.kind)}
        scale={scale}
        testID={`enemy-page-silhouette-${page.kind}`}
      />
      <View
        testID="enemy-page-fill-clip"
        style={[styles.fillClip, { width, height: reducedMotion ? height : height * done }]}
      >
        <View
          testID="enemy-page-fill"
          style={[styles.fill, { width, height, opacity: reducedMotion ? done : 1 }]}
        >
          {colors}
        </View>
      </View>
    </View>
  );
}

/** La scène (maquette 278, `.stage`) : le fond du palier, l'ennemi, sa catégorie et son état. */
function Stage({
  page,
  filling,
  step,
}: {
  readonly page: EnemyPage;
  readonly filling: boolean;
  readonly step: number;
}) {
  const defeated = page.state === 'defeated';
  const categoryColor =
    page.category === 'elite' ? ELITE : page.category === 'boss' ? BOSS : roles.parchment;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.stage, { borderWidth: LINE }]}
    >
      <View style={styles.backdrop}>
        <AssetRows
          image={backdropBand(page.tier)}
          scale={BACKDROP_SCALE}
          testID={`enemy-page-backdrop-${page.tier}`}
        />
      </View>
      <View style={styles.veil} />
      <View style={styles.figure}>
        <View style={styles.socket} />
        <Figure page={page} filling={filling} step={step} />
      </View>
      <View style={[styles.tag, styles.tagLeft, { borderColor: categoryColor, borderWidth: LINE }]}>
        {page.category !== 'enemy' && (
          <PixelIcon name={page.category === 'elite' ? 'crown8' : 'skull'} color={categoryColor} />
        )}
        <Text style={[styles.tagText, { color: categoryColor }]}>{pageCategory(page)}</Text>
      </View>
      <View
        style={[
          styles.tag,
          styles.tagRight,
          { borderWidth: LINE, borderColor: defeated ? roles.done : roles.line },
        ]}
      >
        <PixelIcon
          name={defeated ? 'check8' : 'eye8'}
          color={defeated ? roles.done : roles.parchment}
        />
        <Text style={[styles.tagText, { color: defeated ? roles.done : roles.parchment }]}>
          {pageStatus(page)}
        </Text>
      </View>
      {filling && step === FILL_STEPS && <Text style={styles.filled}>{PAGE_FILLED}</Text>}
    </View>
  );
}

/** Le titre d'une section (maquette 278, `.cxh`), et son compte : décoratif, lu par ses lignes. */
function SectionTitle({
  title,
  count,
  countID,
}: {
  readonly title: string;
  readonly count?: string;
  readonly countID?: string;
}) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {count !== undefined && (
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no"
          testID={countID}
          style={styles.sectionCount}
        >
          {count}
        </Text>
      )}
    </View>
  );
}

/** Un coup (maquette 278 F2) : son nom, son type et ses puces, sa description ; lu d'un trait. */
function MoveRow({ move, index }: { readonly move: MoveText; readonly index: number }) {
  const perilous = ATTACKS[move.attack].perilous;
  const typeChip = perilous ? PERILOUS_CHIP : move.attack === 'sweep' ? SWEEP_CHIP : null;
  return (
    <PixelFrame
      accessible
      accessibilityRole="text"
      accessibilityLabel={move.speech}
      testID={`enemy-page-move-${index}`}
      style={styles.row}
    >
      <View style={styles.moveHead}>
        <Text style={styles.moveName}>{move.name}</Text>
        <View
          style={[
            styles.chip,
            typeChip !== null && {
              backgroundColor: typeChip.background,
              borderColor: typeChip.line,
            },
          ]}
        >
          {perilous && (
            <View testID={`enemy-page-seal-${index}`}>
              <PixelIcon name="diamond8" color={PERILOUS_CHIP.color} />
            </View>
          )}
          <Text style={[styles.chipText, typeChip !== null && { color: typeChip.color }]}>
            {move.type}
          </Text>
        </View>
        {move.chips.map((chip) => {
          const tint = CHIP_STYLES[chip.kind];
          return (
            <View
              key={chip.kind}
              style={[styles.chip, { backgroundColor: tint.background, borderColor: tint.line }]}
            >
              <Text style={[styles.chipText, { color: tint.color }]}>{chip.label}</Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.moveText}>{move.description}</Text>
    </PixelFrame>
  );
}

/** Les coups d'une phase : « Coups », ou une phase d'un boss avec sa description (F3). */
function Phase({
  page,
  phase,
  index,
  offset,
}: {
  readonly page: EnemyPage;
  readonly phase: PhaseText;
  readonly index: number;
  readonly offset: number;
}) {
  const portrait = index > 0 ? PHASE_2_PORTRAITS[page.kind] : undefined;
  return (
    <View style={styles.phase}>
      <SectionTitle
        title={phase.title}
        count={phase.count}
        countID={index === 0 ? 'enemy-page-count-moves' : 'enemy-page-count-phase2'}
      />
      {portrait !== undefined && (
        <View style={[styles.phaseBanner, { borderLeftWidth: 3 }]}>
          <AssetRows image={portrait} scale={1} testID="enemy-page-phase2-portrait" />
          <Text style={styles.phaseBannerText}>{PHASE_2_PORTRAIT}</Text>
        </View>
      )}
      {phase.description !== null && <Text style={styles.phaseText}>{phase.description}</Text>}
      {phase.moves.map((move, at) => (
        <MoveRow key={move.name} move={move} index={offset + at} />
      ))}
    </View>
  );
}

/** Le reste de la page cachée (F4) : « ??? », sa phrase, et des lignes hachurées. */
function HiddenPage({ kind }: { readonly kind: EnemyKind }) {
  return (
    <>
      <SectionTitle title={LORE_TITLE} />
      <Text
        accessible
        accessibilityRole="text"
        accessibilityLabel={HIDDEN_PAGE_LABEL}
        style={[styles.lore, styles.loreHidden]}
      >
        {HIDDEN_LORE}
      </Text>
      <PixelFrame
        accessible
        accessibilityRole="text"
        accessibilityLabel={hiddenPageSentence(kind)}
        variant="raised"
        style={styles.lock}
      >
        <PixelIcon name="lock" color={roles.parchment} />
        <Text style={styles.lockText}>{hiddenPageSentence(kind)}</Text>
      </PixelFrame>
      <SectionTitle title={MECHANICS_TITLE} />
      <View style={[styles.ghost, { borderWidth: LINE }]} />
      <SectionTitle title="Coups" />
      <View style={[styles.ghost, { borderWidth: LINE }]} />
      <View style={[styles.ghost, { borderWidth: LINE }]} />
    </>
  );
}

/** Le reste de la page remplie (F1 à F3, F6) : Histoire, Mécaniques, puis Coups. */
function FilledPage({ page }: { readonly page: EnemyPage }) {
  const lore = ENEMY_PAGES[page.kind].lore;
  const mechanics = pageMechanicsText(page);
  const phases = pagePhasesText(page);
  return (
    <>
      <SectionTitle title={LORE_TITLE} />
      <Text
        accessible
        accessibilityRole="text"
        accessibilityLabel={`${LORE_TITLE} : ${lore}`}
        style={styles.lore}
      >
        {lore}
      </Text>
      <SectionTitle
        title={MECHANICS_TITLE}
        {...(mechanics.length > 0 && { count: `${mechanics.length}` })}
        countID="enemy-page-count-mechanics"
      />
      {mechanics.length === 0 && <Text style={styles.none}>{NO_MECHANIC}</Text>}
      {mechanics.map(({ mechanic, label, sentence, speech }) => {
        const tint = MECHANIC_STYLES[mechanic];
        return (
          <PixelFrame
            key={mechanic}
            accessible
            accessibilityRole="text"
            accessibilityLabel={speech}
            testID={`enemy-page-mechanic-${mechanic}`}
            style={styles.row}
          >
            <View
              style={[
                styles.trait,
                { borderColor: tint.color, backgroundColor: tint.background, borderWidth: LINE },
              ]}
            >
              <PixelIcon name={tint.icon} color={tint.color} />
              <Text style={[styles.traitLabel, { color: tint.color }]}>{label}</Text>
            </View>
            <Text style={styles.traitText}>{sentence}</Text>
          </PixelFrame>
        );
      })}
      {phases.map((phase, index) => (
        <Phase
          key={phase.title}
          page={page}
          phase={phase}
          index={index}
          offset={phases.slice(0, index).reduce((sum, each) => sum + each.moves.length, 0)}
        />
      ))}
    </>
  );
}

/**
 * La page d'un ennemi (`EnemyPageScreen`, #283, maquette 278 F1 à F6) : un écran poussé depuis le
 * Bestiaire, « Retour au Bestiaire », le nom et son palier, puis la scène (l'image de combat sur le
 * fond du palier, ou sa silhouette), le nom, la catégorie et l'état, puis, vaincu, l'Histoire, les
 * Mécaniques et les Coups, phase par phase pour un boss ; rencontré, la page cachée. Le domaine
 * décide de ce qui s'y montre (D1).
 *
 * « Page remplie » se décide à l'ouverture (D6) : la première ouverture de la page remplie colore
 * l'ennemi en 4 pas de 120 ms, montre « Page remplie » et l'annonce poliment ; la marque « page vue
 * remplie » est posée aussitôt, une seule fois, et rien ne rejoue ensuite. Aucun son (D5).
 */
export function EnemyPageScreen({
  book,
  kind,
  onBack,
}: {
  readonly book: DiscoveryBookSession;
  readonly kind: string;
  readonly onBack: () => void;
}) {
  // La page est lue à l'ouverture : la marque qui suit ne la change plus à l'écran.
  const [page] = useState(() => book.page(kind));
  const filling = page?.state === 'defeated' && page.firstFill;
  const step = useFillStep(filling);
  const announced = useRef(false);

  useEffect(() => {
    if (page?.state === 'defeated') void book.markPageSeen(page.kind);
  }, [book, page]);
  useEffect(() => {
    if (!filling || step !== FILL_STEPS || announced.current) return;
    announced.current = true;
    AccessibilityInfo.announceForAccessibility(pageFilledAnnouncement(page!.kind));
  }, [filling, step, page]);

  if (page === null) return null;
  return (
    <Screen layout="top" background={roles.night} testID="enemy-page">
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={PAGE_BACK_LABEL}
          onPress={onBack}
          style={styles.back}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.heading}>
          <Text accessibilityRole="header" style={styles.title}>
            {ENEMY_NAMES[page.kind]}
          </Text>
          <Text style={styles.subtitle}>{pageSubtitle(page)}</Text>
        </View>
      </View>
      <ScrollView testID="enemy-page-scroll" contentContainerStyle={styles.body}>
        <Stage page={page} filling={filling} step={step} />
        <View accessible accessibilityRole="text" accessibilityLabel={pageIdentityLabel(page)}>
          <Text style={styles.name}>{ENEMY_NAMES[page.kind]}</Text>
          <Text style={styles.tierLine}>{pageTierLine(page)}</Text>
        </View>
        {page.state === 'defeated' ? <FilledPage page={page} /> : <HiddenPage kind={page.kind} />}
      </ScrollView>
      {filling && step === FILL_STEPS && (
        <Text accessibilityLiveRegion="polite" role="status" style={styles.srOnly}>
          {pageFilledAnnouncement(page.kind)}
        </Text>
      )}
    </Screen>
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
  body: { gap: 10, paddingHorizontal: GUTTER, paddingTop: 8, paddingBottom: 24 },
  stage: {
    height: STAGE_HEIGHT,
    overflow: 'hidden',
    borderColor: roles.line,
    backgroundColor: roles.well,
  },
  backdrop: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'flex-end' },
  veil: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(14,17,32,0.45)' },
  figure: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 12,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  socket: {
    position: 'absolute',
    bottom: -4,
    width: 96,
    height: 12,
    backgroundColor: 'rgba(6,7,12,0.6)',
  },
  fillClip: { position: 'absolute', left: 0, bottom: 0, overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, bottom: 0 },
  tag: {
    position: 'absolute',
    top: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(16,19,31,0.9)',
  },
  tagLeft: { left: 8 },
  tagRight: { right: 8 },
  tagText: {
    fontFamily: textFont.bold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  filled: {
    position: 'absolute',
    top: 44,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontFamily: pixelFont,
    fontSize: 17,
    lineHeight: 19,
    color: roles.ink,
    backgroundColor: roles.gold,
  },
  name: { fontFamily: pixelFont, fontSize: 24, lineHeight: 27, color: roles.light },
  tierLine: { fontFamily: textFont.medium, fontSize: 13, lineHeight: 17, color: roles.parchment },
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
  lore: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontFamily: textFont.regular,
    fontStyle: 'italic',
    fontSize: 14.5,
    lineHeight: 21,
    color: '#E6DFCF',
    borderLeftWidth: 3,
    borderLeftColor: roles.gold,
    backgroundColor: roles.sunken,
  },
  loreHidden: {
    fontFamily: pixelFont,
    fontStyle: 'normal',
    fontSize: 18,
    letterSpacing: 2,
    color: roles.muted,
  },
  lock: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12 },
  lockText: {
    flex: 1,
    fontFamily: textFont.medium,
    fontSize: 13.5,
    lineHeight: 19.5,
    color: roles.light,
  },
  ghost: { height: 56, borderColor: roles.raised, backgroundColor: roles.sunken },
  none: { fontFamily: textFont.medium, fontSize: 13.5, lineHeight: 19, color: roles.parchment },
  row: { gap: 4, paddingVertical: 9, paddingHorizontal: 12 },
  trait: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  traitLabel: { fontFamily: textFont.bold, fontSize: 12, lineHeight: 17 },
  traitText: { fontFamily: textFont.medium, fontSize: 13.5, lineHeight: 19.5, color: roles.light },
  moveHead: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  moveName: {
    marginRight: 'auto',
    fontFamily: pixelFont,
    fontSize: 16,
    lineHeight: 19,
    color: roles.light,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: roles.line,
    backgroundColor: roles.sunken,
  },
  chipText: { fontFamily: textFont.bold, fontSize: 11, lineHeight: 16, color: roles.parchment },
  moveText: { fontFamily: textFont.medium, fontSize: 12.5, lineHeight: 18, color: roles.parchment },
  phase: { gap: 6 },
  phaseBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderLeftColor: roles.curse,
    backgroundColor: '#2E1520',
  },
  phaseBannerText: { fontFamily: textFont.bold, fontSize: 13, lineHeight: 17, color: roles.light },
  phaseText: { fontFamily: textFont.medium, fontSize: 13, lineHeight: 19, color: roles.parchment },
  srOnly: { position: 'absolute', width: 1, height: 1, overflow: 'hidden' },
});
// Stryker restore all
