import { type ReactNode, type Ref, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { AscentSession } from '../../../application/useCases/AscentSession';
import type { CampSession, CampView } from '../../../application/useCases/CampSession';
import type { LogExport } from '../../../application/useCases/exportAscentLog';
import type { FateGaugeReading } from '../../../application/useCases/fateGauge';
import type { Ascent } from '../../../domain/ascent/Ascent';
import type { FateGauge } from '../../../domain/ascent/fateGauge';
import { loadoutOf, loadoutSize } from '../../../domain/ascent/loadout';
import type { Tier } from '../../../domain/ascent/tiers';
import type { HeroKind } from '../../../domain/battle/combatants';
import type { PowerKind } from '../../../domain/battle/powers';
import { TowerFootBackdrop } from '../battle/TierBackdrop';
import { towerFootTier } from '../battle/scene/towerFootTier';
import { GaugeDetailSheet } from '../components/GaugeDetailSheet';
import { GaugeDial, GaugeEffectList } from '../components/GaugeDial';
import { LoadoutSection } from '../components/LoadoutSection';
import { LogExportButton } from '../components/LogExportButton';
import { LoadoutSheet } from '../components/LoadoutSheet';
import { Screen } from '../components/Screen';
import { ScrollHint } from '../components/ScrollHint';
import {
  TIER_LINE,
  TOWER_TITLE,
  floorLine,
  goldText,
  shardText,
  tierLine,
} from '../format/ascentText';
import { HERO_NAMES } from '../format/battleText';
import { heroOathLine, type HeroOathLine } from '../format/oathText';
import { keysText } from '../format/sealedChestText';
import {
  ASCENT_GAUGE_TITLE,
  ASCENT_KEEPS_GAUGE,
  DAY_GAUGE_TITLE,
  DETAIL_LINK,
  GAUGE_LOADING,
  GAUGE_REASSURANCE,
  NOT_YET_LINE,
  OPEN_DETAIL,
  SEALED_LINE,
  UNREADABLE_TEXT,
  ascentFavorEffects,
  ascentGaugeAnnouncement,
  gaugeAnnouncement,
  gaugeChangedText,
  gaugeEffects,
  gaugeReason,
  isFirstUse,
  nextAscentLine,
} from '../format/gaugeText';
import { artPalette } from '../pixelArt/artPalette';
import { PixelButton } from '../pixelArt/PixelButton';
import { PixelFrame } from '../pixelArt/PixelFrame';
import { artPixelSize } from '../pixelArt/artPixel';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { PixelSkeleton } from '../pixelArt/PixelSkeleton';
import { pixelTypography, textFont } from '../pixelArt/pixelTypography';
import { CAMP_TITLE } from '../format/campText';
import { useAscent } from '../state/useAscent';
import { useCamp } from '../state/useCamp';
import { useFateGauge } from '../state/useFateGauge';
import { useHabitNames } from '../state/useHabitNames';
import { HeroChoiceScreen } from './HeroChoiceScreen';

const { roles } = artPalette;

/** « la Sentinelle », « l'Errante » : le héros dans une phrase. */
function heroInSentence(hero: HeroKind): string {
  const name = HERO_NAMES[hero];
  return name.charAt(0).toLowerCase() + name.slice(1);
}

/**
 * Les Éclats disponibles (#38, maquette 30 ; #40, maquette 40, C1) : l'éclat de cristal et
 * « 22 Éclats », « 0 Éclat », le même nombre qu'au camp, toujours visible, ascension en cours ou non.
 * Sans Déblocage, c'est le Total d'Éclats.
 */
function ShardChip({ total }: { readonly total: number }) {
  return (
    <View
      accessible
      accessibilityLabel={shardText(total)}
      testID="tower-foot-shards"
      style={styles.shards}
    >
      <PixelIcon name="shard8" color={roles.shard} secondColor={roles.light} />
      <Text style={styles.shardText}>{shardText(total)}</Text>
    </View>
  );
}

/**
 * L'en-tête du pied de la tour (titre « La tour », Éclats, ligne du palier), mesuré dans la fenêtre
 * à chaque mise en page (#233) : le voile fort du décor s'arrête à son bas. Le contenu centré bouge
 * quand la jauge ou la bande « jauge changée » apparaît : il est remesuré à chaque fois.
 */
function TowerFootHeader({
  children,
  onBottom,
}: {
  readonly children: ReactNode;
  readonly onBottom: (bottom: number) => void;
}) {
  const view = useRef<View>(null);
  return (
    <View
      ref={view}
      testID="tower-foot-header"
      style={styles.header}
      onLayout={() =>
        view.current?.measureInWindow((_x, y, _width, height) => onBottom(y + height))
      }
    >
      {children}
    </View>
  );
}

/**
 * Le pied de la tour sur son décor (#233) : le fond du palier `tier` sous un voile de la nuit, puis
 * l'écran, transparent, par-dessus ; comme l'écran de combat, le décor passe sous la barre d'état.
 */
function OnBackdrop({
  tier,
  headerBottom,
  children,
}: {
  readonly tier: Tier;
  readonly headerBottom: number | null;
  readonly children: ReactNode;
}) {
  return (
    <View style={styles.backdrop}>
      <TowerFootBackdrop tier={tier} headerBottom={headerBottom} />
      <Screen layout="top" background="transparent" testID="tower-foot">
        {children}
      </Screen>
    </View>
  );
}

/** « Le camp » (#40, C1 et C2) : un bouton secondaire, avec la petite flamme de braise. */
function CampButton({ onCamp }: { readonly onCamp: () => void }) {
  return (
    <PixelButton label={CAMP_TITLE} variant="secondary" onPress={onCamp}>
      <View style={styles.camp}>
        <PixelIcon name="flame8" color={roles.ember} secondColor={roles.gold} />
        <Text style={styles.campText}>{CAMP_TITLE}</Text>
      </View>
    </PixelButton>
  );
}

/** L'en-tête d'un cadre de jauge : son titre et « Détail ›». */
function GaugeHead({ title }: { readonly title: string }) {
  return (
    <View style={styles.gaugeHead}>
      <Text style={styles.gaugeTitle}>{title}</Text>
      <Text style={styles.gaugeMore}>{`${DETAIL_LINK} ›`}</Text>
    </View>
  );
}

/**
 * La jauge du jour au pied de la tour (#41, maquette 205, G1 à G8) : tout le cadre est un bouton qui
 * ouvre son détail. Le cadran, le compte d'hier (ou « pas encore », ou la lecture en échec), ses
 * effets, la phrase rassurante d'une malédiction et le scellement. Le lecteur d'écran lit le mot,
 * la valeur, puis le compte d'hier.
 */
function GaugeCard({
  reading,
  onOpen,
  ref,
}: {
  readonly reading: FateGaugeReading;
  readonly onOpen: () => void;
  readonly ref: Ref<View>;
}) {
  const firstUse = isFirstUse(reading);
  const effects = gaugeEffects(reading);
  const line = artPixelSize(2);
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={`${gaugeAnnouncement(reading)} ${OPEN_DETAIL}`}
      onPress={onOpen}
      testID="gauge-card"
    >
      <PixelFrame style={styles.gaugeCard}>
        <GaugeHead title={DAY_GAUGE_TITLE} />
        <GaugeDial gauge={reading.gauge} notYet={firstUse} sealed={reading.sealed} />
        {!reading.unreadable && <Text style={styles.gaugeLine}>{gaugeReason(reading)}</Text>}
        {firstUse && <Text style={styles.gaugeSoft}>{NOT_YET_LINE}</Text>}
        {reading.unreadable && (
          <View style={[styles.infoBand, { borderWidth: line }]}>
            <View style={styles.infoDot} />
            <Text style={styles.infoText}>{UNREADABLE_TEXT}</Text>
          </View>
        )}
        {effects.length > 0 && <GaugeEffectList effects={effects} />}
        {reading.gauge < 0 && (
          <Text style={[styles.reassurance, { borderWidth: line }]}>{GAUGE_REASSURANCE}</Text>
        )}
        {reading.sealed && <Text style={styles.gaugeSoft}>{SEALED_LINE}</Text>}
      </PixelFrame>
    </Pressable>
  );
}

