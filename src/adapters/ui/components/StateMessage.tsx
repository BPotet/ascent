import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { artPalette } from '../pixelArt/artPalette';
import { pixelTypography } from '../pixelArt/pixelTypography';
import { alertEmblem } from '../pixelArt/sprites/alertEmblem';
import { characterSprite } from '../pixelArt/sprites/characterSprite';
import { toPixelImage } from '../pixelArt/sprites/Sprite';
import { SpriteCanvas } from '../pixelArt/SpriteCanvas';

// Stryker disable all: illustrations purement visuelles, vérifiées par la conformité aux maquettes.
/**
 * Les illustrations des états, dessinées par le code : le personnage qui attend, à ×3 (vide), et
 * l'emblème d'alerte, à ×2 (erreur).
 */
const illustrations = {
  character: { sprite: 'character-0', draw: () => toPixelImage(characterSprite(0)), scale: 3 },
  alert: { sprite: 'alert-emblem', draw: () => toPixelImage(alertEmblem()), scale: 2 },
} as const;
// Stryker restore all

export type Illustration = keyof typeof illustrations;

/**
 * État plein écran d'une vue (vide, erreur), dans l'identité pixel art : une illustration, un titre
 * en police pixel, une explication en police de texte et une seule action. `alert` fait annoncer
 * l'état au lecteur d'écran (erreur). L'illustration est décorative.
 */
export function StateMessage({
  illustration,
  title,
  text,
  action,
  alert = false,
  testID,
}: {
  readonly illustration: Illustration;
  readonly title: string;
  readonly text: string;
  readonly action: ReactNode;
  readonly alert?: boolean;
  readonly testID?: string;
}) {
  const { sprite, draw, scale } = illustrations[illustration];
  return (
    <View style={styles.state} testID={testID}>
      <SpriteCanvas
        sprite={sprite}
        draw={draw}
        scale={scale}
        testID={`illustration-${illustration}`}
      />
      <View
        accessible
        accessibilityRole={alert ? 'alert' : 'header'}
        accessibilityLiveRegion={alert ? 'assertive' : 'none'}
        accessibilityLabel={`${title} ${text}`}
        style={styles.texts}
      >
        <Text style={[pixelTypography.stateTitle, styles.title]}>{title}</Text>
        <Text style={[pixelTypography.body, styles.text]}>{text}</Text>
      </View>
      {action}
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  state: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 120,
    gap: 12,
  },
  texts: { alignItems: 'center', gap: 12, maxWidth: 320 },
  title: { color: artPalette.roles.light, textAlign: 'center' },
  text: { color: artPalette.roles.parchment, textAlign: 'center' },
});
// Stryker restore all
