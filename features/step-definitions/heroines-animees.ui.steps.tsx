/**
 * @jest-environment ./test/setup/skiaEnvironment.js
 */
/*
 * Scénarios de « L'Errante et la Sentinelle animées » (#140, chemin B). Correspondance :
 * - « s'affiche avec son image validée », « joue les poses », « pixel pour pixel » : la pose que la
 *   scène choisit à chaque instant (`heroFrame`), puis son image (`battleSprite`) et sa case dans
 *   l'atlas de l'héroïne (`battleAtlas`), comparées aux lignes recopiées de l'Atelier ;
 * - l'héroïne en jeu, l'ascension reprise et le lecteur d'écran : l'écran de l'ascension
 *   (`AscentScreen`), sur une ascension sauvegardée, la scène y étant simulée ;
 * - « à la place et à la taille du héros d'aujourd'hui », « son déplacement », « mouvement réduit » :
 *   la scène dessinée avec Skia (`BattleScene`), dont on lit la case et la transformation du héros ;
 * - « aujourd'hui » : les valeurs de la scène d'avant #140 (moments, durées, déplacement), écrites
 *   ici telles quelles.
 */
import '@shopify/react-native-skia/jestSetup';

import { cleanup, screen } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { heroFrame } from '../../src/adapters/ui/battle/scene/heroFrame';
import { sceneGeometry } from '../../src/adapters/ui/battle/scene/sceneGeometry';
import type { HeroPose } from '../../src/adapters/ui/battle/sceneTypes';
import { HERO_NAMES } from '../../src/adapters/ui/format/battleText';
import { toRgba } from '../../src/adapters/ui/pixelArt/sprites/Sprite';
import { atlasRect, battleAtlas } from '../../src/adapters/ui/pixelArt/sprites/battle/battleAtlas';
import {
  HERO_FRAMES,
  battleSprite,
  type HeroFrame,
} from '../../src/adapters/ui/pixelArt/sprites/battle/battleCharacters';
import { AscentScreen } from '../../src/adapters/ui/screens/AscentScreen';
import { ascentSetUp } from '../../src/adapters/ui/testing/ascent';
import { renderScreen } from '../../src/adapters/ui/testing/renderScreen';
import { startAscent, type Ascent } from '../../src/domain/ascent/Ascent';
import type { HeroKind } from '../../src/domain/battle/combatants';
import {
  ANIMATION_OF,
  HEROINES,
  HEROINE_OF_NAME,
  copiedPose,
  drawHero,
  heroAtlasCell,
  shifted,
} from '../support/heroinesStory';

jest.mock('../../src/adapters/ui/battle/BattleCanvas', () =>
  jest.requireActual('../../src/adapters/ui/battle/testing/fakeBattleCanvas'),
);

/** Une image d'animation, à 12 images par seconde : la pose change à la première milliseconde après 83,3 ms. */
const NEXT_FRAME_AT = 84;

/**
 * Chaque moment du combat, aujourd'hui (avant #140) : la pose du héros, prise à 0, l'impact de
 * la frappe en rythme, la fenêtre observée, en ms, et l'instant où la deuxième pose s'affiche.
 */
const MOMENTS: Readonly<
  Record<
    string,
    {
      pose: HeroPose;
      impact: number | null;
      from: number;
      to: number;
      secondAt: number | null;
    }
  >
> = {
  attend: { pose: 'idle', impact: null, from: 0, to: 500, secondAt: 250 },
  'lève sa garde': { pose: 'raise', impact: null, from: 0, to: 500, secondAt: null },
  'lève sa garde au moment du reflet': {
    pose: 'raise',
    impact: 500,
    from: 340,
    to: 661,
    secondAt: null,
  },
  frappe: { pose: 'strike', impact: null, from: 0, to: 320, secondAt: NEXT_FRAME_AT },
  pare: { pose: 'parry', impact: null, from: 0, to: 250, secondAt: NEXT_FRAME_AT },
  esquive: { pose: 'dodge', impact: null, from: 0, to: 300, secondAt: NEXT_FRAME_AT },
  'est touchée': { pose: 'hit', impact: null, from: 0, to: 300, secondAt: NEXT_FRAME_AT },
  'est déséquilibrée': { pose: 'off', impact: null, from: 0, to: 160, secondAt: NEXT_FRAME_AT },
  tombe: { pose: 'fallen', impact: null, from: 0, to: 500, secondAt: null },
};

/** Le déplacement d'aujourd'hui : l'esquive (300 ms) et l'élan de la frappe (320 ms), de 0 à 1. */
const TODAY_MOVE = {
  dodge: (elapsed: number) => Math.sin((Math.PI * elapsed) / 300),
  strike: (elapsed: number) => Math.sin((Math.PI * elapsed) / 320),
};
/** La part du déplacement gardée en mouvement réduit, aujourd'hui : 30 % de l'esquive, 20 % de l'élan. */
const TODAY_REDUCED = { dodge: 0.3, strike: 0.2 };

