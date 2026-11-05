import { type ReactNode, useEffect, useRef } from 'react';
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

import type { FateGaugeReading } from '../../../application/useCases/fateGauge';
import type { FateGauge } from '../../../domain/ascent/fateGauge';
import {
  ASCENT_GAUGE_TITLE,
  ASCENT_KEEPS_GAUGE,
  ASCENT_LEVEL_TAG,
  CLOSE_DETAIL,
  DAY_GAUGE_TITLE,
  DETAIL_HEADINGS,
  FIRST_USE_DETAIL,
  FIRST_USE_EFFECTS,
  GAUGE_LEVELS,
  GAUGE_SAFEGUARDS,
  SEALED_TEXT,
  SEALED_TITLE,
  UNREADABLE_TEXT,
  closingNote,
  gaugeEffects,
  gaugeShare,
  gaugeValue,
  gaugeWord,
  habitLabel,
  habitStatus,
  isFirstUse,
  levelTag,
  AT_CLOSING_MARK,
} from '../format/gaugeText';
import { artPalette } from '../pixelArt/artPalette';
import { artPixelSize } from '../pixelArt/artPixel';
import { MIN_TARGET_SIZE, PixelButton } from '../pixelArt/PixelButton';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { PixelSheet } from '../pixelArt/PixelSheet';
import { pixelFont, textFont } from '../pixelArt/pixelTypography';
import { useReducedMotion } from '../state/useReducedMotion';
import { GaugeDial, GaugeEffectList, SIDE_COLORS } from './GaugeDial';

const { roles } = artPalette;

/** Un bandeau du détail : information (bleu) ou scellement (or, au cadenas). */
function Band({
  kind,
  testID,
  children,
}: {
  readonly kind: 'info' | 'seal';
  readonly testID?: string;
  readonly children: ReactNode;
}) {
  return (
    <View
      accessible
      testID={testID}
      style={[
        styles.band,
        { borderWidth: artPixelSize(2), borderColor: kind === 'seal' ? roles.gold : roles.blue },
      ]}
    >
      {kind === 'seal' ? <PixelIcon name="lock" color={roles.gold} /> : <View style={styles.dot} />}
      <Text style={styles.bandText}>{children}</Text>
    </View>
  );
}

function Heading({ children }: { readonly children: string }) {
  return (
    <Text accessibilityRole="header" style={styles.heading}>
      {children}
    </Text>
  );
}

/** Hier, habitude par habitude, faites ou non, puis la part (D1, D4). */
function Yesterday({ reading }: { readonly reading: FateGaugeReading }) {
  return (
    <>
      <Heading>{DETAIL_HEADINGS.yesterday}</Heading>
      <View>
        {reading.habits.map((habit, index) => (
          <View
            key={`${index}-${habit.name}`}
            accessible
            accessibilityLabel={habitLabel(habit)}
            testID="gauge-habit"
            style={styles.habit}
          >
            <PixelIcon
              name={habit.done ? 'check8' : 'dash8'}
              color={habit.done ? roles.done : roles.muted}
            />
            <Text style={styles.habitName}>
              {habit.name}
              {habit.atClosingOnly && <Text style={styles.mark}>{` · ${AT_CLOSING_MARK}`}</Text>}
            </Text>
            <Text style={[styles.status, habit.done && { color: roles.done }]}>
              {habitStatus(habit.done)}
            </Text>
          </View>
        ))}
      </View>
      <Text style={styles.line}>{gaugeShare(reading)}</Text>
    </>
  );
}

/** Les cinq niveaux et leurs seuils, celui du jour marqué au mot (D1). */
function Levels({ gauge, tag }: { readonly gauge: FateGauge; readonly tag: string }) {
  const line = artPixelSize(2);
  return (
    <>
      <Heading>{DETAIL_HEADINGS.levels}</Heading>
      <View style={styles.levels}>
        {GAUGE_LEVELS.map((level) => {
          const on = level.gauge === gauge;
          const color = SIDE_COLORS[level.gauge < 0 ? 'neg' : level.gauge > 0 ? 'pos' : 'neu'];
          return (
            <View
              key={level.gauge}
              testID={on ? 'gauge-level-on' : 'gauge-level'}
              style={[styles.level, on && { borderWidth: line, borderColor: roles.gold }]}
            >
              <Text style={[styles.levelValue, { color }]}>{gaugeValue(level.gauge)}</Text>
              <Text style={styles.levelText}>
                {`${gaugeWord(level.gauge)} · ${level.threshold}`}
              </Text>
              {on && <Text style={styles.today}>{tag}</Text>}
            </View>
          );
        })}
      </View>
    </>
  );
}

/**
 * Le détail de la jauge (`GaugeDetail`, #41, maquette 205, D1 à D5) : une feuille du bas, ouverte en
 * touchant la jauge. Le titre reçoit le focus à l'ouverture. Elle se lit de haut en bas : le mot et
 * le cadran, le scellement, l'écart avec le Rappel d'hier, hier habitude par habitude (les noms ne
 * s'affichent qu'ici), les cinq niveaux, ce qu'elle change, et les quatre garde-fous. « Fermer », en
 * haut et en bas, le voile et le geste retour appellent `onClose` ; l'appelant rend le focus à la
 * jauge.
 *
 * Sans `reading`, c'est la jauge de l'ascension en cours (G9) : l'ascension ne garde que son niveau,
 * le détail ne montre donc ni le compte ni les noms d'hier.
 */
