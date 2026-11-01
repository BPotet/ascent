import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { AscentSession } from '../../../application/useCases/AscentSession';
import { startAscent, type Ascent } from '../../../domain/ascent/Ascent';
import type { BlessingFamily, StartingBlessing } from '../../../domain/ascent/blessings';
import type { BoonKind } from '../../../domain/ascent/boons';
import type { Exit } from '../../../domain/ascent/exits';
import type { Rarity } from '../../../domain/ascent/rarity';
import type { ShardAward } from '../../../domain/ascent/shards';
import { BoonChoicePanel } from '../battle/BoonChoicePanel';
import { BlessingChoice } from '../components/BlessingChoice';
import { ExitChoice } from '../components/ExitChoice';
import { Screen } from '../components/Screen';
import { artPalette } from '../pixelArt/artPalette';
import { PixelButton } from '../pixelArt/PixelButton';
import { pixelFont, pixelTypography, textFont } from '../pixelArt/pixelTypography';
import { AscentScreen, type AscentVisibility } from './AscentScreen';
import { TowerFootScreen } from './TowerFootScreen';

const { roles } = artPalette;

/** Une planche : un écran de la maquette #153, rendu avec les vrais composants et des données fixes. */
type Board = 'boons' | 'noBoon' | 'twoBoons' | 'lastDoor' | 'blessings' | 'oneBlessing';

const ENTRIES: readonly (readonly [Board, string])[] = [
  ['boons', "Choix d'un bienfait"],
  ['noBoon', 'Sorties · aucun bienfait'],
  ['twoBoons', 'Sorties · deux bienfaits'],
  ['lastDoor', 'Dernière porte · 5 bienfaits'],
  ['blessings', 'Bénédictions · 3 sur 3'],
  ['oneBlessing', 'Bénédiction · 1 sur 1'],
];

/**
 * Une entrée de l'Équipement (#159) : le vrai pied de la tour ou le vrai écran de l'ascension, sur
 * une ascension fixe, ouverte dans sa propre session en mémoire.
 */
type LoadoutBoard =
  | 'foot1'
  | 'foot3'
  | 'foot8'
  | 'battle8'
  | 'exits8'
  | 'boons3'
  // Les paliers et les Éclats (#38) : X3, C4, X6, X7 et le Total d'Éclats au pied de la tour.
  | 'bossDefeated'
  | 'tierTwo'
  | 'fall10'
  | 'summit'
  | 'foot22';

const LOADOUT_ENTRIES: readonly (readonly [LoadoutBoard, string])[] = [
  ['foot1', 'Équipement · 1 · pied de la tour'],
  ['foot3', 'Équipement · 3 · pied de la tour'],
  ['foot8', 'Équipement · 8 · pied de la tour'],
  ['battle8', 'Équipement · 8 · combat'],
  ['exits8', 'Équipement · 8 · sorties'],
  ['boons3', "Équipement · 3 · choix d'un bienfait"],
  ['bossDefeated', 'Boss vaincu · palier 1'],
  ['tierTwo', 'Palier 2 · Les Jardins de cendre'],
  ['fall10', 'Chute · 10 Éclats'],
  ['summit', 'Sommet atteint'],
  ['foot22', 'Pied de la tour · 22 Éclats'],
];

// Stryker disable all: données fixes d'un outil du build de preview.
const OFFER: readonly BoonKind[] = ['perfectEcho', 'lingeringFrost', 'emberHeart'];
const DOORS: readonly Exit[] = [
  { kind: 'combat', groupSize: 2 },
  { kind: 'elite', groupSize: 1 },
  { kind: 'campfire', groupSize: null },
];
const EXITS: Readonly<
  Record<
    Exclude<Board, 'boons' | 'blessings' | 'oneBlessing'>,
    { boons: readonly BoonKind[]; exits: readonly Exit[] }
  >
> = {
  noBoon: { boons: [], exits: DOORS },
  twoBoons: { boons: ['perfectEcho', 'lingeringFrost'], exits: DOORS },
  lastDoor: {
    boons: ['perfectEcho', 'lingeringFrost', 'shatteringEmber', 'blazingEmber', 'emberHeart'],
    exits: [{ kind: 'boss', groupSize: null }],
  },
};

