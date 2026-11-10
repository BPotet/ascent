import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { HeroKind } from '../../../domain/battle/combatants';
import { EQUIPPED_POWER_SLOTS } from '../../../domain/ascent/powerTree';
import { basePower, type PowerKind } from '../../../domain/battle/powers';
import { EquippedPowersRow } from '../components/EquippedPowersRow';
import { KindledFlame } from '../components/KindledFlame';
import { Screen } from '../components/Screen';
import { heroCard } from '../format/battleText';
import type { HeroOathLine } from '../format/oathText';
import { LAUNCH_ERROR } from '../format/powerText';
import { CHANGE_POWERS, changePowersLinkLabel } from '../format/powersMenuText';
import { artPixelSize } from '../pixelArt/artPixel';
import { artPalette } from '../pixelArt/artPalette';
import { MIN_TARGET_SIZE, PixelButton } from '../pixelArt/PixelButton';
import { PixelFrame } from '../pixelArt/PixelFrame';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { pixelFont, textFont } from '../pixelArt/pixelTypography';

const { roles } = artPalette;

const HERO_KINDS: readonly HeroKind[] = ['sentinel', 'wanderer'];
const LINE = artPixelSize(2);

export type { HeroOathLine };

function HeroOption({
  kind,
  powers,
  kindled,
  oathLines,
  checked,
  onPress,
}: {
  readonly kind: HeroKind;
  readonly powers: readonly PowerKind[];
  readonly kindled: readonly PowerKind[];
  readonly oathLines: readonly HeroOathLine[];
  readonly checked: boolean;
  readonly onPress: () => void;
}) {
  const card = heroCard(kind, powers, kindled);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={card.label}
      accessibilityState={{ checked, selected: checked }}
      onPress={onPress}
      testID={`hero-choice-${kind}`}
    >
      <PixelFrame
        tone={checked ? 'gold' : 'default'}
        {...(checked && { background: roles.goldBg })}
        style={styles.card}
      >
        <Text style={[styles.name, checked && styles.checkedName]}>{card.name}</Text>
        <Text style={styles.style}>{card.style}</Text>
        <Text style={styles.stats}>{card.stats}</Text>
        {checked ? <Text style={styles.line}>{card.kit}</Text> : null}
        <EquippedPowersRow powers={powers} kindled={kindled} short={!checked} />
        {checked
          ? oathLines.map((line) => (
              <View key={line.text} style={styles.oathLine}>
                {line.tone === 'kindled' ? (
                  <KindledFlame />
                ) : (
                  <PixelIcon name="oath8" color={roles.parchment} />
                )}
                <Text style={[styles.oathText, line.tone === 'muted' && styles.oathMuted]}>
                  {line.text}
                </Text>
              </View>
            ))
          : null}
        {checked ? <Text style={styles.small}>{card.trait}</Text> : null}
        {checked ? (
          <View pointerEvents="none" style={styles.tick}>
            <PixelIcon name="check8" color={roles.gold} />
          </View>
        ) : null}
      </PixelFrame>
    </Pressable>
  );
}

/**
 * Le choix du héros (`HeroChoice`) au pied de la tour (prototype #92, maquette H3, avec son titre,
 * sa note et son bouton) : la Sentinelle ou l'Errante, avec son équipement de base, ses pouvoirs
 * équipés (#235, H1, H2 : le pouvoir de base seul par défaut) et son trait. Rien n'est lancé avant
 * le bouton. Les pouvoirs équipés se préparent au menu des pouvoirs (#270) : le Choix du héros ne
 * fait que les résumer, en lecture seule (H1) ; pour le héros choisi, à partir de 4 pouvoirs
 * possédés, un lien discret « Changer les pouvoirs » ouvre ce menu (H2). Pendant l'enregistrement du
 * choix, « Continuer » attend ; s'il échoue, un message le dit et « Réessayer » relance, la sélection
 * gardée (H4).
 */
