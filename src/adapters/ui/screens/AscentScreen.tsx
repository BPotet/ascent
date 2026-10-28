import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { AscentSession } from '../../../application/useCases/AscentSession';
import type { Ascent } from '../../../domain/ascent/Ascent';
import { ITEMS } from '../../../domain/ascent/items';
import { BoonChoicePanel } from '../battle/BoonChoicePanel';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import {
  blessingText,
  exitLabel,
  floorLine,
  goldText,
  itemDescription,
  itemText,
  wornText,
} from '../format/ascentText';
import { ownedBoonsLine } from '../format/boonText';
import { itemSilhouette } from '../pixelArt/sprites/itemSilhouettes';
import { toPixelImage } from '../pixelArt/sprites/Sprite';
import { SpriteCanvas } from '../pixelArt/SpriteCanvas';
import { useAscent } from '../state/useAscent';
import { battleColors } from '../theme/battleColors';
import { TrialBattleScreen } from './TrialBattleScreen';

/** Le compte à rebours de reprise (`ResumeCountdown`, P32), en secondes. */
export const RESUME_COUNTDOWN_S = 3;

/** La visibilité de l'application : la pause quand elle passe en arrière-plan (P33). */
export interface AscentVisibility {
  onChange(listener: (visible: boolean) => void): () => void;
}

export interface AscentScreenProps {
  readonly session: AscentSession;
  readonly visibility: AscentVisibility;
  /** Quitter l'écran de l'ascension : retour au pied de la tour. */
  readonly onLeave: () => void;
}

