import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { FateGauge } from '../../../domain/ascent/fateGauge';
import {
  NOT_YET_PILL,
  SEALED_PILL,
  gaugeValue,
  gaugeWord,
  type GaugeEffect,
  type GaugeTone,
} from '../format/gaugeText';
import { artPalette } from '../pixelArt/artPalette';
import { artPixelSize } from '../pixelArt/artPixel';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { pixelFont, textFont } from '../pixelArt/pixelTypography';
import type { IconName } from '../pixelArt/sprites/icons';
import { useReducedMotion } from '../state/useReducedMotion';

const { roles } = artPalette;

const LEVELS: readonly FateGauge[] = [-2, -1, 0, 1, 2];

/** Le pas des animations du jeu, et le nombre de pas du curseur (500 ms, maquette G11). */
const STEP_MS = 100;
const CURSOR_STEPS = 5;

// Stryker disable all: valeurs purement visuelles, vérifiées par la conformité aux maquettes (barrière 10 bis).
type Side = 'neg' | 'neu' | 'pos';
const sideOf = (gauge: number): Side => (gauge < 0 ? 'neg' : gauge > 0 ? 'pos' : 'neu');

/** La couleur du mot et de la valeur : jamais seule, toujours avec le mot. */
export const SIDE_COLORS: Readonly<Record<Side, string>> = {
  neg: roles.error,
  neu: roles.light,
  pos: roles.done,
};
const NOTCH: Readonly<Record<Side, { bg: string; line: string; onBg: string; onLine: string }>> = {
  neg: { bg: roles.missedBg, line: roles.missedLine, onBg: roles.errorBg, onLine: roles.curse },
  neu: { bg: roles.surface, line: roles.line, onBg: roles.raised, onLine: roles.parchment },
  pos: { bg: roles.doneBg, line: roles.doneShade, onBg: roles.doneBg, onLine: roles.done },
};
const GLYPH_COLORS: Readonly<Record<Side, { on: string; off: string }>> = {
  neg: { on: roles.pink, off: roles.curse },
  neu: { on: roles.light, off: roles.muted },
  pos: { on: roles.light, off: roles.doneLine },
};
export const TONE_COLORS: Readonly<Record<GaugeTone, string>> = {
  gold: roles.gold,
  favor: roles.done,
  curse: roles.error,
  muted: roles.muted,
};
// Stryker restore all

/** Les signes d'un cran : un crâne par cran de malédiction, un « + » par cran de faveur, « = » à 0. */
function glyphsOf(level: FateGauge): IconName[] {
  if (level < 0) return Array.from({ length: -level }, () => 'skull');
  if (level > 0) return Array.from({ length: level }, () => 'plus8');
  return ['eq'];
}

/** La place du curseur au-dessus du cran de `gauge`, en % de la largeur du cadran. */
const cursorAt = (gauge: FateGauge) => (gauge + 2) * 20 + 10;

/**
 * Le curseur glisse vers son nouveau cran en 5 pas de 100 ms (G11) ; en mouvement réduit, il y
 * apparaît.
 */
function useCursor(gauge: FateGauge): number {
  const reducedMotion = useReducedMotion();
  const target = cursorAt(gauge);
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = from.current;
    from.current = target;
    if (reducedMotion || start === target) {
      setShown(target);
      return undefined;
    }
    let step = 0;
    const timer = setInterval(() => {
      step += 1;
      setShown(start + ((target - start) * step) / CURSOR_STEPS);
      if (step === CURSOR_STEPS) clearInterval(timer);
    }, STEP_MS);
    return () => clearInterval(timer);
  }, [target, reducedMotion]);
  return shown;
}

/**
 * Le cadran de la jauge (#41, maquette 205, G1 à G9) : le mot et la valeur, la pastille « Scellée »
 * ou « Pas encore », puis cinq crans de −2 à +2 sous un curseur d'or. Le cran du jour est allumé et
 * porte autant de signes que son niveau. Sans compte (`notYet`), le cadran est hachuré, sans curseur
 * ni valeur. La couleur n'est jamais seule : le mot, la valeur et les signes la doublent. Le cadran
 * est décoratif ; son cadre porte l'annonce.
 */