interface World {
  heroes: readonly HeroKind[];
  saved: Ascent | null;
  /** Les poses montrées, dans l'ordre, chacune avec l'instant où elle s'affiche et son liseré. */
  shown: { frame: HeroFrame; at: number; tier: 0 | 1 }[];
  moment: string;
  width: number[];
  reduced: boolean;
  scene: Record<string, unknown>;
  read: { hidden: boolean; bar: string };
}

let world: World;

beforeEach(() => {
  world = {
    heroes: [],
    saved: null,
    shown: [],
    moment: '',
    width: [],
    reduced: false,
    scene: {},
    read: { hidden: false, bar: '' },
  };
});

/** Les poses que la scène montre pour le moment `moment`, chacune notée quand elle change. */
function posesOf(moment: string): World['shown'] {
  const { pose, impact, from, to } = MOMENTS[moment]!;
  const shown: World['shown'] = [];
  for (let now = from; now < to; now += 1) {
    const { frame, tier } = heroFrame(pose, 0, now, impact);
    if (shown[shown.length - 1]?.frame !== frame) shown.push({ frame, at: now, tier });
  }
  return shown;
}

/** Une ascension avec `hero`, entre deux étages, et le combat où elle entre. */
function ascentWith(hero: HeroKind): Ascent {
  return {
    ...startAscent(42, { hero }),
    encounter: { kind: 'combat', enemies: ['ghoul'], battleSeed: 7 },
  };
}

/** L'écran de l'ascension sur l'ascension sauvegardée `saved`, reprise : la scène du combat. */
async function resume(saved: Ascent) {
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
  return (await screen.findByTestId('battle-scene', { includeHiddenElements: true }))
    .props as Record<string, unknown>;
}

/** L'héroïne s'affiche avec son animation complète : chaque pose recopiée, image et atlas. */
function expectFullAnimation(kind: HeroKind) {
  for (const frame of HERO_FRAMES) {
    const pose = copiedPose(kind, frame);
    expect([kind, frame, battleSprite(kind, frame).sprite]).toEqual([kind, frame, pose]);
    expect([kind, frame, heroAtlasCell(kind, frame, 0)]).toEqual([kind, frame, toRgba(pose)]);
  }
}

