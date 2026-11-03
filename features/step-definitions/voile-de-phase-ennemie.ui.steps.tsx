/**
 * « Assombrir la scène et la Frise d'action pendant la phase ennemie » (#188) à l'écran : le vrai
 * écran de l'ascension, sur une vraie session d'ascension, un Stockage clé-valeur en mémoire et
 * l'horloge de combat manuelle. Le combat est sauvegardé avec l'ascension, puis repris par l'écran
 * (compte à rebours compris). Les canevas Skia du fond de palier et de la scène sont simulés : la
 * simulation du fond expose son palier, celle de la scène ce qu'elle reçoit.
 *
 * À chaque pas du combat, le voile et la frise sont comparés à la pastille de l'en-tête : le voile
 * est là si et seulement si elle dit « Phase ennemie », au même rendu.
 *
 * Correspondance des libellés :
 * - « un voile d'encre (#06070C) à 38 % » : `enemy-phase-veil`, `rgba(6,7,12,0.38)` en plein cadre ;
 * - « couvre tout le cadre de la scène » : il est posé sur le cadre fixe (`battle-scene-frame`) ;
 * - « au-dessus du voile » : dans la scène qui tremble (`battle-scene-shake`), posée après lui ;
 * - « le fond de palier assombri » : le fond est sous tout l'écran de combat, le voile au-dessus ;
 * - « sans fondu », « d'un coup », « sans animation » : le voile est une vue simple, sans opacité
 *   ni transformation, et la frise un voile d'encre fixe par case, au rendu de la pastille ;
 * - « aucune bande non voilée » : le voile est hors de la vue qui tremble, sur le cadre fixe ;
 * - « 45 % de luminosité et 60 % de saturation » : le voile de la case (`track-shade`) à 0,55 sur
 *   la case entière, et le portrait à la saturation 0,6 ; de même 0,68 et 0,5 pour l'aperçu ;
 * - « 62 % de luminosité et 70 % de saturation » (aperçu de la phase du héros) : le voile à 0,38
 *   dans le cadre, et le portrait à la saturation 0,7 (maquette v2 de #174, `.fp.next`) ;
 * - « le fond de palier ne peut pas être dessiné » : la simulation du fond ne dessine rien.
 */
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';

import type { TierBackdropProps } from '../../src/adapters/ui/battle/TierBackdrop';
import { actionTrackLabel } from '../../src/adapters/ui/format/battleText';
import { artPalette } from '../../src/adapters/ui/pixelArt/artPalette';
import { AscentScreen, RESUME_COUNTDOWN_S } from '../../src/adapters/ui/screens/AscentScreen';
import { actionTrackView } from '../../src/adapters/ui/state/battleView';
import { renderScreen } from '../../src/adapters/ui/testing/renderScreen';
import { silentHaptics } from '../../src/adapters/ui/testing/silentHaptics';
import { InMemoryUnitOfWork } from '../../src/application/testing/InMemoryUnitOfWork';
import type { ManualBattleClock } from '../../src/application/testing/ManualBattleClock';
import { settableClock } from '../../src/application/testing/settableClock';
import { ASCENT_KEY, type AscentSession } from '../../src/application/useCases/AscentSession';
import type { BattleSession } from '../../src/application/useCases/BattleSession';
import { BATTLE_HINT_SEEN_KEYS } from '../../src/application/useCases/battleHints';
import { ATTACKS } from '../../src/domain/battle/attacks';
import { startBattle, type AttackStep, type Battle } from '../../src/domain/battle/Battle';
import type { EnemyKind } from '../../src/domain/battle/combatants';
import { Day } from '../../src/domain/day/Day';
import { ascentBefore, settleStore, storySession, storyStore } from '../support/tiersStory';

jest.mock('../../src/adapters/ui/battle/BattleCanvas', () =>
  jest.requireActual('../../src/adapters/ui/battle/testing/fakeBattleCanvas'),
);

/** Le fond de palier se dessine-t-il ? Faux : le repli sur la nuit (« fond absent »). */
const mockBackdrop = { drawn: true };

jest.mock('../../src/adapters/ui/battle/TierBackdrop', () => {
  const fake = jest.requireActual<{
    TierBackdrop: (props: TierBackdropProps) => React.JSX.Element;
  }>('../../src/adapters/ui/battle/testing/fakeTierBackdrop');
  return {
    TierBackdrop: (props: TierBackdropProps) =>
      mockBackdrop.drawn ? fake.TierBackdrop(props) : null,
  };
});

