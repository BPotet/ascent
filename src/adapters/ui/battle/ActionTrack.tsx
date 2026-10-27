import { StyleSheet, Text, View } from 'react-native';

import type { Actor } from '../../../domain/battle/actionOrder';
import type { EnemyKind } from '../../../domain/battle/combatants';
import { ENEMY_NAMES, actionTrackLabel } from '../format/battleText';
import { artPalette } from '../pixelArt/artPalette';
import { textFont } from '../pixelArt/pixelTypography';
import type { ActionTrackView } from '../state/battleView';

const { roles } = artPalette;

/** Ce qu'une case montre : « Toi » pour le héros, l'initiale d'un ennemi (portraits à venir). */
function caption(actor: Actor, enemies: readonly EnemyKind[]): string {
  return actor === 'hero' ? 'Toi' : ENEMY_NAMES[enemies[actor]!].charAt(0);
}

function Portrait({
  actor,
  enemies,
  current = false,
  next = false,
}: {
  readonly actor: Actor;
  readonly enemies: readonly EnemyKind[];
  readonly current?: boolean;
  readonly next?: boolean;
}) {
  return (
    <View
      style={[
        styles.portrait,
        actor === 'hero' && styles.hero,
        current && styles.current,
        next && styles.next,
      ]}
    >
      <Text style={[styles.initial, actor === 'hero' && styles.heroInitial]}>
        {caption(actor, enemies)}
      </Text>
    </View>
  );
}

/**
 * La frise d'action (prototype #90, maquette F2, F6) : qui agit et quand, jamais quoi. Le
 * combattant en cours en grand, puis ceux qui n'ont pas encore agi, puis « suiv. » et l'aperçu de
 * la manche suivante. Sans chiffre d'Initiative ; elle est lue en une phrase.
 */
export function ActionTrack({
  track,
  enemies,
}: {
  readonly track: ActionTrackView;
  readonly enemies: readonly EnemyKind[];
}) {
  return (
    <View
      accessible
      accessibilityLabel={actionTrackLabel(track.round, track.current, track.next, enemies)}
      testID="battle-action-track"
      style={styles.track}
    >
      {track.current.map((actor, index) => (
        <Portrait key={`current-${actor}`} actor={actor} enemies={enemies} current={index === 0} />
      ))}
      {track.next.length === 0 ? null : <Text style={styles.separator}>suiv.</Text>}
      {track.next.map((actor) => (
        <Portrait key={`next-${actor}`} actor={actor} enemies={enemies} next />
      ))}
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 48,
    paddingHorizontal: 16,
    paddingBottom: 6,
    overflow: 'hidden',
  },
  portrait: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: roles.surface,
    borderWidth: 2,
    borderColor: roles.line,
  },
  hero: { borderColor: roles.gold },
  current: {
    width: 38,
    height: 38,
    marginHorizontal: 2,
    backgroundColor: roles.raised,
    borderColor: roles.gold,
  },
  next: { opacity: 0.45 },
  initial: { color: roles.light, fontFamily: textFont.bold, fontSize: 14 },
  heroInitial: { color: roles.gold, fontSize: 11 },
  separator: {
    alignSelf: 'stretch',
    textAlignVertical: 'center',
    paddingTop: 10,
    paddingLeft: 6,
    marginHorizontal: 2,
    borderLeftWidth: 2,
    borderLeftColor: roles.line,
    color: roles.muted,
    fontFamily: textFont.semiBold,
    fontSize: 11,
  },
});
// Stryker restore all
