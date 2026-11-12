import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';

import type { IntentCategory } from '../../../domain/battle/shownIntent';
import { intentNumber } from '../format/battleText';
import { artPalette } from '../pixelArt/artPalette';
import { PixelFrame } from '../pixelArt/PixelFrame';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { textFont } from '../pixelArt/pixelTypography';
import type { IconName } from '../pixelArt/sprites/icons';
import type { EnemyView } from '../state/battleView';
import { battleColors } from '../theme/battleColors';
import { DamageFloat } from './BattleEffects';
import { PerilSeal } from './PerilSeal';
import { SignatureMark } from './SignatureMark';
import type { EnemySlot } from './scene/sceneGeometry';
import type { BattleDisplay } from '../state/useBattleDisplay';
import { useReleaseGesture } from './touchGestures';

/** L'identifiant du geste de la colonne d'un ennemi, pour `getByGestureTestId` dans les tests. */
export function enemyGestureTestId(index: number): string {
  return `battle-enemy-${index}`;
}

/** L'icône de chaque catégorie d'intention (C2.2). */
const INTENT_ICONS: Readonly<Record<IntentCategory, IconName>> = {
  attack: 'iAttack',
  guard: 'iGuard',
  heal: 'iHeal',
  raise: 'iRaise',
  exhume: 'iExhume',
  charge: 'iAttack',
  skip: 'iSkip',
};

/**
 * La colonne d'un ennemi (maquette F1, F5, F7, P0b à P13) : toute la colonne est touchable pour le
 * viser (au relâcher). Elle montre son intention en icône (avec « +N » pour Garde et Soin), sa barre
 * de PV, son nom, sa garde (ou « Étourdie ×1,5 ») et le sceau rouge d'un coup imparable. En phase
 * ennemie épurée, le nom et les chiffres sont masqués. L'ennemi actif a son intention cernée de
 * lumière (de rouge sous le sceau) et sa plaque à 45 % ; les autres s'estompent. L'ennemi est
 * annoncé en entier au lecteur d'écran. Sa plaque est en cadre cranté ; la cible a un double cadre
 * d'or, une flèche au-dessus de son intention et son nom en gras, jamais la couleur seule (#120).
 * Son sprite, ses étoiles et son ombre au sol sont dessinés par la scène, derrière, à la place que
 * donne `sceneGeometry`. Un ennemi maudit (#209, maquette M2) porte l'étiquette « Maudit » au crâne
 * sous son nom, sur sa propre ligne, un cadre rose (d'or s'il est la cible) et une lueur rose fixe
 * sous ses pieds : jamais la couleur seule. L'Élite escortée (#257) porte la couronne d'Élite
 * violette avant son nom, que les étiquettes complètent sans la remplacer ; sa plaque fait 128 dp au
 * plus, celle d'une escorte 100 dp. Une place vide (un ennemi tombé) ne se touche plus.
 */
