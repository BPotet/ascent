import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SECOND_BREATH, type BoonKind, type OfferCard } from '../../../domain/ascent/boons';
import { IconWell, RARITY_COLORS } from '../components/IconWell';
import {
  boonCard,
  boonObtainedLabel,
  offerBoonCard,
  offerHeading,
  secondBreathCard,
  secondBreathObtained,
} from '../format/boonText';
import { artPalette } from '../pixelArt/artPalette';
import { PixelButton } from '../pixelArt/PixelButton';
import { PixelFrame } from '../pixelArt/PixelFrame';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { pixelFont, pixelTypography, textFont } from '../pixelArt/pixelTypography';
import { boonIcon, secondBreathIcon } from '../pixelArt/sprites/gameIcons';
import { battleColors } from '../theme/battleColors';

const { roles } = artPalette;

function BoonOption({
  kind,
  checked,
  onPress,
}: {
  readonly kind: BoonKind;
  readonly checked: boolean;
  readonly onPress: () => void;
}) {
  const card = offerBoonCard(kind);
  const color = RARITY_COLORS[card.rarity];
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={card.label}
      accessibilityState={{ checked, selected: checked }}
      onPress={onPress}
      style={styles.card}
    >
      <PixelFrame
        tone={checked ? 'gold' : 'default'}
        {...(checked && { background: roles.goldBg })}
        style={styles.frame}
      >
        <IconWell
          icon={boonIcon(kind)}
          rarity={card.rarity}
          size="card"
          under={checked ? roles.goldBg : roles.surface}
        />
        <View style={styles.text}>
          <Text style={[styles.tag, { color }]}>
            {card.tierMark === null
              ? card.tag
              : [
                  `${card.tag} `,
                  <Text key="tier" style={styles.tierMark}>
                    {card.tierMark}
                  </Text>,
                ]}
          </Text>
          <Text style={[styles.name, checked && styles.checkedName]}>{card.name}</Text>
          <Text style={styles.effect}>{card.effect}</Text>
        </View>
        {checked && <Tick />}
      </PixelFrame>
    </Pressable>
  );
}

function Tick() {
  return (
    <View pointerEvents="none" style={styles.tick}>
      <PixelIcon name="check8" color={roles.ink} testID="boon-tick" />
    </View>
  );
}

/** Une barre de PV : les PV en clair, et en vert ce que Second souffle rend (#212). */
function HealBar({
  hp,
  healed,
  maxHp,
  style,
}: {
  readonly hp: number;
  readonly healed: number;
  readonly maxHp: number;
  readonly style: object;
}) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="second-breath-bar"
      style={[styles.bar, style]}
    >
      <View
        testID="second-breath-bar-gain"
        style={[
          styles.barFill,
          { width: `${(healed / maxHp) * 100}%`, backgroundColor: roles.done },
        ]}
      />
      <View
        testID="second-breath-bar-hp"
        style={[
          styles.barFill,
          { width: `${(hp / maxHp) * 100}%`, backgroundColor: battleColors.heroHp },
        ]}
      />
    </View>
  );
}

/**
 * La carte Second souffle (#212, maquette 210) : le gabarit d'une carte de bienfait, en vert, sans
 * famille ni losanges, avec les PV qu'elle rendra.
 */
