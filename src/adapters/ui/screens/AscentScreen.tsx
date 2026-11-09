import { type Ref, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import type { AscentSession } from '../../../application/useCases/AscentSession';
import type { LogExport } from '../../../application/useCases/exportAscentLog';
import { canReroll, type Ascent, type TierPassage } from '../../../domain/ascent/Ascent';
import { favorRerolls } from '../../../domain/ascent/fateGauge';
import { loadoutOf } from '../../../domain/ascent/loadout';
import { SUMMIT_SHARDS, shardSum } from '../../../domain/ascent/shards';
import { BoonChoicePanel } from '../battle/BoonChoicePanel';
import type { SceneArea } from '../battle/scene/backdropVeil';
import { TierBackdrop } from '../battle/TierBackdrop';
import { BlessingChoice } from '../components/BlessingChoice';
import { ExitChoice } from '../components/ExitChoice';
import { FoundItemPanel } from '../components/FoundItemPanel';
import { KeysEntry } from '../components/KeysEntry';
import { LoadoutButton } from '../components/LoadoutButton';
import { LogExportButton } from '../components/LogExportButton';
import { LoadoutSheet } from '../components/LoadoutSheet';
import { Screen } from '../components/Screen';
import { SealedChestPanel } from '../components/SealedChestPanel';
import {
  TIER_NAMES,
  bossDefeatedAnnouncement,
  floorLine,
  goldText,
  shardText,
  shardsWonText,
  summitAnnouncement,
  tierAnnouncement,
} from '../format/ascentText';
import { HERO_NAMES } from '../format/battleText';
import {
  FROM_SEALED_CHEST,
  keysText,
  sealedLeftAnnouncement,
  sealedLeftBand,
} from '../format/sealedChestText';
import { artPalette } from '../pixelArt/artPalette';
import { PixelButton } from '../pixelArt/PixelButton';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { pixelFont, pixelTypography, textFont } from '../pixelArt/pixelTypography';
import { useAscent } from '../state/useAscent';
import { useLargeText } from '../state/useLargeText';
import { useShardTotal } from '../state/useShardTotal';
import { useHabitNames } from '../state/useHabitNames';
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
  /** « Aller au camp » depuis le bilan de fin (#40, C11) ; absent, aucun bouton. */
  readonly onCamp?: (() => void) | undefined;
  /** L'Export du journal (#196), build de preview seulement ; absent, aucun bouton. */
  readonly logExport?: LogExport | undefined;
}

/** En deçà de cette largeur d'écran, en dp, le statut de l'en-tête passe au-dessus des boutons. */
export const NARROW_HEADER_WIDTH = 375;

function useStackedHeader(): boolean {
  const { width } = useWindowDimensions();
  return useLargeText() || width < NARROW_HEADER_WIDTH;
}

function Header({
  ascent,
  extra,
  onPause,
  onLoadout,
  combat = false,
  loadoutRef,
  keySpent = false,
}: {
  readonly ascent: Ascent;
  readonly extra?: string | null;
  /** Une clé vient d'être dépensée (#226, S3) : « −1 clé » monte de l'en-tête. */
  readonly keySpent?: boolean;
  readonly onPause?: () => void;
  /** Le bouton « Équipement » (#159) : ce qu'il ouvre, s'il met le combat en pause, et son focus. */
  readonly onLoadout?: () => void;
  readonly combat?: boolean;
  readonly loadoutRef?: Ref<View>;
}) {
  const parts = [
    floorLine(ascent.floor, ascent.tier),
    `${ascent.hero.hp}/${ascent.hero.maxHp} PV`,
    goldText(ascent.gold),
  ];
  const buttons = (
    <>
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
    </>
  );
  // Sur un téléphone étroit ou en grand texte, le statut passe sur sa propre ligne, au-dessus des
  // deux boutons : à côté d'eux, il s'étirerait sur plusieurs lignes et repousserait la scène (#159).
  const stacked = useStackedHeader();
  return (
    <View testID="ascent-header" style={[styles.header, stacked && styles.headerStacked]}>
      <Text testID="ascent-status" style={[styles.status, stacked && styles.statusStacked]}>
        {parts.join(' · ')}
        {ascent.keys > 0 && (
          // Les clés après l'Or (#226, H1, H2), à partir d'une clé ; le glyphe est caché au lecteur.
          <>
            {' · '}
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              testID="ascent-status-key"
            >
              <PixelIcon name="key8" color={roles.gold} />
            </View>
            {keysText(ascent.keys)}
          </>
        )}
        {extra ? ` · ${extra}` : null}
      </Text>
      {keySpent && (
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          testID="ascent-keys-float"
          style={styles.keysFloat}
        >
          −1 clé
        </Text>
      )}
      {stacked ? (
        <View testID="ascent-header-buttons" style={styles.headerButtons}>
          {buttons}
        </View>
      ) : (
        buttons
      )}
    </View>
  );
}

