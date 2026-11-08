import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import type { EnemyKind } from '../../../domain/battle/combatants';
import { ENEMY_NAMES, actionTrackLabel } from '../format/battleText';
import { artPalette } from '../pixelArt/artPalette';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { battleColors } from '../theme/battleColors';
import { textFont } from '../pixelArt/pixelTypography';
import { SpriteCanvas } from '../pixelArt/SpriteCanvas';
import { PORTRAITS } from '../pixelArt/sprites/atelier/data/portraits';
import { assetSprite, type AssetImage } from '../pixelArt/sprites/atelier/fullAnimation';
import { trackPortrait, type Fighter } from '../pixelArt/sprites/battle/portraits';
import { toPixelImage } from '../pixelArt/sprites/Sprite';
import type { ActionTrackView, TrackEntry } from '../state/battleView';
import { trackShade, type TrackShade } from './trackShade';
import {
  placeGhosts,
  trackTransition,
  type LeavingEntry,
  type TrackRow,
} from '../state/trackTransition';

const { roles } = artPalette;

/** La sortie d'un ennemi tombé : 400 ms en 4 paliers (maquette, `fpout`). */
export const TRACK_LEAVE_MS = 400;
const LEAVE_STEPS = 4;
/** L'entrée d'un renfort : 300 ms en 3 paliers (maquette, `fpin`). */
const ENTER_STEPS = 3;
const STEP_MS = 100;
/** Sous cette largeur d'écran, en dp, la frise resserre ses écarts (notes techniques de #175). */
const NARROW_SCREEN = 375;
/** L'écart entre les cases, en dp : 4, ou 2 sous 375 dp de large. */
const GAP = 4;
const NARROW_GAP = 2;

type Portraits = Readonly<Record<Fighter, AssetImage | null>>;

/** Ce qu'une case montre sans portrait : « Toi » pour le héros, l'initiale d'un ennemi. */
function caption({ actor, fighter }: TrackEntry): string {
  return actor === 'hero' ? 'Toi' : ENEMY_NAMES[fighter as EnemyKind].charAt(0);
}

/** La clé d'une case : un renfort à la place d'un ennemi tombé est une autre case. */
function entryKey({ actor, fighter }: TrackEntry): string {
  return `${actor}:${fighter}`;
}

/** Monte `value` de 0 à `steps`, un palier toutes les 100 ms (animation en paliers du pixel art). */
function stepUp(value: SharedValue<number>, steps: number): void {
  const ticks = Array.from({ length: steps }, (_, index) =>
    withDelay(STEP_MS, withTiming(index + 1, { duration: 0 })),
  );
  value.set(withSequence(withTiming(0, { duration: 0 }), ...ticks));
}

function Portrait({
  entry,
  current,
  saturation,
  portraits,
}: {
  readonly entry: TrackEntry;
  readonly current: boolean;
  /** La saturation du portrait ; seulement en phase ennemie (#188), sinon ses couleurs. */
  readonly saturation: number;
  readonly portraits: Portraits;
}) {
  const icon = trackPortrait(entry.fighter, entry.phase2, portraits);
  const hero = entry.actor === 'hero';
  if (icon === null) {
    return (
      <Text
        style={[
          styles.initial,
          current && styles.currentInitial,
          hero && styles.heroInitial,
          hero && current && styles.currentHeroInitial,
        ]}
      >
        {caption(entry)}
      </Text>
    );
  }
  const draw = () => toPixelImage(assetSprite(icon.image));
  const dimmed = saturation < 1 ? { saturation } : null;
  // Celui qui agit garde le pixel d'art entier (×2) ; les autres, la taille exacte de 24 dp.
  return current ? (
    <SpriteCanvas sprite={icon.sprite} draw={draw} scale={2} testID="track-portrait" />
  ) : (
    <SpriteCanvas sprite={icon.sprite} draw={draw} size={24} testID="track-portrait" {...dimmed} />
  );
}

