import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { CampSession, CampView } from '../../../application/useCases/CampSession';
import type { OathStanding } from '../../../domain/ascent/oaths';
import {
  POWER_TREES,
  powerPrice,
  type PowerNodeState,
  type PowerTreeCode,
} from '../../../domain/ascent/powerTree';
import type { HeroKind } from '../../../domain/battle/combatants';
import type { PowerKind } from '../../../domain/battle/powers';
import type { HabitId } from '../../../domain/habit/Habit';
import { MinusFloat } from '../components/CampFeedback';
import { OathPicker } from '../components/OathPicker';
import { PowerSheet, type SheetOath } from '../components/PowerSheet';
import { PowerTreeNode } from '../components/PowerTreeNode';
import { Screen } from '../components/Screen';
import { availableShardsText, runBand } from '../format/campText';
import { swornAnnouncement } from '../format/oathText';
import { PATH_NAMES, unlockAnnouncement } from '../format/powerText';
import { artPalette } from '../pixelArt/artPalette';
import { artPixelSize } from '../pixelArt/artPixel';
import { AssetRows } from '../pixelArt/AssetRows';
import { MIN_TARGET_SIZE } from '../pixelArt/PixelButton';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { PixelSkeleton } from '../pixelArt/PixelSkeleton';
import { pixelFont, textFont } from '../pixelArt/pixelTypography';
import { PORTRAITS } from '../pixelArt/sprites/atelier/data/portraits';
import { useCamp } from '../state/useCamp';
import { useFateGauge } from '../state/useFateGauge';

const { roles } = artPalette;
const LINE = artPixelSize(2);

const TAB_NAMES: Readonly<Record<HeroKind, string>> = {
  sentinel: 'Sentinelle',
  wanderer: 'Errante',
};
const HEROES_IN_TABS: readonly HeroKind[] = ['sentinel', 'wanderer'];

/** Le dernier déblocage : son nœud s'allume, « −30 » monte des Éclats (D1). */
interface Fresh {
  readonly id: number;
  readonly code: PowerKind;
  readonly price: number;
}

/** Le pouvoir est à soi : de base, débloqué, ou débloqué pour la prochaine ascension. */
function isOwned(state: PowerNodeState): boolean {
  return state.kind === 'base' || state.kind === 'unlocked' || state.kind === 'nextAscent';
}

/** L'habitude d'un Serment non rompu (#237), pour le chaînon du nœud. */
function swornHabit(view: CampView, code: PowerTreeCode): string | undefined {
  return view.oaths[code as PowerKind]?.name ?? undefined;
}

/** Le Serment de la fiche d'un pouvoir à soi (#237) ; aucun cadre pour un autre. */
function sheetOath(
  view: CampView,
  code: PowerTreeCode,
  state: PowerNodeState,
  standings: Partial<Record<PowerKind, OathStanding | null>>,
): SheetOath | undefined {
  if (!isOwned(state)) return undefined;
  const power = code as PowerKind;
  if (!view.oathBearers.includes(power)) return { kind: 'lowCost' };
  const oath = view.oaths[power];
  if (oath === undefined) return { kind: 'none' };
  const standing = standings[power] ?? null;
  if (standing === 'broken' || (oath.name === null && view.habits !== null)) {
    return { kind: 'broken' };
  }
  return { kind: 'sworn', habit: oath.name ?? '', standing };
}

/** Le trait de l'arbre entre deux rangs, ou vers la racine : d'or quand la voie est à soi. */
function Trunk({ lit, testID }: { readonly lit: boolean; readonly testID: string }) {
  return (
    <View
      testID={testID}
      style={[styles.trunk, { backgroundColor: lit ? roles.gold : roles.line }]}
    />
  );
}

/**
 * L'arbre d'un héros, en Y qui monte comme la tour (A1, A2) : en haut les rangs 2, puis les rangs 1,
 * puis la racine (le pouvoir de base). Chaque nœud dit son état en mot.
 */