const hidden = { includeHiddenElements: true } as const;
const TIER = 1;
const ENEMIES: readonly EnemyKind[] = ['specter', 'ghoul'];
const VEIL_STYLE = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(6,7,12,0.38)',
} as const;

interface World {
  store: ReturnType<typeof storyStore>;
  session: AscentSession;
  /** La session du combat ouverte par l'écran (une nouvelle à chaque reprise). */
  battleSession: BattleSession;
  clock: ManualBattleClock;
  /** Le combat sauvegardé avec l'ascension, repris par l'écran. */
  saved: Battle;
  /** L'écran de l'ascension est monté. */
  shown: boolean;
  /** Le rappel de la visibilité de l'application, pour la mettre en arrière-plan. */
  visible: ((visible: boolean) => void) | null;
  /** Le palier du fond de palier à chaque fois qu'il est noté. */
  backdrops: number[];
  /** Le style de « suiv. » à chaque pas du combat. */
  separators: unknown[];
  /** Le nombre de pas où la pastille disait « Phase ennemie », et « Phase du héros ». */
  enemySteps: number;
  heroSteps: number;
  heroHp: number;
}

let world: World;
const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');

function battle(): Battle {
  return world.battleSession.current()!.battle;
}

function veil() {
  return screen.queryByTestId('enemy-phase-veil', hidden);
}

function frame() {
  return screen.getByTestId('battle-scene-frame', hidden);
}

function shaking() {
  return screen.getByTestId('battle-scene-shake', hidden);
}

function pill(): string | null {
  const shown = screen.queryByTestId('battle-phase');
  return shown === null ? null : String(shown.props.children);
}

/** Les cases de la frise, dans l'ordre : la manche, puis l'aperçu. */
function entries() {
  return screen.queryAllByTestId('track-entry', hidden);
}

function shadeOf(entry: ReturnType<typeof entries>[number]) {
  const [shade] = within(entry).queryAllByTestId('track-shade', hidden);
  return shade === undefined ? null : StyleSheet.flatten(shade.props.style);
}

function saturationOf(entry: ReturnType<typeof entries>[number]): unknown {
  return within(entry).getByTestId('track-portrait', hidden).props.saturation;
}

/** Le nombre de cases de la manche en cours (les suivantes sont l'aperçu). */
function roundLength(): number {
  return actionTrackView(battle()).current.length;
}

/** Le voile et la frise suivent la pastille de l'en-tête, au même rendu. */
function expectVeilFollowsThePill(): void {
  const enemy = pill() === 'Phase ennemie';
  expect(veil() !== null).toBe(enemy);
  if (enemy) world.enemySteps += 1;
  if (pill() === 'Phase du héros') world.heroSteps += 1;
  const shown = entries();
  if (shown.length === 0) return;
  const preview = shown.slice(roundLength());
  preview.forEach((entry) => expect(shadeOf(entry)?.opacity).toBe(enemy ? 0.68 : 0.38));
  const separator = screen.queryByText('suiv.', hidden);
  if (separator !== null) world.separators.push(StyleSheet.flatten(separator.props.style));
}

/** L'instant du premier impact de l'attaque en cours. */
function attackStep(): AttackStep | null {
  const { phase } = battle();
  return phase.kind === 'enemy' && phase.step.kind === 'attack' ? phase.step : null;
}

/**
 * Un pas du combat : le héros attaque à son tour, la bulle d'aide se ferme, sinon l'horloge de
 * combat avance jusqu'à la prochaine échéance.
 */
async function step(): Promise<void> {
  const { phase } = battle();
  if (phase.kind === 'hero') {
    const at = world.clock.now() + 50;
    await act(async () => {
      world.clock.advanceTo(at);
      world.battleSession.heroAction({ kind: 'attack' }, at - 20, at);
      await settleStore();
    });
  } else if (phase.kind === 'defenseHint') {
    await act(async () => {
      fireEvent.press(screen.getByTestId('battle-hint-defense'));
      await settleStore();
    });
  } else {
    const [next] = world.clock.pending();
    await act(async () => {
      world.clock.advanceTo(next!);
      await settleStore();
    });
  }
  expectVeilFollowsThePill();
}

async function runUntil(reached: () => boolean): Promise<void> {
  for (let guard = 0; guard < 400 && !reached(); guard += 1) await step();
  expect(reached()).toBe(true);
}

