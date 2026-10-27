import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { AscentSession } from '../../../application/useCases/AscentSession';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { TIER_LINE, TOWER_TITLE, floorLine, goldText } from '../format/ascentText';
import { useAscent } from '../state/useAscent';
import { battleColors } from '../theme/battleColors';

/**
 * Le pied de la tour (`TowerFoot`, prototype #91) : « Commencer l'ascension », ou, quand une
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

  useEffect(() => {
    if (loaded) return;
    session
      .load()
      .catch(() => null)
      .finally(() => setLoaded(true));
  }, [session, loaded]);

  const inProgress = ascent !== null && ascent.outcome === null;
  const start = () => {
    session.begin();
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
            <Button label="Commencer l'ascension" onPress={start} />
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