function Tree({
  hero,
  view,
  fresh,
  onOpen,
  nodeRef,
}: {
  readonly hero: HeroKind;
  readonly view: CampView;
  readonly fresh: PowerKind | null;
  readonly onOpen: (code: PowerTreeCode) => void;
  readonly nodeRef: (code: PowerTreeCode, node: View | null) => void;
}) {
  const { base, paths } = POWER_TREES[hero];
  const state = (code: PowerTreeCode) =>
    view.trees[hero].nodes.find((node) => node.code === code)!.state;
  const owned = (code: PowerTreeCode) => isOwned(state(code));
  const nodeOf = (code: PowerTreeCode) => (
    <PowerTreeNode
      key={code}
      ref={(element) => nodeRef(code, element)}
      code={code}
      state={state(code)}
      fresh={fresh === code}
      sworn={swornHabit(view, code)}
      onPress={() => onOpen(code)}
    />
  );
  return (
    <View testID="power-tree" role="group" style={styles.tree}>
      <View style={styles.columns}>
        {paths.map(({ path }) => (
          <Text key={path} style={styles.pathLabel}>{`Voie ${PATH_NAMES[path]}`}</Text>
        ))}
      </View>
      <View style={styles.columns}>{paths.map(({ ranks }) => nodeOf(ranks[1]))}</View>
      <View style={styles.columns}>
        {paths.map(({ path, ranks }) => (
          <View key={path} style={styles.trunkCell}>
            <Trunk lit={owned(ranks[1])} testID={`power-trunk-${path}-2`} />
          </View>
        ))}
      </View>
      <View style={styles.columns}>{paths.map(({ ranks }) => nodeOf(ranks[0]))}</View>
      <View style={styles.columns}>
        {paths.map(({ path, ranks }) => (
          <View key={path} style={styles.trunkCell}>
            <Trunk lit={owned(ranks[0])} testID={`power-trunk-${path}-1`} />
          </View>
        ))}
      </View>
      <View style={styles.root}>{nodeOf(base)}</View>
      <Text style={styles.legend}>
        Rang 1 : 30 Éclats · Rang 2 : 60 Éclats, après le rang 1 de sa voie.
      </Text>
    </View>
  );
}

function Skeleton() {
  return (
    <View accessibilityState={{ busy: true }} style={styles.tree}>
      {[0, 1].map((row) => (
        <View key={row} style={styles.columns}>
          <PixelSkeleton width="48%" height={128} testID="power-tree-skeleton" />
          <PixelSkeleton width="48%" height={128} testID="power-tree-skeleton" />
        </View>
      ))}
      <View style={styles.root}>
        <PixelSkeleton width="50%" height={128} testID="power-tree-skeleton" />
      </View>
    </View>
  );
}

/**
 * L'arbre de pouvoirs (#235, maquette 232 : A1 à A6, F1 à F5, D1) : les deux héros en onglets,
 * l'arbre en Y sans défilement à 360 × 780 dp, les Éclats disponibles en haut. Toucher un nœud
 * ouvre sa fiche ; « Débloquer pour 30 Éclats » enregistre le déblocage (une seule écriture
 * attendue), puis le nœud s'allume, « −30 » monte, une annonce polie le dit et le focus revient sur
 * le nœud. Pendant une ascension, un bandeau rappelle qu'elle ne change pas.
 */
