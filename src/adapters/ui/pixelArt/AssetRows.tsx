import { type StyleProp, View, type ViewStyle } from 'react-native';

import { runsOf } from './PixelIcon';
import { artPalette } from './artPalette';
import { artPixelSize, type ArtScale } from './artPixel';
import { tintCode, type AssetImage } from './sprites/atelier/fullAnimation';

/**
 * Une image recopiée de l'Atelier (`AssetImage`), dessinée par des `View` à l'échelle `scale` (#155,
 * avenant à l'ADR 0007 § 2) : une `View` par suite horizontale de pixels de même teinte, comme
 * `PixelRows`. Chaque teinte est celle de `artPalette` (`tintCode`, ADR 0010 § 3) : l'image n'est
 * ni redessinée ni recolorée. Décorative : le lecteur d'écran ne la lit pas.
 */
export function AssetRows({
  image,
  scale,
  style,
  testID,
}: {
  readonly image: AssetImage;
  readonly scale: ArtScale;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}) {
  const size = artPixelSize(scale);
  const colors = image.palette.map((tint) => artPalette.tints[tintCode(tint)]);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      testID={testID}
      style={[{ width: image.w * size, height: image.h * size }, style]}
    >
      {runsOf(image.rows).map(({ x, y, length, code }) => (
        <View
          key={`${x}-${y}`}
          style={{
            position: 'absolute',
            left: x * size,
            top: y * size,
            width: length * size,
            height: size,
            backgroundColor: colors[parseInt(code, 36)] ?? undefined,
          }}
        />
      ))}
    </View>
  );
}