/** La jauge de l'ascension en cours (G9) : gardée jusqu'à la fin de l'ascension. */
function AscentGaugeCard({
  gauge,
  rerolls,
  secondChance,
  onOpen,
  ref,
}: {
  readonly gauge: FateGauge;
  /** Les relances qui restent (#42, G9). */
  readonly rerolls: number;
  /** La seconde chance encore là (#206, G9). */
  readonly secondChance: boolean;
  readonly onOpen: () => void;
  readonly ref: Ref<View>;
}) {
  const favor = ascentFavorEffects({ gauge, rerolls, secondChance });
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={`${ascentGaugeAnnouncement(gauge, rerolls, secondChance)} ${OPEN_DETAIL}`}
      onPress={onOpen}
      testID="ascent-gauge-card"
      style={styles.ascentGauge}
    >
      <GaugeHead title={ASCENT_GAUGE_TITLE} />
      <GaugeDial gauge={gauge} small />
      <Text style={styles.gaugeSoft}>{ASCENT_KEEPS_GAUGE}</Text>
      {favor.length > 0 && <GaugeEffectList effects={favor} />}
    </Pressable>
  );
}

/**
 * Le bandeau d'une correction d'hier qui change la jauge avant le lancement (G11) : vert quand elle
 * monte, sans rouge quand elle baisse. Annoncé poliment.
 */