export function HeroChoiceScreen({
  onStart,
  onClose,
  title,
  note,
  confirmLabel,
  equipped,
  kindled,
  oathLines,
  owned,
  onChangePowers,
  starting = false,
  failed = false,
}: {
  readonly onStart: (hero: HeroKind) => void;
  readonly onClose: () => void;
  readonly title: string;
  readonly note: string;
  readonly confirmLabel: (hero: HeroKind) => string;
  /** Les pouvoirs équipés d'office de chaque héros (#235), lus dans la vue du Camp. */
  readonly equipped?: Readonly<Record<HeroKind, readonly PowerKind[]>>;
  /** Les pouvoirs que leurs Serments attiseraient au lancement, par héros (#237, S8). */
  readonly kindled?: Readonly<Record<HeroKind, readonly PowerKind[]>>;
  /** Les lignes des Serments des pouvoirs équipés, par héros (#237, S8, S9). */
  readonly oathLines?: Readonly<Record<HeroKind, readonly HeroOathLine[]>>;
  /** Les pouvoirs possédés de chaque héros (#236) : le lien « Changer les pouvoirs » à partir de 4. */
  readonly owned?: Readonly<Record<HeroKind, readonly PowerKind[]>>;
  /** Ouvre le menu des pouvoirs sur l'onglet du héros choisi (#270, H2, M13). */
  readonly onChangePowers?: (hero: HeroKind) => void;
  /** Le choix s'enregistre : « Continuer » attend (#236). */
  readonly starting?: boolean;
  /** L'enregistrement du choix a échoué : le message, et « Réessayer » (#236). */
  readonly failed?: boolean;
}) {
  const [hero, setHero] = useState<HeroKind>('sentinel');
  const powersOf = (kind: HeroKind) => equipped?.[kind] ?? [basePower(kind)];
  const canChange =
    onChangePowers !== undefined && (owned?.[hero] ?? []).length > EQUIPPED_POWER_SLOTS;
  return (
    <Screen layout="top" background={roles.night} testID="hero-choice">
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retour"
          onPress={onClose}
          style={styles.back}
        >
          <PixelIcon name="left" color={roles.light} />
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <View accessibilityRole="radiogroup" style={styles.options}>
          {HERO_KINDS.map((kind) => (
            <HeroOption
              key={kind}
              kind={kind}
              powers={powersOf(kind)}
              kindled={kindled?.[kind] ?? []}
              oathLines={oathLines?.[kind] ?? []}
              checked={kind === hero}
              onPress={() => setHero(kind)}
            />
          ))}
        </View>
        {failed ? (
          <View accessible role="alert" style={[styles.error, { borderWidth: LINE }]}>
            <Text style={styles.errorText}>{LAUNCH_ERROR}</Text>
          </View>
        ) : null}
      </ScrollView>
      <View style={styles.footer}>
        {canChange ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={changePowersLinkLabel(hero)}
            onPress={() => onChangePowers?.(hero)}
            testID="hero-choice-change-powers"
            style={styles.link}
          >
            <Text style={styles.linkText}>{CHANGE_POWERS}</Text>
          </Pressable>
        ) : null}
        <Text style={styles.note}>{note}</Text>
        <PixelButton
          label={failed ? 'Réessayer' : confirmLabel(hero)}
          onPress={() => onStart(hero)}
          disabled={starting}
          testID="hero-choice-start"
        />
      </View>
    </Screen>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 56, paddingHorizontal: 8 },
  back: {
    width: MIN_TARGET_SIZE,
    height: MIN_TARGET_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: roles.light, fontFamily: pixelFont, fontSize: 22, lineHeight: 26 },
  body: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  options: { gap: 12 },
  card: { padding: 12, gap: 4 },
  name: { color: roles.light, fontFamily: pixelFont, fontSize: 20, lineHeight: 24 },
  checkedName: { color: roles.gold },
  style: { color: roles.parchment, fontFamily: textFont.semiBold, fontSize: 13 },
  stats: { color: roles.light, fontFamily: textFont.semiBold, fontSize: 13 },
  line: { color: roles.parchment, fontFamily: textFont.medium, fontSize: 13, lineHeight: 18 },
  oathLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 2 },
  oathText: {
    flex: 1,
    color: roles.light,
    fontFamily: textFont.medium,
    fontSize: 12.5,
    lineHeight: 17,
  },
  oathMuted: { color: roles.parchment },
  small: { color: roles.muted, fontFamily: textFont.regular, fontSize: 12, lineHeight: 16 },
  tick: { position: 'absolute', right: 8, top: 8 },
  note: {
    color: roles.muted,
    fontFamily: textFont.regular,
    fontSize: 13,
    textAlign: 'center',
  },
  footer: { gap: 8, paddingHorizontal: 16, paddingBottom: 34, paddingTop: 8 },
  link: { minHeight: MIN_TARGET_SIZE, alignItems: 'center', justifyContent: 'center' },
  linkText: {
    color: roles.parchment,
    fontFamily: textFont.semiBold,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  error: { padding: 10, borderColor: roles.curse, backgroundColor: roles.errorBg },
  errorText: { fontFamily: textFont.medium, fontSize: 13, lineHeight: 18, color: roles.pink },
});
// Stryker restore all
