import { StyleSheet, View } from 'react-native';

/**
 * Des hachures à 45° (maquette 278, `repeating-linear-gradient(135deg, …)`) : celles d'une entrée
 * « ??? » du carnet et de la part rencontrée de la barre d'un palier. Décoratives.
 */
export function Hatching({
  color,
  count,
  step,
}: {
  readonly color: string;
  readonly count: number;
  readonly step: number;
}) {
  return (
    <View pointerEvents="none" style={styles.hatching}>
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={[styles.hatch, { left: index * step, backgroundColor: color }]} />
      ))}
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  hatching: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  hatch: {
    position: 'absolute',
    top: -40,
    bottom: -40,
    width: 2,
    transform: [{ rotate: '45deg' }],
  },
});
// Stryker restore all
