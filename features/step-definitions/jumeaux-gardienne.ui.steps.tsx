/*
 * Scénarios de « Les Jumeaux et la Gardienne des ossuaires animés, avec les poses d'un coup »
 * (#139, chemin B). Correspondance :
 * - « s'affiche avec son image validée », « joue les poses », « poses d'un coup », « palette
 *   rouge » : la pose que la scène choisit à chaque instant (`enemyPose` avec la table de l'ennemi,
 *   `attackMotion`, sur une action construite ici ; `restPose` au repos), puis son image
 *   (`battleSprite`) et sa case dans l'atlas que la scène dessine (`battleAtlas`, `atlasRect`),
 *   comparées aux lignes recopiées de l'Atelier, avec `pal` ou `red` ;
 * - « la portée » et « l'élévation » : `reach` et `lift` de la pose choisie, que la scène applique
 *   à 2 dp par pixel d'art (vérifié par le test de fumée de la scène) ;
 * - « à 2 dp par pixel d'art », « pieds sur son socle » : la place d'un ennemi dans la scène
 *   (`sceneGeometry`) et l'origine de sa case (`spriteOrigin`) ;
 * - « le reflet » et « les étoiles » : les ancrages de la pose affichée (`poseAnchors`), tels que la
 *   scène les place (`glintSprites`) ;
 * - « le sceau » : la colonne de l'ennemi (`EnemyColumn`), comme le fait #81 ;
 * - le changement de phase de la Gardienne : un combat réel (`Battle`) mis à 150 PV ou moins, dont
 *   le hasard (sa graine) tire Deux tibias puis Mise en ossuaire, lu par la scène (`sceneTimeline`) ;
 * - le combat et le lecteur d'écran : l'écran de l'ascension (`AscentScreen`), la scène y étant
 *   simulée ;
 * - « comme aujourd'hui » (le changement de phase, l'annonce du coup) : le code inchangé, vérifié
 *   par les scénarios de #32, #81, #91 et #138.
 */
import { cleanup, render, screen, within } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { EnemyColumn } from '../../src/adapters/ui/battle/EnemyColumn';
import { FRAME_MS, enemyPose, restPose } from '../../src/adapters/ui/battle/scene/enemyPose';
import { glintSprites } from '../../src/adapters/ui/battle/scene/sceneEffects';
import { sceneGeometry, spriteOrigin } from '../../src/adapters/ui/battle/scene/sceneGeometry';
import { sceneTimeline } from '../../src/adapters/ui/battle/scene/sceneTimeline';
import type { SceneEnemy, SceneTimeline } from '../../src/adapters/ui/battle/sceneTypes';
import { ATTACK_NAMES, ENEMY_NAMES, announcement } from '../../src/adapters/ui/format/battleText';
import { toRgba } from '../../src/adapters/ui/pixelArt/sprites/Sprite';
import { OSSUARY_WARDEN_ANIMATION } from '../../src/adapters/ui/pixelArt/sprites/atelier/data/ossuaryWarden';
import { TWINS_ANIMATION } from '../../src/adapters/ui/pixelArt/sprites/atelier/data/twins';
import type { FullAnimation } from '../../src/adapters/ui/pixelArt/sprites/atelier/fullAnimation';
import { battleAtlas } from '../../src/adapters/ui/pixelArt/sprites/battle/battleAtlas';
import {
  ANIMATED_ENEMIES,
  ENEMY_FRAMES,
  RED_FRAMES,
  attackMotion,
  battleSprite,
  poseAnchors,
  type EnemyFrame,
} from '../../src/adapters/ui/pixelArt/sprites/battle/battleCharacters';
import { AscentScreen } from '../../src/adapters/ui/screens/AscentScreen';
import type { EnemyView } from '../../src/adapters/ui/state/battleView';
import { ascentSetUp } from '../../src/adapters/ui/testing/ascent';
import { renderScreen } from '../../src/adapters/ui/testing/renderScreen';
import { startAscent } from '../../src/domain/ascent/Ascent';
import { ATTACKS, type AttackKind } from '../../src/domain/battle/attacks';
import {
  advance,
  heroAction,
  nextDeadline,
  startBattle,
  type Battle,
} from '../../src/domain/battle/Battle';
import { ENEMIES, type EnemyKind, type Move } from '../../src/domain/battle/combatants';
import {
  IMPACT,
  STEP_IN,
  STEP_IN_AT,
  WIND_UP_AT,
  atlasCell,
  attackPosesOf,
  attackTimeline,
  copiedAnchors,
  copiedPose,
  inOrder,
  posesOf,
  restPoses,
  type AttackShownPose,
} from '../support/fullAnimationStory';

jest.mock('../../src/adapters/ui/battle/BattleCanvas', () =>
  jest.requireActual('../../src/adapters/ui/battle/testing/fakeBattleCanvas'),
);

type StoryEnemy = 'twins' | 'ossuaryWarden';

