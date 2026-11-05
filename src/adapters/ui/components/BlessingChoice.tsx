import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { BlessingFamily, StartingBlessing } from '../../../domain/ascent/blessings';
import type { Rarity } from '../../../domain/ascent/rarity';
import {
  blessingCard,
  blessingChip,
  startingBlessingsLabel,
  takenBlessingsHeading,
} from '../format/ascentText';
import { artPalette } from '../pixelArt/artPalette';
import { PixelButton } from '../pixelArt/PixelButton';
import { pixelFont, pixelTypography, textFont } from '../pixelArt/pixelTypography';
import { blessingIcon } from '../pixelArt/sprites/gameIcons';
import { IconWell, RARITY_COLORS } from './IconWell';
import { LoadoutChipGrid, LoadoutHeading } from './LoadoutChip';

const { roles } = artPalette;

/** Le bouton d'une bénédiction : son écrin, puis le nom de sa famille, sa rareté et son effet. */
function BlessingButton({
  family,
  rarity,
  index,
  onChoose,
}: {
  readonly family: BlessingFamily;
  readonly rarity: Rarity;
  readonly index: number;
  readonly onChoose: (index: number) => void;
}) {
  const card = blessingCard({ family, rarity });
  return (
    <PixelButton
      label={card.label}
      variant="secondary"
      testID={`blessing-${index}`}
      onPress={() => onChoose(index)}
      style={styles.button}
    >
      <IconWell icon={blessingIcon(family)} rarity={rarity} size="card" />
      <View style={styles.stack}>
        <Text style={styles.name}>{card.name}</Text>
        <Text style={[styles.rarity, { color: RARITY_COLORS[rarity] }]}>{card.rarityLine}</Text>
        <Text style={styles.effect}>{card.effect}</Text>
      </View>
    </PixelButton>
  );
}

/** Les bénédictions déjà choisies, en pastilles dans l'ordre du choix, sous « Déjà choisie ». */
function TakenBlessings({
  taken,
  total,
}: {
  readonly taken: readonly StartingBlessing[];
  readonly total: number;
}) {
  const title = takenBlessingsHeading(taken.length);
  const count = `${taken.length} sur ${total}`;
  return (
    <View testID="blessing-taken" style={styles.taken}>
      <LoadoutHeading title={title} count={count} label={`${title}, ${count}`} />
      <LoadoutChipGrid
        label={startingBlessingsLabel(taken)}
        chips={taken.map((blessing) => ({
          key: blessing.family,
          icon: blessingIcon(blessing.family),
          ...blessingChip(blessing),
        }))}
      />
    </View>
  );
}

/**
 * Le choix d'une bénédiction de départ (#158) : « Bénédiction N sur M », trois boutons à icône (un
 * toucher choisit, sans confirmation), puis en bas les bénédictions déjà choisies, s'il y en a.
 */
export function BlessingChoice({
  offer,
  rarity,
  taken,
  total,
  onChoose,
}: {
  readonly offer: readonly BlessingFamily[];
  readonly rarity: Rarity;
  readonly taken: readonly StartingBlessing[];
  readonly total: number;
  readonly onChoose: (index: number) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>
        {`Bénédiction ${taken.length + 1} sur ${total}`}
      </Text>
      <Text style={styles.line}>Choisis-en une. Elle dure toute l&apos;ascension.</Text>
      {offer.map((family, index) => (
        <BlessingButton
          key={family}
          family={family}
          rarity={rarity}
          index={index}
          onChoose={onChoose}
        />
      ))}
      {taken.length > 0 && (
        <>
          <View style={styles.spacer} />
          <TakenBlessings taken={taken} total={total} />
        </>
      )}
    </ScrollView>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 30, gap: 12 },
  title: {
    fontFamily: pixelFont,
    fontSize: 22,
    lineHeight: 26,
    color: roles.light,
    textAlign: 'center',
  },
  line: { ...pixelTypography.body, color: roles.parchment, textAlign: 'center' },
  button: {
    minHeight: 72,
    justifyContent: 'flex-start',
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 8,
    paddingRight: 14,
    gap: 12,
  },
  stack: { flex: 1, gap: 1 },
  name: { fontFamily: pixelFont, fontSize: 18, lineHeight: 22, color: roles.light },
  rarity: { fontFamily: textFont.bold, fontSize: 12, lineHeight: 16 },
  effect: {
    fontFamily: textFont.medium,
    fontSize: 13,
    lineHeight: 18,
    color: roles.light,
    opacity: 0.9,
  },
  spacer: { flex: 1 },
  taken: { gap: 6 },
});
// Stryker restore all
