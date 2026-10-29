/**
 * @jest-environment ./test/setup/skiaEnvironment.js
 */
/*
 * Scénarios de « Le Squelette et le Nécromancien animés, et l'image de l'Armure de chevalier noir »
 * (#137, chemin B). Correspondance, sur le modèle de #119 :
 * - « s'affiche avec son image validée », « joue les poses », « centrée et calée en bas » : la
 *   pose que la scène choisit à chaque instant (`enemyPose` sur une action construite ici,
 *   `restPose` au repos), puis son image (`battleSprite`) et sa case dans l'atlas que la scène
 *   dessine (`battleAtlas`), comparées aux lignes recopiées de l'Atelier ;
 * - « à 2 dp par pixel d'art » : la place d'un ennemi dans la scène (`sceneGeometry`), 88 × 104 dp
 *   pour la case de 44 × 52 pixels d'art ;
 * - « le reflet » et « les étoiles » : les ancrages de la pose affichée (`poseAnchors`), tels que la
 *   scène les place (`glintSprites`) ;
 * - le combat, « Objet trouvé » et le lecteur d'écran : l'écran de l'ascension (`AscentScreen`),
 *   la scène y étant simulée ;
 * - « comme aujourd'hui » (l'annonce, le son et l'étiquette du relevé, l'intention, le mouvement
 *   réduit) : le code inchangé, vérifié par les scénarios de #81, #106 et #119.
 * Les aides sont recopiées de `goule-villageois-objets.ui.steps.tsx` (#119), sans le factoriser.
 */
import '@shopify/react-native-skia/jestSetup';

import { cleanup, screen } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { FRAME_MS, enemyPose, restPose } from '../../src/adapters/ui/battle/scene/enemyPose';
import { glintSprites } from '../../src/adapters/ui/battle/scene/sceneEffects';
import { sceneGeometry } from '../../src/adapters/ui/battle/scene/sceneGeometry';
import type { SceneEnemy, SceneTimeline } from '../../src/adapters/ui/battle/sceneTypes';
import { itemText } from '../../src/adapters/ui/format/ascentText';
import {
  ENEMY_NAMES,
  HERO_NAMES,
  feedbackText,
  intentSpeech,
  selfRevivedTag,
} from '../../src/adapters/ui/format/battleText';
import { artPalette } from '../../src/adapters/ui/pixelArt/artPalette';
import { toRgba, type Sprite } from '../../src/adapters/ui/pixelArt/sprites/Sprite';
import { BLACK_KNIGHT_ARMOR_IMAGE } from '../../src/adapters/ui/pixelArt/sprites/atelier/data/blackKnightArmor';
import { ITEM_IMAGES } from '../../src/adapters/ui/pixelArt/sprites/atelier/data/itemImages';
import { NECROMANCER_ANIMATION } from '../../src/adapters/ui/pixelArt/sprites/atelier/data/necromancer';
import { SKELETON_ANIMATION } from '../../src/adapters/ui/pixelArt/sprites/atelier/data/skeleton';
import {
  assetSprite,
  type FullAnimation,
} from '../../src/adapters/ui/pixelArt/sprites/atelier/fullAnimation';
import { atlasRect, battleAtlas } from '../../src/adapters/ui/pixelArt/sprites/battle/battleAtlas';
import {
  ENEMY_FRAMES,
  battleSprite,
  poseAnchors,
  type EnemyFrame,
} from '../../src/adapters/ui/pixelArt/sprites/battle/battleCharacters';
import { AscentScreen } from '../../src/adapters/ui/screens/AscentScreen';
import { ascentSetUp } from '../../src/adapters/ui/testing/ascent';
import { renderScreen } from '../../src/adapters/ui/testing/renderScreen';
import { feedbackFor } from '../../src/application/useCases/battleFeedback';
import { startAscent, type Ascent } from '../../src/domain/ascent/Ascent';
import type { AttackKind } from '../../src/domain/battle/attacks';
import type { AttackStep } from '../../src/domain/battle/Battle';
import {
  ENEMIES,
  type EnemyKind,
  type HeroKind,
  type Move,
} from '../../src/domain/battle/combatants';
import { glintsOf } from '../../src/domain/battle/glints';

