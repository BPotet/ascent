/*
 * Scénarios de « Le Spectre, le Chevalier déchu et le Prieur sans visage animés » (#138, chemin B).
 * Correspondance :
 * - « s'affiche avec son image validée », « joue les poses », « palette rouge » : la pose que la
 *   scène choisit à chaque instant (`enemyPose` sur une action construite ici, `restPose` au
 *   repos), puis son image (`battleSprite`) et sa case dans l'atlas que la scène dessine
 *   (`battleAtlas`), comparées aux lignes recopiées de l'Atelier, avec `pal` ou `red` ;
 * - « à 2 dp par pixel d'art », « pieds sur son socle » : la place d'un ennemi dans la scène
 *   (`sceneGeometry`) et l'origine de sa case (`spriteOrigin`) ;
 * - « le reflet » et « les étoiles » : les ancrages de la pose affichée (`poseAnchors`), tels que la
 *   scène les place (`glintSprites`) ;
 * - « le sceau » : la colonne de l'ennemi (`EnemyColumn`), comme le fait #81 ;
 * - le combat et le lecteur d'écran : l'écran de l'ascension (`AscentScreen`), la scène y étant
 *   simulée ;
 * - « comme aujourd'hui » (le changement de phase, l'annonce du coup) : le code inchangé, vérifié
 *   par les scénarios de #32, #81 et #91.
 * Les entités hors de cette story ne sont vérifiées que sur ce qu'elle change : quel que soit
 * l'ordre de merge avec #137 et #140, elles ne prennent aucune des trois animations.
 */
import { cleanup, render, screen, within } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { EnemyColumn } from '../../src/adapters/ui/battle/EnemyColumn';
import { FRAME_MS, enemyPose, restPose } from '../../src/adapters/ui/battle/scene/enemyPose';
import { glintSprites } from '../../src/adapters/ui/battle/scene/sceneEffects';
import { sceneGeometry, spriteOrigin } from '../../src/adapters/ui/battle/scene/sceneGeometry';
import type { SceneEnemy } from '../../src/adapters/ui/battle/sceneTypes';
import { ENEMY_NAMES, announcement } from '../../src/adapters/ui/format/battleText';
import { toRgba } from '../../src/adapters/ui/pixelArt/sprites/Sprite';
import { FACELESS_PRIOR_ANIMATION } from '../../src/adapters/ui/pixelArt/sprites/atelier/data/facelessPrior';
import { FALLEN_KNIGHT_ANIMATION } from '../../src/adapters/ui/pixelArt/sprites/atelier/data/fallenKnight';
import { SPECTER_ANIMATION } from '../../src/adapters/ui/pixelArt/sprites/atelier/data/specter';
import type { FullAnimation } from '../../src/adapters/ui/pixelArt/sprites/atelier/fullAnimation';
import { battleAtlas } from '../../src/adapters/ui/pixelArt/sprites/battle/battleAtlas';
import {
  ANIMATED_ENEMIES,
  ENEMY_FRAMES,
  RED_FRAMES,
  battleSprite,
  poseAnchors,
  type EnemyFrame,
} from '../../src/adapters/ui/pixelArt/sprites/battle/battleCharacters';
import type { EnemyView } from '../../src/adapters/ui/state/battleView';
import { AscentScreen } from '../../src/adapters/ui/screens/AscentScreen';
import { ascentSetUp } from '../../src/adapters/ui/testing/ascent';
import { renderScreen } from '../../src/adapters/ui/testing/renderScreen';
import { startAscent } from '../../src/domain/ascent/Ascent';
import { ATTACKS, type AttackKind } from '../../src/domain/battle/attacks';
import type { Battle } from '../../src/domain/battle/Battle';
import { ENEMIES, type EnemyKind, type Move } from '../../src/domain/battle/combatants';
import { drawIntent } from '../../src/domain/battle/intents';
import { seedRandom } from '../../src/domain/battle/SeededRandom';
import {
  IMPACT,
  STEP_IN,
  STEP_IN_AT,
  WIND_UP_AT,
  atlasCell,
  attackTimeline,
  copiedAnchors,
  copiedPose,
  inOrder,
  posesOf,
  restPoses,
  type ShownPose,
} from '../support/fullAnimationStory';

