import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { DamageFloat as Float, FeedbackText } from '../format/battleText';
import { artPalette } from '../pixelArt/artPalette';
import { textFont } from '../pixelArt/pixelTypography';
import { battleColors } from '../theme/battleColors';
import { BulwarkShieldGlyph } from './BattleGlyphs';
import { BurnFlame } from './BurnChip';

/** Le texte d'effet reste lisible un instant, puis s'efface (maquette : 0,7 s en tout). */
const FEEDBACK_HOLD_MS = 450;
const FEEDBACK_FADE_MS = 250;
/** Le mot de Pas de l'ombre reste moins longtemps : 600 ms en tout (#173). */
const SHADOW_STEP_HOLD_MS = 350;
/** « L'escorte reste » (#257, E9) : montré 1 200 ms en tout, fondu compris ; il ne bloque rien. */
export const ESCORT_STAYS_MS = 1_200;

/**
 * Le mot d'un résultat (« Parfait », « Cassure », « Frappe parfaite »), au centre de la scène. Il
 * s'efface de lui-même ; un nouveau résultat le remplace (l'écran le remonte). « Pas de l'ombre »
 * (#173) s'écrit près de l'Errante, 600 ms.
 */
export function FeedbackLabel({ texts }: { readonly texts: readonly FeedbackText[] }) {
  const opacity = useSharedValue(1);
  const shadowStep = texts.some((text) => text.tone === 'shadowStep');
  const escort = texts.some((text) => text.tone === 'escort');
  const hold = escort
    ? ESCORT_STAYS_MS - FEEDBACK_FADE_MS
    : shadowStep
      ? SHADOW_STEP_HOLD_MS
      : FEEDBACK_HOLD_MS;
  useEffect(() => {
    opacity.set(
      withSequence(
        withTiming(1, { duration: 0 }),
        withDelay(hold, withTiming(0, { duration: FEEDBACK_FADE_MS })),
      ),
    );
  }, [opacity, hold]);
  // Dépendances explicites : le code instrumenté par Stryker n'est plus reconnu comme worklet.
  const fade = useAnimatedStyle(() => {
    'worklet';
    return { opacity: opacity.get() };
  }, [opacity]);
  return (
    <Animated.View
      pointerEvents="none"
      testID="battle-feedback"
      style={[styles.feedback, shadowStep && styles.nearHero, fade]}
    >
      {texts.map((text) =>
        text.tone === 'riposte' ? (
          // « Riposte », précédé de l'écu (#128) : jamais l'argent seul.
          <View key={text.title} style={styles.withShield}>
            <BulwarkShieldGlyph scale={2} />
            <Text style={[styles.title, styles.riposte]}>{text.title}</Text>
          </View>
        ) : text.sub === undefined ? (
          <Text key={text.title} style={[styles.title, styles[text.tone]]}>
            {text.title}
          </Text>
        ) : (
          // Le mot d'un pouvoir attisé (#237, S12), et « Attisé · 1 Élan » dessous.
          <View key={text.title} style={styles.withSub}>
            <Text style={[styles.title, styles[text.tone]]}>{text.title}</Text>
            <Text style={styles.sub}>{text.sub}</Text>
          </View>
        ),
      )}
    </Animated.View>
  );
}

/** Le temps d'envol d'un chiffre (« −4 », « +3 »). */
const FLOAT_MS = 700;

/**
 * Un chiffre qui s'envole au-dessus du héros ou d'un ennemi (« −4 », « +3 ») : les dégâts se
 * lisent après coup, jamais avant (C2.5). Agrandi pour une frappe parfaite (C6.7).
 */