/**
 * Une case de la frise : le portrait du combattant dans son cadre, sous son ombre (`shade`). Un
 * renfort (`enter`) y entre en 300 ms ; la case fantôme d'un ennemi tombé (`ghost`) grise puis se
 * referme en 400 ms. Les deux animations partent au montage de la case.
 */
function TrackCase({
  entry,
  current = false,
  shade,
  enemyPhase,
  enter = false,
  ghost = false,
  gap = GAP,
  portraits,
}: {
  readonly entry: TrackEntry;
  readonly current?: boolean;
  readonly shade: TrackShade;
  /** En phase ennemie, le voile couvre la case entière, son cadre compris (#188). */
  readonly enemyPhase: boolean;
  readonly enter?: boolean;
  readonly ghost?: boolean;
  /** L'écart entre les cases, que la case fantôme résorbe en se refermant. */
  readonly gap?: number;
  readonly portraits: Portraits;
}) {
  const [moving] = useState(enter || ghost);
  const step = useSharedValue(moving ? 0 : ENTER_STEPS);
  useEffect(() => {
    if (moving) stepUp(step, ghost ? LEAVE_STEPS : ENTER_STEPS);
  }, [moving, ghost, step]);
  // Dépendances explicites : le code instrumenté par Stryker n'est plus reconnu comme worklet.
  const motion = useAnimatedStyle(() => {
    'worklet';
    const at = step.get();
    if (ghost) {
      const closing = Math.max(0, at - 1) / (LEAVE_STEPS - 1);
      return {
        opacity: at === 0 ? 1 : 0.6 * (1 - closing),
        width: 30 * (1 - closing),
        marginRight: -gap * closing,
      };
    }
    const shown = at / ENTER_STEPS;
    return { opacity: shown, transform: [{ translateY: 6 * (shown - 1) }] };
  }, [step, ghost, gap]);
  const veil = useAnimatedStyle(() => {
    'worklet';
    return { opacity: step.get() > 0 ? 0.4 : 0 };
  }, [step]);
  const pending = entry.pending === true;
  return (
    <Animated.View
      testID={ghost ? 'track-ghost' : pending ? 'track-entry-pending' : 'track-entry'}
      style={[
        styles.entry,
        entry.actor === 'hero' && styles.hero,
        current && styles.current,
        ghost && styles.ghost,
        pending && styles.pending,
        entry.cursed === true && styles.cursed,
        motion,
      ]}
    >
      {current ? (
        <>
          <View pointerEvents="none" style={styles.outerRing} />
          <View pointerEvents="none" style={styles.innerRing} />
          <View pointerEvents="none" testID="track-current-arrow" style={styles.arrow} />
        </>
      ) : null}
      <Portrait
        entry={entry}
        current={current}
        saturation={shade.saturation}
        portraits={portraits}
      />
      {pending ? (
        <View pointerEvents="none" testID="track-pending-ring" style={styles.pendingRing} />
      ) : null}
      {entry.cursed === true ? (
        <View pointerEvents="none" testID="track-cursed-skull" style={styles.cursedSkull}>
          <PixelIcon name="skull" color={roles.pink} />
        </View>
      ) : null}
      {entry.crowned === true ? (
        // La couronne d'Élite (#257, maquette `.fp .bdg`) : en coin opposé au crâne du maudit (E6).
        <View pointerEvents="none" testID="track-crown" style={styles.crown}>
          <PixelIcon name="crown8" color={roles.rarityEpic} />
        </View>
      ) : null}
      {shade.veil > 0 ? (
        <View
          pointerEvents="none"
          testID="track-shade"
          // Un invoqué annoncé pâlit avec son contour en pointillé, en toute phase (#172).
          style={[
            styles.shade,
            (enemyPhase || pending) && styles.wholeShade,
            { opacity: shade.veil },
          ]}
        />
      ) : null}
      {ghost ? (
        <Animated.View
          pointerEvents="none"
          testID="track-ghost-veil"
          style={[styles.ghostVeil, veil]}
        />
      ) : null}
    </Animated.View>
  );
}

/** Une case qui sort de la frise, avec le numéro qui la distingue tant qu'elle est montrée. */
interface Ghost extends LeavingEntry {
  readonly id: number;
}