jest.mock('../../src/adapters/ui/battle/BattleCanvas', () =>
  jest.requireActual('../../src/adapters/ui/battle/testing/fakeBattleCanvas'),
);

type StoryEnemy = 'specter' | 'fallenKnight' | 'facelessPrior';

/** Les trois animations de cette story, une ligne par entité. */
const ANIMATIONS: Readonly<Record<StoryEnemy, FullAnimation<EnemyFrame>>> = {
  specter: SPECTER_ANIMATION,
  fallenKnight: FALLEN_KNIGHT_ANIMATION,
  facelessPrior: FACELESS_PRIOR_ANIMATION,
};
const STORY: readonly StoryEnemy[] = ['specter', 'fallenKnight', 'facelessPrior'];
const KIND_OF_NAME: Readonly<Record<string, EnemyKind>> = Object.fromEntries(
  Object.entries(ENEMY_NAMES).map(([kind, name]) => [name.toLowerCase(), kind as EnemyKind]),
);
/** Le nom de l'entité dans un scénario (« le Prieur sans visage »), sans son article. */
const kindOf = (name: string): EnemyKind =>
  KIND_OF_NAME[name.replace(/^(le |la |les )/iu, '').toLowerCase()]!;
const ENCOUNTERS: Readonly<Record<string, 'combat' | 'elite' | 'boss'>> = {
  'combat ordinaire': 'combat',
  "combat d'Élite": 'elite',
  'combat de boss': 'boss',
};
/** Les coups imparables de la story, recopiés du Codex : nom, dégâts, phase 2. */
const PERILOUS: Readonly<Record<string, { kind: StoryEnemy; damage: number; phase2: boolean }>> = {
  'Étreinte glacée': { kind: 'specter', damage: 9, phase2: false },
  'Charge de la porte': { kind: 'fallenKnight', damage: 12, phase2: false },
  Absolution: { kind: 'facelessPrior', damage: 14, phase2: true },
};

interface World {
  kinds: readonly EnemyKind[];
  shown: ShownPose[];
  scene: SceneEnemy[];
  reduced: boolean;
  /** Le coup imparable préparé. */
  move: Move | null;
  read: { labels: string[]; hidden: boolean };
}

let world: World;

beforeEach(() => {
  world = {
    kinds: [],
    shown: [],
    scene: [],
    reduced: false,
    move: null,
    read: { labels: [], hidden: false },
  };
});

const animationOf = (kind: EnemyKind) => ANIMATIONS[kind as StoryEnemy];

/** Les coups d'un ennemi, phase 2 comprise. */
const movesOf = (kind: EnemyKind): readonly Move[] => [
  ...ENEMIES[kind].moves,
  ...(ENEMIES[kind].phase2Moves ?? []),
];

/**
 * Chaque pose montrée est la pose recopiée, dans sa palette rouge pendant un coup imparable, dans
 * l'image de l'entité comme dans la case que la scène dessine.
 */
function expectCopied(kind: EnemyKind, shown: readonly ShownPose[]) {
  for (const { frame, tier, red } of shown) {
    const pose = copiedPose(animationOf(kind), frame, red && RED_FRAMES.includes(frame));
    expect([kind, frame, red, battleSprite(kind, frame, { tier, red }).sprite]).toEqual([
      kind,
      frame,
      red,
      pose,
    ]);
    expect(atlasCell(kind, frame, tier, red)).toEqual(toRgba(pose));
  }
}

