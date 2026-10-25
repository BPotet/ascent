import { type DimensionValue, View } from 'react-native';

import { artPalette } from './artPalette';
import { useArtFrames } from './useArtFrames';

/** Les paliers du clignotement, 4 images chacun ; le dernier, opaque, est l'état fixe. */
const STEPS = [0.78, 0.55, 0.78, 1] as const;
const FRAMES_PER_STEP = 4;

/**
 * Un bloc de squelette au pixel d'art (`PixelSkeleton`), qui réserve la place de ce qui charge. Il
 * clignote par paliers et reste fixe en mouvement réduit. Décoratif.
 */
export function PixelSkeleton({
  width,
  height,
  testID,
}: {
  readonly width: DimensionValue;
  readonly height: number;
  readonly testID?: string;
}) {
  const frame = useArtFrames(STEPS.length * FRAMES_PER_STEP, { loop: true });
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
      style={{
        width,
        height,
        backgroundColor: artPalette.roles.surface,
        opacity: STEPS[Math.floor(frame / FRAMES_PER_STEP)],
      }}
    />
  );
}