/** Un écran du choix d'une bénédiction (#158) : l'offre, sa rareté, les prises, le total. */
interface BlessingStep {
  readonly offer: readonly BlessingFamily[];
  readonly rarity: Rarity;
  readonly taken: readonly StartingBlessing[];
  readonly total: number;
}
const HASTE: StartingBlessing = { family: 'haste', rarity: 'rare' };
/** Les écrans 3A, 3B et 3C, enchaînés : les prises sont fixes, pas le bouton touché. */
const BLESSING_STEPS: readonly BlessingStep[] = [
  { offer: ['haste', 'vigor', 'edge'], rarity: 'rare', taken: [], total: 3 },
  { offer: ['momentum', 'protection', 'vigor'], rarity: 'common', taken: [HASTE], total: 3 },
  {
    offer: ['momentum', 'edge', 'protection'],
    rarity: 'epic',
    taken: [HASTE, { family: 'vigor', rarity: 'common' }],
    total: 3,
  },
];
/** L'écran 3D : une seule bénédiction. */
const ONE_BLESSING: BlessingStep = {
  offer: ['momentum', 'vigor', 'protection'],
  rarity: 'common',
  taken: [],
  total: 1,
};

/**
 * Les ascensions de la maquette #153 : une seule bénédiction (4C), un Équipement de 3 (4A), le build
 * le plus long (4D, 5A).
 */
function withLoadout(
  floor: number,
  blessings: Ascent['blessings'],
  boons: Ascent['hero']['boons'],
): Ascent {
  const ascent = startAscent(42);
  return { ...ascent, floor, blessings, hero: { ...ascent.hero, boons } };
}
const THREE = withLoadout(3, [HASTE], ['perfectEcho', 'lingeringFrost']);
const EIGHT = withLoadout(
  6,
  [{ family: 'protection', rarity: 'epic' }, HASTE, { family: 'vigor', rarity: 'common' }],
  ['perfectEcho', 'lingeringFrost', 'shatteringEmber', 'blazingEmber', 'emberHeart'],
);
const between = (ascent: Ascent, exits: readonly Exit[]): Ascent => ({
  ...ascent,
  encounter: null,
  exits,
  lastGold: 10,
});
/** Les Éclats d'une ascension de la planche (#38), par palier, étage et gain. */
const shard = (id: string, amount: number): ShardAward => ({ id: `42:${id}`, amount });
const BOSS_ONE = shard('1:6:boss', 8);
/** Le boss du palier 1 vaincu, 40 Or : l'écran du boss vaincu, puis la transition. */
const beaten = (step: 'bossDefeated' | 'announce'): Ascent => ({
  ...startAscent(42),
  floor: 6,
  encounter: null,
  lastGold: 40,
  gold: 95,
  shardAwards: [BOSS_ONE],
  passage: { to: 2, step },
});
/** Le Total d'Éclats stocké avant chaque ascension de la planche (#38). */
const BOARD_SHARDS: Partial<Readonly<Record<LoadoutBoard, number>>> = { fall10: 34, foot22: 22 };

const LOADOUT_ASCENTS: Readonly<Record<LoadoutBoard, Ascent | null>> = {
  foot1: withLoadout(1, [HASTE], []),
  foot3: THREE,
  foot8: EIGHT,
  battle8: { ...EIGHT, floor: 2 },
  exits8: between({ ...EIGHT, floor: 5 }, [{ kind: 'boss', groupSize: null }]),
  boons3: {
    ...between(THREE, DOORS),
    boonOffer: ['shatteringEmber', 'trueEdge', 'blazingEmber'],
  },
  bossDefeated: beaten('bossDefeated'),
  tierTwo: beaten('announce'),
  fall10: {
    ...startAscent(42),
    tier: 2,
    floor: 4,
    encounter: null,
    gold: 23,
    outcome: 'fall',
    shardAwards: [BOSS_ONE, shard('2:3:elite', 2)],
  },
  summit: {
    ...startAscent(42),
    tier: 3,
    floor: 6,
    encounter: null,
    gold: 214,
    outcome: 'victory',
    shardAwards: [
      shard('1:3:elite', 2),
      BOSS_ONE,
      shard('2:4:elite', 2),
      shard('2:6:boss', 12),
      shard('3:2:elite', 2),
      shard('3:6:boss', 18),
      { id: '42:summit', amount: 10 },
    ],
  },
  foot22: null,
};
// Stryker restore all

/** Le vrai écran ouvert par une entrée de l'Équipement, et sa session. */
interface OpenAscent {
  readonly screen: 'foot' | 'ascent';
  readonly session: AscentSession;
}