function Header({
  ascent,
  extra,
  onPause,
}: {
  readonly ascent: Ascent;
  readonly extra?: string | null;
  readonly onPause?: () => void;
}) {
  const parts = [
    floorLine(ascent.floor),
    `${ascent.hero.hp}/${ascent.hero.maxHp} PV`,
    goldText(ascent.gold),
    ...(extra ? [extra] : []),
  ];
  return (
    <View style={styles.header}>
      <Text testID="ascent-status" style={styles.status}>
        {parts.join(' · ')}
      </Text>
      {onPause === undefined ? null : (
        <Pressable accessibilityRole="button" onPress={onPause} style={styles.pause}>
          <Text style={styles.pauseLabel}>Pause</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Le combat de l'étage, sur l'écran du combat ; la réserve se lit par « +N en réserve ». */
function FloorBattle({
  session,
  ascent,
  onPause,
}: {
  readonly session: AscentSession;
  readonly ascent: Ascent;
  readonly onPause: () => void;
}) {
  const battleSession = useMemo(() => session.battleSession(), [session]);
  const [reserve, setReserve] = useState(0);
  useEffect(
    () => battleSession.subscribe(({ battle }) => setReserve(battle.reserve.length)),
    [battleSession],
  );
  return (
    <View style={styles.fill}>
      <Header
        ascent={ascent}
        extra={reserve > 0 ? `+${reserve} en réserve` : null}
        onPause={onPause}
      />
      <TrialBattleScreen
        session={battleSession}
        onClose={() => undefined}
        trialTools={false}
        title={ascent.encounter?.kind === 'boss' ? 'Le boss' : `Étage ${ascent.floor}`}
      />
    </View>
  );
}

function Countdown({ onDone }: { readonly onDone: () => void }) {
  const [left, setLeft] = useState(RESUME_COUNTDOWN_S);
  useEffect(() => {
    if (left === 0) {
      onDone();
      return;
    }
    const timer = setTimeout(() => setLeft(left - 1), 1_000);
    return () => clearTimeout(timer);
  }, [left, onDone]);
  return (
    <View style={styles.center} testID="ascent-countdown">
      <Text style={styles.line}>Reprise dans</Text>
      <Text style={styles.big}>{left}</Text>
    </View>
  );
}

/**
 * L'écran de l'ascension (prototype #91) : le combat de l'étage, le choix de sortie (la porte
 * Combat annonce la taille du groupe), et le bilan de fin (victoire, chute ; l'Or est perdu à la
 * fin). Passer en arrière-plan met en pause ; la reprise d'un combat commence par un compte à
 * rebours de 3 s, sans aucun appui.
 */
export function AscentScreen({ session, visibility, onLeave }: AscentScreenProps) {
  const ascent = useAscent(session);
  const [counting, setCounting] = useState(() => session.resuming());
  const [paused, setPaused] = useState(false);
  const [mount, setMount] = useState(0);

  useEffect(
    () =>
      visibility.onChange((visible) => {
        if (!visible) {
          session.pause();
          setPaused(true);
          return;
        }
        setPaused(false);
        setCounting(session.resuming());
        setMount((count) => count + 1);
      }),
    [session, visibility],
  );

  // Quitter l'écran (Pause, retour arrière) met en pause et sauvegarde (P33).
  useEffect(() => () => session.pause(), [session]);

  const leave = () => {
    session.pause();
    onLeave();
  };

  if (ascent === null) {
    return (
      <Screen layout="top" background={battleColors.background} testID="ascent">
        <View style={styles.center}>
          <Button label="Retour au pied de la tour" onPress={onLeave} />
        </View>
      </Screen>
    );
  }

  if (ascent.outcome !== null) {
    const victory = ascent.outcome === 'victory';
    return (
      <Screen layout="top" background={battleColors.background} testID="ascent-end">
        <View style={styles.center}>
          <Text accessibilityRole="header" style={[styles.big, !victory && styles.fall]}>
            {victory ? 'Victoire !' : 'Chute'}
          </Text>
          <Text style={styles.line}>
            {victory ? 'Le boss des Catacombes est vaincu.' : `Tombé à l'étage ${ascent.floor}.`}
          </Text>
          <Text style={styles.gold}>{`Or gagné : ${goldText(ascent.gold)}`}</Text>
          <Text style={styles.line}>L&apos;Or est perdu à la fin de l&apos;ascension.</Text>
          <Button
            label="Retour au pied de la tour"
            onPress={() => {
              session.leave();
              onLeave();
            }}
          />
        </View>
      </Screen>
    );
  }

  if (ascent.blessingOffer !== null) {
    const rarity = ascent.blessingRarities[0]!;
    const total = ascent.blessings.length + ascent.blessingRarities.length;
    return (
      <Screen layout="top" background={battleColors.background} testID="ascent-blessing">
        <Header ascent={ascent} onPause={leave} />
        <ScrollView contentContainerStyle={styles.exits}>
          <Text accessibilityRole="header" style={styles.title}>
            {`Bénédiction ${ascent.blessings.length + 1} sur ${total}`}
          </Text>
          <Text style={styles.line}>Choisis-en une. Elle dure toute l&apos;ascension.</Text>
          {ascent.blessingOffer.map((family, index) => (
            <Button
              key={family}
              label={blessingText({ family, rarity })}
              testID={`blessing-${index}`}
              onPress={() => session.chooseBlessing(index)}
            />
          ))}
        </ScrollView>
      </Screen>
    );
  }

  if (ascent.encounter !== null) {
    return (
      <Screen layout="top" background={battleColors.background} testID="ascent-battle">
        {paused ? null : counting ? (
          <>
            <Header ascent={ascent} onPause={leave} />
            <Countdown onDone={() => setCounting(false)} />
          </>
        ) : (
          <FloorBattle
            key={`${ascent.floor}-${mount}`}
            session={session}
            ascent={ascent}
            onPause={leave}
          />
        )}
      </Screen>
    );
  }

  // En fin de combat : l'Or, puis l'objet trouvé (#93), puis le bienfait (#92), puis les sorties.
  const gained =
    ascent.lastGold > 0 ? (
      <Text style={styles.gold}>{`Étage franchi · +${goldText(ascent.lastGold)}`}</Text>
    ) : null;

  if (ascent.foundItem !== null) {
    const { slot } = ITEMS[ascent.foundItem];
    const description = itemDescription(ascent.foundItem);
    return (
      <Screen layout="top" background={battleColors.background} testID="ascent-item">
        <Header ascent={ascent} onPause={leave} />
        {gained}
        <View style={styles.center}>
          <Text accessibilityRole="header" style={styles.title}>
            Objet trouvé
          </Text>
          <SpriteCanvas
            sprite={`item-silhouette-${slot}`}
            draw={() => toPixelImage(itemSilhouette(slot))}
            scale={3}
            testID="item-silhouette"
          />
          <Text style={styles.gold}>{itemText(ascent.foundItem)}</Text>
          {description !== null && <Text style={styles.line}>{description}</Text>}
          <Text style={styles.line}>{`Tu portes : ${wornText(ascent.equipment, slot)}`}</Text>
          <Text style={styles.line}>Un objet laissé ne revient pas.</Text>
          <View style={styles.row}>
            <Button label="Laisser" variant="ghost" onPress={() => session.leaveItem()} />
            <Button label="Équiper" onPress={() => session.equipItem()} />
          </View>
        </View>
      </Screen>
    );
  }

  if (ascent.boonOffer !== null) {
    return (
      <Screen layout="top" background={battleColors.background} testID="ascent-boons">
        <Header ascent={ascent} onPause={leave} />
        {gained}
        <BoonChoicePanel
          key={ascent.floor}
          offer={ascent.boonOffer}
          onChoose={(index) => session.chooseBoon(index)}
        />
      </Screen>
    );
  }

  const boss = ascent.exits.some((exit) => exit.kind === 'boss');
  return (
    <Screen layout="top" background={battleColors.background} testID="ascent-exits">
      <Header ascent={ascent} onPause={leave} />
      <ScrollView contentContainerStyle={styles.exits}>
        {gained}
        <Text style={styles.line}>{ownedBoonsLine(ascent.hero.boons)}</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {boss ? 'Dernière porte' : 'Choisis ta sortie'}
        </Text>
        {ascent.exits.map((exit, index) => (
          <Button
            key={`${ascent.floor}-${index}`}
            label={exitLabel(exit)}
            variant={exit.kind === 'campfire' ? 'ghost' : 'primary'}
            testID={`ascent-exit-${index}`}
            onPress={() => session.chooseExit(index)}
          />
        ))}
      </ScrollView>
    </Screen>
  );
}

// Stryker disable all: styles d'un écran de prototype.
const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  status: { flex: 1, color: battleColors.text, fontSize: 13 },
  pause: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  pauseLabel: { color: battleColors.light, fontSize: 14, fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'stretch', padding: 24, gap: 12 },
  title: { color: battleColors.light, fontSize: 22, fontWeight: '700', textAlign: 'center' },
  big: { color: battleColors.light, fontSize: 40, fontWeight: '700', textAlign: 'center' },
  fall: { color: battleColors.curse },
  line: { color: battleColors.muted, fontSize: 15, textAlign: 'center' },
  gold: { color: battleColors.light, fontSize: 17, textAlign: 'center' },
  exits: { padding: 24, gap: 14 },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
});
