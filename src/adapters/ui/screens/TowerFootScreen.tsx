import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { AscentSession } from '../../../application/useCases/AscentSession';
import type { FateGaugeReading } from '../../../application/useCases/fateGauge';
import { Button } from '../components/Button';
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
import { useAscent } from '../state/useAscent';
import { useFateGauge } from '../state/useFateGauge';
import { battleColors } from '../theme/battleColors';

/**
 * Le pied de la tour (`TowerFoot`, prototypes #91 et #93) : la jauge du jour, d'après hier, et
 * « Commencer l'ascension », qui la scelle ; ou, quand une
 * ascension est en cours (une seule à la fois), « Reprendre l'ascension » et « Abandonner
 * l'ascension », avec confirmation. `onEnter` ouvre l'ascension.
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

  useEffect(() => {
    if (loaded) return;
    session
      .load()
      .catch(() => null)
      .finally(() => setLoaded(true));
  }, [session, loaded]);

  const inProgress = ascent !== null && ascent.outcome === null;
  const start = (reading: FateGaugeReading) => {
    session.begin({ gauge: reading.gauge, blessings: reading.blessings });
    seal(reading);
    onEnter();
  };

  return (
    <Screen layout="top" background={battleColors.background} testID="tower-foot">
      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          {TOWER_TITLE}
        </Text>
        <Text style={styles.line}>{TIER_LINE}</Text>
        {!loaded ? null : inProgress ? (
          <>
            <Text style={styles.status}>
              {`${floorLine(ascent.floor)} · ${ascent.hero.hp}/${ascent.hero.maxHp} PV · ${goldText(ascent.gold)}`}
            </Text>
            <Text style={styles.line}>{`Jauge de l'ascension : ${gaugeWord(ascent.gauge)}`}</Text>
            {confirming ? (
              <View style={styles.actions}>
                <Text style={styles.line}>
                  Abandonner ? L&apos;ascension se termine comme une chute : l&apos;Or est perdu.
                </Text>
                <Button label="Annuler" variant="ghost" onPress={() => setConfirming(false)} />
                <Button
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
                <Button label="Reprendre l'ascension" onPress={onEnter} />
                <Button
                  label="Abandonner l'ascension"
                  variant="dangerText"
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
                <Button label="Commencer l'ascension" onPress={() => start(reading)} />
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
  title: { color: battleColors.light, fontSize: 28, fontWeight: '700', textAlign: 'center' },
  line: { color: battleColors.muted, fontSize: 15, textAlign: 'center' },
  status: { color: battleColors.text, fontSize: 16, textAlign: 'center' },
  actions: { gap: 12, marginTop: 16 },
});
