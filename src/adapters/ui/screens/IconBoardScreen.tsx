import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { AscentSession } from '../../../application/useCases/AscentSession';
import type { CampSession } from '../../../application/useCases/CampSession';
import {
  startAscent,
  type Ascent,
  type AscentLaunch,
  type Encounter,
} from '../../../domain/ascent/Ascent';
import type { Tier } from '../../../domain/ascent/tiers';
import { POWER_TREES, type PowerTreeCode } from '../../../domain/ascent/powerTree';
import type { AttackKind } from '../../../domain/battle/attacks';
import {
  advance,
  heroAction,
  nextDeadline,
  startBattle,
  type Battle,
} from '../../../domain/battle/Battle';
import type { EnemyKind } from '../../../domain/battle/combatants';
import type { BlessingFamily, StartingBlessing } from '../../../domain/ascent/blessings';
import type { BoonKind, OfferCard } from '../../../domain/ascent/boons';
import type { Exit } from '../../../domain/ascent/exits';
import { STARTING_EQUIPMENT } from '../../../domain/ascent/items';
import type { Rarity } from '../../../domain/ascent/rarity';
import type { ShardAward } from '../../../domain/ascent/shards';
import { BoonChoicePanel } from '../battle/BoonChoicePanel';
import { BlessingChoice } from '../components/BlessingChoice';
import { ChestStage } from '../components/ChestStage';
import { ExitChoice } from '../components/ExitChoice';
import { FoundItemPanel } from '../components/FoundItemPanel';
import { IconWell } from '../components/IconWell';
import { PowerIcon } from '../components/PowerIcon';
import { SealedChestPanel } from '../components/SealedChestPanel';
import { Screen } from '../components/Screen';
import { artPalette } from '../pixelArt/artPalette';
import { PixelButton } from '../pixelArt/PixelButton';
import { pixelFont, pixelTypography, textFont } from '../pixelArt/pixelTypography';
import { CHEST_IMAGE, CHEST_OPEN_IMAGE } from '../pixelArt/sprites/atelier/data/chest';
import { KEY_IMAGE } from '../pixelArt/sprites/atelier/data/key';
import {
  SEALED_CHEST_IMAGE,
  SEALED_CHEST_OPEN_IMAGE,
} from '../pixelArt/sprites/atelier/data/sealedChest';
import { assetSprite } from '../pixelArt/sprites/atelier/fullAnimation';
import { blessingIcon } from '../pixelArt/sprites/gameIcons';
import { toPixelImage } from '../pixelArt/sprites/Sprite';
import { SpriteCanvas } from '../pixelArt/SpriteCanvas';
import { AscentScreen, type AscentVisibility } from './AscentScreen';
import { CampScreen } from './CampScreen';
import { TowerFootScreen } from './TowerFootScreen';

const { roles } = artPalette;

/** Une planche : un écran de la maquette #153, rendu avec les vrais composants et des données fixes. */
type Board =
  | 'boons'
  | 'noBoon'
  | 'twoBoons'
  | 'lastDoor'
  | 'blessings'
  | 'oneBlessing'
  // Les bienfaits de palier et la carte Second souffle (#212) : O1, O2 et O4 de la maquette 210.
  | 'tierTwoOffer'
  | 'secondBreath'
  | 'secondBreathAlone'
  // Le Coffre (#227) : fermé et ouvert, puis l'objet qui en sort (B1 à B3 de la maquette 208).
  | 'chest'
  // Le coffre scellé, la clé et l'icône Fortune (#226, S2, S3 de la maquette 208).
  | 'sealedChest'
  // Les 10 icônes des pouvoirs (#235, maquette 232), à ×1 et ×2, dans l'ordre des arbres.
  | 'powers';

const ENTRIES: readonly (readonly [Board, string])[] = [
  ['boons', "Choix d'un bienfait"],
  ['noBoon', 'Sorties · aucun bienfait'],
  ['twoBoons', 'Sorties · deux bienfaits'],
  ['lastDoor', 'Dernière porte · 5 bienfaits'],
  ['blessings', 'Bénédictions · 3 sur 3'],
  ['oneBlessing', 'Bénédiction · 1 sur 1'],
  ['tierTwoOffer', 'Offre · palier 2'],
  ['secondBreath', 'Offre · Second souffle'],
  ['secondBreathAlone', 'Offre · Second souffle seule'],
  ['chest', 'Coffre · fermé et ouvert'],
  ['sealedChest', 'Coffre scellé · clé et Fortune'],
  ['powers', 'Pouvoirs · 10 icônes'],
];