function SecondBreathOption({
  hp,
  maxHp,
  checked,
  onPress,
}: {
  readonly hp: number;
  readonly maxHp: number;
  readonly checked: boolean;
  readonly onPress: () => void;
}) {
  const card = secondBreathCard(hp, maxHp);
  const zero = card.full !== null;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={card.label}
      accessibilityState={{ checked, selected: checked }}
      onPress={onPress}
      style={styles.card}
    >
      <PixelFrame
        tone={checked ? 'gold' : 'done'}
        {...(checked && { background: roles.goldBg })}
        style={styles.frame}
        testID="second-breath-frame"
      >
        <IconWell
          icon={secondBreathIcon()}
          rarity="heal"
          size="card"
          under={checked ? roles.goldBg : roles.surface}
        />
        <View style={styles.text}>
          <View style={styles.healTag}>
            <Text style={[styles.gain, zero && styles.gainZero]}>{card.gain}</Text>
            <Text style={[styles.tag, { color: roles.done }]}>{card.tag}</Text>
          </View>
          <Text style={[styles.name, checked && styles.checkedName]}>{card.name}</Text>
          <Text style={styles.effect}>{card.effect}</Text>
          <View style={styles.hpLine}>
            <HealBar hp={hp} healed={card.healed} maxHp={maxHp} style={styles.smallBar} />
            <Text style={styles.hpText}>{card.hpLine}</Text>
          </View>
          {card.full !== null && <Text style={styles.full}>{card.full}</Text>}
        </View>
        {checked && <Tick />}
      </PixelFrame>
    </Pressable>
  );
}

/** L'écran après le choix de Second souffle (#212) : les PV rendus, au lieu de « Bienfait obtenu. ». */
function SecondBreathObtained({
  hp,
  maxHp,
  onContinue,
}: {
  readonly hp: number;
  readonly maxHp: number;
  readonly onContinue: () => void;
}) {
  const obtained = secondBreathObtained(hp, maxHp);
  const zero = obtained.healed === hp;
  return (
    <View style={styles.body} testID="second-breath-obtained">
      <View
        accessible
        accessibilityLabel={obtained.label}
        accessibilityLiveRegion="polite"
        style={[styles.center, styles.centerItems]}
      >
        <IconWell icon={secondBreathIcon()} rarity="heal" size="large" under={roles.night} />
        <Text style={[styles.tag, styles.centered, { color: roles.done }]}>Soin</Text>
        <Text style={[styles.title, styles.bigTitle]}>Second souffle</Text>
        <Text style={[styles.bigGain, zero && styles.bigGainZero]}>{obtained.gain}</Text>
        <View style={styles.bigBar}>
          <HealBar hp={hp} healed={obtained.healed} maxHp={maxHp} style={styles.largeBar} />
          <Text style={[styles.hpText, styles.centered]}>{obtained.hpLine}</Text>
        </View>
        <Text style={[styles.sub, styles.obtained, zero && styles.obtainedZero]}>
          {obtained.line}
        </Text>
      </View>
      <PixelButton label="Continuer" onPress={onContinue} />
    </View>
  );
}

/**
 * Le choix d'un bienfait (prototype #92, maquette B1 à B3) : 3 cartes, toucher une carte puis
 * « Prendre » ; puis le bienfait obtenu, et « Continuer » le garde pour l'ascension. Chaque carte
 * porte l'icône du bienfait dans son écrin, et « Bienfait obtenu. » la montre en grand (#157,
 * maquette 1A à 1E). La carte Second souffle complète une offre de moins de 3 bienfaits ; seule,
 * elle est déjà cochée (#212, maquette 210).
 */