/** Les deux animations de cette story, une ligne par entité. */
const ANIMATIONS: Readonly<Record<StoryEnemy, FullAnimation<EnemyFrame>>> = {
  twins: TWINS_ANIMATION,
  ossuaryWarden: OSSUARY_WARDEN_ANIMATION,
};
const STORY: readonly StoryEnemy[] = ['twins', 'ossuaryWarden'];
const KIND_OF_NAME: Readonly<Record<string, EnemyKind>> = Object.fromEntries(
  Object.entries(ENEMY_NAMES).map(([kind, name]) => [name.toLowerCase(), kind as EnemyKind]),
);
/** Le nom de l'entité dans un scénario (« la Gardienne des ossuaires »), sans son article. */
const kindOf = (name: string): EnemyKind =>
  KIND_OF_NAME[name.toLowerCase()] ?? KIND_OF_NAME[name.replace(/^(le |la )/iu, '').toLowerCase()]!;
const ENCOUNTERS: Readonly<Record<string, 'elite' | 'boss'>> = {
  "combat d'Élite": 'elite',
  'combat de boss': 'boss',
};
/** Les coups qui ont des poses d'un coup, recopiés du Codex : entité, type, dégâts, phase 2. */
const MOVES: Readonly<
  Record<string, { kind: StoryEnemy; attack: AttackKind; damage: number; phase2: boolean }>
> = {
  "Carreau d'arbalète": { kind: 'twins', attack: 'basic', damage: 5, phase2: false },
  'Onde de choc': { kind: 'twins', attack: 'delayedPerilous', damage: 10, phase2: false },
  'Deux tibias': { kind: 'ossuaryWarden', attack: 'double', damage: 6, phase2: true },
  'Mise en ossuaire': { kind: 'ossuaryWarden', attack: 'perilous', damage: 15, phase2: true },
};
/** La fin d'une action construite ici : la double frappe, sa récupération et son retour. */
const END = IMPACT + 1_000;

interface World {
  kinds: readonly EnemyKind[];
  /** Les poses montrées, par entité. */
  shown: Partial<Record<EnemyKind, AttackShownPose[]>>;
  scene: SceneEnemy[];
  reduced: boolean;
  /** Le coup préparé, avec ses poses d'un coup. */
  move: { kind: StoryEnemy; attack: AttackKind } | null;
  /** Les actions de la Gardienne en phase 2, lues sur un combat réel. */
  phase2: { timeline: SceneTimeline; shown: AttackShownPose[] }[];
  shifted: boolean;
  read: { labels: string[]; hidden: boolean };
}

let world: World;

beforeEach(() => {
  world = {
    kinds: [],
    shown: {},
    scene: [],
    reduced: false,
    move: null,
    phase2: [],
    shifted: false,
    read: { labels: [], hidden: false },
  };
});

const animationOf = (kind: EnemyKind) => ANIMATIONS[kind as StoryEnemy];

/** Les coups d'un ennemi, phase 2 comprise. */
const movesOf = (kind: EnemyKind): readonly Move[] => [
  ...ENEMIES[kind].moves,
  ...(ENEMIES[kind].phase2Moves ?? []),
];

/** Les poses d'un coup de l'entité pour `attack`, dans l'ordre de l'Atelier. */
const ownPoses = (kind: EnemyKind, attack: AttackKind): EnemyFrame[] =>
  Object.keys(animationOf(kind).attackPoses?.[attack]?.frames ?? {}) as EnemyFrame[];

/** Les noms de poses d'un texte (« ant0, ant1, … »), dans l'ordre. */
const framesIn = (text: string): EnemyFrame[] =>
  (text.match(new RegExp(`\\b(${ENEMY_FRAMES.join('|')})\\b`, 'gu')) ?? []) as EnemyFrame[];

/** L'action `attack` de l'entité, de la préparation au retour, avec sa table. */
const actionOf = (kind: EnemyKind, attack: AttackKind, reduced = false) =>
  attackPosesOf(attackTimeline(attack), attackMotion(kind), WIND_UP_AT, END, reduced);

/**
 * Chaque pose montrée est la pose recopiée, celle de ses poses d'un coup quand elle en vient, dans
 * sa palette rouge pendant un coup imparable, dans l'image de l'entité comme dans la case que la
 * scène dessine.
 */
function expectCopied(kind: EnemyKind, shown: readonly AttackShownPose[]) {
  for (const { frame, tier, red, poses } of shown) {
    const redShown = red && (poses !== null || RED_FRAMES.includes(frame));
    const pose = copiedPose(animationOf(kind), frame, redShown, poses);
    expect([
      kind,
      frame,
      red,
      poses,
      battleSprite(kind, frame, { tier, red, attack: poses }).sprite,
    ]).toEqual([kind, frame, red, poses, pose]);
    expect([kind, frame, poses, atlasCell(kind, frame, tier, red, poses)]).toEqual([
      kind,
      frame,
      poses,
      toRgba(pose),
    ]);
  }
}

/** Un combat de la tour contre `enemies`, l'écran de l'ascension monté. */
async function showBattle(enemies: readonly EnemyKind[], kind: 'combat' | 'elite' | 'boss') {
  const setUp = ascentSetUp({
    saved: { ...startAscent(42), encounter: { kind, enemies, battleSeed: 7 } },
  });
  await setUp.session.load();
  await renderScreen(
    <AscentScreen
      session={setUp.session}
      visibility={{ onChange: () => () => undefined }}
      onLeave={() => undefined}
    />,
    setUp.dependencies,
  );
  return (await screen.findByTestId('battle-scene', { includeHiddenElements: true })).props
    .enemies as SceneEnemy[];
}