/** Les codes des arbres de pouvoirs, racine puis voies, Sentinelle puis Errante (#235). */
const TREE_CODES: readonly PowerTreeCode[] = (['sentinel', 'wanderer'] as const).flatMap((hero) => {
  const { base, paths } = POWER_TREES[hero];
  return [base, ...paths.flatMap((path) => path.ranks)];
});

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
  | 'foot22'
  // Les portraits de la Frise d'action (#175) : F1, F2 (4 + 4 cases) et F4.
  | 'trackRound'
  | 'trackTwoGhouls'
  | 'trackPhaseTwo'
  // Le voile de phase ennemie (#188) : C1 et C3 de la maquette v2 de #174, un coup imparable.
  | 'veilTierOne'
  | 'veilTierThree'
  // Les trois ennemis du Beffroi (#214), le Jaquemart préparant Heure pleine.
  | 'belfryEnemies'
  // Veillée d'hiver et la Flamberge (#195).
  | 'vigilBoons'
  | 'flamberge';

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
  ['trackRound', 'Frise · manche et aperçu'],
  ['trackTwoGhouls', 'Frise · deux Goules'],
  ['trackPhaseTwo', 'Frise · boss en phase 2'],
  ['veilTierOne', 'Voile · coup imparable · palier 1'],
  ['veilTierThree', 'Voile · coup imparable · palier 3'],
  ['belfryEnemies', 'Beffroi · Novice, Sonneuse, Jaquemart'],
  ['vigilBoons', "Choix d'un bienfait · Veillée d'hiver"],
  ['flamberge', 'Objet trouvé · Flamberge'],
];

// Stryker disable all: données fixes d'un outil du build de preview.
const OFFER: readonly BoonKind[] = ['perfectEcho', 'lingeringFrost', 'emberHeart'];

/** Les offres de la maquette 210 (#212), la Sentinelle à 40 PV sur 88. */
const OFFERS: Readonly<
  Record<'boons' | 'tierTwoOffer' | 'secondBreath' | 'secondBreathAlone', readonly OfferCard[]>
> = {
  boons: OFFER,
  tierTwoOffer: ['perfectEcho', 'hoarfrost', 'lingeringFrost'],
  secondBreath: ['trueHour', 'belfryFrost', 'secondBreath'],
  secondBreathAlone: ['secondBreath'],
};
const isOffer = (board: Board): board is keyof typeof OFFERS => board in OFFERS;
const DOORS: readonly Exit[] = [
  { kind: 'combat', groupSize: 2 },
  { kind: 'elite', groupSize: 1 },
  { kind: 'campfire', groupSize: null },
];
const EXITS: Readonly<
  Record<
    Exclude<
      Board,
      keyof typeof OFFERS | 'blessings' | 'oneBlessing' | 'chest' | 'sealedChest' | 'powers'
    >,
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
/**
 * Un combat de la Frise d'action (#175), au palier `tier` : l'héroïne agit la première et attend son
 * attaque, la frise reste fixe pour la capture.
 */