export function PowerTreeScreen({
  camp,
  hero: initialHero,
  onLeave,
  onGoToDay,
}: {
  readonly camp: CampSession;
  readonly hero: HeroKind;
  readonly onLeave: () => void;
  /** Va à la Vue Journée, pour créer une habitude à lier par un Serment (#237, S3). */
  readonly onGoToDay?: () => void;
}) {
  const view = useCamp(camp);
  const { reading } = useFateGauge();
  const doneYesterday = reading === null || reading.unreadable ? null : reading.doneYesterday;
  const [picking, setPicking] = useState(false);
  const [oathError, setOathError] = useState(false);
  const [hero, setHero] = useState(initialHero);
  const [sheet, setSheet] = useState<PowerTreeCode | null>(null);
  const [error, setError] = useState(false);
  const [fresh, setFresh] = useState<Fresh | null>(null);
  const nodes = useRef(new Map<PowerTreeCode, View | null>());
  const loading = view.status === 'loading';

  useEffect(() => {
    void camp.markPowerTreesSeen();
  }, [camp]);

  const focus = (code: PowerTreeCode) => {
    const node = nodes.current.get(code);
    if (node !== null && node !== undefined)
      AccessibilityInfo.sendAccessibilityEvent(node, 'focus');
  };
  const open = (code: PowerTreeCode) => {
    setError(false);
    setSheet(code);
  };
  const close = () => {
    const code = sheet;
    setSheet(null);
    setError(false);
    setPicking(false);
    if (code !== null) focus(code);
  };
  const swear = async (habit: HabitId) => {
    if (sheet === null) return;
    const power = sheet as PowerKind;
    const result = await camp.swearOath(power, habit);
    if (result === 'failed') {
      setOathError(true);
      return;
    }
    setPicking(false);
    setOathError(false);
    const name = camp.view().habits?.find(({ id }) => id === habit)?.name;
    if (result === 'sworn' && name !== undefined) {
      AccessibilityInfo.announceForAccessibility(swornAnnouncement(power, name));
    }
  };
  const unlock = async () => {
    if (sheet === null) return;
    const code = sheet as PowerKind;
    const result = await camp.unlockPower(code);
    if (result === 'failed') {
      setError(true);
      return;
    }
    if (result === 'refused') return;
    setSheet(null);
    setError(false);
    setFresh({ id: (fresh?.id ?? 0) + 1, code, price: powerPrice(code) });
    AccessibilityInfo.announceForAccessibility(
      unlockAnnouncement(code, camp.view().availableShards),
    );
    focus(code);
  };
  const state = sheet === null ? null : view.trees[hero].nodes.find(({ code }) => code === sheet);

  return (
    <Screen layout="top" background={roles.night} testID="power-tree-screen">
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retour au camp"
          onPress={onLeave}
          style={styles.back}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>
          Arbre de pouvoirs
        </Text>
        {loading ? (
          <PixelSkeleton width={72} height={40} testID="power-tree-balance-skeleton" />
        ) : (
          <View
            accessible
            accessibilityLabel={availableShardsText(view.availableShards)}
            style={[styles.balance, { borderWidth: LINE }]}
          >
            <PixelIcon name="shard8" color={roles.shard} secondColor={roles.light} />
            <Text style={styles.balanceText}>{view.availableShards}</Text>
            {fresh === null ? null : (
              <View testID="power-tree-minus" style={styles.minus}>
                <MinusFloat key={fresh.id} amount={fresh.price} />
              </View>
            )}
          </View>
        )}
      </View>
      <View role="tablist" accessibilityLabel="Héros" style={styles.tabs}>
        {HEROES_IN_TABS.map((kind) => {
          const portrait = PORTRAITS[kind];
          return (
            <Pressable
              key={kind}
              accessibilityRole="tab"
              accessibilityState={{ selected: kind === hero }}
              onPress={() => setHero(kind)}
              testID={`power-tree-tab-${kind}`}
              style={[styles.tab, { borderWidth: LINE }, kind === hero && styles.tabOn]}
            >
              {portrait === null ? null : <AssetRows image={portrait} scale={1} />}
              <Text style={[styles.tabText, kind === hero && styles.tabTextOn]}>
                {TAB_NAMES[kind]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {view.place === null ? null : (
          <View accessible style={[styles.band, { borderWidth: LINE }]}>
            <Text style={styles.bandText}>{runBand(view.place)}</Text>
          </View>
        )}
        {loading ? (
          <Skeleton />
        ) : (
          <Tree
            hero={hero}
            view={view}
            fresh={fresh?.code ?? null}
            onOpen={open}
            nodeRef={(code, element) => nodes.current.set(code, element)}
          />
        )}
      </ScrollView>
      {state === null || state === undefined ? null : picking ? (
        <OathPicker
          power={state.code as PowerKind}
          habits={view.habits}
          oaths={view.oaths}
          error={oathError}
          onSwear={(habit) => void swear(habit)}
          onRetryHabits={() => void camp.refreshHabits()}
          {...(onGoToDay !== undefined && { onGoToDay })}
          onClose={() => {
            setPicking(false);
            setOathError(false);
          }}
        />
      ) : (
        <PowerSheet
          code={state.code}
          state={state.state}
          availableShards={view.availableShards}
          ascentInProgress={view.ascentInProgress}
          readOnly={view.readOnly}
          error={error}
          oath={sheetOath(view, state.code, state.state, camp.oathStandings(doneYesterday))}
          onSwear={() => setPicking(true)}
          onUnlock={() => void unlock()}
          onSee={open}
          onClose={close}
        />
      )}
    </Screen>
  );
}

// Stryker disable all: valeurs purement visuelles, vérifiées par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 56,
    paddingLeft: 8,
    paddingRight: 12,
  },
  back: {
    minWidth: MIN_TARGET_SIZE,
    minHeight: MIN_TARGET_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { fontFamily: pixelFont, fontSize: 28, lineHeight: 32, color: roles.light },
  title: { flex: 1, fontFamily: pixelFont, fontSize: 24, lineHeight: 28, color: roles.light },
  balance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 10,
    backgroundColor: roles.sunken,
    borderColor: roles.line,
  },
  balanceText: { fontFamily: pixelFont, fontSize: 22, lineHeight: 26, color: roles.shard },
  minus: { position: 'absolute', left: 0, right: 0, bottom: -18, alignItems: 'center' },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  tab: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderColor: roles.line,
    backgroundColor: roles.surface,
  },
  tabOn: { borderColor: roles.gold, backgroundColor: roles.goldBg },
  tabText: { fontFamily: textFont.bold, fontSize: 14, lineHeight: 18, color: roles.parchment },
  tabTextOn: { color: roles.gold },
  scroll: { paddingHorizontal: 16, paddingBottom: 24, gap: 8 },
  band: { padding: 10, borderColor: roles.blue, backgroundColor: roles.raised },
  bandText: { fontFamily: textFont.medium, fontSize: 13, lineHeight: 18, color: roles.light },
  tree: { gap: 0 },
  columns: { flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  pathLabel: {
    flex: 1,
    textAlign: 'center',
    fontFamily: textFont.bold,
    fontSize: 12,
    lineHeight: 18,
    color: roles.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  trunkCell: { flex: 1, alignItems: 'center' },
  trunk: { width: 4, height: 18 },
  root: { flexDirection: 'row', justifyContent: 'center', paddingHorizontal: '25%' },
  legend: {
    marginTop: 8,
    textAlign: 'center',
    fontFamily: textFont.medium,
    fontSize: 12,
    lineHeight: 16,
    color: roles.parchment,
  },
});
// Stryker restore all