/**
 * La planche des icônes (`IconBoard`, voir `docs/glossary.md`), outil du build de preview (#157) :
 * les écrans du choix d'un bienfait, des sorties et du choix d'une bénédiction de départ (#158),
 * rendus avec les vrais composants et des données fixes, pour les captures end-to-end comparées à
 * la maquette (aucun combat à gagner, aucune habitude faite hier). Les entrées « Équipement · … »
 * (#159) ouvrent le vrai pied de la tour et le vrai écran de l'ascension sur des ascensions fixes,
 * chacune dans une session neuve en mémoire (`openAscent`) ; quitter l'ascension revient à la planche.
 */
export function IconBoardScreen({
  onClose,
  openAscent,
  visibility,
}: {
  readonly onClose: () => void;
  /**
   * Ouvre une ascension fixe (ou aucune) dans une session neuve, en mémoire, avec un Total d'Éclats
   * fixe (#38) : jamais celle du joueur (#159).
   */
  readonly openAscent: (saved: Ascent | null, shards?: number) => Promise<AscentSession>;
  readonly visibility: AscentVisibility;
}) {
  const [board, setBoard] = useState<Board | null>(null);
  const [step, setStep] = useState(0);
  const [ascent, setAscent] = useState<OpenAscent | null>(null);
  const back = () => setBoard(null);
  const open = (entry: Board) => {
    setStep(0);
    setBoard(entry);
  };
  const openLoadout = (entry: LoadoutBoard) => {
    void openAscent(LOADOUT_ASCENTS[entry], BOARD_SHARDS[entry]).then((session) =>
      setAscent({ screen: entry.startsWith('foot') ? 'foot' : 'ascent', session }),
    );
  };

  if (ascent !== null) {
    return ascent.screen === 'foot' ? (
      <TowerFootScreen
        session={ascent.session}
        onEnter={() => setAscent({ ...ascent, screen: 'ascent' })}
      />
    ) : (
      <AscentScreen
        session={ascent.session}
        visibility={visibility}
        onLeave={() => setAscent(null)}
      />
    );
  }

  if (board === null) {
    return (
      <Screen layout="top" background={roles.night} testID="icon-board">
        <ScrollView contentContainerStyle={styles.menu}>
          <Text accessibilityRole="header" style={styles.title}>
            Planche des icônes
          </Text>
          <Text style={styles.line}>Outil du build de preview</Text>
          {ENTRIES.map(([entry, label]) => (
            <PixelButton
              key={entry}
              label={label}
              variant="secondary"
              onPress={() => open(entry)}
            />
          ))}
          {LOADOUT_ENTRIES.map(([entry, label]) => (
            <PixelButton
              key={entry}
              label={label}
              variant="secondary"
              onPress={() => openLoadout(entry)}
            />
          ))}
          <PixelButton label="Fermer" onPress={onClose} />
        </ScrollView>
      </Screen>
    );
  }

  const gained = <Text style={styles.gold}>Étage franchi · +10 Or</Text>;
  return (
    <Screen layout="top" background={roles.night} testID={`icon-board-${board}`}>
      <View style={styles.header}>
        <Text style={styles.status}>Planche des icônes</Text>
        <PixelButton label="Retour" variant="secondary" onPress={back} style={styles.back} />
      </View>
      {board === 'boons' ? (
        <>
          {gained}
          <BoonChoicePanel offer={OFFER} onChoose={back} />
        </>
      ) : board === 'blessings' ? (
        <BlessingChoice
          key={step}
          {...BLESSING_STEPS[step]!}
          onChoose={() => (step + 1 < BLESSING_STEPS.length ? setStep(step + 1) : back())}
        />
      ) : board === 'oneBlessing' ? (
        <BlessingChoice {...ONE_BLESSING} onChoose={back} />
      ) : (
        <ExitChoice {...EXITS[board]} banner={gained} onChoose={back} />
      )}
    </Screen>
  );
}

// Stryker disable all: styles d'un outil du build de preview.
const styles = StyleSheet.create({
  menu: { padding: 24, gap: 12 },
  title: {
    fontFamily: pixelFont,
    fontSize: 22,
    lineHeight: 26,
    color: roles.light,
    textAlign: 'center',
  },
  line: { ...pixelTypography.body, color: roles.parchment, textAlign: 'center' },
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
  back: { minWidth: 84, paddingHorizontal: 14 },
  gold: {
    fontFamily: pixelFont,
    fontSize: 18,
    lineHeight: 22,
    color: roles.gold,
    textAlign: 'center',
  },
});
// Stryker restore all