export function BoonChoicePanel({
  offer,
  heroHp,
  heroMaxHp,
  onChoose,
}: {
  readonly offer: readonly OfferCard[];
  /** Les PV du héros, et ses PV max, pour ce que rend Second souffle (#212). */
  readonly heroHp: number;
  readonly heroMaxHp: number;
  readonly onChoose: (index: number) => void;
}) {
  const alone = offer.length === 1 && offer[0] === SECOND_BREATH;
  const [selected, setSelected] = useState<number | null>(alone ? 0 : null);
  const [taken, setTaken] = useState(false);
  const heading = offerHeading(offer);

  if (taken && selected !== null) {
    const chosen = offer[selected]!;
    if (chosen === SECOND_BREATH) {
      return (
        <SecondBreathObtained hp={heroHp} maxHp={heroMaxHp} onContinue={() => onChoose(selected)} />
      );
    }
    const kind: BoonKind = chosen;
    const card = boonCard(kind);
    return (
      <View style={styles.body} testID="boon-obtained">
        <View
          accessible
          accessibilityLabel={boonObtainedLabel(kind)}
          accessibilityLiveRegion="polite"
          style={styles.center}
        >
          <View style={styles.large}>
            <IconWell icon={boonIcon(kind)} rarity={card.rarity} size="large" under={roles.night} />
          </View>
          <Text style={[styles.tag, styles.centered, { color: RARITY_COLORS[card.rarity] }]}>
            {card.tag}
          </Text>
          <Text style={[styles.title, styles.bigTitle]}>{card.name}</Text>
          <Text style={[styles.effect, styles.centered]}>{card.effect}</Text>
          <Text style={[styles.sub, styles.obtained]}>Bienfait obtenu.</Text>
        </View>
        <PixelButton label="Continuer" onPress={() => onChoose(selected)} />
      </View>
    );
  }

  return (
    <View style={styles.body} testID="boon-choice">
      <ScrollView contentContainerStyle={styles.list}>
        <Text accessibilityRole="header" style={styles.title}>
          {heading.title}
        </Text>
        <Text style={styles.sub}>{heading.sub}</Text>
        <View accessibilityRole="radiogroup" accessibilityLabel="Offre" style={styles.list}>
          {offer.map((card, index) =>
            card === SECOND_BREATH ? (
              <SecondBreathOption
                key={card}
                hp={heroHp}
                maxHp={heroMaxHp}
                checked={selected === index}
                onPress={() => setSelected(index)}
              />
            ) : (
              <BoonOption
                key={card}
                kind={card}
                checked={selected === index}
                onPress={() => setSelected(index)}
              />
            ),
          )}
        </View>
      </ScrollView>
      <PixelButton label="Prendre" disabled={selected === null} onPress={() => setTaken(true)} />
    </View>
  );
}

// Stryker disable all: styles d'un écran de prototype.
const styles = StyleSheet.create({
  body: { flex: 1, padding: 16, paddingBottom: 34, gap: 12 },
  center: { flex: 1, justifyContent: 'center', gap: 12 },
  list: { gap: 8 },
  title: {
    fontFamily: pixelFont,
    fontSize: 22,
    lineHeight: 26,
    color: roles.light,
    textAlign: 'center',
  },
  sub: { ...pixelTypography.body, fontSize: 14, color: roles.parchment, textAlign: 'center' },
  card: { minHeight: 88 },
  frame: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 40,
  },
  text: { flex: 1, gap: 2 },
  large: { alignSelf: 'center' },
  bigTitle: { fontSize: 28, lineHeight: 32 },
  centered: { textAlign: 'center' },
  obtained: { fontFamily: textFont.semiBold, color: roles.done },
  tag: { fontFamily: textFont.bold, fontSize: 12, lineHeight: 16 },
  name: { fontFamily: pixelFont, fontSize: 20, lineHeight: 24, color: roles.light },
  checkedName: { color: roles.gold },
  effect: { fontFamily: textFont.medium, fontSize: 14, lineHeight: 20, color: roles.parchment },
  tierMark: { fontFamily: textFont.semiBold, color: roles.muted },
  healTag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  gain: {
    fontFamily: pixelFont,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 6,
    color: roles.ink,
    backgroundColor: roles.done,
  },
  gainZero: { color: roles.parchment, backgroundColor: roles.raised },
  hpLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
  hpText: { fontFamily: textFont.semiBold, fontSize: 12, lineHeight: 16, color: roles.parchment },
  full: { fontFamily: textFont.semiBold, fontSize: 12, lineHeight: 16, color: roles.muted },
  bar: { position: 'relative', overflow: 'hidden', backgroundColor: battleColors.hpTrack },
  barFill: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  smallBar: { flex: 1, maxWidth: 96, height: 10 },
  largeBar: { height: 20 },
  bigBar: { width: '100%', maxWidth: 260, gap: 6 },
  centerItems: { alignItems: 'center' },
  bigGain: { fontFamily: pixelFont, fontSize: 34, lineHeight: 38, color: roles.done },
  bigGainZero: { fontSize: 24, lineHeight: 28, color: roles.muted },
  obtainedZero: { color: roles.parchment },
  tick: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: roles.gold,
  },
});
// Stryker restore all
