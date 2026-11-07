import type { PowerKind } from '../../../domain/battle/powers';
import { assetSprite } from '../pixelArt/sprites/atelier/fullAnimation';
import { POWER_ICONS } from '../pixelArt/sprites/atelier/data/powerIcons';
import { toPixelImage } from '../pixelArt/sprites/Sprite';
import { SpriteCanvas } from '../pixelArt/SpriteCanvas';

/**
 * L'icône d'un pouvoir (#235), 16 × 16, à une échelle entière : ×1 sur une étiquette, ×2 sur une
 * touche, ×3 dans l'arbre, ×4 dans la fiche. Éteinte (en gris) pour un nœud verrouillé. Toujours
 * cachée au lecteur d'écran : le texte à côté porte le sens.
 */
export function PowerIcon({
  power,
  scale,
  off = false,
  saturation,
  testID,
}: {
  readonly power: PowerKind;
  readonly scale: 1 | 2 | 3 | 4;
  readonly off?: boolean;
  /** La saturation (0 : gris, 1 : intacte), pour une icône qui s'allume ; sinon selon `off`. */
  readonly saturation?: number;
  readonly testID?: string;
}) {
  return (
    <SpriteCanvas
      sprite={`power-icon:${power}`}
      draw={() => toPixelImage(assetSprite(POWER_ICONS[power]))}
      scale={scale}
      saturation={saturation ?? (off ? 0 : 1)}
      testID={testID ?? `power-icon-${power}`}
    />
  );
}