/** Un combat sauvegardé contre le Spectre et la Goule, changé par `change`. */
function save(change: (battle: Battle) => Battle = (same) => same, defenseHint = false): void {
  const { battle: started } = startBattle({
    seed: 3,
    defenseHint,
    at: 0,
    initiative: true,
    enemies: ENEMIES,
  });
  world.saved = change(started);
  world.store.values.set(
    ASCENT_KEY,
    JSON.stringify({
      version: 1,
      ascent: ascentBefore(TIER, 'combat', ENEMIES),
      battle: world.saved,
    }),
  );
}

/**
 * Fait tourner `start` (le montage de l'écran, le retour au premier plan), puis le compte à rebours
 * de la reprise sur des minuteurs simulés, jusqu'à l'écran de combat.
 */
async function resume(start: () => Promise<void>): Promise<void> {
  jest.useFakeTimers();
  try {
    await start();
    for (let second = 0; second < RESUME_COUNTDOWN_S; second += 1) {
      await act(async () => {
        jest.advanceTimersByTime(1_000);
      });
    }
  } finally {
    jest.useRealTimers();
  }
  expect(screen.getByTestId('battle-screen')).toBeOnTheScreen();
}

function noteBackdrop(): void {
  if (mockBackdrop.drawn) {
    world.backdrops.push(screen.getByTestId('tier-backdrop', hidden).props.tier as number);
  } else {
    expect(screen.queryByTestId('tier-backdrop', hidden)).toBeNull();
  }
}

/** L'écran de l'ascension monté sur le combat sauvegardé, repris après son compte à rebours. */
async function show(): Promise<void> {
  if (world.shown) return;
  const { session, clock } = storySession(world.store);
  await session.load();
  expect(session.resuming()).toBe(true);
  world.session = session;
  world.clock = clock;
  const open = session.battleSession.bind(session);
  jest.spyOn(session, 'battleSession').mockImplementation(() => {
    world.battleSession = open();
    return world.battleSession;
  });
  await resume(async () => {
    await renderScreen(
      <AscentScreen
        session={session}
        visibility={{
          onChange: (listener) => {
            world.visible = listener;
            return () => undefined;
          },
        }}
        onLeave={() => undefined}
      />,
      {
        clock: settableClock(Day.of(2026, 11, 3)),
        unitOfWork: new InMemoryUnitOfWork(),
        keyValueStore: world.store,
        haptics: silentHaptics(),
      },
    );
    noteBackdrop();
  });
  world.shown = true;
  noteBackdrop();
  world.heroHp = battle().hero.hp;
  expectVeilFollowsThePill();
}

const inEnemyPhase = () => pill() === 'Phase ennemie';
const inHeroPhase = () => pill() === 'Phase du héros';
/** Un ennemi prépare son coup, en phase ennemie, avant celui du héros dans la manche. */
const enemyActsBeforeTheHero = () =>
  inEnemyPhase() &&
  attackStep() !== null &&
  actionTrackView(battle()).current.some((entry) => entry.actor === 'hero');

function expectNoMotion(style: Record<string, unknown>): void {
  expect(style.opacity).toBeUndefined();
  expect(style.transform).toBeUndefined();
}

