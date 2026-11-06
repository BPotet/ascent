import { StyleSheet, View } from 'react-native';

import { artPalette } from '../pixelArt/artPalette';
import { type ArtScale, artPixelSize } from '../pixelArt/artPixel';
import { assetSprite, type AssetImage } from '../pixelArt/sprites/atelier/fullAnimation';
import { toPixelImage } from '../pixelArt/sprites/Sprite';
import { SpriteCanvas } from '../pixelArt/SpriteCanvas';

const { roles } = artPalette;

export interface ChestStageProps {
  /** Le nom de la scène, qui nomme ses deux sprites : `chest-closed`, `chest-open`. */
  readonly name: string;
  readonly closed: AssetImage;
  readonly open: AssetImage;
  readonly scale: ArtScale;
  /** Le coffre ouvert, ou encore fermé. */
  readonly opened: boolean;
  /** Le décalage du coffre qui tremble, en pixels d'art (0 : immobile). */
  readonly shake: number;
  /** La lueur d'or derrière le coffre, de 0 (éteinte) à 1. */
  readonly glow: number;
}

/**
 * La scène d'un coffre (#227) : le coffre fermé ou ouvert, décalé quand il tremble, et une lueur
 * d'or derrière lui. Sans frise propre : l'écran qui l'utilise la mène (le Coffre, ou le coffre
 * scellé de #226, avec ses images). Décorative : le lecteur d'écran et les touchers l'ignorent.
 */
export function ChestStage({ name, closed, open, scale, opened, shake, glow }: ChestStageProps) {
  const pixel = artPixelSize(scale);
  const image = opened ? open : closed;
  const width = image.w * pixel;
  const height = image.h * pixel;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      testID="chest-stage"
      style={[styles.stage, { width, height, transform: [{ translateX: shake * pixel }] }]}
    >
      <View
        testID="chest-glow"
        style={[
          styles.glow,
          {
            left: -width / 4,
            right: -width / 4,
            top: -height / 2,
            bottom: height / 10,
            opacity: glow,
          },
        ]}
      >
        <View testID="chest-glow-tint" style={styles.glowTint} />
      </View>
      {opened ? (
        <SpriteCanvas
          sprite={`${name}-open`}
          draw={() => toPixelImage(assetSprite(open))}
          scale={scale}
          testID="chest-open"
        />
      ) : (
        <SpriteCanvas
          sprite={`${name}-closed`}
          draw={() => toPixelImage(assetSprite(closed))}
          scale={scale}
          testID="chest-closed"
        />
      )}
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  stage: { alignSelf: 'center' },
  glow: { position: 'absolute' },
  glowTint: { flex: 1, borderRadius: 9999, backgroundColor: roles.gold, opacity: 0.4 },
});
// Stryker restore all
