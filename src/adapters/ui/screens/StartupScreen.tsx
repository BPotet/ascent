import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Screen } from '../components/Screen';
import { artPalette } from '../pixelArt/artPalette';
import { artPixelSize } from '../pixelArt/artPixel';
import { PixelButton } from '../pixelArt/PixelButton';
import { PixelFrame } from '../pixelArt/PixelFrame';
import { pixelTypography } from '../pixelArt/pixelTypography';
import { alertEmblem } from '../pixelArt/sprites/alertEmblem';
import { paintStartupSky } from '../pixelArt/sprites/paintDaySky';
import { toPixelImage } from '../pixelArt/sprites/Sprite';
import { SpriteCanvas } from '../pixelArt/SpriteCanvas';
import { useArtFrames } from '../pixelArt/useArtFrames';
import { useReducedMotion } from '../state/useReducedMotion';

const { roles } = artPalette;

/** Le pixel d'art, arrondi au pixel physique du téléphone (traits, crans, pas des envols). */
const LINE = artPixelSize(2);

// Stryker disable all: valeurs purement visuelles, vérifiées par la conformité aux maquettes (barrière 10 bis).
/** Les trois carrés du chargement, et leur couleur quand ils sont fixes (mouvement réduit). */
const SQUARES = [roles.gold, roles.goldDark, roles.dusk] as const;
// Stryker restore all
/** Chaque carré reste allumé 4 images (1/3 s). */
const FRAMES_PER_SQUARE = 4;

/** Le ciel du démarrage : la grande tour dans la nuit, à la taille de l'écran. Décoratif. */
function StartupSky() {
  const { width, height } = useWindowDimensions();
  const pixel = artPixelSize(2);
  const columns = Math.ceil(width / pixel);
  const rows = Math.ceil(height / pixel);
  return (
    <SpriteCanvas
      sprite={`startup-sky:${columns}x${rows}`}
      draw={() => paintStartupSky(columns, rows)}
      scale={2}
      testID="startup-sky"
      style={styles.sky}
    />
  );
}

/** Trois carrés qui s'allument tour à tour, à 12 images par seconde ; fixes en mouvement réduit. */
function LoadingSquares() {
  const reducedMotion = useReducedMotion();
  const frame = useArtFrames(SQUARES.length * FRAMES_PER_SQUARE, { loop: true });
  const current = Math.floor(frame / FRAMES_PER_SQUARE);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Chargement"
      style={styles.squares}
    >
      {SQUARES.map((color, index) => {
        const lit = reducedMotion || index === current;
        return (
          <View
            key={color}
            testID={`startup-square-${index}${lit ? '-lit' : ''}`}
            style={[
              styles.square,
              { backgroundColor: reducedMotion ? color : lit ? roles.gold : roles.raised },
            ]}
          />
        );
      })}
    </View>
  );
}

/**
 * Pendant l'ouverture des données du téléphone (E6) : la tour dans la nuit, le titre « Ascent » en
 * police pixel et trois carrés qui s'allument tour à tour. Le titre n'apparaît qu'une fois les
 * polices chargées (`titleShown`, vrai par défaut) : jamais d'abord dans la police du système.
 */
export function StartupLoadingScreen({ titleShown = true }: { readonly titleShown?: boolean }) {
  return (
    <Screen testID="startup-loading" background={roles.night}>
      <StartupSky />
      <View style={styles.content}>
        {titleShown && <Text style={[pixelTypography.appTitle, styles.title]}>Ascent</Text>}
        <LoadingSquares />
      </View>
    </Screen>
  );
}

/**
 * Quand les données du téléphone n'ont pas pu être ouvertes (E6) : l'emblème d'alerte, le libellé
 * en police de texte et « Réessayer ». Rien n'est effacé.
 */
export function StartupErrorScreen({ onRetry }: { readonly onRetry: () => void }) {
  return (
    <Screen testID="startup-error" background={roles.night}>
      <StartupSky />
      <View style={styles.content}>
        <SpriteCanvas
          sprite="alert-emblem"
          draw={() => toPixelImage(alertEmblem())}
          scale={2}
          testID="startup-emblem"
        />
        <PixelFrame background="rgba(16,19,31,0.94)" style={styles.panel}>
          <Text accessibilityRole="alert" style={styles.message}>
            Impossible d’ouvrir les données enregistrées sur le téléphone.
          </Text>
          <PixelButton label="Réessayer" onPress={onRetry} style={styles.retry} />
        </PixelFrame>
      </View>
    </Screen>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  sky: { position: 'absolute', left: 0, top: 0 },
  content: { alignItems: 'center', gap: 14, paddingHorizontal: 28 },
  title: {
    color: roles.gold,
    textAlign: 'center',
    textShadowColor: roles.ink,
    textShadowOffset: { width: 2 * LINE, height: 2 * LINE },
    textShadowRadius: 0,
  },
  squares: { flexDirection: 'row', gap: 6 },
  square: { width: 8, height: 8 },
  panel: {
    alignItems: 'center',
    gap: 12,
    paddingTop: 16,
    paddingBottom: 18,
    paddingHorizontal: 16,
  },
  message: { ...pixelTypography.habitName, color: roles.light, textAlign: 'center' },
  retry: { minWidth: 180 },
});
// Stryker restore all