/** Un combat de la tour contre `enemies`, l'écran de l'ascension monté. */
async function showBattle(
  enemies: readonly EnemyKind[],
  kind: 'combat' | 'elite' | 'boss' = 'combat',
) {
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

const steps: StepDefinitions = ({ given, when, then, and }) => {
  // --- Contexte ---

  given(
    "l'image et l'animation complète du Spectre (specter), du Chevalier déchu (fallenKnight) et du Prieur sans visage (facelessPrior) sont validées dans l'Atelier de l'ascension au 29/10/2026",
    () => {
      for (const kind of STORY) {
        expect(ANIMATED_ENEMIES).toContain(kind);
        expect(Object.keys(ANIMATIONS[kind].frames).sort()).toEqual([...ENEMY_FRAMES].sort());
      }
    },
  );

  and(
    "l'animation complète, palette rouge comprise, est recopiée telle quelle dans le code",
    () => {
      for (const kind of STORY) {
        const { pal, red } = ANIMATIONS[kind];
        expect([kind, red?.length]).toEqual([kind, pal.length]);
        for (const frame of ENEMY_FRAMES) {
          expect(battleSprite(kind, frame).sprite).toEqual(copiedPose(ANIMATIONS[kind], frame));
        }
      }
    },
  );

  // --- Les sujets ---

  given('une ascension en cours', () => undefined);

  given('le Spectre, le Chevalier déchu ou le Prieur sans visage en combat', () => {
    world.kinds = STORY;
  });

  given('le mouvement réduit est actif', () => {
    world.reduced = true;
  });

  // --- Chacun en combat avec son image validée ---

  when(
    /^le joueur entre dans un (combat ordinaire|combat d'Élite|combat de boss) contre (.+)$/u,
    async (encounter: string, name: string) => {
      const kind = kindOf(name);
      world.kinds = [kind];
      world.scene = await showBattle([kind], ENCOUNTERS[encounter]);
    },
  );

  then(
    /^(.+) s'affiche avec son image validée \((\d+) × (\d+) pixels d'art\), à 2 dp par pixel d'art$/u,
    (name: string, width: string, height: string) => {
      const kind = kindOf(name);
      expect(world.scene.map((enemy) => enemy.kind)).toEqual([kind]);
      const animation = animationOf(kind);
      expect([animation.w, animation.h]).toEqual([Number(width), Number(height)]);
      expectCopied(
        kind,
        ENEMY_FRAMES.map((frame) => ({ frame, tier: 0, red: false })),
      );
      // Sa case, à 2 dp par pixel d'art, posée sur sa place de la scène.
      const { sprite } = sceneGeometry(390, 440, 1).enemies[0]!;
      const { cellWidth, cellHeight } = battleAtlas(kind).table;
      expect([cellWidth, cellHeight]).toEqual([Number(width), Number(height)]);
      const origin = spriteOrigin(sprite, cellWidth, cellHeight);
      expect(origin.y + cellHeight * 2).toBe(sprite.y + sprite.height);
    },
  );

  and(/^il n'est plus dessiné avec .+$/u, () => {
    const [kind] = world.kinds as [EnemyKind];
    for (const frame of ENEMY_FRAMES) {
      // Plus aucun dessin par le code, ni l'ancien ni un autre : le liseré d'un dessin, ajouté au
      // palier 2, ne s'y ajoute plus. Le dessin des ennemis par le code n'existe plus (#139).
      expect(battleSprite(kind, frame, { tier: 2 }).sprite).toEqual(
        battleSprite(kind, frame).sprite,
      );
    }
  });

  // --- Chaque moment du combat ---

  when(
    /^il (attend son tour|avance vers le héros puis revient|prépare un coup simple ou une double frappe|prépare un coup retardé|fait une fausse amorce|est touché|est étourdi|tombe)$/u,
    (moment: string) => {
      const timelines: Record<string, () => ShownPose[]> = {
        'attend son tour': () => restPoses('standing'),
        'avance vers le héros puis revient': () => [
          ...posesOf(STEP_IN, STEP_IN_AT, WIND_UP_AT),
          ...posesOf(attackTimeline('basic'), IMPACT, IMPACT + 600),
        ],
        'prépare un coup simple ou une double frappe': () => [
          ...posesOf(attackTimeline('basic'), WIND_UP_AT, IMPACT + 600),
          ...posesOf(attackTimeline('double'), WIND_UP_AT, IMPACT + 1_000),
        ],
        'prépare un coup retardé': () =>
          posesOf(attackTimeline('delayed'), WIND_UP_AT, IMPACT + 600),
        'fait une fausse amorce': () => posesOf(attackTimeline('feint'), WIND_UP_AT, IMPACT),
        // Touché, il garde sa pose : la scène ne la change pas, seul le chiffre s'envole.
        'est touché': () => restPoses('standing'),
        'est étourdi': () => restPoses('stunned'),
        tombe: () => restPoses('fallen'),
      };
      world.shown = timelines[moment]!();
    },
  );

  then(
    /^il joue les poses (.+) de son animation complète, à 12 images par seconde \(83 ms par image\)$/u,
    (poses: string) => {
      const wanted = poses.match(new RegExp(`\\b(${ENEMY_FRAMES.join('|')})\\b`, 'gu'))!;
      const shown = world.shown.map(({ frame }) => frame);
      expect([shown, inOrder(shown, wanted as EnemyFrame[])]).toEqual([shown, true]);
      expect(Math.round(FRAME_MS)).toBe(83);
      for (const kind of world.kinds) expectCopied(kind, world.shown);
    },
  );

  and("aucune pose n'est obtenue en déplaçant ou en étirant une autre", () => {
    for (const kind of world.kinds) {
      const [width, height] = [animationOf(kind).w, animationOf(kind).h];
      for (const { frame } of world.shown) {
        const { sprite } = battleSprite(kind, frame);
        expect([sprite.width, sprite.height]).toEqual([width, height]);
        expect(sprite).toEqual(copiedPose(animationOf(kind), frame));
      }
      expect(battleSprite(kind, 'hes').sprite).not.toEqual(battleSprite(kind, 'ant2').sprite);
    }
  });

  // --- Le coup imparable en rouge ---

  given(
    /^(le Spectre|le Chevalier déchu|le Prieur sans visage)(?:, en phase 2)? en combat$/u,
    (name: string) => {
      world.kinds = [kindOf(name)];
    },
  );

  when(/^il prépare (.+), un coup imparable$/u, (attackName: string) => {
    const { kind, damage, phase2 } = PERILOUS[attackName]!;
    expect(world.kinds).toEqual([kind]);
    const moves = phase2 ? (ENEMIES[kind].phase2Moves ?? []) : ENEMIES[kind].moves;
    world.move = moves.find((move) => ATTACKS[move.attack].perilous) ?? null;
    expect(world.move).toEqual({ attack: 'perilous', damage });
    world.shown = [
      ...posesOf({ ...STEP_IN, attack: 'perilous' }, STEP_IN_AT, WIND_UP_AT, world.reduced),
      ...posesOf(attackTimeline('perilous'), WIND_UP_AT, IMPACT + 600, world.reduced),
    ];
  });

  then(
    "ses poses d'attaque s'affichent dans sa palette rouge validée, pose pour pose, aux mêmes moments qu'aujourd'hui",
    () => {
      const [kind] = world.kinds as [EnemyKind];
      // Les mêmes moments : la scène demande le rouge de toute la préparation à la récupération.
      const reds = world.shown.filter(({ red }) => red);
      expect(reds.map(({ frame }) => frame)).toEqual(
        expect.arrayContaining(['ant0', 'ant1', 'ant2', 'lunge', 'impact', 'rec0', 'rec1']),
      );
      for (const { frame } of reds) expect(RED_FRAMES).toContain(frame);
      expectCopied(kind, world.shown);
      for (const { frame, tier } of reds) {
        expect(battleSprite(kind, frame, { tier, red: true }).sprite).not.toEqual(
          battleSprite(kind, frame, { tier }).sprite,
        );
      }
    },
  );

  and("le sceau pulse au-dessus de lui comme aujourd'hui", async () => {
    const [kind] = world.kinds as [EnemyKind];
    await showColumn(kind, true);
    expectSeal(kind);
  });

  and('ses autres coups gardent sa palette normale', () => {
    const [kind] = world.kinds as [EnemyKind];
    const others = movesOf(kind).filter((move) => !ATTACKS[move.attack].perilous);
    expect(others.length).toBeGreaterThan(0);
    for (const { attack } of others) {
      const shown = posesOf(attackTimeline(attack), WIND_UP_AT, IMPACT + 600);
      expect(shown.some(({ red }) => red)).toBe(false);
      expectCopied(kind, shown);
    }
  });

  // --- Le changement de phase du Prieur ---

  given('un combat contre le Prieur sans visage', () => {
    world.kinds = ['facelessPrior'];
  });

  when('ses PV passent à 150 ou moins', () => {
    expect(ENEMIES.facelessPrior.phaseShiftHp).toBe(150);
  });

  then("le changement de phase se joue comme aujourd'hui", () => {
    // En phase 2, ses coups de phase 2 s'ajoutent à son tirage, Absolution comprise.
    const drawn = (phase2: boolean) =>
      Array.from({ length: 200 }, (_, seed) => {
        const { intent } = drawIntent('facelessPrior', seedRandom(seed), {
          fallenAlly: null,
          stunned: false,
          guardDamaged: false,
          phase2,
        });
        return intent.category === 'attack' ? intent.attack : intent.category;
      });
    expect(drawn(false)).not.toContain('perilous');
    expect(drawn(true)).toContain('perilous');
    expect(ENEMIES.facelessPrior.phase2Initiative).toBe(9);
  });

  and(
    'il garde son animation complète, avec ses poses rouges pour son coup imparable de phase 2',
    () => {
      const shown = posesOf(attackTimeline('perilous'), WIND_UP_AT, IMPACT + 600);
      expect(shown.some(({ red }) => red)).toBe(true);
      expectCopied('facelessPrior', shown);
      expectCopied(
        'facelessPrior',
        ENEMY_FRAMES.map((frame) => ({ frame, tier: 0, red: false })),
      );
    },
  );

  // --- Le reflet et les étoiles ---

  when("le reflet de son coup s'allume, ou quand il est étourdi", () => undefined);

  then(
    'le reflet part de son œil ou de ses 2 pointes, selon les ancrages de la pose affichée',
    () => {
      for (const kind of world.kinds) {
        const animation = animationOf(kind);
        const attacks: readonly AttackKind[] = ['basic', 'delayed', 'perilous'];
        for (const attack of attacks) {
          const timeline = attackTimeline(attack);
          const glint = timeline.glints[0]!;
          // Pendant les 70 ms où la pose reste pleine, puis pendant la ruée.
          for (const delay of [10, 80]) {
            const now = glint.at + delay;
            const { frame } = enemyPose(timeline, now, false);
            const glints = glintSprites(timeline.glints, now, poseAnchors(kind, frame));
            expect([kind, attack, glints.map(({ x, y }) => [x, y])]).toEqual([
              kind,
              attack,
              [copiedAnchors(animation, frame).eye],
            ]);
          }
        }
        // Une double frappe : un reflet à chacune de ses 2 pointes.
        const double = attackTimeline('double');
        const now = double.glints[0]!.at + 10;
        const { frame } = enemyPose(double, now, false);
        const glints = glintSprites(double.glints, now, poseAnchors(kind, frame));
        expect(glints.map(({ x, y }) => [x, y])).toEqual(copiedAnchors(animation, frame).tips);
        expect(glints).toHaveLength(2);
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

  // --- Les grandes entités ---

  given('le Chevalier déchu (44 × 54) ou le Prieur sans visage (52 × 62) en combat', () => {
    world.kinds = ['fallenKnight', 'facelessPrior'];
    expect(world.kinds.map((kind) => [animationOf(kind).w, animationOf(kind).h])).toEqual([
      [44, 54],
      [52, 62],
    ]);
  });

  when("il s'affiche, dans n'importe quelle pose", () => {
    // Chaque pose, et sa version rouge pour les poses d'attaque, les seules que la scène rougit.
    world.shown = ENEMY_FRAMES.flatMap((frame) =>
      [false, ...(RED_FRAMES.includes(frame) ? [true] : [])].map((red) => ({
        frame,
        tier: 2 as const,
        red,
      })),
    );
  });

  then(
    "il s'affiche en entier, à sa taille, à 2 dp par pixel d'art, sans être rogné ni réduit",
    () => {
      for (const kind of world.kinds) {
        // Chaque pixel de chaque pose est là, ni rogné ni réduit, dans l'image comme dans l'atlas.
        expectCopied(kind, world.shown);
        const { table } = battleAtlas(kind);
        expect([table.cellWidth, table.cellHeight]).toEqual([
          animationOf(kind).w,
          animationOf(kind).h,
        ]);
      }
    },
  );

  and('ses pieds reposent sur son socle, comme ceux des autres ennemis', () => {
    for (const count of [1, 2, 3]) {
      for (const { sprite, pedestalAt } of sceneGeometry(390, 440, count).enemies) {
        for (const kind of world.kinds) {
          const { cellWidth, cellHeight } = battleAtlas(kind).table;
          const origin = spriteOrigin(sprite, cellWidth, cellHeight);
          // Le bas de sa case tombe sur le bas de la place, centrée sur le socle.
          expect(origin.y + cellHeight * 2).toBe(sprite.y + sprite.height);
          expect(Math.abs(origin.x + cellWidth - pedestalAt.x)).toBeLessThanOrEqual(2);
          expect([origin.x % 2, origin.y % 2]).toEqual([0, 0]);
        }
      }
    }
  });

  and(
    "la Goule, le Villageois fou et les entités de 44 × 52 ou moins gardent leur place d'aujourd'hui",
    () => {
      const small = (Object.keys(ENEMIES) as EnemyKind[]).filter((kind) => {
        const { cellWidth, cellHeight } = battleAtlas(kind).table;
        return cellWidth <= 44 && cellHeight <= 52;
      });
      expect(small).toEqual(expect.arrayContaining(['ghoul', 'madVillager', 'specter']));
      for (const kind of small) {
        const { cellWidth, cellHeight } = battleAtlas(kind).table;
        for (const { sprite } of sceneGeometry(390, 440, 3).enemies) {
          expect(spriteOrigin(sprite, cellWidth, cellHeight)).toEqual({ x: sprite.x, y: sprite.y });
        }
      }
    },
  );

  // --- Les entités hors de cette story ---

  given("le Squelette, le Nécromancien, la Sentinelle ou l'Errante", () => {
    world.kinds = ['skeleton', 'necromancer'];
    // Les héroïnes ne sont pas des ennemis : aucune animation d'ennemi ne les touche.
    expect(ANIMATED_ENEMIES).not.toContain('sentinel');
    expect(ANIMATED_ENEMIES).not.toContain('wanderer');
  });

  when('il apparaît dans la tour', async () => {
    world.scene = await showBattle(['skeleton', 'necromancer']);
    expect(world.scene).toHaveLength(2);
  });

  then("il garde son sprite actuel ou sa silhouette provisoire, comme aujourd'hui", () => {
    for (const kind of world.kinds) {
      for (const frame of ENEMY_FRAMES) {
        const { sprite } = battleSprite(kind, frame);
        for (const story of STORY) {
          expect([kind, story, frame, sprite]).not.toEqual([
            kind,
            story,
            frame,
            copiedPose(ANIMATIONS[story], frame),
          ]);
        }
      }
    }
  });

  and(
    "les ennemis encore dessinés gardent leurs poses rouges, leur liseré et leur traînée d'aujourd'hui",
    () => {
      // Plus aucun ennemi n'est dessiné par le code depuis #139 : tous ont leur animation complète,
      // sans liseré ni traînée.
      const drawn = world.kinds.filter((kind) => !ANIMATED_ENEMIES.includes(kind));
      expect(drawn).toEqual([]);
      expect([...ANIMATED_ENEMIES].sort()).toEqual(Object.keys(ENEMIES).sort());
    },
  );

  // --- Jamais d'échelle fractionnaire ---

  given('le Spectre, le Chevalier déchu ou le Prieur sans visage avec son image validée', () => {
    world.kinds = STORY;
  });

  when("il s'affiche, dans n'importe quelle pose, rouge ou non", () => {
    world.shown = ENEMY_FRAMES.flatMap((frame) =>
      [false, true].map((red) => ({ frame, tier: 0 as const, red })),
    );
  });

  then("il est à 2 dp par pixel d'art, jamais à une autre échelle", () => {
    for (const kind of world.kinds) {
      const { w, h } = animationOf(kind);
      for (const { frame, red } of world.shown) {
        const { sprite } = battleSprite(kind, frame, { red });
        expect([sprite.width, sprite.height]).toEqual([w, h]);
      }
      // La place de la scène est de 2 dp par pixel d'art de la case de 44 × 52 : la case de
      // l'entité y garde 2 dp, sur la grille de 2 dp.
      for (const { sprite } of sceneGeometry(390, 440, 3).enemies) {
        expect([sprite.width / 44, sprite.height / 52]).toEqual([2, 2]);
        const origin = spriteOrigin(sprite, w, h);
        expect([origin.x % 2, origin.y % 2]).toEqual([0, 0]);
      }
    }
  });

  // --- Mouvement réduit ---

  when(
    'le Spectre, le Chevalier déchu ou le Prieur sans visage prépare un coup, imparable ou non',
    () => {
      world.kinds = STORY;
    },
  );

  then("il parcourt seulement le quart du chemin, comme aujourd'hui, avec les mêmes durées", () => {
    for (const attack of ['basic', 'perilous'] as const) {
      const timeline = attackTimeline(attack);
      for (let now = WIND_UP_AT; now < IMPACT + 600; now += 5) {
        const full = enemyPose(timeline, now, false);
        const reduced = enemyPose(timeline, now, true);
        expect([attack, now, reduced.frame, reduced.red]).toEqual([
          attack,
          now,
          full.frame,
          full.red,
        ]);
        expect(reduced.reach).toBeCloseTo(full.reach * 0.25, 6);
      }
    }
  });

  and('le reflet, la palette rouge et le sceau restent affichés', async () => {
    const perilous = attackTimeline('perilous');
    const now = perilous.glints[0]!.at + 10;
    const pose = enemyPose(perilous, now, true);
    expect(pose.red).toBe(true);
    for (const kind of world.kinds) {
      expect(glintSprites(perilous.glints, now, poseAnchors(kind, pose.frame))).toHaveLength(1);
      expect(battleSprite(kind, pose.frame, { red: true }).sprite).toEqual(
        copiedPose(animationOf(kind), pose.frame, true),
      );
      await showColumn(kind, true, true);
      expectSeal(kind);
    }
  });

  // --- Lecteur d'écran ---

  given("le lecteur d'écran est actif", () => undefined);

  when(
    'le joueur parcourt un combat contre le Spectre, le Chevalier déchu ou le Prieur sans visage',
    async () => {
      await showBattle(STORY);
      world.read.hidden = isHidden(
        screen.getByTestId('battle-scene', { includeHiddenElements: true }),
      );
      expect(screen.queryByTestId('battle-scene')).toBeNull();
      world.read.labels = STORY.map(
        (kind) => screen.getByTestId(`enemy-${kind}`).props.accessibilityLabel as string,
      );
    },
  );

  then("l'image, ses poses et sa palette rouge ne sont pas lues : elles sont décoratives", () => {
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
        const windUp = { type: 'windUpStarted', enemy: 0, attack: 'perilous' } as const;
        expect(announcement(windUp as Parameters<typeof announcement>[0], battle)).toBe(
          `${ENEMY_NAMES[kind]}, coup imparable, esquive`,
        );
      });
    },
  );
};

const feature = loadFeature('features/spectre-chevalier-prieur.feature');
autoBindSteps([feature], [steps]);
