import { type Ref, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';

import type { AscentSession } from '../../../application/useCases/AscentSession';
import type { Ascent } from '../../../domain/ascent/Ascent';
import { ITEMS } from '../../../domain/ascent/items';
import { loadoutOf } from '../../../domain/ascent/loadout';
import { BoonChoicePanel } from '../battle/BoonChoicePanel';
import { BlessingChoice } from '../components/BlessingChoice';
import { ExitChoice } from '../components/ExitChoice';
import { LoadoutButton } from '../components/LoadoutButton';
import { LoadoutSheet } from '../components/LoadoutSheet';
import { Screen } from '../components/Screen';
import { floorLine, goldText, itemDescription, itemText, wornText } from '../format/ascentText';
import { artPalette } from '../pixelArt/artPalette';
import { PixelButton } from '../pixelArt/PixelButton';
import { pixelFont, pixelTypography, textFont } from '../pixelArt/pixelTypography';
import { ITEM_IMAGES } from '../pixelArt/sprites/atelier/data/itemImages';
import { assetSprite } from '../pixelArt/sprites/atelier/fullAnimation';
import { itemSilhouette } from '../pixelArt/sprites/itemSilhouettes';
import { toPixelImage } from '../pixelArt/sprites/Sprite';
import { SpriteCanvas } from '../pixelArt/SpriteCanvas';
import { useAscent } from '../state/useAscent';
import { BattleScreen } from './BattleScreen';

const { roles } = artPalette;

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
  onLoadout,
  combat = false,
  loadoutRef,
}: {
  readonly ascent: Ascent;
  readonly extra?: string | null;
  readonly onPause?: () => void;
  /** Le bouton « Équipement » (#159) : ce qu'il ouvre, s'il met le combat en pause, et son focus. */
  readonly onLoadout?: () => void;
  readonly combat?: boolean;
  readonly loadoutRef?: Ref<View>;
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
      {onLoadout === undefined ? null : (
        <LoadoutButton
          {...(loadoutRef !== undefined && { ref: loadoutRef })}
          loadout={loadoutOf(ascent)}
          combat={combat}
          onPress={onLoadout}
        />
      )}
      {onPause === undefined ? null : (
        <PixelButton
          label="Pause"
          variant="secondary"
          onPress={onPause}
          testID="ascent-pause"
          style={styles.pause}
        />
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
      <BattleScreen
        session={battleSession}
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
  const [loadoutOpen, setLoadoutOpen] = useState(false);
  const opener = useRef<View>(null);

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

  // La feuille de l'Équipement (#159), hors combat : rien n'est mis en pause, l'écran garde son état.
  const openLoadout = () => setLoadoutOpen(true);
  const closeLoadout = () => {
    setLoadoutOpen(false);
    if (opener.current !== null) AccessibilityInfo.sendAccessibilityEvent(opener.current, 'focus');
  };

  if (ascent === null) {
    return (
      <Screen layout="top" background={roles.night} testID="ascent">
        <View style={styles.center}>
          <PixelButton label="Retour au pied de la tour" onPress={onLeave} />
        </View>
      </Screen>
    );
  }

  if (ascent.outcome !== null) {
    const victory = ascent.outcome === 'victory';
    return (
      <Screen layout="top" background={roles.night} testID="ascent-end">
        <View style={styles.center}>
          <Text accessibilityRole="header" style={[styles.big, !victory && styles.fall]}>
            {victory ? 'Victoire !' : 'Chute'}
          </Text>
          <Text style={styles.line}>
            {victory ? 'Le boss des Catacombes est vaincu.' : `Tombé à l'étage ${ascent.floor}.`}
          </Text>
          <Text style={styles.gold}>{`Or gagné : ${goldText(ascent.gold)}`}</Text>
          <Text style={styles.line}>L&apos;Or est perdu à la fin de l&apos;ascension.</Text>
          <PixelButton
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

  // Une seule feuille de l'Équipement, au niveau de l'écran, quel que soit l'écran de l'ascension.
  const loadoutSheet = (
    <LoadoutSheet
      loadout={loadoutOf(ascent)}
      combat={false}
      visible={loadoutOpen}
      onClose={closeLoadout}
    />
  );

  if (ascent.blessingOffer !== null) {
    return (
      <Screen layout="top" background={roles.night} testID="ascent-blessing">
        <Header ascent={ascent} onPause={leave} onLoadout={openLoadout} loadoutRef={opener} />
        <BlessingChoice
          offer={ascent.blessingOffer}
          rarity={ascent.blessingRarities[0]!}
          taken={ascent.blessings}
          total={ascent.blessings.length + ascent.blessingRarities.length}
          onChoose={(index) => session.chooseBlessing(index)}
        />
        {loadoutSheet}
      </Screen>
    );
  }

  if (ascent.encounter !== null) {
    return (
      <Screen layout="top" background={roles.night} testID="ascent-battle">
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
    const image = ITEM_IMAGES[ascent.foundItem];
    return (
      <Screen layout="top" background={roles.night} testID="ascent-item">
        <Header ascent={ascent} onPause={leave} onLoadout={openLoadout} loadoutRef={opener} />
        {gained}
        <View style={styles.center}>
          <Text accessibilityRole="header" style={styles.title}>
            Objet trouvé
          </Text>
          {image === undefined ? (
            <SpriteCanvas
              sprite={`item-silhouette-${slot}`}
              draw={() => toPixelImage(itemSilhouette(slot))}
              scale={3}
              testID="item-silhouette"
            />
          ) : (
            // L'image validée dans l'Atelier (#119), à la place de la silhouette provisoire.
            <SpriteCanvas
              sprite={`item-${ascent.foundItem}`}
              draw={() => toPixelImage(assetSprite(image))}
              scale={3}
              testID="item-image"
            />
          )}
          <Text style={styles.gold}>{itemText(ascent.foundItem)}</Text>
          {description !== null && <Text style={styles.line}>{description}</Text>}
          <Text style={styles.line}>{`Tu portes : ${wornText(ascent.equipment, slot)}`}</Text>
          <Text style={styles.line}>Un objet laissé ne revient pas.</Text>
          <View style={styles.row}>
            <PixelButton
              label="Laisser"
              variant="secondary"
              onPress={() => session.leaveItem()}
              style={styles.half}
            />
            <PixelButton label="Équiper" onPress={() => session.equipItem()} style={styles.half} />
          </View>
        </View>
        {loadoutSheet}
      </Screen>
    );
  }

  if (ascent.boonOffer !== null) {
    return (
      <Screen layout="top" background={roles.night} testID="ascent-boons">
        <Header ascent={ascent} onPause={leave} onLoadout={openLoadout} loadoutRef={opener} />
        {gained}
        <BoonChoicePanel
          key={ascent.floor}
          offer={ascent.boonOffer}
          onChoose={(index) => session.chooseBoon(index)}
        />
        {loadoutSheet}
      </Screen>
    );
  }

  return (
    <Screen layout="top" background={roles.night} testID="ascent-exits">
      <Header ascent={ascent} onPause={leave} onLoadout={openLoadout} loadoutRef={opener} />
      <ExitChoice
        key={ascent.floor}
        boons={ascent.hero.boons}
        exits={ascent.exits}
        banner={gained}
        onChoose={(index) => session.chooseExit(index)}
      />
      {loadoutSheet}
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
  status: {
    flex: 1,
    fontFamily: textFont.semiBold,
    fontSize: 13,
    lineHeight: 18,
    color: roles.parchment,
  },
  pause: { minWidth: 84, paddingHorizontal: 14 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'stretch', padding: 24, gap: 12 },
  title: {
    fontFamily: pixelFont,
    fontSize: 22,
    lineHeight: 26,
    color: roles.light,
    textAlign: 'center',
  },
  big: {
    fontFamily: pixelFont,
    fontSize: 40,
    lineHeight: 46,
    color: roles.light,
    textAlign: 'center',
  },
  fall: { color: roles.error },
  line: { ...pixelTypography.body, color: roles.parchment, textAlign: 'center' },
  gold: {
    fontFamily: pixelFont,
    fontSize: 18,
    lineHeight: 22,
    color: roles.gold,
    textAlign: 'center',
  },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  half: { flex: 1 },
});