/** Le combat de l'étage, sur l'écran du combat ; la réserve se lit par « +N en réserve ». */
function FloorBattle({
  session,
  ascent,
  onPause,
  onLoadout,
  loadoutRef,
  onSceneArea,
}: {
  readonly session: AscentSession;
  readonly ascent: Ascent;
  readonly onPause: () => void;
  readonly onLoadout: () => void;
  readonly loadoutRef: Ref<View>;
  readonly onSceneArea: (top: number, bottom: number) => void;
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
        onLoadout={onLoadout}
        combat
        loadoutRef={loadoutRef}
      />
      <BattleScreen
        session={battleSession}
        title={ascent.encounter?.kind === 'boss' ? 'Le boss' : `Étage ${ascent.floor}`}
        onSceneArea={onSceneArea}
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

/** La clé de l'objet trouvé en attente (#227) : son palier, son étage et l'objet ; `null` sans objet. */
function foundItemKey(ascent: Ascent): string | null {
  return ascent.foundItem === null ? null : `${ascent.tier}-${ascent.floor}-${ascent.foundItem}`;
}

/** Annonce `message` au lecteur d'écran, une fois, à l'affichage de l'écran. */
function useAnnouncement(message: string): void {
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(message);
  }, [message]);
}

/** Les Éclats en grand : l'éclat de cristal et « +8 », lus d'un trait. */
function BigShards({ shards, label }: { readonly shards: number; readonly label: string }) {
  return (
    <View accessible accessibilityLabel={label} style={styles.bigShards}>
      <PixelIcon name="shard12" color={roles.shard} secondColor={roles.light} />
      <Text style={styles.shards}>{`+${shards}`}</Text>
    </View>
  );
}

/**
 * L'écran du boss vaincu (X3, #38, maquette 30) : les Éclats du boss en grand, gardés pour
 * toujours, l'Or, puis « Continuer vers le palier N » ou « Faire une pause ». Le coffre et le
 * bienfait de la maquette (#37) ne sont pas repris.
 */
function BossDefeated({
  ascent,
  passage,
  onContinue,
  onPause,
}: {
  readonly ascent: Ascent;
  readonly passage: TierPassage;
  readonly onContinue: () => void;
  readonly onPause: () => void;
}) {
  const shards = ascent.shardAwards.at(-1)?.amount ?? 0;
  useAnnouncement(bossDefeatedAnnouncement(shards));
  return (
    <View style={styles.center}>
      <Text style={styles.label}>Boss vaincu</Text>
      <Text accessibilityRole="header" style={styles.big}>
        {`Palier ${ascent.tier} franchi`}
      </Text>
      <BigShards shards={shards} label={bossDefeatedAnnouncement(shards)} />
      <Text style={styles.line}>Éclats · gardés pour toujours, même si tu tombes.</Text>
      <View style={styles.reward}>
        <PixelIcon name="coin8" color={roles.gold} secondColor={roles.light} />
        <Text style={styles.gold}>{`+${goldText(ascent.lastGold)}`}</Text>
      </View>
      <PixelButton label={`Continuer vers le palier ${passage.to}`} onPress={onContinue} />
      <PixelButton label="Faire une pause" variant="secondary" onPress={onPause} />
    </View>
  );
}

