import { View } from 'react-native';

import { artPalette } from '../pixelArt/artPalette';
import { artPixelSize } from '../pixelArt/artPixel';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { useArtFrames } from '../pixelArt/useArtFrames';

/** Les images d'un vacillement : deux pas, chacun tenu 4 images (un tiers de seconde). */
const FLICKER_FRAMES = 8;

/**
 * La flamme d'un pouvoir attisé (#237, maquette 232) : de braise, elle vacille en deux pas, d'un
 * pixel d'art ; immobile en mouvement réduit. Décorative : un mot ou une annonce dit « attisé ».
 */
export function KindledFlame({ testID }: { readonly testID?: string }) {
  const frame = useArtFrames(FLICKER_FRAMES, { loop: true });
  const lifted = frame < FLICKER_FRAMES / 2;
  return (
    <View testID={testID} style={{ transform: [{ translateY: lifted ? -artPixelSize(1) : 0 }] }}>
      <PixelIcon name="kindled8" color={artPalette.roles.ember} />
    </View>
  );
}
