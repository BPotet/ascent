import { useEffect, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { formatXp, formatXpChange } from '../format/formatXp';
import { artPalette } from '../pixelArt/artPalette';
import { artPixelSize } from '../pixelArt/artPixel';
import { PixelFrame } from '../pixelArt/PixelFrame';
import { pixelTypography } from '../pixelArt/pixelTypography';
import { type CharacterFrame, characterSprite } from '../pixelArt/sprites/characterSprite';
import { paintDaySky } from '../pixelArt/sprites/paintDaySky';
import { toPixelImage } from '../pixelArt/sprites/Sprite';
import { SpriteCanvas } from '../pixelArt/SpriteCanvas';
import { useArtFrames } from '../pixelArt/useArtFrames';
import { useDaySky } from '../state/useDaySky';
import { useReducedMotion } from '../state/useReducedMotion';
import { type ShownXpChange, TARGET_BONUS_DELAY_MS } from '../state/xpFeedback';

const { roles } = artPalette;

/** Le pixel d'art, arrondi au pixel physique du téléphone (traits, crans, pas des envols). */
const LINE = artPixelSize(2);

/** Le libellé de l'expérience dans l'en-tête, lu aussi par le lecteur d'écran. */
export const CHARACTER_XP_LABEL = 'Expérience du personnage';

/** La hauteur de l'en-tête : 132 dp dans la Vue Journée, 92 dp (`compact`) ailleurs. */
const HEIGHT = 132;
const COMPACT_HEIGHT = 92;

/** Les images de l'arrivée d'une pastille : elle monte de 6 dp par pas de 2 dp. */
const PILL_FRAMES = 4;

/** La part du suivi et celle de la prime d'un changement. */
function sharesOf({ amount, bonus = 0 }: ShownXpChange): {
  readonly checkIn: number;
  readonly bonus: number;
} {
  return { checkIn: amount - bonus, bonus };
}

/** Le personnage : au repos, ou la lanterne levée au lever du soleil (maquette, « Toutes faites »). */
const characterFrameOf = (light: number): CharacterFrame => (light === 1 ? 2 : 0);

/**
 * Une pastille d'expérience (`XpChangePill`) : « +10 XP » sur l'or, « +30 XP prime » sur la lumière
 * vive, « −10 XP » en gris, en police pixel 18. Elle monte de 6 dp par pas de 2 dp, à 12 images par
 * seconde ; en mouvement réduit, elle est tout de suite en place. Décorative : le changement est
 * annoncé par `Experience`.
 */
function XpChangePill({
  amount,
  bonus = false,
}: {
  readonly amount: number;
  readonly bonus?: boolean;
}) {
  const frame = useArtFrames(PILL_FRAMES);
  const gain = amount > 0;
  const text = bonus ? `${formatXpChange(amount)} prime` : formatXpChange(amount);
  const background = bonus ? roles.light : roles.gold;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      testID={bonus ? 'xp-change-bonus' : 'xp-change'}
      style={[
        styles.pill,
        { backgroundColor: gain ? background : roles.raised },
        { transform: [{ translateY: (PILL_FRAMES - 1 - frame) * LINE }] },
      ]}
    >
      <Text style={[pixelTypography.xpChange, { color: gain ? roles.ink : roles.parchment }]}>
        {text}
      </Text>
    </View>
  );
}

/**
 * Les pastilles d'un changement : celle du suivi, s'il y en a une, puis celle de la prime d'objectif,
 * `TARGET_BONUS_DELAY_MS` après un gain du suivi (F1), en même temps sinon ou en mouvement réduit.
 */