const steps: StepDefinitions = ({ given, when, then, and }) => {
  beforeEach(() => {
    world = {
      store: storyStore(),
      shown: false,
      visible: null,
      backdrops: [],
      separators: [],
      enemySteps: 0,
      heroSteps: 0,
    } as unknown as World;
    mockBackdrop.drawn = true;
    announce.mockClear();
  });
  afterEach(() => {
    mockBackdrop.drawn = true;
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false);
    jest.mocked(AccessibilityInfo.isScreenReaderEnabled).mockResolvedValue(false);
  });

  given(/^un combat de l'ascension, sur le fond de palier de son palier$/u, () => {
    save();
  });

  // --- La scène s'assombrit en phase ennemie ---

  given(/^la phase du héros$/u, async () => {
    await show();
    await runUntil(inHeroPhase);
    expect(veil()).toBeNull();
  });

  when(/^la phase ennemie commence et que l'en-tête affiche « Phase ennemie »$/u, async () => {
    await runUntil(inEnemyPhase);
  });

  then(/^un voile d'encre \(#06070C\) à 38 % couvre tout le cadre de la scène$/u, () => {
    expect(artPalette.roles.enemyPhaseVeil).toBe('rgba(6,7,12,0.38)');
    expect(StyleSheet.flatten(veil()!.props.style)).toEqual(VEIL_STYLE);
    expect(within(frame()).getByTestId('enemy-phase-veil', hidden)).toBe(veil());
  });

  and(/^le fond de palier de la scène est assombri par ce voile$/u, () => {
    // Le fond est sous tout l'écran de combat ; le voile, sur le cadre de la scène, au-dessus.
    const container = screen.getByTestId('ascent-battle-backdrop', hidden);
    const [first, second] = container.children as unknown as { props: { testID?: string } }[];
    expect(first?.props.testID).toBe('tier-backdrop');
    expect(second?.props.testID).toBe('ascent-battle');
    expect(within(frame()).queryByTestId('tier-backdrop', hidden)).toBeNull();
    expect(world.backdrops.every((tier) => tier === TIER)).toBe(true);
  });

  and(
    /^le voile apparaît au même instant que « Phase ennemie » dans l'en-tête, sans fondu$/u,
    () => {
      // Chaque pas a comparé le voile à la pastille, au même rendu.
      expect(world.enemySteps).toBeGreaterThan(0);
      expect(world.heroSteps).toBeGreaterThan(0);
      expectNoMotion(StyleSheet.flatten(veil()!.props.style));
    },
  );

  // --- La Frise d'action s'assombrit en phase ennemie ---

  given(/^la phase ennemie, un ennemi qui agit$/u, async () => {
    await show();
    await runUntil(enemyActsBeforeTheHero);
  });

  then(
    /^le portrait de l'ennemi qui agit reste en grand, à pleine lumière, avec son cadre et sa flèche d'or$/u,
    () => {
      const [acting] = entries();
      const enemy = battle().enemies[attackStep()!.enemy]!;
      const portrait = within(acting!).getByTestId('track-portrait', hidden);
      expect(portrait).toHaveProp('sprite', `portrait:${enemy.kind}`);
      expect(portrait).toHaveProp('scale', 2);
      expect(portrait).not.toHaveProp('saturation');
      expect(shadeOf(acting!)).toBeNull();
      expect(StyleSheet.flatten(acting!.props.style)).toMatchObject({
        width: 52,
        height: 52,
        borderColor: artPalette.roles.gold,
      });
      expect(within(acting!).getByTestId('track-current-arrow', hidden)).toBeTruthy();
    },
  );

  and(
    /^les autres cases de la manche, celle du héros comprise, passent à 45 % de luminosité et 60 % de saturation$/u,
    () => {
      const round = entries().slice(1, roundLength());
      expect(
        round.some(
          (entry) =>
            within(entry).getByTestId('track-portrait', hidden).props.sprite ===
            'portrait:sentinel',
        ),
      ).toBe(true);
      round.forEach((entry) => {
        expect(shadeOf(entry)).toMatchObject({
          top: -2,
          left: -2,
          right: -2,
          bottom: -2,
          backgroundColor: artPalette.roles.ink,
          opacity: 0.55,
        });
        expect(saturationOf(entry)).toBe(0.6);
      });
    },
  );

  and(
    /^les cases de l'aperçu de la manche suivante passent à 32 % de luminosité et 50 % de saturation$/u,
    () => {
      const preview = entries().slice(roundLength());
      expect(preview.length).toBeGreaterThan(0);
      preview.forEach((entry) => {
        expect(shadeOf(entry)).toMatchObject({ top: -2, bottom: -2, opacity: 0.68 });
        expect(saturationOf(entry)).toBe(0.5);
      });
    },
  );

  and(/^« suiv\. » garde son aspect actuel$/u, async () => {
    await runUntil(inHeroPhase);
    expect(world.separators.length).toBeGreaterThan(1);
    world.separators.forEach((style) => expect(style).toEqual(world.separators[0]));
  });

  // --- Retour en phase du héros ---

  given(/^la phase ennemie, la scène voilée et la frise assombrie$/u, async () => {
    await show();
    await runUntil(() => inEnemyPhase() && attackStep() !== null);
    expect(veil()).not.toBeNull();
    expect(entries().some((entry) => shadeOf(entry)?.opacity === 0.68)).toBe(true);
  });

  when(/^la phase du héros commence et que l'en-tête affiche « Phase du héros »$/u, async () => {
    await runUntil(inHeroPhase);
  });

  then(/^le voile de la scène disparaît, au même instant, sans fondu$/u, () => {
    expect(veil()).toBeNull();
    expect(world.enemySteps).toBeGreaterThan(0);
  });

  and(
    /^la Frise d'action reprend son aspect de la phase du héros \(aperçu à 62 % de luminosité et 70 % de saturation, comme aujourd'hui\)$/u,
    () => {
      const shown = entries();
      shown.slice(0, roundLength()).forEach((entry) => expect(shadeOf(entry)).toBeNull());
      shown.slice(roundLength()).forEach((entry) => {
        expect(shadeOf(entry)).toMatchObject({
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: artPalette.roles.ink,
          opacity: 0.38,
        });
        expect(saturationOf(entry)).toBe(0.7);
      });
    },
  );

  // --- Rien d'utile n'est caché par le voile ---

  given(/^la phase ennemie et un ennemi qui prépare un coup imparable$/u, async () => {
    // Le Spectre prépare un coup imparable, et la bulle d'aide de la défense n'a pas été vue.
    save(
      (started) => ({
        ...started,
        enemies: started.enemies.map((enemy) =>
          enemy.intent?.category === 'attack'
            ? { ...enemy, intent: { ...enemy.intent, attack: 'perilous' } }
            : enemy,
        ),
      }),
      true,
    );
    world.store.values.delete(BATTLE_HINT_SEEN_KEYS.defense);
    await show();
    await runUntil(() => battle().phase.kind === 'defenseHint');
    expect(veil()).not.toBeNull();
    expect(within(shaking()).getByTestId('battle-hint-defense')).toBeOnTheScreen();
    await step();
    await runUntil(() => screen.queryByTestId('phase-banner') !== null);
    expect(veil()).not.toBeNull();
    expect(within(shaking()).getByTestId('phase-banner')).toBeOnTheScreen();
    await runUntil(() => {
      const attack = attackStep();
      return attack !== null && ATTACKS[attack.attack].perilous;
    });
  });

  then(
    /^les ennemis, leurs plaques \(nom, PV, garde\), leurs intentions et le héros sont au-dessus du voile, sans assombrissement$/u,
    () => {
      const scene = within(shaking());
      expect(veil()).not.toBeNull();
      for (const kind of ENEMIES) {
        expect(scene.getByTestId(`enemy-${kind}`)).toBeOnTheScreen();
        expect(scene.getByTestId(`enemy-${kind}-plate`, hidden)).toBeTruthy();
      }
      expect(scene.getAllByTestId(/^enemy-.+-intent$/u, hidden).length).toBeGreaterThan(0);
      const { heroKind } = scene.getByTestId('battle-scene', hidden).props as Record<
        string,
        unknown
      >;
      expect(heroKind).toBe('sentinel');
      // Le voile ne contient rien et ne couvre rien d'autre que le cadre.
      expect(within(veil()!).queryAllByTestId(/./u, hidden)).toHaveLength(0);
    },
  );

  and(
    /^la préparation, la palette rouge, le sceau et le reflet de l'ennemi qui agit se voient comme aujourd'hui$/u,
    () => {
      const scene = within(shaking());
      const { timeline } = scene.getByTestId('battle-scene', hidden).props as {
        timeline: Record<string, unknown>;
      };
      expect(timeline).toMatchObject({ kind: 'attack', attack: 'perilous' });
      expect(timeline.glints).toBeDefined();
      expect(scene.getByLabelText('Sceau rouge : coup imparable')).toBeOnTheScreen();
    },
  );

  and(
    /^les chiffres de dégâts, les mots de scène, les étincelles de parade, l'annonce de phase et la bulle d'aide du combat sont au-dessus du voile$/u,
    async () => {
      // La bulle d'aide et l'annonce de phase sont vérifiées en arrivant dans la phase ennemie.
      const impact = attackStep()!.impacts[0]!.at;
      await act(async () => {
        world.clock.advanceTo(impact - 40);
        world.battleSession.pressDefense('dodge', impact - 40);
        await settleStore();
      });
      await runUntil(() => screen.queryByTestId('battle-feedback') !== null);
      expect(within(shaking()).getByTestId('battle-feedback')).toBeOnTheScreen();
      await runUntil(() => screen.queryByTestId('battle-hero-float', hidden) !== null);
      expect(within(shaking()).getByTestId('battle-hero-float', hidden)).toBeTruthy();
      // Les étincelles de parade sont dessinées par la scène, elle aussi dans la vue qui tremble.
      expect(within(shaking()).getByTestId('battle-scene', hidden)).toHaveProp('spark');
    },
  );

  and(
    /^l'indicateur « Phase ennemie », la barre du héros et la zone d'action \(Esquive, Parade\) ne sont pas voilés$/u,
    async () => {
      await runUntil(() => inEnemyPhase() && attackStep() !== null);
      expect(within(shaking()).getByTestId('battle-phase')).toHaveTextContent('Phase ennemie');
      const scene = within(frame());
      expect(scene.queryByTestId('battle-hero-bar')).toBeNull();
      expect(scene.queryByTestId('battle-pad')).toBeNull();
      expect(screen.getByRole('button', { name: 'Esquive' })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Parade' })).toBeOnTheScreen();
    },
  );

  and(
    /^le joueur peut parer ou esquiver dans la fenêtre de parade exactement comme avant$/u,
    async () => {
      const events: string[] = [];
      world.battleSession.subscribe((snapshot) =>
        snapshot.events.forEach(
          (event) => event.type === 'blowResolved' && events.push(event.outcome),
        ),
      );
      const attack = attackStep()!;
      const impact = attack.impacts[0]!.at;
      const button = ATTACKS[attack.attack].perilous ? 'dodge' : 'parry';
      await act(async () => {
        world.clock.advanceTo(impact - 40);
        world.battleSession.pressDefense(button, impact - 40);
        await settleStore();
      });
      expect(veil()).not.toBeNull();
      await runUntil(() => events.length > 0);
      expect(events[0]).toBe(button === 'dodge' ? 'dodge' : 'perfectParry');
    },
  );

  // --- Le voile ne déborde pas quand la scène tremble ---

  given(/^la phase ennemie$/u, async () => {
    await show();
    await runUntil(() => inEnemyPhase() && attackStep() !== null);
  });

  when(/^un coup touche le héros et que la scène tremble$/u, async () => {
    await runUntil(() => battle().hero.hp < world.heroHp && inEnemyPhase());
  });

  then(/^aucune bande de fond non voilée n'apparaît au bord de la scène$/u, () => {
    expect(veil()).not.toBeNull();
    expect(getAnimatedStyle(shaking()).transform).toBeDefined();
    expect(within(shaking()).queryByTestId('enemy-phase-veil', hidden)).toBeNull();
    expect(StyleSheet.flatten(veil()!.props.style)).toEqual(VEIL_STYLE);
    const fixed = StyleSheet.flatten(frame().props.style);
    expectNoMotion(fixed);
    expect(fixed.overflow).toBeUndefined();
  });

  and(/^le voile ne couvre ni l'en-tête, ni la Frise d'action, ni la barre du héros$/u, () => {
    const scene = within(frame());
    expect(scene.queryByRole('header')).toBeNull();
    expect(scene.queryByTestId('ascent-pause')).toBeNull();
    expect(scene.queryByTestId('battle-action-track')).toBeNull();
    expect(scene.queryByTestId('battle-hero-bar')).toBeNull();
  });

  // --- Mouvement réduit ---

  given(/^le mouvement réduit activé dans le réglage système$/u, async () => {
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(true);
    await show();
  });

  when(/^la phase change$/u, async () => {
    await runUntil(inEnemyPhase);
    await runUntil(inHeroPhase);
    await runUntil(inEnemyPhase);
  });

  then(
    /^le voile et l'assombrissement de la frise apparaissent et disparaissent de la même façon, d'un coup$/u,
    () => {
      expect(world.enemySteps).toBeGreaterThan(0);
      expect(world.heroSteps).toBeGreaterThan(0);
      expectNoMotion(StyleSheet.flatten(veil()!.props.style));
      entries().forEach((entry) => {
        const shade = shadeOf(entry);
        if (shade !== null) expect(shade.transform).toBeUndefined();
      });
    },
  );

  and(/^le voile reste fixe$/u, () => {
    expect(within(shaking()).queryByTestId('enemy-phase-veil', hidden)).toBeNull();
    expect(StyleSheet.flatten(shaking().props.style).transform).toBeUndefined();
    expect(StyleSheet.flatten(veil()!.props.style)).toEqual(VEIL_STYLE);
  });

  // --- Le lecteur d'écran est inchangé ---

  given(/^le lecteur d'écran actif, en phase ennemie$/u, async () => {
    jest.mocked(AccessibilityInfo.isScreenReaderEnabled).mockResolvedValue(true);
    await show();
    // De la phase du héros à la phase ennemie : l'annonce de phase est faite.
    await runUntil(inHeroPhase);
    await runUntil(() => inEnemyPhase() && attackStep() !== null);
  });

  then(/^le voile n'est ni lu ni focalisable$/u, () => {
    expect(screen.queryByTestId('enemy-phase-veil')).toBeNull();
    expect(veil()).toHaveProp('accessibilityElementsHidden', true);
    expect(veil()).toHaveProp('importantForAccessibility', 'no-hide-descendants');
    expect(veil()).toHaveProp('pointerEvents', 'none');
    expect(veil()!.props.accessible).toBeUndefined();
    expect(veil()!.props.accessibilityLabel).toBeUndefined();
  });

  and(
    /^la Frise d'action est lue avec la même phrase qu'aujourd'hui, sans mention de l'assombrissement$/u,
    () => {
      const track = actionTrackView(battle());
      const label = screen.getByTestId('battle-action-track').props.accessibilityLabel as string;
      expect(label).toBe(actionTrackLabel(track.round, track.current, track.next));
      expect(label).not.toMatch(/sombr|pâl|voil|lumi/iu);
    },
  );

  and(/^l'annonce de phase au lecteur d'écran est inchangée$/u, () => {
    expect(announce).toHaveBeenCalledWith('Phase ennemie. Prépare ta parade.');
    expect(announce.mock.calls.flat().join(' ')).not.toMatch(/sombr|voil/iu);
  });

  // --- Combat repris ---

  given(/^un combat de l'ascension mis en pause puis repris$/u, async () => {
    await show();
    await runUntil(() => inEnemyPhase() && attackStep() !== null);
    await act(async () => {
      world.visible!(false);
      await settleStore();
    });
    expect(screen.queryByTestId('battle-screen')).toBeNull();
    expect(veil()).toBeNull();
    noteBackdrop();
  });

  when(/^l'écran de combat s'affiche de nouveau$/u, async () => {
    await resume(async () => {
      await act(async () => {
        world.visible!(true);
        await settleStore();
      });
    });
    noteBackdrop();
  });

  then(
    /^le voile et l'assombrissement de la frise suivent la phase affichée dans l'en-tête, sans animation$/u,
    () => {
      expect(pill()).toBe('Phase ennemie');
      expectVeilFollowsThePill();
      expectNoMotion(StyleSheet.flatten(veil()!.props.style));
      expect(entries().some((entry) => shadeOf(entry)?.opacity === 0.55)).toBe(true);
    },
  );

  and(/^le fond de palier est le même qu'avant la pause$/u, () => {
    expect(world.backdrops.length).toBeGreaterThanOrEqual(4);
    expect(world.backdrops.every((tier) => tier === TIER)).toBe(true);
  });

  // --- Fin du combat ---

  when(/^le combat se termine \(victoire ou défaite\)$/u, async () => {
    // Le héros attaque à chaque tour, sans jamais se défendre, jusqu'à la fin du combat.
    expect(veil()).not.toBeNull();
    await runUntil(() => battle().phase.kind === 'over');
  });

  then(/^l'écran de fin s'affiche comme aujourd'hui, sans voile de phase ennemie$/u, () => {
    expect(battle().phase.kind).toBe('over');
    expect(veil()).toBeNull();
    expect(screen.queryByTestId('battle-phase')).toBeNull();
    expect(screen.queryByTestId('battle-action-track')).toBeNull();
  });

  // --- Fond de palier absent ---

  given(/^le fond de palier ne peut pas être dessiné \(repli sur la nuit\)$/u, async () => {
    mockBackdrop.drawn = false;
    await show();
  });

  when(/^la phase ennemie commence$/u, async () => {
    await runUntil(inEnemyPhase);
  });

  then(/^le voile assombrit la nuit de la scène de la même façon, sans erreur$/u, () => {
    expect(screen.queryByTestId('tier-backdrop', hidden)).toBeNull();
    expect(StyleSheet.flatten(veil()!.props.style)).toEqual(VEIL_STYLE);
    expect(within(frame()).getByTestId('enemy-phase-veil', hidden)).toBe(veil());
  });
};

autoBindSteps([loadFeature('features/voile-de-phase-ennemie.feature')], [steps]);