const fight = (
  launch: AscentLaunch,
  tier: Tier,
  kind: Encounter['kind'],
  enemies: readonly EnemyKind[],
): Ascent => ({
  ...startAscent(42, launch),
  tier,
  floor: kind === 'boss' ? 6 : 2,
  encounter: { kind, enemies, battleSeed: 7 },
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
  trackRound: fight({ hero: 'wanderer' }, 1, 'combat', ['skeleton', 'ghoul']),
  trackTwoGhouls: fight({ hero: 'wanderer' }, 1, 'combat', ['skeleton', 'ghoul', 'ghoul']),
  trackPhaseTwo: fight({}, 2, 'boss', ['ashGardener']),
  veilTierOne: fight({}, 1, 'combat', ['specter', 'ghoul', 'ghoul']),
  veilTierThree: fight({}, 3, 'combat', ['gargoyle', 'bellFounder', 'bronzeWarden']),
  belfryEnemies: fight({}, 3, 'combat', ['bellNovice', 'clockJack', 'matinsRinger']),
  vigilBoons: {
    ...between(startAscent(42), DOORS),
    boonOffer: ['perfectEcho', 'lingeringFrost', 'winterVigil'],
  },
  flamberge: { ...between(startAscent(42), DOORS), foundItem: 'flamberge' },
};

/**
 * La préparation du coup imparable d'une entrée du voile (#188), en ms : bien plus longue que celle
 * du jeu (1,3 à 2 s), pour que le parcours end-to-end voie le sceau et capture l'écran pendant la
 * préparation, quel que soit le temps de lecture de l'émulateur. Seul l'outil de preview l'utilise.
 */
export const BOARD_WIND_UP_MS = 20_000;

/**
 * Un combat du voile de phase ennemie (#188) contre `enemies`, joué par le domaine (le héros attaque
 * à chacun de ses tours) jusqu'à la préparation du coup imparable `attack` de l'ennemi `enemy`,
 * longue de `BOARD_WIND_UP_MS`. Repris, ce coup repart du début de sa préparation : la scène est
 * voilée, le sceau au-dessus de l'ennemi.
 */
function windingUp(enemies: readonly EnemyKind[], enemy: number, attack: AttackKind): Battle {
  const { battle: started } = startBattle({
    seed: 7,
    defenseHint: false,
    at: 0,
    initiative: true,
    enemies,
  });
  let battle: Battle = {
    ...started,
    enemies: started.enemies.map((one, index) =>
      index === enemy && one.intent?.category === 'attack'
        ? { ...one, intent: { ...one.intent, attack, windUpMs: BOARD_WIND_UP_MS } }
        : one,
    ),
  };
  for (let turn = 0; turn < 100; turn += 1) {
    const { phase } = battle;
    if (phase.kind === 'enemy' && phase.step.kind === 'attack' && phase.step.enemy === enemy) {
      return battle;
    }
    const next = nextDeadline(battle)!;
    // Un impact qui attend un appui n'est subi qu'après son échéance.
    battle =
      phase.kind === 'hero'
        ? heroAction(battle, {
            action: { kind: 'attack' },
            touchStartedAt: battle.now,
            releasedAt: battle.now,
          }).battle
        : advance(battle, next.awaitsPress ? next.at + 1 : next.at).battle;
  }
  throw new Error(`No wind-up of ${enemies[enemy]!}`);
}

/**
 * Le combat sauvegardé d'une entrée (#175) : la Jardinière des cendres déjà en phase 2, au tour de
 * la Sentinelle, qui agit avant elle dans la manche. Repris, il montre son portrait de phase 2.
 */
const BOARD_BATTLES: Partial<Readonly<Record<LoadoutBoard, Battle>>> = {
  trackPhaseTwo: (() => {
    const { battle } = startBattle({
      seed: 7,
      defenseHint: false,
      at: 0,
      initiative: true,
      enemies: ['ashGardener'],
    });
    const [gardener] = battle.enemies;
    return { ...battle, enemies: [{ ...gardener!, hp: 200, phase2: true }] };
  })(),
  veilTierOne: windingUp(['specter', 'ghoul', 'ghoul'], 0, 'perilous'),
  veilTierThree: windingUp(['gargoyle', 'bellFounder', 'bronzeWarden'], 2, 'delayedPerilous'),
  belfryEnemies: windingUp(['bellNovice', 'clockJack', 'matinsRinger'], 1, 'perilous'),
};
// Stryker restore all

/** Une ascension fixe de la planche, dans sa session neuve, avec son camp (#40). */
export interface BoardAscent {
  readonly session: AscentSession;
  readonly camp: CampSession;
}

/** Le vrai écran ouvert par une entrée de l'Équipement, et sa session. */
interface OpenAscent extends BoardAscent {
  readonly screen: 'foot' | 'ascent' | 'camp';
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
  readonly openAscent: (
    saved: Ascent | null,
    shards?: number,
    battle?: Battle,
  ) => Promise<BoardAscent>;
  readonly visibility: AscentVisibility;
}) {
  const [board, setBoard] = useState<Board | null>(null);
  const [step, setStep] = useState(0);
  const [sealedOpening, setSealedOpening] = useState(false);
  const [ascent, setAscent] = useState<OpenAscent | null>(null);
  const back = () => setBoard(null);
  const open = (entry: Board) => {
    setStep(0);
    setBoard(entry);
  };
  const openLoadout = (entry: LoadoutBoard) => {
    void openAscent(LOADOUT_ASCENTS[entry], BOARD_SHARDS[entry], BOARD_BATTLES[entry]).then(
      (opened) => setAscent({ screen: entry.startsWith('foot') ? 'foot' : 'ascent', ...opened }),
    );
  };

  if (ascent !== null) {
    if (ascent.screen === 'camp') {
      return (
        <CampScreen camp={ascent.camp} onLeave={() => setAscent({ ...ascent, screen: 'foot' })} />
      );
    }
    return ascent.screen === 'foot' ? (
      <TowerFootScreen
        session={ascent.session}
        camp={ascent.camp}
        onEnter={() => setAscent({ ...ascent, screen: 'ascent' })}
        onCamp={() => setAscent({ ...ascent, screen: 'camp' })}
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
      {isOffer(board) ? (
        <>
          {gained}
          <BoonChoicePanel offer={OFFERS[board]} heroHp={40} heroMaxHp={88} onChoose={back} />
        </>
      ) : board === 'blessings' ? (
        <BlessingChoice
          key={step}
          {...BLESSING_STEPS[step]!}
          onChoose={() => (step + 1 < BLESSING_STEPS.length ? setStep(step + 1) : back())}
        />
      ) : board === 'oneBlessing' ? (
        <BlessingChoice {...ONE_BLESSING} onChoose={back} />
      ) : board === 'chest' ? (
        <>
          {gained}
          <View style={styles.chests}>
            {[false, true].map((opened) => (
              <View key={String(opened)} testID="chest-board-still">
                <ChestStage
                  name="chest"
                  closed={CHEST_IMAGE}
                  open={CHEST_OPEN_IMAGE}
                  scale={2}
                  opened={opened}
                  shake={0}
                  glow={opened ? 1 : 0}
                />
              </View>
            ))}
          </View>
          <View testID="chest-board-opening" style={styles.opening}>
            <FoundItemPanel
              key={step}
              item="axe"
              equipment={STARTING_EQUIPMENT}
              animate
              onLeave={back}
              onEquip={back}
            />
          </View>
          <PixelButton
            label="Rejouer l'ouverture"
            variant="secondary"
            onPress={() => setStep(step + 1)}
            style={styles.replay}
          />
        </>
      ) : board === 'sealedChest' ? (
        <>
          <View style={styles.chests}>
            {[false, true].map((opened) => (
              <View key={String(opened)} testID="sealed-chest-board-still">
                <ChestStage
                  name="sealed-chest"
                  closed={SEALED_CHEST_IMAGE}
                  open={SEALED_CHEST_OPEN_IMAGE}
                  scale={2}
                  opened={opened}
                  shake={0}
                  glow={opened ? 1 : 0}
                />
              </View>
            ))}
            <SpriteCanvas
              sprite="key"
              draw={() => toPixelImage(assetSprite(KEY_IMAGE))}
              scale={2}
              testID="sealed-chest-board-key"
            />
            <View testID="sealed-chest-board-fortune">
              <IconWell icon={blessingIcon('fortune')} rarity="rare" size="card" />
            </View>
          </View>
          <View style={styles.opening}>
            <SealedChestPanel
              keys={2}
              opening={sealedOpening}
              onOpen={() => setSealedOpening(true)}
              onLeave={back}
              onOpened={() => setSealedOpening(false)}
            />
          </View>
        </>
      ) : board === 'powers' ? (
        <View style={styles.chests}>
          {TREE_CODES.flatMap((code) =>
            ([1, 2] as const).map((scale) => (
              <PowerIcon
                key={`${code}-${scale}`}
                power={code}
                scale={scale}
                testID={`power-board-${code}-${scale}`}
              />
            )),
          )}
        </View>
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
  chests: { flexDirection: 'row', justifyContent: 'center', gap: 24, paddingTop: 16 },
  opening: { flex: 1 },
  replay: { margin: 16 },
  gold: {
    fontFamily: pixelFont,
    fontSize: 18,
    lineHeight: 22,
    color: roles.gold,
    textAlign: 'center',
  },
});
// Stryker restore all