export function GaugeDial({
  gauge,
  notYet = false,
  sealed = false,
  small = false,
}: {
  readonly gauge: FateGauge;
  readonly notYet?: boolean;
  readonly sealed?: boolean;
  readonly small?: boolean;
}) {
  const side = sideOf(gauge);
  const cursor = useCursor(gauge);
  const line = artPixelSize(2);
  return (
    <View style={styles.block}>
      <View style={styles.word}>
        <Text style={[styles.wordText, small && styles.wordSmall, { color: SIDE_COLORS[side] }]}>
          {gaugeWord(gauge)}
        </Text>
        {!notYet && (
          <Text
            style={[
              styles.value,
              {
                color: SIDE_COLORS[side],
                borderWidth: line,
                borderColor: NOTCH[side].onLine,
                backgroundColor: NOTCH[side].onBg,
              },
            ]}
          >
            {gaugeValue(gauge)}
          </Text>
        )}
        {(sealed || notYet) && (
          <View style={[styles.pill, { borderWidth: line }]}>
            {sealed && <PixelIcon name="lock" color={roles.parchment} />}
            <Text style={styles.pillText}>{sealed ? SEALED_PILL : NOT_YET_PILL}</Text>
          </View>
        )}
      </View>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.dial}
      >
        {!notYet && (
          <View testID="gauge-cursor" style={[styles.cursor, { left: `${cursor}%` }]}>
            <View style={styles.cursorHead} />
            <View style={styles.cursorTip} />
          </View>
        )}
        <View style={styles.notches}>
          {LEVELS.map((level) => {
            const on = !notYet && level === gauge;
            const look = NOTCH[sideOf(level)];
            return (
              <View
                key={level}
                testID={notYet ? 'gauge-notch-hatched' : on ? 'gauge-notch-on' : 'gauge-notch'}
                style={[
                  styles.notch,
                  small && styles.notchSmall,
                  { borderWidth: line },
                  notYet
                    ? styles.hatched
                    : {
                        backgroundColor: on ? look.onBg : look.bg,
                        borderColor: on ? look.onLine : look.line,
                      },
                ]}
              >
                {!notYet &&
                  glyphsOf(level).map((glyph, index) => (
                    <PixelIcon
                      key={index}
                      name={glyph}
                      testID={`gauge-glyph-${glyph}`}
                      color={GLYPH_COLORS[sideOf(level)][on ? 'on' : 'off']}
                      style={!on && styles.off}
                    />
                  ))}
              </View>
            );
          })}
        </View>
        <View style={styles.scale}>
          {LEVELS.map((level) => (
            <Text
              key={level}
              style={[styles.scaleText, !notYet && level === gauge && styles.scaleOn]}
            >
              {gaugeValue(level)}
            </Text>
          ))}
        </View>
        {!small && (
          <View style={styles.ends}>
            <Text style={styles.endText}>Malédiction</Text>
            <Text style={styles.endText}>Faveur</Text>
          </View>
        )}
      </View>
    </View>
  );
}

/** La liste des effets de la jauge : un glyphe, puis le texte de chaque effet. */
export function GaugeEffectList({ effects }: { readonly effects: readonly GaugeEffect[] }) {
  return (
    <View testID="gauge-effects" style={styles.effects}>
      {effects.map(({ glyph, tone, text }) => (
        <View key={text} style={styles.effect}>
          <PixelIcon name={glyph} color={TONE_COLORS[tone]} testID={`gauge-glyph-${glyph}`} />
          <Text style={styles.effectText}>{text}</Text>
        </View>
      ))}
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  block: { gap: 4 },
  word: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  wordText: { fontFamily: pixelFont, fontSize: 24, lineHeight: 28 },
  wordSmall: { fontSize: 21, lineHeight: 25 },
  value: {
    fontFamily: pixelFont,
    fontSize: 18,
    lineHeight: 22,
    paddingHorizontal: 6,
    fontVariant: ['tabular-nums'],
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderColor: roles.line,
  },
  pillText: {
    fontFamily: textFont.bold,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: roles.parchment,
  },
  dial: { paddingTop: 12, gap: 2 },
  cursor: { position: 'absolute', top: 0, width: 14, height: 10, marginLeft: -7, zIndex: 1 },
  cursorHead: { height: 4, backgroundColor: roles.gold },
  cursorTip: { alignSelf: 'center', width: 6, height: 6, backgroundColor: roles.gold },
  notches: { flexDirection: 'row', gap: 4 },
  notch: {
    flex: 1,
    height: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  notchSmall: { height: 20 },
  hatched: { backgroundColor: roles.raised, borderColor: roles.line, borderStyle: 'dashed' },
  off: { opacity: 0.45 },
  scale: { flexDirection: 'row', gap: 4 },
  scaleText: {
    flex: 1,
    textAlign: 'center',
    fontFamily: textFont.bold,
    fontSize: 11,
    lineHeight: 14,
    color: roles.muted,
    fontVariant: ['tabular-nums'],
  },
  scaleOn: { color: roles.light },
  ends: { flexDirection: 'row', justifyContent: 'space-between' },
  endText: { fontFamily: textFont.semiBold, fontSize: 11, lineHeight: 14, color: roles.muted },
  effects: { gap: 3 },
  effect: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  effectText: {
    flex: 1,
    fontFamily: textFont.medium,
    fontSize: 13,
    lineHeight: 18,
    color: roles.light,
  },
});
// Stryker restore all