/** Une case fantôme, oubliée au bout de 400 ms ; son minuteur part avec elle. */
function GhostCase({
  ghost,
  gap,
  enemyPhase,
  portraits,
  onDone,
}: {
  readonly ghost: Ghost;
  readonly gap: number;
  readonly enemyPhase: boolean;
  readonly portraits: Portraits;
  readonly onDone: (id: number) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDone(ghost.id), TRACK_LEAVE_MS);
    return () => clearTimeout(timer);
  }, [ghost.id, onDone]);
  return (
    <TrackCase
      entry={ghost.entry}
      shade={trackShade(ghost.row, false, enemyPhase)}
      enemyPhase={enemyPhase}
      ghost
      gap={gap}
      portraits={portraits}
    />
  );
}

/** Ce que la frise montre : la frise reçue, ses cases fantômes et les renforts qui entrent. */
interface Shown {
  readonly track: ActionTrackView;
  readonly ghosts: readonly Ghost[];
  readonly entering: ReadonlySet<string>;
  readonly lastId: number;
}

/**
 * La frise d'action (prototype #90, maquette F2, F6 ; portraits #175, maquette v2 F1 à F5) : qui
 * agit et quand, jamais quoi. Le portrait du combattant en cours en grand (48 dp), puis ceux qui
 * n'ont pas encore agi (24 dp), puis « suiv. » et l'aperçu de la manche suivante. Sans chiffre
 * d'Initiative ; elle est lue en une phrase, sans les portraits. Un ennemi tombé grise et sa case se
 * referme, un renfort entre ; d'un coup avec « réduire les animations ». En phase ennemie
 * (`enemyPhase`, #188), toutes ses cases pâlissent sauf celle de celui qui agit, d'un coup.
 */