export function GaugeDetailSheet({
  visible,
  gauge,
  reading,
  blessings = 0,
  onClose,
}: {
  readonly visible: boolean;
  readonly gauge: FateGauge;
  /** La jauge du jour, ou `null` pour celle de l'ascension en cours. */
  readonly reading: FateGaugeReading | null;
  /** Les bénédictions de départ de l'ascension en cours. */
  readonly blessings?: number;
  readonly onClose: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const { height } = useWindowDimensions();
  const title = useRef<Text>(null);

  useEffect(() => {
    if (visible && title.current !== null) {
      AccessibilityInfo.sendAccessibilityEvent(title.current, 'focus');
    }
  }, [visible]);

  const firstUse = reading !== null && isFirstUse(reading);
  const atClosing = reading?.habits.filter((habit) => habit.atClosingOnly) ?? [];
  const effects =
    reading === null
      ? gaugeEffects({ gauge, blessings: Array.from({ length: blessings }) })
      : gaugeEffects(reading);

  return (
    <Modal
      transparent
      visible={visible}
      animationType={reducedMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
      testID="gauge-detail"
    >
      <View style={styles.container}>
        <Pressable accessible={false} onPress={onClose} style={styles.scrim} />
        <PixelSheet accessibilityViewIsModal style={[styles.sheet, { maxHeight: height * 0.92 }]}>
          <View style={styles.header}>
            <Text ref={title} accessibilityRole="header" style={styles.title}>
              {reading === null ? ASCENT_GAUGE_TITLE : DAY_GAUGE_TITLE}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={CLOSE_DETAIL}
              onPress={onClose}
              style={styles.close}
            >
              <PixelIcon name="close" color={roles.light} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content} bounces={false}>
            <GaugeDial gauge={gauge} notYet={firstUse} sealed={reading?.sealed ?? false} small />
            {reading === null && <Text style={styles.line}>{ASCENT_KEEPS_GAUGE}</Text>}
            {reading?.sealed && (
              <Band kind="seal" testID="gauge-sealed">
                <Text style={styles.bold}>{SEALED_TITLE}</Text>
                {` ${SEALED_TEXT}`}
              </Band>
            )}
            {atClosing.length > 0 && (
              <Band kind="info" testID="gauge-closing">
                {closingNote(atClosing.map(({ name }) => name))}
              </Band>
            )}
            {firstUse && <Band kind="info">{FIRST_USE_DETAIL}</Band>}
            {reading?.unreadable && <Band kind="info">{UNREADABLE_TEXT}</Band>}
            {reading !== null && reading.expected > 0 && <Yesterday reading={reading} />}
            <Levels gauge={gauge} tag={reading === null ? ASCENT_LEVEL_TAG : levelTag(reading)} />
            <Heading>{reading === null ? DETAIL_HEADINGS.ascent : DETAIL_HEADINGS.today}</Heading>
            {firstUse ? (
              <Text style={styles.soft}>{FIRST_USE_EFFECTS}</Text>
            ) : (
              <GaugeEffectList effects={effects} />
            )}
            <Heading>{DETAIL_HEADINGS.never}</Heading>
            <View style={styles.safeguards}>
              {GAUGE_SAFEGUARDS.map(({ glyph, text }) => (
                <View key={text} style={styles.safeguard}>
                  <PixelIcon
                    name={glyph}
                    color={glyph === 'shard8' ? roles.shard : roles.parchment}
                  />
                  <Text style={styles.safeguardText}>{text}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
          <PixelButton label={CLOSE_DETAIL} text="Fermer" variant="secondary" onPress={onClose} />
        </PixelSheet>
      </View>
    </Modal>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: roles.scrim },
  sheet: { paddingTop: 4, paddingHorizontal: 16, paddingBottom: 34, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: pixelFont, fontSize: 24, lineHeight: 28, color: roles.light },
  close: {
    width: MIN_TARGET_SIZE,
    height: MIN_TARGET_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { gap: 10, paddingBottom: 8 },
  band: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: roles.raised,
  },
  dot: {
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
  bold: { fontFamily: textFont.bold },
  heading: {
    marginTop: 6,
    fontFamily: textFont.bold,
    fontSize: 11.5,
    lineHeight: 15,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: roles.muted,
  },
  habit: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 24 },
  habitName: {
    flex: 1,
    fontFamily: textFont.medium,
    fontSize: 13.5,
    lineHeight: 18,
    color: roles.light,
  },
  mark: { fontSize: 12, color: roles.muted },
  status: { fontFamily: textFont.semiBold, fontSize: 12, lineHeight: 16, color: roles.muted },
  line: {
    fontFamily: textFont.medium,
    fontSize: 13.5,
    lineHeight: 19,
    color: roles.light,
  },
  soft: { fontFamily: textFont.medium, fontSize: 13.5, lineHeight: 19, color: roles.parchment },
  levels: { gap: 3 },
  level: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 30,
    paddingVertical: 2,
    paddingLeft: 4,
    paddingRight: 8,
  },
  levelValue: { width: 34, textAlign: 'center', fontFamily: textFont.bold, fontSize: 12 },
  levelText: {
    flex: 1,
    fontFamily: textFont.medium,
    fontSize: 13,
    lineHeight: 17,
    color: roles.parchment,
  },
  today: {
    fontFamily: textFont.bold,
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: roles.ink,
    backgroundColor: roles.gold,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  safeguards: { gap: 4 },
  safeguard: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  safeguardText: {
    flex: 1,
    fontFamily: textFont.medium,
    fontSize: 13,
    lineHeight: 18,
    color: roles.light,
  },
});
// Stryker restore all