function GaugeChangedBand({ gauge, rose }: { readonly gauge: FateGauge; readonly rose: boolean }) {
  return (
    <View
      accessibilityLiveRegion="polite"
      role="status"
      style={[
        styles.changedBand,
        { borderWidth: artPixelSize(2) },
        rose && { backgroundColor: roles.doneBg, borderColor: roles.doneLine },
      ]}
    >
      {rose && <PixelIcon name="check8" color={roles.done} />}
      <Text style={styles.infoText}>{gaugeChangedText(gauge, rose)}</Text>
    </View>
  );
}

/** Le changement de la jauge du jour entre deux lectures, hors scellement et lecture en échec. */
function useGaugeChange(reading: FateGaugeReading | null) {
  const previous = useRef(reading);
  const [change, setChange] = useState<{ gauge: FateGauge; rose: boolean } | null>(null);
  useEffect(() => {
    const before = previous.current;
    previous.current = reading;
    if (
      before === null ||
      reading === null ||
      reading.sealed ||
      before.unreadable ||
      reading.unreadable ||
      before.gauge === reading.gauge
    ) {
      return;
    }
    setChange({ gauge: reading.gauge, rose: reading.gauge > before.gauge });
  }, [reading]);
  return change;
}

/** Au-delà de ce nombre d'entrées, le cadre de l'ascension annonce qu'il défile (maquette #153). */
const SCROLL_HINT_BEYOND = 5;

/**
 * L'ascension en cours au pied de la tour : son cadre défile (héros, étage, PV, Or, jauge, puis
 * l'Équipement, #159), « Reprendre » et « Abandonner » restent en bas, à portée du pouce. « Voir le
 * détail » ouvre la feuille de l'Équipement, sans pause ; sa fermeture rend le focus au lien.
 */