jest.mock('../../src/adapters/ui/battle/BattleCanvas', () =>
  jest.requireActual('../../src/adapters/ui/battle/testing/fakeBattleCanvas'),
);

type Animated = 'skeleton' | 'necromancer';

const ANIMATIONS: Readonly<Record<Animated, FullAnimation<EnemyFrame>>> = {
  skeleton: SKELETON_ANIMATION,
  necromancer: NECROMANCER_ANIMATION,
};
const ANIMATED: readonly Animated[] = ['skeleton', 'necromancer'];
const KIND_OF_NAME: Readonly<Record<string, EnemyKind>> = Object.fromEntries(
  Object.entries(ENEMY_NAMES).map(([kind, name]) => [name, kind as EnemyKind]),
);
const HERO_OF_NAME: Readonly<Record<string, HeroKind>> = Object.fromEntries(
  Object.entries(HERO_NAMES).map(([kind, name]) => [name.toLowerCase(), kind as HeroKind]),
);
/** Le début de l'action et son premier impact, sur l'horloge de combat. */
const STEP_IN_AT = 0;
const WIND_UP_AT = 600;
const IMPACT = 2_000;

interface World {
  kinds: readonly EnemyKind[];
  heroes: readonly HeroKind[];
  reduced: boolean;
  /** Les poses montrées, dans l'ordre, et leur liseré et leur rouge. */
  shown: { frame: EnemyFrame; tier: 0 | 1 | 2; red: boolean }[];
  scene: SceneEnemy[];
  /** Ce que lit le lecteur d'écran, et les images cachées. */
  read: { labels: string[]; hidden: boolean[]; heroes: string[] };
}

let world: World;

beforeEach(() => {
  world = {
    kinds: [],
    heroes: [],
    reduced: false,
    shown: [],
    scene: [],
    read: { labels: [], hidden: [], heroes: [] },
  };
});

/** Le code `artPalette` d'une teinte recopiée. */
const codeOf = (tint: string) =>
  artPalette.tints.findIndex((known) => known?.toLowerCase() === tint.toLowerCase());

/** La pose recopiée de l'Atelier, dans la case de 44 × 52 : centrée en largeur, calée en bas. */
function copied(kind: Animated, frame: EnemyFrame): Sprite {
  const { w, h, pal, frames } = ANIMATIONS[kind];
  const pixels = new Uint8Array(44 * 52);
  frames[frame].forEach((row, y) =>
    Array.from(row).forEach((char, x) => {
      if (char !== '.')
        pixels[(y + 52 - h) * 44 + x + (44 - w) / 2] = codeOf(pal[parseInt(char, 36)]!);
    }),
  );
  return { width: 44, height: 52, pixels };
}

/** Les ancrages recopiés d'une pose, dans la case de 44 × 52. */
function copiedAnchors(kind: Animated, frame: EnemyFrame) {
  const { w, h, anchors } = ANIMATIONS[kind];
  const moved = ([x, y]: readonly [number, number]) => [x + (44 - w) / 2, y + 52 - h];
  const { eye, head, tips } = anchors[frame];
  return { eye: moved(eye), head: moved(head), tips: tips.map(moved) };
}

/** Les pixels de la case d'une variante dans l'atlas que la scène dessine. */
function atlasCell(kind: EnemyKind, frame: EnemyFrame, tier: number, red: boolean): Uint8Array {
  const atlas = battleAtlas(kind);
  const rect = atlasRect(atlas.table, frame, tier, red);
  const cell = new Uint8Array(rect.width * rect.height * 4);
  for (let row = 0; row < rect.height; row += 1) {
    const start = ((rect.y + row) * atlas.width + rect.x) * 4;
    cell.set(atlas.rgba.subarray(start, start + rect.width * 4), row * rect.width * 4);
  }
  return cell;
}

