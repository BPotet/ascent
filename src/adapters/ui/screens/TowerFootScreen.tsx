import { type ReactNode, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { AscentSession } from '../../../application/useCases/AscentSession';
import type { CampSession } from '../../../application/useCases/CampSession';
import type { LogExport } from '../../../application/useCases/exportAscentLog';
import type { FateGaugeReading } from '../../../application/useCases/fateGauge';
import type { Ascent } from '../../../domain/ascent/Ascent';
import { loadoutOf, loadoutSize } from '../../../domain/ascent/loadout';
import type { HeroKind } from '../../../domain/battle/combatants';
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
import { gaugeEffects, gaugeReason, gaugeWord } from '../format/gaugeText';
import { artPalette } from '../pixelArt/artPalette';
import { PixelButton } from '../pixelArt/PixelButton';
import { PixelFrame } from '../pixelArt/PixelFrame';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { pixelTypography, textFont } from '../pixelArt/pixelTypography';
import { CAMP_TITLE } from '../format/campText';
import { useAscent } from '../state/useAscent';
import { useCamp } from '../state/useCamp';
import { useFateGauge } from '../state/useFateGauge';
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
}: {
  readonly ascent: Ascent;
  readonly shards: number;
  readonly onEnter: () => void;
  readonly onCamp: () => void;
  readonly onAbandon: () => void;
  readonly foot: ReactNode;
}) {
  const [confirming, setConfirming] = useState(false);
  const [detail, setDetail] = useState(false);
  const link = useRef<View>(null);
  const loadout = loadoutOf(ascent);
  const closeDetail = () => {
    setDetail(false);
    if (link.current !== null) AccessibilityInfo.sendAccessibilityEvent(link.current, 'focus');
  };
  return (
    <>
      <View style={styles.scrollArea}>
        <ScrollView testID="tower-foot-scroll" contentContainerStyle={styles.scroll}>
          <Text accessibilityRole="header" style={styles.title}>
            {TOWER_TITLE}
          </Text>
          <ShardChip total={shards} />
          <Text style={styles.line}>{tierLine(ascent.tier)}</Text>
          <PixelFrame testID="tower-foot-ascent" style={styles.frame}>
            <View style={styles.hero}>
              <Text style={styles.status}>{HERO_NAMES[ascent.hero.kind]}</Text>
              <Text style={styles.status}>
                {`${floorLine(ascent.floor, ascent.tier)} · ${ascent.hero.hp}/${ascent.hero.maxHp} PV · ${goldText(ascent.gold)}`}
              </Text>
              <Text style={styles.line}>{`Jauge de l'ascension : ${gaugeWord(ascent.gauge)}`}</Text>
            </View>
            <LoadoutSection ref={link} loadout={loadout} onDetail={() => setDetail(true)} />
          </PixelFrame>
        </ScrollView>
        {loadoutSize(loadout) > SCROLL_HINT_BEYOND && (
          <ScrollHint under={roles.night} testID="tower-foot-more" />
        )}
      </View>
      {confirming ? (
        <View style={styles.bottom}>
          <Text style={styles.line}>
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
      <LoadoutSheet loadout={loadout} combat={false} visible={detail} onClose={closeDetail} />
    </>
  );
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
      <View style={styles.foot}>
        <LogExportButton logExport={logExport} revision={ascent} showCount active={focused} />
      </View>
    );
  const start = (reading: FateGaugeReading, hero: HeroKind) => {
    setChoosing(null);
    if (camp.beginAscent({ hero, gauge: reading.gauge, blessings: reading.blessings }) === null) {
      return;
    }
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

  if (loaded && inProgress) {
    return (
      <Screen layout="top" background={roles.night} testID="tower-foot">
        <AscentInProgress
          ascent={ascent}
          shards={shards}
          onEnter={onEnter}
          onCamp={onCamp}
          onAbandon={() => session.abandon()}
          foot={foot}
        />
      </Screen>
    );
  }

  return (
    <Screen layout="top" background={roles.night} testID="tower-foot">
      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          {TOWER_TITLE}
        </Text>
        {!loaded ? null : <ShardChip total={shards} />}
        <Text style={styles.line}>{TIER_LINE}</Text>
        {!loaded ? null : (
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
            <CampButton onCamp={onCamp} />
          </View>
        )}
      </View>
      {foot}
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
});