function AscentInProgress({
  ascent,
  shards,
  onEnter,
  onCamp,
  onAbandon,
  foot,
  today,
  onHeaderBottom,
}: {
  readonly ascent: Ascent;
  readonly shards: number;
  readonly onEnter: () => void;
  readonly onCamp: () => void;
  readonly onAbandon: () => void;
  readonly foot: ReactNode;
  /** La jauge du jour, qui attend la prochaine ascension. */
  readonly today: FateGaugeReading | null;
  /** Le bas de l'en-tête, mesuré dans la fenêtre (#233). */
  readonly onHeaderBottom: (bottom: number) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [detail, setDetail] = useState(false);
  const [gaugeDetail, setGaugeDetail] = useState(false);
  const link = useRef<View>(null);
  const gaugeCard = useRef<View>(null);
  const loadout = loadoutOf(ascent);
  const habitNames = useHabitNames();
  const closeDetail = () => {
    setDetail(false);
    if (link.current !== null) AccessibilityInfo.sendAccessibilityEvent(link.current, 'focus');
  };
  const closeGaugeDetail = () => {
    setGaugeDetail(false);
    if (gaugeCard.current !== null) {
      AccessibilityInfo.sendAccessibilityEvent(gaugeCard.current, 'focus');
    }
  };
  return (
    <>
      <View style={styles.scrollArea}>
        <ScrollView testID="tower-foot-scroll" contentContainerStyle={styles.scroll}>
          <TowerFootHeader onBottom={onHeaderBottom}>
            <Text accessibilityRole="header" style={styles.title}>
              {TOWER_TITLE}
            </Text>
            <ShardChip total={shards} />
            <Text style={styles.line}>{tierLine(ascent.tier)}</Text>
          </TowerFootHeader>
          <PixelFrame testID="tower-foot-ascent" style={styles.frame}>
            <View style={styles.hero}>
              <Text style={styles.status}>{HERO_NAMES[ascent.hero.kind]}</Text>
              <Text style={styles.status}>
                {`${floorLine(ascent.floor, ascent.tier)} · ${ascent.hero.hp}/${ascent.hero.maxHp} PV · ${goldText(ascent.gold)}`}
              </Text>
              {ascent.keys > 0 && (
                // Les clés sous l'Or, sur leur propre ligne, à partir d'une clé (#226, T1).
                <View style={styles.keys} testID="tower-foot-keys">
                  <PixelIcon name="key8" color={roles.gold} />
                  <Text style={styles.status}>{keysText(ascent.keys)}</Text>
                </View>
              )}
            </View>
            <AscentGaugeCard
              ref={gaugeCard}
              gauge={ascent.gauge}
              rerolls={ascent.rerolls}
              secondChance={ascent.secondChance}
              onOpen={() => setGaugeDetail(true)}
            />
            <LoadoutSection ref={link} loadout={loadout} onDetail={() => setDetail(true)} />
          </PixelFrame>
          {today !== null && !today.sealed && (
            <Text style={[styles.discreet, styles.plate]}>{nextAscentLine(today.gauge)}</Text>
          )}
        </ScrollView>
        {loadoutSize(loadout) > SCROLL_HINT_BEYOND && (
          <ScrollHint under={roles.night} testID="tower-foot-more" />
        )}
      </View>
      {confirming ? (
        <View style={styles.bottom}>
          <Text style={[styles.line, styles.plate]}>
            Abandonner ? L&apos;ascension se termine comme une chute : l&apos;Or est perdu.
          </Text>
          <PixelButton label="Annuler" variant="secondary" onPress={() => setConfirming(false)} />
          <PixelButton
            label="Abandonner"
            variant="danger"
            onPress={() => {
              setConfirming(false);
              onAbandon();
            }}
          />
        </View>
      ) : (
        <View style={styles.bottom}>
          <PixelButton label="Reprendre l'ascension" onPress={onEnter} />
          <CampButton onCamp={onCamp} />
          <PixelButton
            label="Abandonner l'ascension"
            variant="secondary"
            onPress={() => setConfirming(true)}
          />
        </View>
      )}
      {foot}
      <LoadoutSheet
        loadout={loadout}
        combat={false}
        visible={detail}
        habitNames={habitNames}
        onClose={closeDetail}
      />
      <GaugeDetailSheet
        visible={gaugeDetail}
        gauge={ascent.gauge}
        reading={null}
        blessings={ascent.blessings.length}
        onClose={closeGaugeDetail}
      />
    </>
  );
}

/**
 * Ce que le Choix du héros montre des Serments (#237, S8, S9) : les pouvoirs qu'un lancement
 * attiserait, selon la jauge lue, et une ligne par pouvoir équipé sous Serment non rompu. Hier
 * illisible : rien.
 */
function heroOaths(
  camp: CampSession,
  view: CampView,
  reading: FateGaugeReading,
  selection: Readonly<Record<HeroKind, readonly PowerKind[]>>,
): {
  readonly kindled: Record<HeroKind, readonly PowerKind[]>;
  readonly oathLines: Record<HeroKind, readonly HeroOathLine[]>;
} {
  const doneYesterday = reading.unreadable ? null : reading.doneYesterday;
  const preview = camp.kindledPreview(doneYesterday, selection);
  const standings = camp.oathStandings(doneYesterday);
  const lines = (hero: HeroKind) =>
    selection[hero].flatMap((power) => {
      const oath = view.oaths[power];
      const standing = standings[power];
      if (
        oath === undefined ||
        oath.name === null ||
        standing === undefined ||
        standing === 'broken'
      )
        return [];
      return heroOathLine(power, oath.name, standing) ?? [];
    });
  return {
    kindled: {
      sentinel: preview.sentinel.map(({ power }) => power),
      wanderer: preview.wanderer.map(({ power }) => power),
    },
    oathLines: { sentinel: lines('sentinel'), wanderer: lines('wanderer') },
  };
}

/**
 * Le pied de la tour (`TowerFoot`, prototypes #91 à #93) : la jauge du jour, d'après hier, et
 * « Commencer l'ascension », puis le choix du héros, qui scelle la jauge ; ou, quand une ascension
 * est en cours (une seule à la fois), son héros, qui ne change plus, « Reprendre l'ascension » et
 * « Abandonner l'ascension », avec confirmation. `onEnter` ouvre l'ascension.
 *
 * « Le camp » (#40) ouvre le camp (`onCamp`), ascension en cours ou non. Les Éclats montrés sont les
 * Éclats disponibles, et une ascension commence par le camp, avec ses Déblocages (ADR 0017) : rien
 * ne s'affiche avant la lecture du camp.
 */
export function TowerFootScreen({
  session,
  camp,
  onEnter,
  onCamp,
  logExport,
  focused = true,
}: {
  readonly session: AscentSession;
  readonly camp: CampSession;
  readonly onEnter: () => void;
  readonly onCamp: () => void;
  /** L'onglet Tour est affiché ; il reste monté quand on le quitte. */
  readonly focused?: boolean;
  /** L'Export du journal (#196), build de preview seulement ; absent, aucun bouton. */
  readonly logExport?: LogExport | undefined;
}) {
  const ascent = useAscent(session);
  const campView = useCamp(camp);
  const shards = campView.availableShards;
  const [sessionLoaded, setLoaded] = useState(ascent !== null);
  const loaded = sessionLoaded && campView.status === 'ready';
  const { reading, seal } = useFateGauge();
  const [choosing, setChoosing] = useState<FateGaugeReading | null>(null);
  // La sélection en cours au Choix du héros (#236), la présélection du Camp tant qu'elle n'a pas
  // changé ; l'état de l'enregistrement du choix au lancement.
  const [chosen, setChosen] = useState<Partial<Record<HeroKind, readonly PowerKind[]>>>({});
  const [launching, setLaunching] = useState<'idle' | 'starting' | 'failed'>('idle');
  const selection: Record<HeroKind, readonly PowerKind[]> = {
    sentinel: chosen.sentinel ?? campView.equipped.sentinel,
    wanderer: chosen.wanderer ?? campView.equipped.wanderer,
  };
  const closeChoice = () => {
    setChoosing(null);
    setChosen({});
    setLaunching('idle');
  };
  const [gaugeDetail, setGaugeDetail] = useState(false);
  const gaugeCard = useRef<View>(null);
  const gaugeChange = useGaugeChange(reading);
  const [headerBottom, setHeaderBottom] = useState<number | null>(null);
  const closeGaugeDetail = () => {
    setGaugeDetail(false);
    if (gaugeCard.current !== null) {
      AccessibilityInfo.sendAccessibilityEvent(gaugeCard.current, 'focus');
    }
  };

  useEffect(() => {
    if (sessionLoaded) return;
    session
      .load()
      .catch(() => null)
      .finally(() => setLoaded(true));
  }, [session, sessionLoaded]);

  const inProgress = ascent !== null && ascent.outcome === null;
  // « Exporter le journal », en bas, sous les actions, séparé par un filet (maquette 193, P1 à P4).
  const foot =
    !loaded || logExport === undefined ? null : (
      <View testID="tower-foot-log-export" style={[styles.foot, styles.plate]}>
        <LogExportButton logExport={logExport} revision={ascent} showCount active={focused} />
      </View>
    );
  const start = async (reading: FateGaugeReading, hero: HeroKind) => {
    setLaunching('starting');
    const result = await camp.launchAscent({
      hero,
      gauge: reading.gauge,
      blessings: reading.blessings,
      // Les habitudes faites hier, scellées avec la jauge : elles attisent les Serments (#237).
      doneYesterday: reading.doneYesterday,
      // Les pouvoirs choisis, figés jusqu'à la fin de l'ascension (#236).
      powers: selection[hero],
    });
    // Un échec d'enregistrement garde l'écran et la sélection : « Réessayer » relance.
    if (result.kind === 'failed') {
      setLaunching('failed');
      return;
    }
    closeChoice();
    if (result.kind === 'refused') return;
    seal(reading);
    onEnter();
  };

  if (choosing !== null && !inProgress) {
    const { kindled, oathLines } = heroOaths(camp, campView, choosing, selection);
    return (
      <HeroChoiceScreen
        title="Choisir un héros"
        note="Il ne change plus jusqu'à la fin de l'ascension."
        confirmLabel={(hero) => `Continuer avec ${heroInSentence(hero)}`}
        onStart={(hero) => void start(choosing, hero)}
        onClose={closeChoice}
        equipped={selection}
        kindled={kindled}
        oathLines={oathLines}
        owned={campView.owned}
        onChangePowers={(hero, powers) => {
          setChosen((current) => ({ ...current, [hero]: powers }));
          setLaunching('idle');
        }}
        starting={launching === 'starting'}
        failed={launching === 'failed'}
      />
    );
  }

  if (loaded && inProgress) {
    return (
      <OnBackdrop tier={towerFootTier(ascent)} headerBottom={headerBottom}>
        <AscentInProgress
          ascent={ascent}
          shards={shards}
          onEnter={onEnter}
          onCamp={onCamp}
          onAbandon={() => session.abandon()}
          foot={foot}
          today={reading}
          onHeaderBottom={setHeaderBottom}
        />
      </OnBackdrop>
    );
  }

  return (
    <OnBackdrop tier={towerFootTier(ascent)} headerBottom={headerBottom}>
      <View style={styles.content}>
        <TowerFootHeader onBottom={setHeaderBottom}>
          <Text accessibilityRole="header" style={styles.title}>
            {TOWER_TITLE}
          </Text>
          {!loaded ? null : <ShardChip total={shards} />}
          <Text style={styles.line}>{TIER_LINE}</Text>
        </TowerFootHeader>
        {!loaded ? null : (
          <View style={styles.actions}>
            {ascent === null ? null : (
              <Text style={[styles.status, styles.plate]}>
                {`Ascension terminée : ${goldText(ascent.gold)}, perdus à la fin.`}
              </Text>
            )}
            {gaugeChange !== null && reading !== null && !reading.sealed && (
              <GaugeChangedBand gauge={gaugeChange.gauge} rose={gaugeChange.rose} />
            )}
            {reading === null ? (
              <>
                <PixelSkeleton width="100%" height={196} testID="gauge-loading" />
                <Text accessibilityLiveRegion="polite" role="status" style={styles.srOnly}>
                  {GAUGE_LOADING}
                </Text>
              </>
            ) : (
              <GaugeCard ref={gaugeCard} reading={reading} onOpen={() => setGaugeDetail(true)} />
            )}
            <PixelButton
              label="Commencer l'ascension"
              disabled={reading === null}
              onPress={() => {
                if (reading !== null) setChoosing(reading);
              }}
            />
            <CampButton onCamp={onCamp} />
          </View>
        )}
      </View>
      {foot}
      {reading !== null && (
        <GaugeDetailSheet
          visible={gaugeDetail}
          gauge={reading.gauge}
          reading={reading}
          onClose={closeGaugeDetail}
        />
      )}
    </OnBackdrop>
  );
}

// Stryker disable all: styles d'un écran de prototype.
const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: roles.night },
  header: { gap: 12 },
  /** La plaque du Voile de lisibilité sous un texte posé sur le décor hors de l'en-tête (#233). */
  plate: { backgroundColor: roles.backdropVeil },
  content: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { ...pixelTypography.screenTitle, color: roles.light, textAlign: 'center' },
  line: { ...pixelTypography.body, color: roles.parchment, textAlign: 'center' },
  keys: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  status: {
    fontFamily: textFont.semiBold,
    fontSize: 16,
    lineHeight: 22,
    color: roles.light,
    textAlign: 'center',
  },
  actions: { gap: 12, marginTop: 16 },
  scrollArea: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 12,
  },
  frame: { paddingTop: 8 },
  hero: { paddingHorizontal: 14, gap: 2 },
  bottom: { gap: 12, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16 },
  foot: {
    marginHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    borderTopWidth: 2,
    borderTopColor: roles.surface,
  },
  shards: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: roles.line,
    backgroundColor: roles.surface,
  },
  shardText: { fontFamily: textFont.semiBold, fontSize: 13, lineHeight: 18, color: roles.shard },
  camp: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  campText: { fontFamily: textFont.bold, fontSize: 15, lineHeight: 19, color: roles.light },
  gaugeCard: { gap: 7, paddingTop: 10, paddingBottom: 12, paddingHorizontal: 12 },
  ascentGauge: { gap: 6, paddingHorizontal: 14, paddingVertical: 8 },
  gaugeHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  gaugeTitle: {
    fontFamily: textFont.bold,
    fontSize: 11.5,
    lineHeight: 15,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: roles.muted,
  },
  gaugeMore: { fontFamily: textFont.semiBold, fontSize: 13, lineHeight: 17, color: roles.gold },
  gaugeLine: { fontFamily: textFont.medium, fontSize: 13.5, lineHeight: 19, color: roles.light },
  gaugeSoft: {
    fontFamily: textFont.medium,
    fontSize: 13,
    lineHeight: 18,
    color: roles.parchment,
  },
  reassurance: {
    paddingVertical: 7,
    paddingHorizontal: 9,
    fontFamily: textFont.medium,
    fontSize: 12.5,
    lineHeight: 17,
    color: roles.parchment,
    backgroundColor: roles.sunken,
    borderColor: roles.line,
  },
  infoBand: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: roles.raised,
    borderColor: roles.blue,
  },
  infoDot: {
    width: 10,
    height: 10,
    marginTop: 4,
    backgroundColor: roles.blue,
    transform: [{ rotate: '45deg' }],
  },
  infoText: {
    flex: 1,
    fontFamily: textFont.medium,
    fontSize: 13,
    lineHeight: 18,
    color: roles.light,
  },
  changedBand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: roles.raised,
    borderColor: roles.line,
  },
  discreet: {
    fontFamily: textFont.medium,
    fontSize: 12.5,
    lineHeight: 17,
    color: roles.muted,
    textAlign: 'center',
  },
  srOnly: { position: 'absolute', width: 1, height: 1, overflow: 'hidden' },
});