/** L'écran de transition (C4, #38, maquette 30) : le palier franchi, puis le palier suivant. */
function TierAnnounce({
  passage,
  onEnter,
}: {
  readonly passage: TierPassage;
  readonly onEnter: () => void;
}) {
  useAnnouncement(tierAnnouncement(passage.to));
  return (
    <View style={styles.center}>
      <Text style={styles.label}>{`Palier ${passage.to - 1} franchi`}</Text>
      <Text style={[styles.label, styles.light]}>{`Palier ${passage.to}`}</Text>
      <Text accessibilityRole="header" style={styles.big}>
        {TIER_NAMES[passage.to]}
      </Text>
      <Text style={styles.line}>Les ennemis y sont plus forts.</Text>
      <PixelButton label="Entrer" onPress={onEnter} />
    </View>
  );
}

/**
 * La fin de l'ascension (X6) ou le Sommet atteint (X7) (#38, maquette 30) : les Éclats gagnés en
 * grand, le Total d'Éclats, ce qui reste (vert) et ce qui est perdu (rouge), puis « Retour au pied
 * de la tour » et, dessous, « Aller au camp » (#40, C11). La Forgeronne n'est pas reprise, ni la
 * grille de statistiques de la maquette, que la story ne demande pas.
 */
function AscentEnd({
  ascent,
  shardTotal,
  onLeave,
  onCamp,
  logExport,
}: {
  readonly ascent: Ascent;
  readonly shardTotal: number;
  readonly onLeave: () => void;
  readonly onCamp: (() => void) | undefined;
  readonly logExport?: LogExport | undefined;
}) {
  const summit = ascent.outcome === 'victory';
  const won = shardSum(ascent.shardAwards);
  const hero = HERO_NAMES[ascent.hero.kind];
  const total = `Total : ${shardText(shardTotal)}`;
  return (
    <View style={styles.center}>
      {summit ? <SummitAnnouncement ascent={ascent} /> : null}
      <Text accessibilityRole="header" style={styles.big}>
        {summit ? 'Sommet atteint' : "Fin de l'ascension"}
      </Text>
      <Text style={styles.line}>
        {summit
          ? `Les trois paliers franchis avec ${hero.charAt(0).toLowerCase()}${hero.slice(1)}.`
          : `${hero} est tombée au palier ${ascent.tier}, étage ${ascent.floor}.`}
      </Text>
      <Text style={styles.label}>Éclats gagnés</Text>
      <BigShards shards={won} label={shardsWonText(won)} />
      <Text style={styles.line}>
        {summit ? `Dont ${SUMMIT_SHARDS} pour le Sommet · ${total}` : total}
      </Text>
      <View style={styles.reward} testID="ascent-end-kept">
        <PixelIcon name="check8" color={roles.done} />
        <Text style={[styles.line, styles.kept]}>Tu gardes tes Éclats.</Text>
      </View>
      <View style={styles.reward} testID="ascent-end-lost">
        <PixelIcon name="cross8" color={roles.error} />
        <Text style={[styles.line, styles.lost]}>
          {`L'Or (${goldText(ascent.gold)}), l'équipement et les bienfaits de cette ascension sont perdus.`}
        </Text>
      </View>
      <PixelButton label="Retour au pied de la tour" onPress={onLeave} />
      {onCamp === undefined ? null : (
        <PixelButton label="Aller au camp" variant="secondary" onPress={onCamp}>
          <View style={styles.camp}>
            <PixelIcon name="flame8" color={roles.ember} secondColor={roles.gold} />
            <Text style={styles.campText}>Aller au camp</Text>
          </View>
        </PixelButton>
      )}
      {logExport === undefined ? null : (
        <LogExportButton logExport={logExport} revision={ascent} showCount={false} />
      )}
    </View>
  );
}

/** L'annonce du Sommet : les Éclats du boss du palier 3 et du Sommet, gagnés d'un coup. */
function SummitAnnouncement({ ascent }: { readonly ascent: Ascent }) {
  useAnnouncement(summitAnnouncement(shardSum(ascent.shardAwards.slice(-2))));
  return null;
}

/**
 * L'écran de l'ascension (prototype #91) : le combat de l'étage, le choix de sortie (la porte
 * Combat annonce la taille du groupe), et le bilan de fin (victoire, chute ; l'Or est perdu à la
 * fin). Passer en arrière-plan met en pause ; la reprise d'un combat commence par un compte à
 * rebours de 3 s, sans aucun appui.
 */
