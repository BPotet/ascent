import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { AscentSession } from '../../../application/useCases/AscentSession';
import type { FateGaugeReading } from '../../../application/useCases/fateGauge';
import type { HeroKind } from '../../../domain/battle/combatants';
import { Screen } from '../components/Screen';
import {
  TIER_LINE,
  TOWER_TITLE,
  floorLine,
  gaugeEffects,
  gaugeReason,
  gaugeWord,
  goldText,
} from '../format/ascentText';
import { HERO_NAMES } from '../format/battleText';
import { artPalette } from '../pixelArt/artPalette';
import { PixelButton } from '../pixelArt/PixelButton';
import { pixelTypography, textFont } from '../pixelArt/pixelTypography';
import { useAscent } from '../state/useAscent';
import { useFateGauge } from '../state/useFateGauge';
import { HeroChoiceScreen } from './HeroChoiceScreen';

const { roles } = artPalette;

/** « la Sentinelle », « l'Errante » : le héros dans une phrase. */
function heroInSentence(hero: HeroKind): string {
  const name = HERO_NAMES[hero];
  return name.charAt(0).toLowerCase() + name.slice(1);
}

/**
 * Le pied de la tour (`TowerFoot`, prototypes #91 à #93) : la jauge du jour, d'après hier, et
 * « Commencer l'ascension », puis le choix du héros, qui scelle la jauge ; ou, quand une ascension
 * est en cours (une seule à la fois), son héros, qui ne change plus, « Reprendre l'ascension » et
 * « Abandonner l'ascension », avec confirmation. `onEnter` ouvre l'ascension.
 */
export function TowerFootScreen({
  session,
  onEnter,
}: {
  readonly session: AscentSession;
  readonly onEnter: () => void;
}) {
  const ascent = useAscent(session);
  const [loaded, setLoaded] = useState(ascent !== null);
  const [confirming, setConfirming] = useState(false);
  const { reading, seal } = useFateGauge();
  const [choosing, setChoosing] = useState<FateGaugeReading | null>(null);

  useEffect(() => {
    if (loaded) return;
    session
      .load()
      .catch(() => null)
      .finally(() => setLoaded(true));
  }, [session, loaded]);

  const inProgress = ascent !== null && ascent.outcome === null;
  const start = (reading: FateGaugeReading, hero: HeroKind) => {
    setChoosing(null);
    session.begin({ hero, gauge: reading.gauge, blessings: reading.blessings });
    seal(reading);
    onEnter();
  };

  if (choosing !== null && !inProgress) {
    return (
      <HeroChoiceScreen
        title="Choisir un héros"
        note="Il ne change plus jusqu'à la fin de l'ascension."
        confirmLabel={(hero) => `Continuer avec ${heroInSentence(hero)}`}
        onStart={(hero) => start(choosing, hero)}
        onClose={() => setChoosing(null)}
      />
    );
  }

  return (
    <Screen layout="top" background={roles.night} testID="tower-foot">
      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          {TOWER_TITLE}
        </Text>
        <Text style={styles.line}>{TIER_LINE}</Text>
        {!loaded ? null : inProgress ? (
          <>
            <Text style={styles.status}>{HERO_NAMES[ascent.hero.kind]}</Text>
            <Text style={styles.status}>
              {`${floorLine(ascent.floor)} · ${ascent.hero.hp}/${ascent.hero.maxHp} PV · ${goldText(ascent.gold)}`}
            </Text>
            <Text style={styles.line}>{`Jauge de l'ascension : ${gaugeWord(ascent.gauge)}`}</Text>
            {confirming ? (
              <View style={styles.actions}>
                <Text style={styles.line}>
                  Abandonner ? L&apos;ascension se termine comme une chute : l&apos;Or est perdu.
                </Text>
                <PixelButton
                  label="Annuler"
                  variant="secondary"
                  onPress={() => setConfirming(false)}
                />
                <PixelButton
                  label="Abandonner"
                  variant="danger"
                  onPress={() => {
                    setConfirming(false);
                    session.abandon();
                  }}
                />
              </View>
            ) : (
              <View style={styles.actions}>
                <PixelButton label="Reprendre l'ascension" onPress={onEnter} />
                <PixelButton
                  label="Abandonner l'ascension"
                  variant="secondary"
                  onPress={() => setConfirming(true)}
                />
              </View>
            )}
          </>
        ) : (
          <View style={styles.actions}>
            {ascent === null ? null : (
              <Text style={styles.status}>
                {`Ascension terminée : ${goldText(ascent.gold)}, perdus à la fin.`}
              </Text>
            )}
            {reading === null ? null : (
              <>
                <Text style={styles.status}>{`Jauge du jour : ${gaugeWord(reading.gauge)}`}</Text>
                <Text style={styles.line}>{gaugeReason(reading)}</Text>
                {gaugeEffects(reading).map((effect) => (
                  <Text key={effect} style={styles.line}>
                    {effect}
                  </Text>
                ))}
                <PixelButton label="Commencer l'ascension" onPress={() => setChoosing(reading)} />
              </>
            )}
          </View>
        )}
      </View>
    </Screen>
  );
}

// Stryker disable all: styles d'un écran de prototype.
const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { ...pixelTypography.screenTitle, color: roles.light, textAlign: 'center' },
  line: { ...pixelTypography.body, color: roles.parchment, textAlign: 'center' },
  status: {
    fontFamily: textFont.semiBold,
    fontSize: 16,
    lineHeight: 22,
    color: roles.light,
    textAlign: 'center',
  },
  actions: { gap: 12, marginTop: 16 },
});