/** La colonne de l'ennemi `kind`, seule, active, avec ou sans sceau. */
async function showColumn(kind: EnemyKind, sealed: boolean, reducedMotion = false) {
  const { maxHp, maxGuard } = ENEMIES[kind];
  const view: EnemyView = {
    kind,
    name: ENEMY_NAMES[kind],
    standing: true,
    target: false,
    hpRatio: 1,
    hpText: `${maxHp}/${maxHp} PV`,
    guardRatio: 1,
    guardText: `Garde ${maxGuard}/${maxGuard}`,
    stunned: false,
    losingAction: false,
    rising: null,
    intent: { category: 'attack' },
    active: true,
    dimmed: false,
    tag: null,
    label: `${ENEMY_NAMES[kind]}, intention : attaque`,
  };
  await cleanup();
  await render(
    <EnemyColumn
      view={view}
      index={0}
      slot={sceneGeometry(390, 440, 1).enemies[0]!}
      sealed={sealed}
      reducedMotion={reducedMotion}
      float={null}
      uiNow={() => 0}
      now={() => 0}
      onTarget={() => undefined}
    />,
  );
}

/** Le sceau rouge pulse au-dessus de l'ennemi, dans sa colonne, comme aujourd'hui (#81). */
function expectSeal(kind: EnemyKind) {
  const seal = within(screen.getByTestId(`enemy-${kind}`)).getByLabelText(
    'Sceau rouge : coup imparable',
  );
  const hidden = { includeHiddenElements: true };
  expect(within(seal).getByTestId('peril-seal-small', hidden).props.sprite).toBe('seal-8');
  expect(within(seal).getByTestId('peril-seal-big', hidden).props.sprite).toBe('seal-10');
}

const isHidden = (element: ReturnType<typeof screen.getByTestId>) =>
  element.props.accessibilityElementsHidden === true &&
  element.props.importantForAccessibility === 'no-hide-descendants';

/**
 * Un combat réel contre la Gardienne, mise à 151 PV : le héros frappe à chaque tour, sans se
 * défendre ; la Gardienne est remise à 150 PV à chaque tour du héros, pour rester en phase 2. Le
 * hasard du combat (sa graine) est celui qui tire Deux tibias, puis Mise en ossuaire, en phase 2.
 */
function wardenInPhase2(seed: number) {
  const hero = { heroHp: 999, heroMaxHp: 999 };
  let battle: Battle = startBattle({
    seed,
    defenseHint: false,
    at: 0,
    ...hero,
    enemies: ['ossuaryWarden'],
  }).battle;
  const wound = (current: Battle, hp: number): Battle => ({
    ...current,
    enemies: current.enemies.map((enemy) => ({ ...enemy, hp })),
  });
  battle = wound(battle, 151);
  let shifted = false;
  const actions: SceneTimeline[] = [];
  for (let guard = 0; guard < 400 && actions.length < 12; guard += 1) {
    if (battle.phase.kind === 'hero') {
      if (shifted) battle = wound(battle, 150);
      const releasedAt = battle.now + 100;
      const update = heroAction(battle, {
        action: { kind: 'attack' },
        touchStartedAt: releasedAt - 50,
        releasedAt,
      });
      battle = update.battle;
      shifted ||= update.events.some((event) => event.type === 'bossPhaseShifted');
    } else {
      const deadline = nextDeadline(battle);
      if (deadline === null) break;
      battle = advance(battle, deadline.at + 40).battle;
      shifted ||= battle.enemies[0]!.phase2 === true;
    }
    const timeline = sceneTimeline(battle);
    if (shifted && timeline?.kind === 'attack' && timeline.windUpAt !== actions.at(-1)?.windUpAt) {
      actions.push(timeline);
    }
  }
  return { shifted, phase2: battle.enemies[0]!.phase2 === true, actions };
}

