import { type StyleProp, View, type ViewStyle } from 'react-native';

import { artPalette } from './artPalette';
import { artPixelSize } from './artPixel';
import { type IconName, type IconRows, ICONS } from './sprites/icons';

/** Une suite horizontale de pixels de même couleur. */
interface Run {
  readonly x: number;
  readonly y: number;
  readonly length: number;
  readonly code: string;
}

/** Les suites de pixels de même code de `rows`, ligne par ligne. */
function runsOf(rows: IconRows): Run[] {
  const runs: Run[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const code = row.charAt(x);
      let end = x + 1;
      while (end < row.length && row.charAt(end) === code) {
        end += 1;
      }
      if (code !== '.') {
        runs.push({ x, y, length: end - x, code });
      }
      x = end;
    }
  });
  return runs;
}

/**
 * Des lignes de pixels d'art (`X` couleur, `Y` seconde couleur, `k` encre), dessinées à ×2 : une
 * `View` par suite de pixels de même couleur. Décoratives : le lecteur d'écran ne les lit pas.
 */
export function PixelRows({
  rows,
  color,
  secondColor = color,
  style,
  testID,
}: {
  readonly rows: IconRows;
  readonly color: string;
  readonly secondColor?: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}) {
  const size = artPixelSize(2);
  const colors: Readonly<Record<string, string>> = {
    X: color,
    Y: secondColor,
    k: artPalette.roles.ink,
  };
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      testID={testID}
      style={[{ width: (rows[0]?.length ?? 0) * size, height: rows.length * size }, style]}
    >
      {runsOf(rows).map(({ x, y, length, code }) => (
        <View
          key={`${x}-${y}`}
          style={{
            position: 'absolute',
            left: x * size,
            top: y * size,
            width: length * size,
            height: size,
            backgroundColor: colors[code],
          }}
        />
      ))}
    </View>
  );
}

/**
 * Une icône de l'identité pixel art, par son nom : 16 dp (8 × 8 pixels d'art) ou 24 dp (12 × 12).
 * Décorative : elle accompagne toujours un libellé ou une annonce.
 */
export function PixelIcon({
  name,
  color,
  secondColor,
  style,
  testID,
}: {
  readonly name: IconName;
  readonly color: string;
  readonly secondColor?: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}) {
  return (
    <PixelRows
      rows={ICONS[name]}
      color={color}
      {...(secondColor !== undefined && { secondColor })}
      {...(style !== undefined && { style })}
      {...(testID !== undefined && { testID })}
    />
  );
}