export function EnemyColumn({
  view,
  index,
  slot,
  sealed,
  reducedMotion = false,
  float,
  uiNow,
  now,
  onTarget,
}: {
  readonly view: EnemyView;
  readonly index: number;
  /** Sa place dans la scène. */
  readonly slot: EnemySlot;
  readonly sealed: boolean;
  readonly reducedMotion?: boolean;
  /** Le chiffre qui s'envole au-dessus de lui, s'il est pour lui. */
  readonly float: BattleDisplay['float'];
  readonly uiNow: () => number;
  readonly now: () => number;
  readonly onTarget: (enemy: number, touchStartedAt: number, releasedAt: number) => void;
}) {
  // Un rappel stable : le geste n'est pas recréé à chaque instantané du combat.
  // Une place vide (un ennemi tombé) ne se touche plus (#257, E9).
  const { standing } = view;
  const onRelease = useCallback(
    (touchStartedAt: number, releasedAt: number) => {
      if (standing) onTarget(index, touchStartedAt, releasedAt);
    },
    [onTarget, index, standing],
  );
  const gesture = useReleaseGesture(enemyGestureTestId(index), uiNow, onRelease);
  const { kind, intent } = view;
  const number = intent === null ? null : intentNumber(intent);
  return (
    <GestureDetector gesture={gesture}>
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={view.label}
        accessibilityState={{ selected: view.target, disabled: !view.standing }}
        accessibilityActions={standing ? [{ name: 'activate' }] : []}
        onAccessibilityAction={() => {
          if (standing) onTarget(index, now(), now());
        }}
        testID={`enemy-${kind}`}
        style={[
          styles.column,
          { left: slot.column.x, top: slot.column.y, width: slot.column.width },
          view.dimmed && styles.dimmed,
          !view.standing && styles.down,
        ]}
      >
        {view.target ? (
          <View
            pointerEvents="none"
            testID={`enemy-${kind}-target-arrow`}
            style={styles.targetArrow}
          >
            <PixelIcon name="right" color={artPalette.roles.gold} style={styles.pointDown} />
          </View>
        ) : null}
        <View
          {...(intent === null ? {} : { testID: `enemy-${kind}-intent` })}
          style={[
            styles.intent,
            intent === null && styles.noIntent,
            intent?.category === 'exhume' && styles.exhumeIntent,
            view.active && (sealed ? styles.sealedIntent : styles.activeIntent),
            view.active && intent?.category === 'exhume' && styles.activeExhumeIntent,
          ]}
        >
          {intent === null ? null : (
            <>
              <PixelIcon
                name={INTENT_ICONS[intent.category]}
                color={intent.category === 'exhume' ? battleColors.onGrave : battleColors.text}
                secondColor={battleColors.light}
                testID={`enemy-${kind}-intent-${intent.category}`}
              />
              {number === null ? null : <Text style={styles.intentText}>{number}</Text>}
            </>
          )}
        </View>
        <View style={styles.figure}>
          {view.curse === undefined ? null : (
            <View
              pointerEvents="none"
              testID={`enemy-${kind}-curse-glow`}
              style={styles.curseGlow}
            />
          )}
          {sealed ? <PerilSeal reducedMotion={reducedMotion} /> : null}
          {float === null ? null : <DamageFloat key={float.key} float={float.float} />}
        </View>
        <PixelFrame
          tone={view.target ? 'gold' : view.curse === undefined ? 'default' : 'error'}
          under={battleColors.background}
          testID={`enemy-${kind}-plate`}
          style={[
            styles.plate,
            view.elite === true && styles.elitePlate,
            view.escort === true && styles.escortPlate,
            view.active && styles.activePlate,
          ]}
        >
          <View
            testID={`enemy-${kind}-ring`}
            style={[styles.ring, view.target && styles.targetRing]}
          >
            <View style={styles.track}>
              <View
                testID={`enemy-${kind}-hp`}
                style={[styles.hp, { width: `${Math.round(100 * view.hpRatio)}%` }]}
              />
              {view.hpText === null ? null : <Text style={styles.barText}>{view.hpText}</Text>}
            </View>
            {view.name === null ? null : (
              <View style={styles.nameLine}>
                {view.elite === true ? (
                  <PixelIcon
                    name="crown8"
                    color={artPalette.roles.rarityEpic}
                    testID={`enemy-${kind}-crown`}
                  />
                ) : null}
                <Text style={[styles.name, view.target && styles.targetName]}>{view.name}</Text>
              </View>
            )}
            {view.curse === undefined ? null : (
              <View testID={`enemy-${kind}-curse`} style={styles.curseTag}>
                <PixelIcon
                  name="skull"
                  color={artPalette.roles.pink}
                  testID={`enemy-${kind}-curse-skull`}
                />
                <Text style={styles.curseText}>{view.curse}</Text>
              </View>
            )}
            {view.signature === undefined ? null : (
              <SignatureMark signature={view.signature} testID={`enemy-${kind}-signature`} />
            )}
            {view.tag === null ? null : (
              <Text style={[styles.tag, view.summoned === true && styles.summonedTag]}>
                {view.tag}
              </Text>
            )}
            <View style={[styles.track, view.stunned && styles.stunnedTrack]}>
              <View
                testID={`enemy-${kind}-guard`}
                style={[styles.guard, { width: `${Math.round(100 * view.guardRatio)}%` }]}
              />
              {view.guardWard === true ? (
                // Le liseré d'acier du Sanctuaire (#259, B1, `.pbar.gd.ward`) : c'est la garde qui
                // le protège. Il disparaît à la cassure et revient avec la garde.
                <View testID={`enemy-${kind}-guard-ward`} style={styles.guardWard}>
                  <View style={styles.guardWardEdge} />
                </View>
              ) : null}
              {view.guardText === null ? null : (
                <Text style={[styles.barText, view.stunned && styles.stunnedText]}>
                  {view.guardText}
                </Text>
              )}
            </View>
          </View>
        </PixelFrame>
      </View>
    </GestureDetector>
  );
}