export function ActionTrack({
  track,
  reducedMotion = false,
  enemyPhase = false,
  portraits = PORTRAITS,
}: {
  readonly track: ActionTrackView;
  readonly reducedMotion?: boolean;
  readonly enemyPhase?: boolean;
  readonly portraits?: Portraits;
}) {
  const narrow = useWindowDimensions().width < NARROW_SCREEN;
  const [shown, setShown] = useState<Shown>({
    track,
    ghosts: [],
    entering: new Set(),
    lastId: 0,
  });
  let { ghosts, entering } = shown;
  if (shown.track !== track) {
    // État dérivé du rendu : la frise précédente dit qui sort et qui entre, sans image vide entre deux.
    const transition = trackTransition(shown.track, track);
    const leaving = reducedMotion ? [] : transition.leaving;
    ghosts = [
      ...shown.ghosts,
      ...leaving.map((place, index) => ({ ...place, id: shown.lastId + index + 1 })),
    ];
    entering = new Set(reducedMotion ? [] : transition.entering.map(entryKey));
    setShown({ track, ghosts, entering, lastId: shown.lastId + leaving.length });
  }
  const [forget] = useState(
    () => (id: number) =>
      setShown((state) => ({ ...state, ghosts: state.ghosts.filter((ghost) => ghost.id !== id) })),
  );
  const cases = (row: TrackRow) => {
    const rowGhosts = ghosts.filter((ghost) => ghost.row === row);
    const placed = placeGhosts(track[row], rowGhosts);
    // Celui qui agit : la première case qui n'est pas un fantôme (un ennemi tombé pendant son tour).
    const acting = row === 'current' ? placed.findIndex(({ ghost }) => !ghost) : -1;
    return placed.map(({ entry, ghost }, index) => {
      const leaving = ghost ? rowGhosts.find((one) => one.entry === entry) : undefined;
      return leaving === undefined ? (
        <TrackCase
          key={`${row}-${entryKey(entry)}`}
          entry={entry}
          current={index === acting}
          shade={trackShade(row, index === acting, enemyPhase)}
          enemyPhase={enemyPhase}
          enter={entering.has(entryKey(entry))}
          portraits={portraits}
        />
      ) : (
        <GhostCase
          key={`ghost-${leaving.id}`}
          ghost={leaving}
          gap={narrow ? NARROW_GAP : GAP}
          enemyPhase={enemyPhase}
          portraits={portraits}
          onDone={forget}
        />
      );
    });
  };
  return (
    <View
      accessible
      accessibilityLabel={actionTrackLabel(track.round, track.current, track.next)}
      testID="battle-action-track"
      style={[styles.track, narrow && styles.narrowTrack]}
    >
      {cases('current')}
      {track.next.length === 0 ? null : (
        <Text style={[styles.separator, narrow && styles.narrowSeparator]}>suiv.</Text>
      )}
      {cases('next')}
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GAP,
    height: 64,
    paddingTop: 4,
    paddingHorizontal: 16,
    paddingBottom: 10,
    overflow: 'hidden',
  },
  narrowTrack: { gap: NARROW_GAP },
  entry: {
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
    width: 52,
    height: 52,
    marginLeft: 2,
    marginRight: 4,
    backgroundColor: roles.raised,
    borderColor: roles.gold,
  },
  ghost: { overflow: 'hidden' },
  // L'ennemi maudit (#209, maquette `.fp.cursed`) : fond d'erreur et trait de malédiction, sous le
  // double cadre d'or quand il agit ; le crâne en coin (`.skb`) le dit sans la couleur.
  cursed: { backgroundColor: roles.errorBg, borderColor: roles.curse },
  crown: {
    position: 'absolute',
    left: -6,
    top: -6,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: roles.night,
    borderWidth: 1,
    borderColor: roles.rarityEpic,
  },
  cursedSkull: {
    position: 'absolute',
    right: -6,
    top: -6,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: roles.errorBg,
    borderWidth: 1,
    borderColor: roles.curse,
    zIndex: 2,
  },
  // Un invoqué annoncé, pas encore entré (#172, maquette `.fp.summ`) : cerclé de pointillé gris.
  pending: { borderStyle: 'dashed', borderColor: battleColors.summonDust },
  // Son anneau intérieur de 2 dp, de fumée claire (`.fp.summ`, `inset 0 0 0 2px --smoke-l`).
  pendingRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 2,
    borderColor: battleColors.summonTag,
  },
  // Le double cadre de celui qui agit (maquette `.fp.cur`) : encre, puis or, autour du trait d'or.
  innerRing: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderWidth: 2,
    borderColor: roles.ink,
  },
  outerRing: {
    position: 'absolute',
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderWidth: 2,
    borderColor: roles.gold,
  },
  // La flèche d'or de 4 dp sous la case de celui qui agit.
  arrow: {
    position: 'absolute',
    bottom: -13,
    left: '50%',
    marginLeft: -4,
    borderWidth: 4,
    borderColor: 'transparent',
    borderTopColor: roles.gold,
  },
  // Une case plus pâle : un voile d'encre sur la case, jamais une opacité (ADR 0010, avenant #155),
  // d'opacité 1 − luminosité (`trackShade`). En phase du héros, l'aperçu, dans son cadre.
  shade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: roles.ink,
  },
  // En phase ennemie, la case entière, son cadre de 2 dp compris (#188, `filter` de `.frise.dimf`).
  wholeShade: { top: -2, left: -2, right: -2, bottom: -2 },
  ghostVeil: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: roles.ink,
  },
  initial: { color: roles.light, fontFamily: textFont.bold, fontSize: 14 },
  currentInitial: { fontSize: 22 },
  heroInitial: { color: roles.gold, fontSize: 11 },
  currentHeroInitial: { fontSize: 16 },
  separator: {
    alignSelf: 'stretch',
    textAlignVertical: 'center',
    marginTop: 4,
    marginHorizontal: 2,
    paddingTop: 12,
    paddingHorizontal: 6,
    borderLeftWidth: 2,
    borderLeftColor: roles.line,
    backgroundColor: roles.scrim,
    color: roles.muted,
    fontFamily: textFont.semiBold,
    fontSize: 11,
  },
  narrowSeparator: { paddingHorizontal: 4 },
});
// Stryker restore all