const steps: StepDefinitions = ({ given, when, then, and }) => {
  // --- Contexte ---

  given(
    "l'image et l'animation complète des Jumeaux (twins) et de la Gardienne des ossuaires (ossuaryWarden) sont validées dans l'Atelier de l'ascension au 29/10/2026",
    () => {
      for (const kind of STORY) {
        expect(ANIMATED_ENEMIES).toContain(kind);
        expect(Object.keys(ANIMATIONS[kind].frames).sort()).toEqual([...ENEMY_FRAMES].sort());
      }
    },
  );

  and(
    "l'animation complète, palette rouge et poses d'un coup comprises, est recopiée telle quelle dans le code",
    () => {
      for (const kind of STORY) {
        const { pal, red, attackPoses = {} } = ANIMATIONS[kind];
        expect([kind, red?.length]).toEqual([kind, pal.length]);
        for (const frame of ENEMY_FRAMES) {
          expect(battleSprite(kind, frame).sprite).toEqual(copiedPose(ANIMATIONS[kind], frame));
        }
        expect(Object.keys(attackPoses)).toHaveLength(2);
        for (const attack of Object.keys(attackPoses) as AttackKind[]) {
          for (const frame of ownPoses(kind, attack)) {
            expect(battleSprite(kind, frame, { attack }).sprite).toEqual(
              copiedPose(ANIMATIONS[kind], frame, false, attack),
            );
            expect(poseAnchors(kind, frame, attack)).toEqual(
              copiedAnchors(ANIMATIONS[kind], frame, attack),
            );
          }
        }
      }
    },
  );

  // --- Les sujets ---

  given('une ascension en cours', () => undefined);

  given('Les Jumeaux ou la Gardienne des ossuaires en combat', () => {
    world.kinds = STORY;
  });

  given(/^(Les Jumeaux|la Gardienne des ossuaires) en combat$/u, (name: string) => {
    world.kinds = [kindOf(name)];
  });

  given('le mouvement réduit est actif', () => {
    world.reduced = true;
  });

  // --- Chacun en combat avec son image validée ---

  when(
    /^le joueur entre dans un (combat d'Élite|combat de boss) contre (.+)$/u,
    async (encounter: string, name: string) => {
      const kind = kindOf(name);
      world.kinds = [kind];
      world.scene = await showBattle([kind], ENCOUNTERS[encounter]!);
    },
  );

  then(
    /^(.+) s'affiche en entier avec son image validée \((\d+) × (\d+) pixels d'art\), à 2 dp par pixel d'art, pieds sur son socle$/u,
    (name: string, width: string, height: string) => {
      const kind = kindOf(name);
      expect(world.scene.map((enemy) => enemy.kind)).toEqual([kind]);
      const animation = animationOf(kind);
      expect([animation.w, animation.h]).toEqual([Number(width), Number(height)]);
      expectCopied(
        kind,
        ENEMY_FRAMES.map((frame) => ({ frame, tier: 0, red: false, poses: null, lift: 0 })),
      );
      // Sa case, en entier, à 2 dp par pixel d'art, les pieds sur le bas de sa place, sur le socle.
      const { sprite, pedestalAt } = sceneGeometry(390, 440, 1).enemies[0]!;
      const { cellWidth, cellHeight } = battleAtlas(kind).table;
      expect([cellWidth, cellHeight]).toEqual([Number(width), Number(height)]);
      const origin = spriteOrigin(sprite, cellWidth, cellHeight);
      expect(origin.y + cellHeight * 2).toBe(sprite.y + sprite.height);
      expect(Math.abs(origin.x + cellWidth - pedestalAt.x)).toBeLessThanOrEqual(2);
      expect(origin.y).toBeGreaterThanOrEqual(0);
    },
  );

  and(/^(.+) n'est plus dessiné avec (.+)$/u, () => {
    const [kind] = world.kinds as [EnemyKind];
    for (const frame of ENEMY_FRAMES) {
      // Plus aucun dessin par le code : ni la silhouette ni le dessin du Nécromancien. Le liseré
      // d'un dessin, ajouté au palier 2, ne s'y ajoute plus, et la silhouette n'avait que l'ombre
      // et les yeux.
      const { sprite } = battleSprite(kind, frame, { tier: 2 });
      expect(sprite).toEqual(battleSprite(kind, frame).sprite);
      expect(sprite).toEqual(copiedPose(animationOf(kind), frame));
      expect(new Set(sprite.pixels).size).toBeGreaterThan(3);
    }
  });

  // --- Chaque moment du combat ---

  when(
    /^il (attend son tour|avance vers le héros puis revient|prépare un coup sans poses d'un coup|est touché|est étourdi|tombe)$/u,
    (moment: string) => {
      const still = (state: 'standing' | 'stunned' | 'fallen') =>
        restPoses(state).map((pose) => ({ ...pose, poses: null, lift: 0 }));
      for (const kind of world.kinds) {
        const motion = attackMotion(kind);
        const timelines: Record<string, () => AttackShownPose[]> = {
          'attend son tour': () => still('standing'),
          'avance vers le héros puis revient': () => [
            ...attackPosesOf(STEP_IN, motion, STEP_IN_AT, WIND_UP_AT),
            // Le retour, après la récupération du second impact et ses images rec0, rec1.
            ...attackPosesOf(
              attackTimeline('double'),
              motion,
              IMPACT + 420 + 170 + 2 * FRAME_MS,
              END,
            ),
          ],
          // Les coups de l'entité qui n'ont pas de poses d'un coup.
          "prépare un coup sans poses d'un coup": () =>
            movesOf(kind)
              .filter(({ attack }) => motion[attack] === undefined)
              .flatMap(({ attack }) => actionOf(kind, attack)),
          // Touché, il garde sa pose : la scène ne la change pas, seul le chiffre s'envole.
          'est touché': () => still('standing'),
          'est étourdi': () => still('stunned'),
          tombe: () => still('fallen'),
        };
        world.shown[kind] = timelines[moment]!();
      }
    },
  );

  then(
    /^il joue les poses (.+) de son animation complète, à 12 images par seconde \(83 ms par image\)$/u,
    (poses: string) => {
      const wanted = framesIn(poses);
      expect(Math.round(FRAME_MS)).toBe(83);
      for (const kind of world.kinds) {
        const shownPoses = world.shown[kind]!;
        expect(shownPoses.length).toBeGreaterThan(0);
        const shown = shownPoses.map(({ frame }) => frame);
        expect([kind, shown, inOrder(shown, wanted)]).toEqual([kind, shown, true]);
        // Toutes de l'animation complète : aucune pose d'un coup, aucune élévation.
        expect(shownPoses.filter(({ poses: source }) => source !== null)).toEqual([]);
        expect(shownPoses.every(({ lift }) => lift === 0)).toBe(true);
        expectCopied(kind, shownPoses);
      }
    },
  );

  and("aucune pose n'est obtenue en déplaçant ou en étirant une autre", () => {
    for (const kind of world.kinds) {
      const { w, h } = animationOf(kind);
      for (const { frame, poses } of world.shown[kind]!) {
        const { sprite } = battleSprite(kind, frame, { attack: poses });
        expect([sprite.width, sprite.height]).toEqual([w, h]);
        expect(sprite).toEqual(copiedPose(animationOf(kind), frame, false, poses));
      }
      expect(battleSprite(kind, 'hes').sprite).not.toEqual(battleSprite(kind, 'ant2').sprite);
    }
  });

  // --- Un coup avec ses poses d'un coup ---

  when(
    /^il prépare (le Carreau d'arbalète|l'Onde de choc|Deux tibias|Mise en ossuaire) \((.+)\)$/u,
    (name: string) => {
      const move = MOVES[name.replace(/^(le |l')/u, '')]!;
      expect(world.kinds).toEqual([move.kind]);
      const moves = move.phase2 ? (ENEMIES[move.kind].phase2Moves ?? []) : ENEMIES[move.kind].moves;
      expect(moves).toContainEqual({ attack: move.attack, damage: move.damage });
      world.move = { kind: move.kind, attack: move.attack };
      world.shown[move.kind] = actionOf(move.kind, move.attack);
    },
  );

  then(
    /^les poses (.+) sont celles de ses poses d'un coup pour (.+), avec leurs ancrages$/u,
    (poses: string) => {
      const { kind, attack } = world.move!;
      const wanted = framesIn(poses);
      expect([...ownPoses(kind, attack)].sort()).toEqual([...wanted].sort());
      const own = world.shown[kind]!.filter(({ poses: source }) => source !== null);
      expect(new Set(own.map(({ frame }) => frame))).toEqual(new Set(wanted));
      for (const { frame, poses: source } of own) {
        expect(source).toBe(attack);
        expect(poseAnchors(kind, frame, attack)).toEqual(
          copiedAnchors(animationOf(kind), frame, attack),
        );
      }
      expectCopied(kind, world.shown[kind]!);
    },
  );

  and('ses autres poses de ce coup viennent de son animation complète', () => {
    const { kind, attack } = world.move!;
    const others = world.shown[kind]!.filter(
      ({ frame }) => !ownPoses(kind, attack).includes(frame),
    );
    expect(others.length).toBeGreaterThan(0);
    for (const pose of others) expect([pose.frame, pose.poses]).toEqual([pose.frame, null]);
    expectCopied(kind, others);
  });

  and(
    "les durées de préparation et les fenêtres de parade et d'esquive sont celles d'aujourd'hui",
    () => {
      const { kind, attack } = world.move!;
      // Les mêmes images aux mêmes instants qu'avant cette story : les poses d'un coup ne changent
      // que le dessin. Les fenêtres viennent des impacts du domaine, inchangés.
      const timeline = attackTimeline(attack);
      for (let now = WIND_UP_AT; now < END; now += 1) {
        const { frame, tier, red, jitter } = enemyPose(timeline, now, false);
        expect([now, enemyPose(timeline, now, false, attackMotion(kind))]).toMatchObject([
          now,
          { frame, tier, red, jitter },
        ]);
      }
      expect(posesOf(timeline, WIND_UP_AT, END)).toEqual(
        attackPosesOf(timeline, {}, WIND_UP_AT, END).map(({ frame, tier, red }) => ({
          frame,
          tier,
          red,
        })),
      );
    },
  );

  // --- Le Carreau d'arbalète ---

  when("ils tirent le Carreau d'arbalète", () => {
    world.move = { kind: 'twins', attack: 'basic' };
    world.shown.twins = actionOf('twins', 'basic');
  });

  then(
    "leur ruée ne parcourt que la moitié du chemin vers le héros (portée 0,5 de l'Atelier)",
    () => {
      const bolt = attackTimeline('basic');
      const motion = attackMotion('twins');
      expect(motion.basic?.reach).toBe(0.5);
      expect(enemyPose(bolt, IMPACT, false, motion).reach).toBeCloseTo(0.5);
      let farthest = 0;
      for (let now = WIND_UP_AT; now < END; now += 1) {
        farthest = Math.max(farthest, enemyPose(bolt, now, false, motion).reach);
      }
      expect(farthest).toBeCloseTo(0.5);
    },
  );

  and("l'arbalète est visible sur les poses du coup", () => {
    const { pal, frames } = TWINS_ANIMATION;
    for (const frame of ownPoses('twins', 'basic')) {
      const pose = copiedPose(TWINS_ANIMATION, frame, false, 'basic');
      expect(battleSprite('twins', frame, { attack: 'basic' }).sprite).toEqual(pose);
      expect(pose).not.toEqual(copiedPose(TWINS_ANIMATION, frame));
    }
    // L'œil du coup est sur l'arbalète, tenue au bout du bras : peinte sur la pose du coup, là où
    // la pose de l'animation complète est vide.
    for (const frame of ['ant1', 'ant2', 'lunge'] as const) {
      const [x, y] = poseAnchors('twins', frame, 'basic').eye!;
      const rows = TWINS_ANIMATION.attackPoses.basic.frames[frame];
      expect([frame, rows[y]![x] !== '.', frames[frame][y]![x]]).toEqual([frame, true, '.']);
      expect(pal[parseInt(rows[y]![x]!, 36)]).toBeDefined();
    }
  });

  // --- L'Onde de choc ---

  when("ils préparent l'Onde de choc", () => {
    world.move = { kind: 'twins', attack: 'delayedPerilous' };
    world.shown.twins = actionOf('twins', 'delayedPerilous');
  });

  then(
    /^chaque pose du coup est élevée de l'élévation donnée par l'Atelier \((.+) pixels d'art\)$/u,
    (lifts: string) => {
      const wanted = Object.fromEntries(
        lifts.split(', ').map((pair) => {
          const [frame, lift] = pair.split(' ');
          return [frame, Number(lift)];
        }),
      );
      const seen: Record<string, number> = {};
      for (const { frame, poses, lift } of world.shown.twins!) {
        if (poses === null) expect([frame, lift]).toEqual([frame, 0]);
        else seen[frame] = lift;
      }
      expect(seen).toEqual(wanted);
      expect(TWINS_ANIMATION.attackPoses.delayedPerilous.lift).toEqual(wanted);
    },
  );

  and(
    "leurs poses du coup s'affichent dans leur palette rouge, avec le sceau qui pulse pendant toute la préparation, hésitation comprise, comme aujourd'hui",
    async () => {
      const own = world.shown.twins!.filter(({ poses }) => poses === 'delayedPerilous');
      expect(own.map(({ frame }) => frame)).toContain('hes');
      for (const { frame, tier, red } of own) {
        expect([frame, red]).toEqual([frame, true]);
        expect(atlasCell('twins', frame, tier, true, 'delayedPerilous')).toEqual(
          toRgba(copiedPose(TWINS_ANIMATION, frame, true, 'delayedPerilous')),
        );
      }
      expectCopied('twins', world.shown.twins!);
      await showColumn('twins', true);
      expectSeal('twins');
    },
  );

  // --- Le changement de phase de la Gardienne ---

  given('un combat contre la Gardienne des ossuaires', () => {
    world.kinds = ['ossuaryWarden'];
  });

  when('ses PV passent à 150 ou moins', () => {
    expect(ENEMIES.ossuaryWarden.phaseShiftHp).toBe(150);
    // Le premier hasard qui tire Deux tibias, puis Mise en ossuaire, en phase 2.
    for (let seed = 1; seed <= 200 && world.phase2.length === 0; seed += 1) {
      const fight = wardenInPhase2(seed);
      const kinds = fight.actions.map((timeline) => timeline.attack);
      const double = kinds.indexOf('double');
      if (fight.shifted && double >= 0 && kinds.indexOf('perilous', double) > double) {
        world.shifted = fight.phase2;
        world.phase2 = fight.actions.map((timeline) => ({
          timeline,
          shown: attackPosesOf(
            timeline,
            attackMotion('ossuaryWarden'),
            timeline.windUpAt,
            timeline.until + 400,
          ),
        }));
      }
    }
    expect(world.phase2.length).toBeGreaterThan(0);
  });

  then("le changement de phase se joue comme aujourd'hui", () => {
    // Le domaine passe la Gardienne en phase 2 ; Initiative 9, comme #91 le joue.
    expect(world.shifted).toBe(true);
    expect(ENEMIES.ossuaryWarden.phase2Initiative).toBe(9);
    expect(ENEMIES.ossuaryWarden.phase2Moves).toEqual([
      { attack: 'double', damage: 6 },
      { attack: 'perilous', damage: 15 },
    ]);
  });

  and("ses coups de phase 2, Deux tibias et Mise en ossuaire, jouent leurs poses d'un coup", () => {
    for (const attack of ['double', 'perilous'] as const) {
      const action = world.phase2.find(({ timeline }) => timeline.attack === attack)!;
      expect(action).toBeDefined();
      const own = action.shown.filter(({ poses }) => poses === attack);
      expect(new Set(own.map(({ frame }) => frame))).toEqual(
        new Set(ownPoses('ossuaryWarden', attack)),
      );
      expectCopied('ossuaryWarden', action.shown);
    }
    // Fémur et Pesée, en phase 2 comme en phase 1, jouent l'animation complète.
    for (const { timeline, shown } of world.phase2) {
      if (timeline.attack === 'basic' || timeline.attack === 'delayed') {
        expect(shown.every(({ poses }) => poses === null)).toBe(true);
      }
    }
  });

  and("Mise en ossuaire s'affiche dans sa palette rouge", () => {
    const burial = world.phase2.find(({ timeline }) => timeline.attack === 'perilous')!;
    const own = burial.shown.filter(({ poses }) => poses === 'perilous');
    expect(own.length).toBeGreaterThan(0);
    for (const { frame, tier, red } of own) {
      expect([frame, red]).toEqual([frame, true]);
      expect(atlasCell('ossuaryWarden', frame, tier, true, 'perilous')).toEqual(
        toRgba(copiedPose(OSSUARY_WARDEN_ANIMATION, frame, true, 'perilous')),
      );
    }
    // Deux tibias n'est pas imparable : pas de rouge.
    const shinbones = world.phase2.find(({ timeline }) => timeline.attack === 'double')!;
    expect(shinbones.shown.some(({ red }) => red)).toBe(false);
  });

  // --- Le reflet et les étoiles ---

  when("le reflet de son coup s'allume, ou quand il est étourdi", () => undefined);

  then(
    "le reflet part de son œil ou de ses 2 pointes, selon les ancrages de la pose affichée, poses d'un coup comprises",
    () => {
      for (const kind of world.kinds) {
        const animation = animationOf(kind);
        const motion = attackMotion(kind);
        for (const { attack } of movesOf(kind)) {
          const timeline = attackTimeline(attack);
          for (const glint of timeline.glints) {
            // Pendant les 70 ms où la pose reste pleine, puis pendant la ruée.
            for (const delay of [10, 80]) {
              const now = glint.at + delay;
              const { frame, poses } = enemyPose(timeline, now, false, motion);
              expect(poses).toBe(motion[attack] === undefined ? null : attack);
              const glints = glintSprites(timeline.glints, now, poseAnchors(kind, frame, poses));
              const anchors = copiedAnchors(animation, frame, poses);
              const wanted = glint.kind === 'double' ? anchors.tips : [anchors.eye];
              expect([kind, attack, glints.map(({ x, y }) => [x, y])]).toEqual([
                kind,
                attack,
                expect.arrayContaining(wanted),
              ]);
              if (glint.kind === 'double') expect(anchors.tips).toHaveLength(2);
            }
          }
        }
      }
    },
  );

  and("les étoiles tournent au-dessus de sa tête, selon l'ancrage de la pose affichée", () => {
    for (const kind of world.kinds) {
      const stunned = { standing: true, down: true, losingAction: false, rising: null };
      for (const [now, pose] of [
        [100, 'hurt'],
        [500, 'down'],
      ] as const) {
        const rest = restPose({ ...stunned, downSince: 0 }, 0, now);
        expect([rest.frame, rest.stars !== null]).toEqual([pose, true]);
        expect(poseAnchors(kind, rest.frame).head).toEqual(
          copiedAnchors(animationOf(kind), pose).head,
        );
      }
    }
  });

  // --- Les entités sans poses d'un coup ---

  given(
    'la Goule, le Villageois fou, le Spectre, le Chevalier déchu ou le Prieur sans visage en combat',
    () => {
      world.kinds = ['ghoul', 'madVillager', 'specter', 'fallenKnight', 'facelessPrior'];
    },
  );

  when("il prépare n'importe quel coup", () => {
    for (const kind of world.kinds) {
      world.shown[kind] = movesOf(kind).flatMap(({ attack }) => actionOf(kind, attack));
    }
  });

  then('il joue les poses de son animation complète, comme avant cette story', () => {
    for (const kind of world.kinds) {
      expect(attackMotion(kind)).toEqual({});
      expect(battleAtlas(kind).table.attacks).toEqual({});
      const shown = world.shown[kind]!;
      expect(shown.length).toBeGreaterThan(0);
      expect(shown.every(({ poses, lift }) => poses === null && lift === 0)).toBe(true);
      for (const { attack } of movesOf(kind)) {
        const before = posesOf(attackTimeline(attack), WIND_UP_AT, END);
        expect(before).toEqual(
          actionOf(kind, attack).map(({ frame, tier, red }) => ({ frame, tier, red })),
        );
        for (const frame of ENEMY_FRAMES) {
          expect(battleSprite(kind, frame, { attack }).sprite).toEqual(
            battleSprite(kind, frame).sprite,
          );
        }
      }
    }
  });

  // --- Jamais d'échelle fractionnaire ---

  given('Les Jumeaux ou la Gardienne des ossuaires avec son image validée', () => {
    world.kinds = STORY;
  });

  when("il s'affiche, dans n'importe quelle pose, élevé ou non, rouge ou non", () => {
    for (const kind of world.kinds) {
      world.shown[kind] = movesOf(kind).flatMap(({ attack }) => [
        ...actionOf(kind, attack),
        ...actionOf(kind, attack, true),
      ]);
    }
  });

  then(
    "il est à 2 dp par pixel d'art, jamais à une autre échelle, et l'élévation tombe sur un pixel d'art entier",
    () => {
      for (const kind of world.kinds) {
        const { w, h } = animationOf(kind);
        const shown = world.shown[kind]!;
        expect(shown.some(({ red }) => red)).toBe(true);
        for (const { frame, red, poses, lift } of shown) {
          const { sprite } = battleSprite(kind, frame, { red, attack: poses });
          expect([sprite.width, sprite.height]).toEqual([w, h]);
          // L'élévation, en pixels d'art entiers, monte de 2 dp par pixel d'art : sur la grille.
          expect(Number.isInteger(lift)).toBe(true);
          expect((lift * 2) % 2).toBe(0);
        }
        if (kind === 'twins') expect(shown.some(({ lift }) => lift > 0)).toBe(true);
        // La place de la scène est de 2 dp par pixel d'art : la case de l'entité y garde 2 dp.
        for (const { sprite } of sceneGeometry(390, 440, 1).enemies) {
          expect([sprite.width / 44, sprite.height / 52]).toEqual([2, 2]);
          const origin = spriteOrigin(sprite, w, h);
          expect([origin.x % 2, origin.y % 2]).toEqual([0, 0]);
        }
      }
    },
  );

  // --- Mouvement réduit ---

  when('Les Jumeaux ou la Gardienne des ossuaires prépare un coup', () => {
    world.kinds = STORY;
  });

  then(
    "il parcourt seulement le quart de sa portée, comme aujourd'hui, avec les mêmes durées",
    () => {
      for (const kind of world.kinds) {
        const motion = attackMotion(kind);
        for (const { attack } of movesOf(kind)) {
          const timeline = attackTimeline(attack);
          for (let now = WIND_UP_AT; now < END; now += 5) {
            const full = enemyPose(timeline, now, false, motion);
            const reduced = enemyPose(timeline, now, true, motion);
            expect([kind, attack, now, reduced.frame, reduced.red, reduced.poses]).toEqual([
              kind,
              attack,
              now,
              full.frame,
              full.red,
              full.poses,
            ]);
            expect(reduced.reach).toBeCloseTo(full.reach * 0.25, 6);
            expect(reduced.lift).toBe(Math.round(full.lift * 0.25));
          }
        }
      }
    },
  );

  and('les poses du coup, le reflet, la palette rouge et le sceau restent affichés', async () => {
    for (const [kind, attack] of [
      ['twins', 'delayedPerilous'],
      ['ossuaryWarden', 'perilous'],
    ] as const) {
      const timeline = attackTimeline(attack);
      const now = timeline.glints[0]!.at + 10;
      const pose = enemyPose(timeline, now, true, attackMotion(kind));
      expect([pose.poses, pose.red]).toEqual([attack, true]);
      const glints = glintSprites(timeline.glints, now, poseAnchors(kind, pose.frame, attack));
      expect(glints).toHaveLength(1);
      expect(glints[0]!.effect).toBe('glintRed');
      expect(atlasCell(kind, pose.frame, pose.tier, true, attack)).toEqual(
        toRgba(copiedPose(animationOf(kind), pose.frame, true, attack)),
      );
      await showColumn(kind, true, true);
      expectSeal(kind);
    }
  });

  // --- Lecteur d'écran ---

  given("le lecteur d'écran est actif", () => undefined);

  when(
    'le joueur parcourt un combat contre Les Jumeaux ou la Gardienne des ossuaires',
    async () => {
      for (const kind of STORY) {
        await showBattle([kind], kind === 'twins' ? 'elite' : 'boss');
        world.read.hidden = isHidden(
          screen.getByTestId('battle-scene', { includeHiddenElements: true }),
        );
        expect(screen.queryByTestId('battle-scene')).toBeNull();
        world.read.labels.push(
          screen.getByTestId(`enemy-${kind}`).props.accessibilityLabel as string,
        );
        await cleanup();
      }
    },
  );

  then("l'image et ses poses ne sont pas lues : elles sont décoratives", () => {
    expect(world.read.hidden).toBe(true);
  });

  and(
    "le lecteur d'écran lit toujours le nom, les PV, la garde et l'intention, et annonce le type de coup au début de la préparation comme aujourd'hui",
    () => {
      STORY.forEach((kind, index) => {
        const { maxHp, maxGuard } = ENEMIES[kind];
        expect(world.read.labels[index]).toContain(ENEMY_NAMES[kind]);
        expect(world.read.labels[index]).toContain(`${maxHp} PV sur ${maxHp}`);
        expect(world.read.labels[index]).toContain(`garde ${maxGuard} sur ${maxGuard}`);
        expect(world.read.labels[index]).toMatch(/intention/u);
        const battle = { enemies: [{ kind }] } as unknown as Battle;
        for (const { attack } of movesOf(kind)) {
          const windUp = { type: 'windUpStarted', enemy: 0, attack } as const;
          const dodge = ATTACKS[attack].perilous ? ', esquive' : '';
          expect(announcement(windUp as Parameters<typeof announcement>[0], battle)).toBe(
            `${ENEMY_NAMES[kind]}, ${ATTACK_NAMES[attack]}${dodge}`,
          );
        }
      });
    },
  );
};

const feature = loadFeature('features/jumeaux-gardienne.feature');
autoBindSteps([feature], [steps]);