// Stryker disable all: dessin de la scène, vérifié par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  column: {
    position: 'absolute',
    alignItems: 'center',
    gap: 2,
    paddingTop: 2,
    paddingBottom: 4,
  },
  // Maquette `.pfoe.dim` : 25 % ; la scène désature son sprite.
  dimmed: { opacity: 0.25 },
  down: { opacity: 0 },
  intent: {
    height: 40,
    minWidth: 44,
    paddingHorizontal: 6,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: battleColors.badge,
    borderWidth: 1,
    borderColor: battleColors.curseLine,
  },
  noIntent: { opacity: 0 },
  activeIntent: { borderWidth: 2, borderColor: battleColors.light },
  // L'intention Exhumer (#258, `.pint.exhume`) : la pelle couleur os, cadre os ; actif, os clair.
  exhumeIntent: { borderWidth: 2, borderColor: battleColors.grave },
  activeExhumeIntent: { borderColor: battleColors.onGrave },
  sealedIntent: { borderWidth: 2, borderColor: battleColors.seal },
  intentText: {
    color: battleColors.text,
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  figure: { width: 88, height: 104, alignItems: 'center' },
  plate: { width: '100%', minHeight: 56 },
  // Les plaques de l'Élite escortée (#257, maquette `.pfoe.elite .pbox`, `.pbox`) : 128 et 100 dp.
  elitePlate: { maxWidth: 128 },
  escortPlate: { maxWidth: 100 },
  // La couronne d'Élite violette avant le nom (#257), qui passe à la ligne avec lui.
  nameLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 3 },
  // Le second trait, d'or pour la cible : le double cadre d'or (C2).
  ring: {
    flexGrow: 1,
    gap: 2,
    paddingHorizontal: 3,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  targetRing: { borderColor: artPalette.roles.gold },
  activePlate: { opacity: 0.45 },
  targetArrow: { position: 'absolute', top: -16, alignSelf: 'center', zIndex: 4 },
  pointDown: { transform: [{ rotate: '90deg' }] },
  track: {
    height: 14,
    borderRadius: 3,
    backgroundColor: battleColors.hpTrack,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  stunnedTrack: { backgroundColor: battleColors.light },
  hp: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: battleColors.foeHp },
  guard: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: battleColors.guard },
  guardWard: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: battleColors.ward,
  },
  guardWardEdge: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: battleColors.ward,
  },
  barText: {
    color: battleColors.text,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  stunnedText: { color: battleColors.onLight },
  name: { color: battleColors.text, fontFamily: textFont.semiBold, fontSize: 12, lineHeight: 15 },
  targetName: { color: battleColors.light, fontFamily: textFont.bold },
  tag: { color: battleColors.light, fontSize: 11, fontWeight: '700' },
  // L'étiquette « Maudite » (#209, maquette `.ptag.curse`) : rose clair sur le fond d'erreur (11,5:1),
  // cernée du trait de malédiction, en capitales, avec le crâne.
  curseTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 3,
    paddingLeft: 3,
    paddingRight: 4,
    backgroundColor: artPalette.roles.errorBg,
    borderWidth: 1,
    borderColor: artPalette.roles.curse,
  },
  curseText: {
    color: artPalette.roles.pink,
    fontFamily: textFont.bold,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  // La lueur rose sous ses pieds (maquette `.pfoe.cursed .pfig::after`), fixe : rien à réduire.
  curseGlow: {
    position: 'absolute',
    bottom: -6,
    width: 84,
    height: 24,
    borderRadius: 42,
    backgroundColor: artPalette.roles.curse,
    opacity: 0.25,
  },
  // L'étiquette « Invoquée » (#172, maquette `.ptag.summ`) : fumée sur fond sombre, cernée de gris.
  summonedTag: {
    color: battleColors.summonTag,
    backgroundColor: battleColors.summonTagBackground,
    borderWidth: 1,
    borderColor: battleColors.summonDust,
    paddingHorizontal: 4,
    alignSelf: 'center',
  },
});
// Stryker restore all