/** Le coup `move` d'un ennemi, comme le domaine le pose, impacts compris. */
function attackStep(move: Move, impacts: readonly number[]): AttackStep {
  return {
    kind: 'attack',
    enemy: 0,
    attack: move.attack,
    damage: move.damage,
    startedAt: STEP_IN_AT,
    feintAt: null,
    feintShown: false,
    impacts: impacts.map((at) => ({ at, landed: false, lost: false, outcome: null })),
    resolvedAt: impacts[impacts.length - 1]! + 160,
    counter: null,
  };
}

/** L'action d'un ennemi, telle que la scène la reçoit. */
function attackTimeline(attack: AttackKind): SceneTimeline {
  const impacts = [IMPACT];
  return {
    enemy: 0,
    kind: 'attack',
    attack,
    stepInAt: STEP_IN_AT,
    windUpAt: WIND_UP_AT,
    windUpMs: IMPACT - WIND_UP_AT,
    until: IMPACT + 600,
    impacts,
    feintAt: null,
    glints: glintsOf(attackStep({ attack, damage: 5 }, impacts)),
    hitStopAt: 0,
    hitStopUntil: 0,
  };
}

const STEP_IN: SceneTimeline = {
  ...attackTimeline('basic'),
  kind: 'stepIn',
  attack: null,
  until: WIND_UP_AT,
  impacts: [],
  glints: [],
};

/** La Garde ou le Relever d'un ennemi, telle que la scène la reçoit. */
const SUPPORT: SceneTimeline = {
  ...STEP_IN,
  kind: 'support',
  windUpAt: STEP_IN_AT,
  until: 900,
};

/** Les poses de l'action, de `from` à `to`, chacune notée une fois quand elle change. */
function posesOf(timeline: SceneTimeline, from: number, to: number, reduced = false) {
  const shown: World['shown'] = [];
  for (let now = from; now < to; now += 1) {
    const { frame, tier, red } = enemyPose(timeline, now, reduced);
    const last = shown[shown.length - 1];
    if (last?.frame !== frame || last.tier !== tier || last.red !== red) {
      shown.push({ frame, tier, red });
    }
  }
  return shown;
}

/** Les poses au repos de 0 à 1 s : debout, étourdi depuis 0, tombé, ou se relevant depuis 0. */
function restPoses(state: 'standing' | 'stunned' | 'fallen' | 'rising') {
  const enemy = {
    standing: state !== 'fallen',
    down: state === 'stunned',
    losingAction: false,
    rising: state === 'rising' ? { since: 0, until: 400 } : null,
    downSince: 0,
  };
  const shown: World['shown'] = [];
  for (let now = 0; now < 1_000; now += 1) {
    const { frame } = restPose(enemy, 0, now);
    if (shown[shown.length - 1]?.frame !== frame) shown.push({ frame, tier: 0, red: false });
  }
  return shown;
}

/** `wanted` apparaît dans `shown`, dans l'ordre. */
function inOrder(shown: readonly EnemyFrame[], wanted: readonly EnemyFrame[]): boolean {
  let next = 0;
  for (const frame of shown) if (frame === wanted[next]) next += 1;
  return next === wanted.length;
}

const between = (ascent: Ascent): Ascent => ({
  ...ascent,
  encounter: null,
  exits: [{ kind: 'combat', groupSize: 2 }],
  lastGold: 0,
});

async function show(saved: Ascent) {
  const setUp = ascentSetUp({ saved });
  await setUp.session.load();
  await renderScreen(
    <AscentScreen
      session={setUp.session}
      visibility={{ onChange: () => () => undefined }}
      onLeave={() => undefined}
    />,
    setUp.dependencies,
  );
}

/** Un combat d'étage contre `enemies`. */
async function showBattle(enemies: readonly EnemyKind[], hero: HeroKind = 'sentinel') {
  await show({
    ...startAscent(42, { hero }),
    encounter: { kind: 'combat', enemies, battleSeed: 7 },
  });
  return (await screen.findByTestId('battle-scene', { includeHiddenElements: true })).props
    .enemies as SceneEnemy[];
}

async function showArmor() {
  await show({ ...between(startAscent(42)), foundItem: 'blackKnightArmor' });
}

const isHidden = (element: ReturnType<typeof screen.getByTestId>) =>
  element.props.accessibilityElementsHidden === true &&
  element.props.importantForAccessibility === 'no-hide-descendants';