function XpChangePills({ change }: { readonly change: ShownXpChange }) {
  const reducedMotion = useReducedMotion();
  const { checkIn, bonus } = sharesOf(change);
  const delayed = checkIn > 0 && bonus > 0 && !reducedMotion;
  const [waited, setWaited] = useState(false);
  const bonusShown = !delayed || waited;

  useEffect(() => {
    if (!delayed) {
      return;
    }
    const timer = setTimeout(() => setWaited(true), TARGET_BONUS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [delayed]);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      testID="xp-change-pills"
      style={styles.pills}
    >
      {checkIn !== 0 && <XpChangePill amount={checkIn} />}
      {bonus !== 0 && bonusShown && <XpChangePill amount={bonus} bonus />}
    </View>
  );
}

/**
 * La plaque de l'expérience, en cadre cranté : « Expérience du personnage » en police de texte,
 * « 340 XP » en police pixel. Après un gain (`gainId`), son trait s'allume une image en or ; jamais
 * en mouvement réduit.
 */
function XpPlate({
  xp,
  gainId,
  change,
}: {
  readonly xp: number;
  readonly gainId: number | null;
  readonly change: ShownXpChange | null;
}) {
  const frame = useArtFrames(2, { play: gainId !== null });
  const flash = gainId !== null && frame === 0;
  return (
    <PixelFrame
      tone={flash ? 'gold' : 'default'}
      background={roles.plate}
      under="transparent"
      testID="character-plate"
      style={styles.plate}
    >
      <View testID="character-bar-texts" style={styles.texts}>
        <Text style={[pixelTypography.label, styles.label]}>{CHARACTER_XP_LABEL}</Text>
        <View testID="xp-row" style={styles.xpRow}>
          <Text testID="xp-counter" style={[pixelTypography.gameNumber, styles.xp]}>
            {formatXp(xp)}
          </Text>
          {change !== null && <XpChangePills key={change.id} change={change} />}
        </View>
      </View>
    </PixelFrame>
  );
}

/**
 * L'en-tête du personnage (`CharacterBar`), en haut de la Vue Journée, de la Vue Semaine et de la
 * Vue Mois (R24, #72) : le personnage en pixels (×2, la lanterne levée au lever du soleil), devant le ciel du jour (`useDaySky`) et la
 * tour au loin, et l'expérience totale, « 340 XP ». Ni niveau, ni jauge d'expérience. Le lecteur
 * d'écran ignore le personnage, le ciel et la tour, et lit « Expérience du personnage : 340 XP »,
 * toujours la nouvelle valeur.
 *
 * Après un changement (`change`), l'expérience passe directement à la nouvelle valeur, et une
 * pastille d'expérience « +10 XP » (or) ou « −10 XP » (gris) apparaît à côté d'elle ; une prime d'objectif
 * (`change.bonus`, #26) a sa seconde pastille, « +30 XP prime », 0,4 s après (F1). Pour un gain, le
 * trait de la plaque s'allume une image en or. En mouvement réduit, tout est tout de suite en place.
 *
 * `compact` : l'en-tête plus bas de la Vue Semaine et de la Vue Mois. Il grandit avec son texte, et
 * le ciel est repeint à sa hauteur. `xp` vaut `null` tant que l'expérience n'est pas lue : la plaque
 * garde sa place, sans valeur.
 */
export function CharacterBar({
  xp,
  change,
  compact = false,
}: {
  readonly xp: number | null;
  readonly change: ShownXpChange | null;
  readonly compact?: boolean;
}) {
  const { light } = useDaySky();
  const { width } = useWindowDimensions();
  const minHeight = compact ? COMPACT_HEIGHT : HEIGHT;
  const [height, setHeight] = useState(minHeight);
  const pixel = artPixelSize(2);
  const columns = Math.ceil(width / pixel);
  const rows = Math.ceil(Math.max(minHeight, height) / pixel);
  const frame = characterFrameOf(light);
  const gainId = change !== null && sharesOf(change).checkIn > 0 ? change.id : null;

  const measure = ({ nativeEvent }: LayoutChangeEvent) =>
    setHeight(Math.round(nativeEvent.layout.height));

  const decor = (
    <>
      <SpriteCanvas
        sprite={`day-sky:${light}:${columns}x${rows}`}
        draw={() => paintDaySky(columns, rows, light)}
        scale={2}
        testID="day-sky"
        style={styles.sky}
      />
      <SpriteCanvas
        sprite={`character-${frame}`}
        draw={() => toPixelImage(characterSprite(frame))}
        scale={2}
        testID="character-sprite"
        style={styles.character}
      />
    </>
  );

  if (xp === null) {
    return (
      <View onLayout={measure} style={[styles.bar, { minHeight }]}>
        {decor}
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          testID="character-bar-loading"
          style={styles.loadingPlate}
        />
      </View>
    );
  }
  return (
    <View onLayout={measure} style={[styles.bar, { minHeight }]}>
      {decor}
      <View
        accessible
        accessibilityLabel={`${CHARACTER_XP_LABEL} : ${formatXp(xp)}`}
        testID="character-bar"
        style={[styles.content, { minHeight }]}
      >
        <XpPlate key={gainId ?? 'still'} xp={xp} gainId={gainId} change={change} />
      </View>
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  bar: { overflow: 'hidden', justifyContent: 'flex-end' },
  sky: { position: 'absolute', left: 0, top: 0 },
  character: { position: 'absolute', left: 18, bottom: 6 },
  content: { justifyContent: 'flex-end', paddingLeft: 74, paddingRight: 16, paddingBottom: 10 },
  plate: { paddingTop: 8, paddingBottom: 9, paddingHorizontal: 12 },
  loadingPlate: {
    marginLeft: 74,
    marginRight: 16,
    marginBottom: 10,
    height: 56,
    backgroundColor: roles.plate,
  },
  // Le libellé peut passer à la ligne, jamais les pastilles : elles gardent leur largeur.
  texts: { flexShrink: 1, minWidth: 0, gap: 5 },
  label: { color: roles.parchment, fontSize: 12, lineHeight: 15 },
  xp: { color: roles.light },
  // Les pastilles, près de l'expérience (F1-2) : à sa droite, ou dessous en grand texte.
  xpRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 4 },
  pills: { flexShrink: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  pill: { paddingTop: 5, paddingBottom: 4, paddingHorizontal: 8 },
});
// Stryker restore all