export function AscentScreen({
  session,
  visibility,
  onLeave,
  onCamp,
  logExport,
}: AscentScreenProps) {
  const ascent = useAscent(session);
  const shardTotal = useShardTotal(session);
  const habitNames = useHabitNames();
  // L'objet déjà en attente à l'ouverture de l'écran (#227) : la reprise le montre hors du coffre,
  // sans rejouer l'ouverture ; un objet trouvé pendant que l'écran est ouvert sort du coffre.
  const [pendingAtMount] = useState(() => (ascent === null ? null : foundItemKey(ascent)));
  // L'ouverture du coffre scellé qui se joue (#226, S3), et les clés gardées après « Laisser »
  // (S8) : des états de l'écran seulement, jamais rejoués à la reprise.
  const [sealedOpening, setSealedOpening] = useState(false);
  const [leftBand, setLeftBand] = useState<number | null>(null);
  const [, setEntered] = useState(0);
  const [counting, setCounting] = useState(() => session.resuming());
  const [paused, setPaused] = useState(false);
  const [mount, setMount] = useState(0);
  const [sheet, setSheet] = useState<'closed' | 'calm' | 'battle'>('closed');
  const loadoutOpen = sheet !== 'closed';
  const opener = useRef<View>(null);
  // La feuille de l'Équipement ouverte en combat retient le combat en pause (#159).
  const sheetHolds = useRef(false);
  // Le cadre de la scène du combat monté (#176), retenu avec la clé de ce combat : celui d'un combat
  // précédent ne vaut plus.
  const [measured, setMeasured] = useState<{ key: string; area: SceneArea } | null>(null);
  const battleKey = ascent === null ? '' : `${ascent.tier}-${ascent.floor}-${mount}`;
  const onSceneArea = useCallback(
    (top: number, bottom: number) => setMeasured({ key: battleKey, area: { top, bottom } }),
    [battleKey],
  );

  /**
   * Le seul point qui décide de la reprise du combat après une pause (P33, #159) : rien tant que la
   * feuille de l'Équipement retient le combat ; sinon le compte à rebours, si un combat est à
   * reprendre, puis le combat remonté, qui reprend l'action en cours avec le même tirage.
   */
  const resumeUnlessHeld = useCallback(() => {
    if (sheetHolds.current) return;
    setCounting(session.resuming());
    setMount((count) => count + 1);
  }, [session]);

  useEffect(
    () =>
      visibility.onChange((visible) => {
        if (!visible) {
          session.pause();
          setPaused(true);
          return;
        }
        setPaused(false);
        resumeUnlessHeld();
      }),
    [session, visibility, resumeUnlessHeld],
  );

  // Quitter l'écran (Pause, retour arrière) met en pause et sauvegarde (P33).
  useEffect(() => () => session.pause(), [session]);

  const leave = () => {
    session.pause();
    onLeave();
  };

  // La feuille de l'Équipement (#159) : hors combat, rien n'est mis en pause et l'écran garde son
  // état ; en combat, elle met le combat en pause, exactement comme « Pause », et sa fermeture le
  // reprend.
  const openLoadout = () => setSheet('calm');
  const openLoadoutInBattle = () => {
    session.pause();
    sheetHolds.current = true;
    setSheet('battle');
  };
  const closeLoadout = () => {
    setSheet('closed');
    if (sheetHolds.current) {
      sheetHolds.current = false;
      resumeUnlessHeld();
    }
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
    return (
      <Screen layout="top" background={roles.night} testID="ascent-end">
        <AscentEnd
          ascent={ascent}
          shardTotal={shardTotal}
          logExport={logExport}
          onLeave={() => {
            session.leave();
            onLeave();
          }}
          onCamp={
            onCamp === undefined
              ? undefined
              : () => {
                  session.leave();
                  onCamp();
                }
          }
        />
      </Screen>
    );
  }

  // Le Passage de palier (#38) : l'écran du boss vaincu, puis celui de la transition.
  if (ascent.passage !== null) {
    const { passage } = ascent;
    return passage.step === 'bossDefeated' ? (
      <Screen layout="top" background={roles.night} testID="ascent-boss-defeated">
        <BossDefeated
          ascent={ascent}
          passage={passage}
          onContinue={() => session.acknowledgeBossVictory()}
          onPause={leave}
        />
      </Screen>
    ) : (
      <Screen layout="top" background={roles.night} testID="ascent-tier">
        <TierAnnounce passage={passage} onEnter={() => session.enterNextTier()} />
      </Screen>
    );
  }

  // Une seule feuille de l'Équipement, au niveau de l'écran, quel que soit l'écran de l'ascension.
  const loadoutSheet = (
    <LoadoutSheet
      loadout={loadoutOf(ascent)}
      combat={sheet === 'battle'}
      visible={loadoutOpen}
      habitNames={habitNames}
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

  // L'entrée dans la tour avec des clés (#226, F4), avant le premier combat.
  const entry = ascent.encounter === null ? null : session.keysEntry();
  if (entry !== null) {
    const fortune = ascent.blessings.find(({ family }) => family === 'fortune');
    return (
      <Screen layout="top" background={roles.night} testID="ascent-keys-entry">
        <Header ascent={ascent} onPause={leave} onLoadout={openLoadout} loadoutRef={opener} />
        <KeysEntry
          sources={entry}
          fortuneRarity={fortune?.rarity ?? null}
          onDone={() => {
            session.acknowledgeKeysEntry();
            setEntered((count) => count + 1);
          }}
        />
        {loadoutSheet}
      </Screen>
    );
  }

  if (ascent.encounter !== null) {
    // Le combat n'est rendu que s'il n'est ni en pause, ni retenu par la feuille, ni en reprise.
    const fighting = !paused && !loadoutOpen && !counting;
    // Le fond de palier reste le même pendant le compte à rebours, la feuille et la pause (#176) ;
    // tant que la scène du combat n'est pas mesurée, son voile couvre tout l'écran.
    const scene = fighting && measured?.key === battleKey ? measured.area : null;
    return (
      <View style={styles.battle} testID="ascent-battle-backdrop">
        <TierBackdrop tier={ascent.tier} scene={scene} />
        <Screen layout="top" background="transparent" testID="ascent-battle">
          {paused ? null : loadoutOpen || counting ? (
            <>
              <Header
                ascent={ascent}
                onPause={leave}
                onLoadout={openLoadoutInBattle}
                combat
                loadoutRef={opener}
              />
              {loadoutOpen ? null : <Countdown onDone={() => setCounting(false)} />}
            </>
          ) : (
            <FloorBattle
              key={battleKey}
              session={session}
              ascent={ascent}
              onPause={leave}
              onLoadout={openLoadoutInBattle}
              loadoutRef={opener}
              onSceneArea={onSceneArea}
            />
          )}
          {loadoutSheet}
        </Screen>
      </View>
    );
  }

  // En fin de combat : l'Or, puis l'objet trouvé (#93), puis le bienfait (#92), puis les sorties.
  const gained =
    ascent.lastGold > 0 ? (
      <Text style={styles.gold}>{`Étage franchi · +${goldText(ascent.lastGold)}`}</Text>
    ) : null;

  // L'objet du coffre scellé ouvert (#226) : l'ouverture se joue d'abord, puis l'objet, sans Coffre.
  const fromSealedChest = ascent.sealedChest?.opened === true;
  if (ascent.foundItem !== null && fromSealedChest && sealedOpening) {
    return (
      <Screen layout="top" background={roles.night} testID="ascent-sealed-chest">
        <Header
          ascent={ascent}
          onPause={leave}
          onLoadout={openLoadout}
          loadoutRef={opener}
          keySpent
        />
        <SealedChestPanel
          keys={ascent.keys}
          opening
          onOpen={() => undefined}
          onLeave={() => undefined}
          onOpened={() => setSealedOpening(false)}
        />
        {loadoutSheet}
      </Screen>
    );
  }

  if (ascent.foundItem !== null) {
    const revealKey = foundItemKey(ascent);
    return (
      <Screen layout="top" background={roles.night} testID="ascent-item">
        <Header ascent={ascent} onPause={leave} onLoadout={openLoadout} loadoutRef={opener} />
        {fromSealedChest ? null : gained}
        <FoundItemPanel
          key={revealKey}
          item={ascent.foundItem}
          equipment={ascent.equipment}
          animate={revealKey !== pendingAtMount}
          {...(fromSealedChest && { chest: false, source: FROM_SEALED_CHEST })}
          onLeave={() => session.leaveItem()}
          onEquip={() => session.equipItem()}
        />
        {loadoutSheet}
      </Screen>
    );
  }

  // Le coffre scellé de l'Élite (#226, CH2), après l'objet garanti et avant l'offre de bienfaits.
  if (ascent.sealedChest !== null) {
    const { keys } = ascent;
    return (
      <Screen layout="top" background={roles.night} testID="ascent-sealed-chest">
        <Header ascent={ascent} onPause={leave} onLoadout={openLoadout} loadoutRef={opener} />
        <SealedChestPanel
          keys={keys}
          opening={false}
          onOpen={() => {
            setSealedOpening(true);
            session.openSealedChest();
          }}
          onLeave={() => {
            // « Laisser », sans confirmation (décision du 06/11/2026) ; « Continuer » sans clé.
            if (keys > 0) {
              setLeftBand(keys);
              AccessibilityInfo.announceForAccessibility(sealedLeftAnnouncement(keys));
            }
            session.leaveSealedChest();
          }}
          onOpened={() => undefined}
        />
        {loadoutSheet}
      </Screen>
    );
  }

  if (ascent.boonOffer !== null) {
    return (
      <Screen layout="top" background={roles.night} testID="ascent-boons">
        <Header ascent={ascent} onPause={leave} onLoadout={openLoadout} loadoutRef={opener} />
        {gained}
        {leftBand !== null && (
          <View accessible role="status" testID="sealed-left-band" style={styles.band}>
            <PixelIcon name="lock" color={roles.parchment} />
            <Text style={styles.bandText}>{sealedLeftBand(leftBand)}</Text>
          </View>
        )}
        <BoonChoicePanel
          key={ascent.floor}
          offer={ascent.boonOffer}
          heroHp={ascent.hero.hp}
          heroMaxHp={ascent.hero.maxHp}
          onChoose={(index) => {
            setLeftBand(null);
            session.chooseBoon(index);
          }}
          reroll={{
            left: ascent.rerolls,
            granted: favorRerolls(ascent.gauge),
            available: canReroll(ascent),
          }}
          onReroll={() => session.reroll()}
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
        gauge={ascent.gauge}
        tier={ascent.tier}
        banner={gained}
        onChoose={(index) => session.chooseExit(index)}
      />
      {loadoutSheet}
    </Screen>
  );
}

// Stryker disable all: styles d'un écran de prototype.
const styles = StyleSheet.create({
  camp: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  campText: { fontFamily: textFont.bold, fontSize: 15, lineHeight: 19, color: roles.light },
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
  headerStacked: { flexDirection: 'column', alignItems: 'stretch', paddingVertical: 4, gap: 4 },
  statusStacked: { flex: 0 },
  keysFloat: {
    position: 'absolute',
    left: 16,
    bottom: -14,
    fontFamily: textFont.bold,
    fontSize: 12,
    lineHeight: 16,
    color: roles.gold,
  },
  band: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: roles.raised,
  },
  bandText: {
    flex: 1,
    fontFamily: textFont.medium,
    fontSize: 13,
    lineHeight: 18,
    color: roles.parchment,
  },
  headerButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  pause: { minWidth: 84, paddingHorizontal: 14 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'stretch', padding: 24, gap: 12 },
  big: {
    fontFamily: pixelFont,
    fontSize: 40,
    lineHeight: 46,
    color: roles.light,
    textAlign: 'center',
  },
  label: {
    fontFamily: pixelFont,
    fontSize: 14,
    lineHeight: 18,
    color: roles.parchment,
    textAlign: 'center',
  },
  light: { color: roles.light },
  bigShards: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  shards: { fontFamily: pixelFont, fontSize: 48, lineHeight: 54, color: roles.shard },
  reward: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  kept: { color: roles.done, flexShrink: 1 },
  lost: { color: roles.error, flexShrink: 1 },
  line: { ...pixelTypography.body, color: roles.parchment, textAlign: 'center' },
  gold: {
    fontFamily: pixelFont,
    fontSize: 18,
    lineHeight: 22,
    color: roles.gold,
    textAlign: 'center',
  },
  battle: { flex: 1, backgroundColor: roles.night },
});