export function DamageFloat({
  float,
  delayMs = 0,
  reducedMotion = false,
}: {
  readonly float: Float;
  /** Le chiffre attend avant de monter (la Brûlure après le Saignement, #171). */
  readonly delayMs?: number;
  /** En mouvement réduit, le chiffre de la Brûlure monte au quart (#171). */
  readonly reducedMotion?: boolean;
}) {
  const rise = useSharedValue(0);
  const shown = useSharedValue(delayMs > 0 ? 0 : 1);
  const height = reducedMotion ? 6 : 24;
  useEffect(() => {
    rise.set(withDelay(delayMs, withTiming(1, { duration: FLOAT_MS })));
    shown.set(withDelay(delayMs, withTiming(1, { duration: 0 })));
  }, [rise, shown, delayMs]);
  // Dépendances explicites : le code instrumenté par Stryker n'est plus reconnu comme worklet.
  const style = useAnimatedStyle(() => {
    'worklet';
    return {
      opacity: shown.get() * (1 - rise.get() * rise.get()),
      transform: [{ translateY: -height * rise.get() }],
    };
  }, [rise, shown, height]);
  return (
    <Animated.View pointerEvents="none" style={[styles.float, styles.withShield, style]}>
      {float.kind === 'riposte' ? <BulwarkShieldGlyph scale={1} /> : null}
      {float.kind === 'burn' ? <BurnFlame /> : null}
      <Text
        style={[
          styles.floatText,
          float.kind === 'guard' && styles.floatGuard,
          float.kind === 'riposte' && styles.floatRiposte,
          float.at === 'hero' && styles.floatHero,
          float.kind === 'burn' && styles.floatBurn,
          float.kind === 'thorns' && styles.floatThorns,
          (float.kind === 'secondChance' || float.kind === 'heal') && styles.floatSecondChance,
          float.big && styles.floatBig,
        ]}
      >
        {float.text}
      </Text>
      {float.half === true ? (
        // Le « ½ » du Sanctuaire (#259, B2, B3), sur l'acier : jamais la couleur seule.
        <View testID="damage-half" style={styles.half}>
          <Text style={styles.halfText}>½</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

/**
 * Le mot « Épines » près du héros (#259, M2, maquette `.fword.thorn`), en vert ronce : il paraît avec
 * le « −2 », `delayMs` ms après la fin de la frappe, puis s'efface. Décoratif : le lecteur d'écran
 * dit la piqûre.
 */
export function ThornsWord({ delayMs }: { readonly delayMs: number }) {
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.set(
      withDelay(
        delayMs,
        withSequence(
          withTiming(1, { duration: 0 }),
          withDelay(FEEDBACK_HOLD_MS, withTiming(0, { duration: FEEDBACK_FADE_MS })),
        ),
      ),
    );
  }, [opacity, delayMs]);
  // Dépendances explicites : le code instrumenté par Stryker n'est plus reconnu comme worklet.
  const fade = useAnimatedStyle(() => {
    'worklet';
    return { opacity: opacity.get() };
  }, [opacity]);
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={fade}
    >
      <Text style={[styles.title, styles.thorns]}>Épines</Text>
    </Animated.View>
  );
}

/** La secousse de la scène (320 ms), relancée à chaque `shakeKey` ; aucune s'il vaut 0. */
export function useShake(shakeKey: number) {
  const offset = useSharedValue(0);
  useEffect(() => {
    if (shakeKey === 0) return;
    offset.set(
      withSequence(
        withTiming(-5, { duration: 64 }),
        withTiming(5, { duration: 64 }),
        withTiming(-3, { duration: 64 }),
        withTiming(2, { duration: 64 }),
        withTiming(0, { duration: 64 }),
      ),
    );
  }, [shakeKey, offset]);
  // Dépendances explicites : le code instrumenté par Stryker n'est plus reconnu comme worklet.
  return useAnimatedStyle(() => {
    'worklet';
    return { transform: [{ translateX: offset.get() }, { translateY: -offset.get() * 0.6 }] };
  }, [offset]);
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
/**
 * Le contour d'encre des chiffres et mots de scène (maquette #174) : opaque, sans décalage, pour
 * rester lisible sur tout fond de palier (#176).
 */
const INK_OUTLINE = {
  textShadowColor: artPalette.roles.ink,
  textShadowRadius: 2,
  textShadowOffset: { width: 0, height: 0 },
} as const;

const styles = StyleSheet.create({
  feedback: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '68%',
    alignItems: 'center',
    zIndex: 7,
  },
  // Le mot de Pas de l'ombre, près de l'Errante (maquette E2, `.fword.shade`).
  nearHero: { top: 'auto', bottom: 122, left: 96 },
  title: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '700',
    ...INK_OUTLINE,
  },
  perfect: { color: battleColors.light, fontSize: 32, lineHeight: 36 },
  break: { color: battleColors.light, fontSize: 34, lineHeight: 38, letterSpacing: 1 },
  rise: { color: battleColors.light, fontSize: 30, lineHeight: 34, letterSpacing: 1 },
  riposte: { color: artPalette.roles.bulwarkText, fontSize: 30, lineHeight: 34, letterSpacing: 1 },
  shadowStep: { color: battleColors.onShadowStep, fontSize: 24, lineHeight: 28 },
  // « L'escorte reste » (#257, maquette `.announce.gold`) : en or, plus petit qu'un mot de coup.
  escort: { color: artPalette.roles.gold, fontSize: 26, lineHeight: 30 },
  // « Victoire » à la chute du Fossoyeur et de son Squelette (#258, F6).
  victory: { color: battleColors.light, fontSize: 32, lineHeight: 36 },
  // La rupture et le retour du Sanctuaire (#259, B3, B5, `.fword.ward`), en acier clair.
  ward: { color: battleColors.onWard, fontSize: 30, lineHeight: 34, letterSpacing: 1 },
  // « Balayé » et « Il charge » (#266, maquette 246, `.fword.sweep`, `.fword.charge`).
  sweep: { color: battleColors.sweep, fontSize: 26, lineHeight: 30, letterSpacing: 1 },
  charge: { color: battleColors.charge, fontSize: 24, lineHeight: 28, letterSpacing: 1 },
  // Le mot « Épines » (#259, M2, `.fword.thorn`), en vert ronce.
  thorns: { color: battleColors.thornLight, fontSize: 20, lineHeight: 24 },
  withShield: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  withSub: { alignItems: 'center' },
  sub: {
    color: battleColors.light,
    fontFamily: textFont.semiBold,
    fontSize: 14,
    lineHeight: 19,
    ...INK_OUTLINE,
  },
  float: { position: 'absolute', top: 6, alignSelf: 'center', zIndex: 8 },
  floatText: {
    color: battleColors.text,
    fontSize: 20,
    fontWeight: '800',
    ...INK_OUTLINE,
    fontVariant: ['tabular-nums'],
  },
  floatHero: { color: battleColors.miss },
  floatGuard: { color: battleColors.guard },
  floatRiposte: { color: artPalette.roles.bulwarkText },
  floatBurn: { color: battleColors.burnNumber },
  // Le « −2 » des Épines (#259, `.dmg.thorn`), en vert ronce.
  floatThorns: { color: battleColors.thornLight },
  // Le « ½ » du Sanctuaire (#259, `.dmg .hb`) : l'encre sur l'acier.
  half: {
    marginLeft: 3,
    paddingHorizontal: 4,
    height: 18,
    justifyContent: 'center',
    backgroundColor: battleColors.ward,
  },
  halfText: {
    color: artPalette.roles.ink,
    fontFamily: textFont.bold,
    fontSize: 12,
    lineHeight: 14,
  },
  // Les PV du héros relevé par la seconde chance, en or (#206, S3).
  floatSecondChance: { color: artPalette.roles.gold },
  floatBig: { color: battleColors.light, fontSize: 32 },
});
// Stryker restore all