/** Chaque pose montrée est la pose recopiée, dans la case que la scène dessine. */
function expectCopied(kind: Animated, shown: World['shown']) {
  for (const { frame, tier, red } of shown) {
    const pose = copied(kind, frame);
    expect([kind, frame, battleSprite(kind, frame, { tier, red }).sprite]).toEqual([
      kind,
      frame,
      pose,
    ]);
    expect(atlasCell(kind, frame, tier, red)).toEqual(toRgba(pose));
  }
}

const steps: StepDefinitions = ({ given, when, then, and }) => {
  // --- Contexte ---

  given(
    "l'image et l'animation complète du Squelette (skeleton) et du Nécromancien (necromancer) sont validées dans l'Atelier de l'ascension au 29/10/2026",
    () => {
      for (const kind of ANIMATED) {
        expect(Object.keys(ANIMATIONS[kind].frames).sort()).toEqual([...ENEMY_FRAMES].sort());
        expect(Object.keys(ANIMATIONS[kind].anchors).sort()).toEqual([...ENEMY_FRAMES].sort());
      }
    },
  );

  and(
    "l'image de l'Armure de chevalier noir (blackKnightArmor) est validée dans l'Atelier au 29/10/2026",
    () => {
      expect(ITEM_IMAGES.blackKnightArmor).toBe(BLACK_KNIGHT_ARMOR_IMAGE);
    },
  );

  and("l'animation complète et l'image sont recopiées telles quelles dans le code", () => {
    expect([SKELETON_ANIMATION.w, SKELETON_ANIMATION.h]).toEqual([40, 48]);
    expect([NECROMANCER_ANIMATION.w, NECROMANCER_ANIMATION.h]).toEqual([44, 52]);
    const { w, h, palette, rows } = BLACK_KNIGHT_ARMOR_IMAGE;
    expect([w, h]).toEqual([24, 24]);
    const sprite = assetSprite(BLACK_KNIGHT_ARMOR_IMAGE);
    rows.forEach((row, y) =>
      Array.from(row).forEach((char, x) => {
        const code = char === '.' ? 0 : codeOf(palette[parseInt(char, 36)]!);
        if (sprite.pixels[y * 24 + x] !== code) throw new Error(`(${x}, ${y})`);
      }),
    );
  });

  // --- Les sujets ---

  given('une ascension en cours', () => undefined);

  given(/^un Squelette ou un Nécromancien en combat$/, () => {
    world.kinds = ANIMATED;
  });

  given('un Squelette en combat', () => {
    world.kinds = ['skeleton'];
  });

  given('un Nécromancien en combat', () => {
    world.kinds = ['necromancer'];
  });

  given('le mouvement réduit est actif', () => {
    world.reduced = true;
  });

  given('un combat gagné', () => undefined);

  // --- Le Squelette et le Nécromancien en combat ---

  when(
    'le joueur entre dans un combat dont le groupe compte un Squelette et un Nécromancien',
    async () => {
      world.scene = await showBattle(['skeleton', 'necromancer']);
    },
  );

  then(
    /^(le Squelette|le Nécromancien) s'affiche avec son image validée \((\d+) × (\d+) pixels d'art\), à 2 dp par pixel d'art$/,
    (name: string, width: string, height: string) => {
      const kind: Animated = name === 'le Squelette' ? 'skeleton' : 'necromancer';
      const index = world.scene.findIndex((enemy) => enemy.kind === kind);
      expect(index).toBeGreaterThanOrEqual(0);
      expect([ANIMATIONS[kind].w, ANIMATIONS[kind].h]).toEqual([Number(width), Number(height)]);
      expectCopied(
        kind,
        ENEMY_FRAMES.map((frame) => ({ frame, tier: 0, red: false })),
      );
      const slot = sceneGeometry(390, 440, world.scene.length).enemies[index]!;
      expect([slot.sprite.width, slot.sprite.height]).toEqual([44 * 2, 52 * 2]);
    },
  );

  and("le Squelette n'est plus une silhouette provisoire", () => {
    for (const frame of ENEMY_FRAMES) {
      // Une silhouette n'a que l'ombre et les yeux ; la pose recopiée a toutes ses teintes.
      const codes = new Set(battleSprite('skeleton', frame).sprite.pixels);
      expect([frame, codes.size]).toEqual([frame, new Set(copied('skeleton', frame).pixels).size]);
      expect(codes.size).toBeGreaterThan(3);
    }
  });

  and("le Nécromancien n'est plus dessiné avec son dessin d'avant", () => {
    // Le dessin d'avant est supprimé avec tout le dessin des ennemis par le code (#139) : le
    // liseré d'un dessin, ajouté au palier 2, ne s'ajoute plus, et chaque pose est celle recopiée.
    for (const frame of ENEMY_FRAMES) {
      expect([frame, battleSprite('necromancer', frame, { tier: 2 }).sprite]).toEqual([
        frame,
        copied('necromancer', frame),
      ]);
    }
  });

  // --- Chaque moment du combat ---

  when(
    /^il (attend son tour|avance vers le héros puis revient|prépare un coup simple|est touché|est étourdi|tombe)$/,
    (moment: string) => {
      const timelines: Record<string, () => World['shown']> = {
        'attend son tour': () => restPoses('standing'),
        'avance vers le héros puis revient': () => [
          ...posesOf(STEP_IN, STEP_IN_AT, WIND_UP_AT),
          ...posesOf(attackTimeline('basic'), IMPACT, IMPACT + 600),
        ],
        'prépare un coup simple': () => posesOf(attackTimeline('basic'), WIND_UP_AT, IMPACT + 600),
        // Touché, il garde sa pose : la scène ne la change pas, seul le chiffre s'envole.
        'est touché': () => restPoses('standing'),
        'est étourdi': () => restPoses('stunned'),
        tombe: () => restPoses('fallen'),
      };
      world.shown = timelines[moment]!();
    },
  );

  then(
    /^il joue les poses (.+) de son animation complète, à 12 images par seconde \(83 ms par image\)$/,
    (poses: string) => {
      const wanted = poses.match(new RegExp(`\\b(${ENEMY_FRAMES.join('|')})\\b`, 'g'))!;
      const shown = world.shown.map(({ frame }) => frame);
      expect([shown, inOrder(shown, wanted as EnemyFrame[])]).toEqual([shown, true]);
      expect(Math.round(FRAME_MS)).toBe(83);
      for (const kind of world.kinds) expectCopied(kind as Animated, world.shown);
    },
  );

  and("aucune pose n'est obtenue en déplaçant ou en étirant une autre", () => {
    for (const kind of world.kinds) {
      for (const { frame } of world.shown) {
        const { sprite } = battleSprite(kind, frame);
        expect([sprite.width, sprite.height]).toEqual([44, 52]);
        expect(sprite).toEqual(copied(kind as Animated, frame));
      }
      expect(battleSprite(kind, 'hes').sprite).not.toEqual(battleSprite(kind, 'ant2').sprite);
    }
  });

  // --- Le Squelette se relève ---

  given("un Squelette tombé qui ne s'est pas encore relevé dans ce combat", () => {
    world.kinds = ['skeleton'];
    expect(ENEMIES.skeleton.selfRevive).toEqual({ times: 1, hpPercent: 50 });
  });

  when('il se relève seul', () => {
    world.shown = restPoses('rising');
  });

  then(
    "l'annonce « Il se relève », le cliquetis d'os et l'étiquette Relevé restent ceux d'aujourd'hui",
    () => {
      const event = { type: 'enemySelfRevived', at: 0, enemy: 0, hp: 18 } as const;
      expect(feedbackText(event)).toEqual({ tone: 'rise', title: 'Il se relève' });
      expect(feedbackFor(event).sound).toBe('boneRattle');
      expect(selfRevivedTag({ kind: 'skeleton', selfRevives: 1 })).toBe('Relevé');
    },
  );

  and('il reprend les poses de repos de son animation complète', () => {
    const shown = world.shown.map(({ frame }) => frame);
    expect(shown).toEqual(['down', 'hurt', 'idle0']);
    expectCopied('skeleton', world.shown);
  });

  // --- La Garde et le Relever du Nécromancien ---

  when('son intention est Garde ou Relever', () => {
    world.shown = posesOf(SUPPORT, STEP_IN_AT, SUPPORT.until);
  });

  then(
    "il affiche les poses d'aujourd'hui pour ce moment, prises dans son animation complète",
    () => {
      expect(world.shown.map(({ frame }) => frame)).toEqual(['ant0', 'ant1', 'ant0']);
      expectCopied('necromancer', world.shown);
    },
  );

  and("l'intention et son icône ne changent pas", () => {
    // Les icônes de la colonne des ennemis (`EnemyColumn`, inchangée) sont vérifiées par #81.
    expect(intentSpeech('necromancer', { category: 'guard', gain: 3 })).toBe(
      'intention : garde, plus 3',
    );
    expect(intentSpeech('necromancer', { category: 'raise' })).toBe('intention : relever un allié');
  });

  // --- Le reflet et les étoiles ---

  when("le reflet de son coup s'allume, ou quand il est étourdi", () => undefined);

  then(
    'le reflet part de son œil ou de la pointe de son arme, selon les ancrages de la pose affichée',
    () => {
      for (const kind of world.kinds as Animated[]) {
        const basic = attackTimeline('basic');
        // Pendant les 70 ms où la pose reste pleine (`ant2`), puis pendant la ruée (`lunge`).
        for (const [delay, pose] of [
          [10, 'ant2'],
          [80, 'lunge'],
        ] as const) {
          const now = IMPACT - 150 + delay;
          const { frame } = enemyPose(basic, now, false);
          expect(frame).toBe(pose);
          const glints = glintSprites(basic.glints, now, poseAnchors(kind, frame));
          expect(glints.map(({ x, y }) => [x, y])).toEqual([copiedAnchors(kind, pose).eye]);
        }
      }
    },
  );

  and("les étoiles tournent au-dessus de sa tête, selon l'ancrage de la pose affichée", () => {
    for (const kind of world.kinds as Animated[]) {
      const stunned = { standing: true, down: true, losingAction: false, rising: null };
      for (const [now, pose] of [
        [100, 'hurt'],
        [500, 'down'],
      ] as const) {
        const rest = restPose({ ...stunned, downSince: 0 }, 0, now);
        expect([rest.frame, rest.stars !== null]).toEqual([pose, true]);
        expect(poseAnchors(kind, rest.frame).head).toEqual(copiedAnchors(kind, pose).head);
      }
    }
  });

  // --- « Objet trouvé » ---

  when("l'objet trouvé est l'Armure de chevalier noir", async () => {
    await showArmor();
  });

  then(
    "l'écran « Objet trouvé » montre son image validée (24 × 24 pixels d'art), à 3 dp par pixel d'art, soit 72 dp",
    () => {
      expect(screen.getByRole('header', { name: 'Objet trouvé' })).toBeOnTheScreen();
      const image = screen.getByTestId('item-image', { includeHiddenElements: true });
      expect(image).toHaveProp('sprite', 'item-blackKnightArmor');
      const { scale, pixelWidth, pixelHeight } = image.props;
      expect([pixelWidth, pixelHeight, scale, pixelWidth * scale]).toEqual([24, 24, 3, 72]);
    },
  );

  and("la silhouette provisoire de l'emplacement armure n'apparaît plus", () => {
    expect(screen.queryByTestId('item-silhouette', { includeHiddenElements: true })).toBeNull();
  });

  and('son nom, ses chiffres et son libellé « Lourde et lente. » ne changent pas', () => {
    expect(
      screen.getByText(
        'Armure de chevalier noir · Armure · Rare · Réduction des dégâts +20 points, Attaque +1 · Initiative −2',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText('Lourde et lente.')).toBeOnTheScreen();
  });

  // --- Le Squelette dans la case du combat ---

  when("il s'affiche, dans n'importe quelle pose", () => undefined);

  then(
    "sa pose est centrée en largeur et calée en bas dans la case de 44 × 52 pixels d'art, sans mise à l'échelle",
    () => {
      // 40 × 48 dans 44 × 52 : 2 pixels d'art de chaque côté, 4 au-dessus, rien en dessous.
      for (const frame of ENEMY_FRAMES) {
        const { sprite } = battleSprite('skeleton', frame);
        expect([sprite.width, sprite.height]).toEqual([44, 52]);
        SKELETON_ANIMATION.frames[frame].forEach((row, y) =>
          Array.from(row).forEach((char, x) => {
            const code = char === '.' ? 0 : codeOf(SKELETON_ANIMATION.pal[parseInt(char, 36)]!);
            if (sprite.pixels[(y + 4) * 44 + x + 2] !== code) {
              throw new Error(`${frame} (${x}, ${y})`);
            }
          }),
        );
        const painted = Array.from(sprite.pixels).filter((code) => code !== 0).length;
        const copiedPainted = SKELETON_ANIMATION.frames[frame].join('').replaceAll('.', '').length;
        expect([frame, painted]).toEqual([frame, copiedPainted]);
      }
    },
  );

  and("ses ancrages sont décalés d'autant", () => {
    for (const frame of ENEMY_FRAMES) {
      const { eye, head, tips } = SKELETON_ANIMATION.anchors[frame];
      const moved = ([x, y]: readonly [number, number]) => [x + 2, y + 4];
      expect([frame, poseAnchors('skeleton', frame)]).toEqual([
        frame,
        { eye: moved(eye), head: moved(head), tips: tips.map(moved) },
      ]);
    }
  });

  // --- Le Nécromancien sans coup imparable ---

  when('il prépare un coup', () => {
    const attacks = ENEMIES.necromancer.moves.map(({ attack }) => attack);
    expect(attacks).toEqual(['basic']);
    world.shown = attacks.flatMap((attack) =>
      posesOf(attackTimeline(attack), WIND_UP_AT, IMPACT + 600),
    );
  });

  then("aucune pose rouge n'est jouée", () => {
    expect(world.shown.length).toBeGreaterThan(0);
    expect(world.shown.filter(({ red }) => red)).toEqual([]);
    // Même demandée en rouge, la pose reste celle recopiée : sa palette rouge n'est pas jouée.
    for (const frame of ENEMY_FRAMES) {
      expect(atlasCell('necromancer', frame, 2, true)).toEqual(
        toRgba(copied('necromancer', frame)),
      );
    }
  });

  // --- Les entités hors de cette story ---

  given(
    /^(le Spectre, le Chevalier déchu, le Prieur sans visage), (la Sentinelle) ou (l'Errante)$/,
    (enemies: string, sentinel: string, wanderer: string) => {
      world.kinds = enemies.split(', ').map((name) => KIND_OF_NAME[name.replace(/^(le|la) /, '')]!);
      expect(world.kinds).toHaveLength(3);
      world.heroes = [sentinel, wanderer].map((name) => HERO_OF_NAME[name.toLowerCase()]!);
      expect(world.heroes).toEqual(['sentinel', 'wanderer']);
    },
  );

  when('il apparaît dans la tour', async () => {
    for (let start = 0; start < world.kinds.length; start += 3) {
      const group = world.kinds.slice(start, start + 3);
      world.scene.push(...(await showBattle(group)));
      await cleanup();
    }
    for (const hero of world.heroes) {
      await showBattle(['skeleton'], hero);
      world.read.heroes.push(HERO_NAMES[hero]);
      expect(screen.getAllByText(HERO_NAMES[hero]).length).toBeGreaterThan(0);
      await cleanup();
    }
  });

  then("il garde son sprite actuel ou sa silhouette provisoire, comme aujourd'hui", () => {
    expect(world.scene.map((enemy) => enemy.kind)).toEqual(world.kinds);
    // Seuls le Squelette et le Nécromancien changent d'image : aucune autre entité ne prend la leur.
    for (const kind of world.kinds) {
      for (const frame of ENEMY_FRAMES) {
        const { sprite } = battleSprite(kind, frame);
        for (const animated of ANIMATED) {
          expect([kind, frame, sprite]).not.toEqual([kind, frame, copied(animated, frame)]);
        }
      }
    }
    expect(world.read.heroes).toEqual(world.heroes.map((hero) => HERO_NAMES[hero]));
  });

  // --- Jamais d'échelle fractionnaire ---

  given(
    "le Squelette, le Nécromancien ou l'Armure de chevalier noir affiché avec son image validée",
    () => undefined,
  );

  when("il s'affiche", async () => {
    await showArmor();
  });

  then(
    "il est à 2 dp par pixel d'art en scène, 3 dp sur l'écran « Objet trouvé », jamais à une autre échelle",
    () => {
      for (const kind of ANIMATED) {
        for (const frame of ENEMY_FRAMES) {
          const { sprite } = battleSprite(kind, frame);
          expect([sprite.width, sprite.height]).toEqual([44, 52]);
        }
      }
      for (const count of [1, 2, 3]) {
        for (const slot of sceneGeometry(390, 440, count).enemies) {
          expect([slot.sprite.width, slot.sprite.height]).toEqual([44 * 2, 52 * 2]);
        }
      }
      const image = screen.getByTestId('item-image', { includeHiddenElements: true });
      expect([image.props.scale, image.props.pixelWidth, image.props.pixelHeight]).toEqual([
        3, 24, 24,
      ]);
    },
  );

  // --- Mouvement réduit ---

  when('le Squelette ou le Nécromancien prépare un coup', () => {
    world.kinds = ANIMATED;
  });

  then("il parcourt seulement le quart du chemin, comme aujourd'hui, avec les mêmes durées", () => {
    const basic = attackTimeline('basic');
    for (let now = WIND_UP_AT; now < IMPACT + 600; now += 5) {
      const full = enemyPose(basic, now, false);
      const reduced = enemyPose(basic, now, true);
      expect([now, reduced.frame]).toEqual([now, full.frame]);
      expect(reduced.reach).toBeCloseTo(full.reach * 0.25, 6);
    }
  });

  and('le reflet reste affiché', () => {
    const basic = attackTimeline('basic');
    const now = IMPACT - 150 + 10;
    for (const kind of world.kinds) {
      const { frame } = enemyPose(basic, now, true);
      expect(glintSprites(basic.glints, now, poseAnchors(kind, frame))).toHaveLength(1);
    }
  });

  // --- Lecteur d'écran ---

  given("le lecteur d'écran est actif", () => undefined);

  when(
    "le joueur parcourt un combat contre le Squelette ou le Nécromancien, ou l'écran « Objet trouvé » de l'Armure de chevalier noir",
    async () => {
      await showBattle(ANIMATED);
      world.read.hidden.push(
        isHidden(screen.getByTestId('battle-scene', { includeHiddenElements: true })),
      );
      expect(screen.queryByTestId('battle-scene')).toBeNull();
      for (const kind of ANIMATED) {
        world.read.labels.push(screen.getByTestId(`enemy-${kind}`).props.accessibilityLabel);
      }
      await cleanup();
      await showArmor();
      world.read.hidden.push(
        isHidden(screen.getByTestId('item-image', { includeHiddenElements: true })),
      );
      expect(screen.queryByTestId('item-image')).toBeNull();
    },
  );

  then("l'image et ses poses ne sont pas lues : elles sont décoratives", () => {
    expect(world.read.hidden).toEqual([true, true]);
  });

  and(
    "le lecteur d'écran lit toujours le nom, les PV, la garde et l'intention de l'ennemi, ou le nom et les chiffres de l'objet",
    () => {
      ANIMATED.forEach((kind, index) => {
        const { maxHp, maxGuard } = ENEMIES[kind];
        expect(world.read.labels[index]).toContain(ENEMY_NAMES[kind]);
        expect(world.read.labels[index]).toContain(`${maxHp} PV sur ${maxHp}`);
        expect(world.read.labels[index]).toContain(`garde ${maxGuard} sur ${maxGuard}`);
        expect(world.read.labels[index]).toMatch(/intention/);
      });
      expect(screen.getByText(itemText('blackKnightArmor'))).toBeOnTheScreen();
    },
  );
};

const feature = loadFeature('features/squelette-necromancien-armure.feature');
autoBindSteps([feature], [steps]);