const steps: StepDefinitions = ({ given, when, then, and }) => {
  // --- Contexte ---

  given(
    "l'image et l'animation complète de l'Errante (wanderer) sont validées dans l'Atelier de l'ascension au 29/10/2026",
    () => {
      expect(Object.keys(ANIMATION_OF.wanderer.frames).sort()).toEqual([...HERO_FRAMES].sort());
    },
  );

  and(
    "l'image 2.5D légère et l'animation complète de la Sentinelle (sentinel) sont validées dans l'Atelier",
    () => {
      expect(Object.keys(ANIMATION_OF.sentinel.frames).sort()).toEqual([...HERO_FRAMES].sort());
      expect(ANIMATION_OF.sentinel.pal).toHaveLength(19);
    },
  );

  and('chaque animation complète de héros est recopiée telle quelle dans le code', () => {
    for (const kind of HEROINES) {
      const animation = ANIMATION_OF[kind];
      expect([animation.w, animation.h, Object.hasOwn(animation, 'red')]).toEqual([36, 44, false]);
    }
  });

  // --- Les sujets ---

  given(/^une ascension commencée avec (l'Errante|la Sentinelle)$/, (name: string) => {
    world.heroes = [HEROINE_OF_NAME[name]!];
  });

  given("l'Errante ou la Sentinelle en combat", () => {
    world.heroes = HEROINES;
  });

  given("l'Errante ou la Sentinelle avec son image validée", () => {
    world.heroes = HEROINES;
  });

  given("une ascension sauvegardée avec l'Errante", () => {
    world.saved = ascentWith('wanderer');
  });

  given('le mouvement réduit est actif', () => {
    world.reduced = true;
  });

  given("le lecteur d'écran est actif", () => undefined);

  // --- L'héroïne choisie combat avec son propre dessin ---

  when('le joueur entre dans un combat', async () => {
    world.scene = await resume(ascentWith(world.heroes[0]!));
  });

  then(
    /^(l'Errante|la Sentinelle) s'affiche de dos avec son image validée \(36 × 44 pixels d'art\), à la place et à la taille du héros d'aujourd'hui$/,
    async (name: string) => {
      const kind = HEROINE_OF_NAME[name]!;
      expect(world.scene.heroKind).toBe(kind);
      expectFullAnimation(kind);
      const drawn = await drawHero({ heroKind: kind, heroPose: 'idle', now: 0 });
      const { hero } = sceneGeometry(390, 440, 1);
      expect(drawn.transform).toEqual([3, 0, hero.x, hero.y]);
      expect(drawn.rect.slice(2)).toEqual([36, 44]);
      expect([hero.width, hero.height]).toEqual([36 * 3, 44 * 3]);
    },
  );

  and(/^elle n'est plus dessinée avec (.+)$/, (before: string) => {
    const [kind] = world.heroes;
    if (before === 'le dessin de la Sentinelle') {
      for (const frame of HERO_FRAMES) {
        expect(battleSprite('wanderer', frame).sprite.pixels).not.toEqual(
          battleSprite('sentinel', frame).sprite.pixels,
        );
      }
    } else {
      // Le dessin de #81 n'avait que les 31 premiers codes de la palette d'art : la Sentinelle 2.5D
      // en emploie d'autres, ajoutés pour elle.
      expect(before).toBe('son dessin de #81');
      for (const frame of HERO_FRAMES) {
        const codes = Array.from(battleSprite(kind!, frame).sprite.pixels);
        expect([frame, codes.some((code) => code >= 31)]).toEqual([frame, true]);
      }
    }
  });

  // --- Chaque moment du combat ---

  when(
    /^elle (attend|lève sa garde au moment du reflet|lève sa garde|frappe|pare|esquive|est touchée|est déséquilibrée|tombe)$/,
    (moment: string) => {
      world.moment = moment;
      world.shown = posesOf(moment);
    },
  );

  then(
    /^elle joue les poses (.+) de son animation complète, aux mêmes moments et durées qu'aujourd'hui$/,
    (poses: string) => {
      const wanted = poses.split(', ').filter((pose) => (HERO_FRAMES as string[]).includes(pose));
      const distinct = [...new Set(world.shown.map(({ frame }) => frame))];
      expect(distinct).toEqual(wanted);
      const { secondAt } = MOMENTS[world.moment]!;
      expect(world.shown[1]?.at ?? null).toBe(secondAt);
      for (const kind of world.heroes) {
        for (const { frame, tier } of world.shown) {
          const pose = copiedPose(kind, frame);
          expect([kind, frame, battleSprite(kind, frame, { tier }).sprite]).toEqual([
            kind,
            frame,
            pose,
          ]);
          expect([kind, frame, heroAtlasCell(kind, frame, tier)]).toEqual([
            kind,
            frame,
            toRgba(pose),
          ]);
        }
      }
    },
  );

  and("aucune pose n'est obtenue en déplaçant ou en étirant une autre", () => {
    for (const kind of world.heroes) {
      for (const { frame } of world.shown) {
        const sprite = battleSprite(kind, frame).sprite;
        // Pas étirée : la pose garde la case de 36 × 44 et ses pixels recopiés.
        expect([sprite.width, sprite.height]).toEqual([36, 44]);
        for (const other of HERO_FRAMES) {
          const target = battleSprite(kind, other).sprite.pixels;
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ] as const) {
            expect([kind, frame, other, dx, dy, shifted(sprite, dx, dy)]).not.toEqual([
              kind,
              frame,
              other,
              dx,
              dy,
              target,
            ]);
          }
        }
      }
    }
  });

  // --- Une ascension reprise ---

  when('le joueur la reprend et entre dans un combat', async () => {
    world.scene = await resume(world.saved!);
  });

  then("l'Errante s'affiche avec son animation complète", () => {
    expect(world.scene.heroKind).toBe('wanderer');
    expectFullAnimation('wanderer');
  });

  // --- L'esquive et la frappe gardent leur mouvement ---

  when('elle esquive ou frappe', () => undefined);

  when("l'Errante ou la Sentinelle esquive ou frappe", () => {
    world.heroes = HEROINES;
  });

  /**
   * La place du héros à `elapsed` ms de son esquive ou de sa frappe : celle d'aujourd'hui, le
   * déplacement réduit de `share` en mouvement réduit.
   */
  async function expectMove(reduced: boolean) {
    const { hero, chest, enemies } = sceneGeometry(390, 440, 1);
    const target = enemies[0]!.sprite;
    const lunge = { x: (target.x + 44 - chest.x) * 0.4, y: (target.y + 104 - chest.y) * 0.4 };
    const even = (value: number) => Math.round(value / 2) * 2;
    for (const kind of world.heroes) {
      for (const [heroPose, elapsed] of [
        ['dodge', 150],
        ['strike', 100],
      ] as const) {
        const part = TODAY_MOVE[heroPose](elapsed) * (reduced ? TODAY_REDUCED[heroPose] : 1);
        const [dx, dy] =
          heroPose === 'dodge'
            ? [even(-22 * part), even(10 * part)]
            : [even(lunge.x * part), even(lunge.y * part)];
        const drawn = await drawHero({
          heroKind: kind,
          heroPose,
          now: elapsed,
          reducedMotion: reduced,
        });
        expect([kind, heroPose, drawn.transform]).toEqual([
          kind,
          heroPose,
          [3, 0, hero.x + dx, hero.y + dy],
        ]);
        // Les mêmes poses qu'en mouvement normal : la case de la pose du moment.
        const { frame } = heroFrame(heroPose, 0, elapsed, null);
        const rect = atlasRect(battleAtlas(kind).table, frame, 0, false);
        expect(drawn.rect).toEqual([rect.x, rect.y, rect.width, rect.height]);
      }
    }
  }

  then("son déplacement à l'écran est celui d'aujourd'hui", async () => {
    await expectMove(false);
  });

  and('seul le dessin des poses change', () => {
    for (const heroPose of ['dodge', 'strike'] as const) {
      const frames = new Set<HeroFrame>();
      for (let now = 0; now < 320; now += 1) frames.add(heroFrame(heroPose, 0, now, null).frame);
      for (const frame of frames) {
        for (const kind of HEROINES) {
          expect([kind, frame, battleSprite(kind, frame).sprite]).toEqual([
            kind,
            frame,
            copiedPose(kind, frame),
          ]);
        }
      }
    }
  });

  then("son mouvement est réduit comme aujourd'hui, avec les mêmes poses", async () => {
    expect(world.reduced).toBe(true);
    await expectMove(true);
  });

  // --- Ni liseré ni traînée ---

  then(
    "la pose raiseG s'affiche telle que validée dans l'Atelier, pixel pour pixel, sans liseré d'or ajouté",
    () => {
      expect(world.shown).toEqual([{ frame: 'raiseG', at: 340, tier: 1 }]);
      for (const kind of world.heroes) {
        const pose = toRgba(copiedPose(kind, 'raiseG'));
        expect([kind, heroAtlasCell(kind, 'raiseG', 1)]).toEqual([kind, pose]);
        expect(battleSprite(kind, 'raiseG', { tier: 1 }).sprite).toEqual(
          copiedPose(kind, 'raiseG'),
        );
      }
    },
  );

  // --- L'échelle ---

  given(/^un écran de (360 dp ou plus|moins de 360 dp)$/, (width: string) => {
    world.width = width === '360 dp ou plus' ? [360, 390, 430] : [320, 359];
  });

  when("elle s'affiche, dans n'importe quelle pose", () => {
    world.shown = HERO_FRAMES.map((frame) => ({ frame, at: 0, tier: 0 }));
  });

  then(
    /^elle est à (\d) dp par pixel d'art, comme le héros d'aujourd'hui sur cet écran$/,
    async (scale: string) => {
      for (const width of world.width) {
        const { hero } = sceneGeometry(width, 440, 1);
        expect([width, hero.scale, hero.width, hero.height]).toEqual([
          width,
          Number(scale),
          36 * Number(scale),
          44 * Number(scale),
        ]);
        for (const kind of world.heroes) {
          const drawn = await drawHero({ heroKind: kind, heroPose: 'idle', now: 0, width });
          expect([width, kind, drawn.transform[0]]).toEqual([width, kind, Number(scale)]);
          for (const { frame } of world.shown) {
            const { sprite } = battleSprite(kind, frame);
            expect([frame, sprite.width, sprite.height]).toEqual([frame, 36, 44]);
          }
        }
      }
    },
  );

  and('jamais à une échelle fractionnaire', () => {
    for (const width of [300, 320, 359, 360, 390, 430, 600]) {
      expect(Number.isInteger(sceneGeometry(width, 440, 1).hero.scale)).toBe(true);
    }
  });

  // --- Lecteur d'écran ---

  when('le joueur parcourt un combat', async () => {
    await cleanup();
    await resume(ascentWith('wanderer'));
    const scene = screen.getByTestId('battle-scene', { includeHiddenElements: true });
    world.read.hidden =
      scene.props.accessibilityElementsHidden === true &&
      scene.props.importantForAccessibility === 'no-hide-descendants';
    expect(screen.queryByTestId('battle-scene')).toBeNull();
    world.read.bar = screen.getByTestId('battle-hero-bar').props.accessibilityLabel as string;
  });

  then("l'héroïne et ses poses ne sont pas lues : elles sont décoratives", () => {
    expect(world.read.hidden).toBe(true);
  });

  and("la barre du héros est lue comme aujourd'hui", () => {
    expect(world.read.bar).toMatch(new RegExp(`^${HERO_NAMES.wanderer}, PV \\d+ sur \\d+, Élan`));
  });
};

const feature = loadFeature('features/heroines-animees.feature');
autoBindSteps([feature], [steps]);
