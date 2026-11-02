/**
 * « Le fond de palier » (#176) à l'écran : une vraie session d'ascension sur un Stockage clé-valeur
 * en mémoire, et le vrai écran de l'ascension. Le canevas Skia du fond est remplacé par sa
 * simulation (`battle/testing/fakeTierBackdrop.tsx`, jest.config.js), qui expose son palier et le
 * cadre de la scène qu'elle reçoit ; la scène du combat est simulée de même.
 *
 * Correspondance des libellés :
 * - « le fond de palier des Catacombes » : `tier-backdrop` au palier 1, dont le nom est celui du
 *   palier (`TIER_NAMES`) ; de même pour les Jardins de cendre (2) et le Beffroi (3) ;
 * - « aussi lisibles qu'aujourd'hui » : le fond est sous tout l'écran de combat, hors de la scène ;
 *   la plaque des ennemis est pleine, les intentions et les barres ont leur propre fond, et les
 *   chiffres et mots de scène ont un contour d'encre opaque ;
 * - « un contraste d'au moins 4,5:1 » : chaque couleur de texte de l'en-tête et de la zone du pouce
 *   sur chaque teinte de chaque fond sous le voile de lisibilité, et les textes de la plaque sur
 *   sa surface.
 */
import { act, cleanup, render, screen, within } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import { InMemoryUnitOfWork } from '../../src/application/testing/InMemoryUnitOfWork';
import { settableClock } from '../../src/application/testing/settableClock';
import type { AscentSession } from '../../src/application/useCases/AscentSession';
import type { Encounter } from '../../src/domain/ascent/Ascent';
import type { Tier } from '../../src/domain/ascent/tiers';
import type { EnemyKind } from '../../src/domain/battle/combatants';
import { Day } from '../../src/domain/day/Day';
import { DamageFloat, FeedbackLabel } from '../../src/adapters/ui/battle/BattleEffects';
import { TIER_NAMES } from '../../src/adapters/ui/format/ascentText';
import { artPalette } from '../../src/adapters/ui/pixelArt/artPalette';
import { TIER_BACKDROPS } from '../../src/adapters/ui/pixelArt/sprites/battle/tierBackdrops';
import { AscentScreen, RESUME_COUNTDOWN_S } from '../../src/adapters/ui/screens/AscentScreen';
import type { Dependencies } from '../../src/adapters/ui/state/Dependencies';
import { contrast, underVeil } from '../../src/adapters/ui/testing/contrast';
import { renderScreen } from '../../src/adapters/ui/testing/renderScreen';
import { silentHaptics } from '../../src/adapters/ui/testing/silentHaptics';
import { battleColors } from '../../src/adapters/ui/theme/battleColors';
import {
  ascentBefore,
  playToTheEnd,
  saveBefore,
  settleStore,
  storySession,
  storyStore,
  type StoryStore,
} from '../support/tiersStory';

jest.mock('../../src/adapters/ui/battle/BattleCanvas', () =>
  jest.requireActual('../../src/adapters/ui/battle/testing/fakeBattleCanvas'),
);

const { roles } = artPalette;
const hidden = { includeHiddenElements: true } as const;
const TIERS = [1, 2, 3] as const;
/** Le fond nommé dans les scénarios, et son palier. */
const BACKDROPS: Readonly<Record<string, Tier>> = {
  'des Catacombes': 1,
  'des Jardins de cendre': 2,
  'du Beffroi': 3,
};
/** Un ennemi de chaque palier, pour un combat ordinaire. */
const FOES: Readonly<Record<Tier, EnemyKind>> = { 1: 'ghoul', 2: 'ashBramble', 3: 'firstPilgrim' };
/** Les couleurs de texte de l'en-tête et de la zone du pouce, posées sur le voile. */
const VEILED_TEXTS = [
  battleColors.text,
  battleColors.muted,
  roles.gold,
  roles.light,
  roles.muted,
  roles.parchment,
];
/** Les couleurs de texte de la plaque d'un ennemi, posées sur sa surface. */
const PLATE_TEXTS = [battleColors.text, battleColors.light];

interface World {
  store: StoryStore;
  session: AscentSession;
  /** Le palier du fond montré à chaque écran de combat rendu, dans l'ordre. */
  shown: Tier[];
}

let world: World;

function dependencies(store: StoryStore): Dependencies {
  return {
    clock: settableClock(Day.of(2026, 11, 1)),
    unitOfWork: new InMemoryUnitOfWork(),
    keyValueStore: store,
    haptics: silentHaptics(),
  };
}

const backdrop = () => screen.getByTestId('tier-backdrop', hidden);

/** Le palier du fond de l'écran de combat affiché, noté dans `world.shown`. */
function noteBackdrop(): void {
  world.shown.push(backdrop().props.tier as Tier);
}

/** Une session d'ascension neuve sur le stockage du scénario, chargée. */
async function loadSession(): Promise<void> {
  const { session } = storySession(world.store);
  await session.load();
  world.session = session;
}

/** Le vrai écran de l'ascension, sur la session du scénario. */
async function showAscent(): Promise<void> {
  await renderScreen(
    <AscentScreen
      session={world.session}
      visibility={{ onChange: () => () => {} }}
      onLeave={() => undefined}
    />,
    dependencies(world.store),
  );
}

/** Le combat de l'étage à l'écran, son fond noté. */
async function showBattle(): Promise<void> {
  await showAscent();
  await screen.findByTestId('battle-screen');
  noteBackdrop();
}

/** Une ascension au palier `tier`, devant un combat de `kind`, sauvegardée et chargée. */
async function before(tier: Tier, kind: Encounter['kind'], enemy: EnemyKind): Promise<void> {
  saveBefore(world.store, ascentBefore(tier, kind, [enemy]), false);
  await loadSession();
}

const steps: StepDefinitions = ({ given, when, then, and }) => {
  beforeEach(() => {
    world = { store: storyStore(), shown: [] } as unknown as World;
  });
  afterEach(() => {
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false);
    jest.mocked(AccessibilityInfo.isScreenReaderEnabled).mockResolvedValue(false);
  });

  // --- Chaque palier a son fond ---

  given(/^une ascension au palier (\d)$/u, async (tier: string) => {
    const at = Number(tier) as Tier;
    await before(at, 'combat', FOES[at]);
  });

  when(/^un combat commence$/u, async () => {
    await showBattle();
  });

  then(
    /^l'écran de combat montre (?:toujours )?le fond (?:de palier )?(des Catacombes|des Jardins de cendre|du Beffroi)$/u,
    (name: string) => {
      const tier = BACKDROPS[name]!;
      expect(TIER_NAMES[tier].toLowerCase()).toContain(
        name.split(' ').slice(1).join(' ').toLowerCase(),
      );
      expect(world.shown.length).toBeGreaterThan(0);
      expect(world.shown.every((shown) => shown === tier)).toBe(true);
      expect(TIER_BACKDROPS[tier]).toBeDefined();
    },
  );

  // --- Le fond change avec le palier ---

  given(/^le boss du palier 1 vaincu$/u, async () => {
    saveBefore(world.store, ascentBefore(1, 'boss', ['ossuaryWarden']));
    const { session, clock } = storySession(world.store);
    await session.load();
    world.session = session;
    const { battle } = await playToTheEnd(session.battleSession(), clock);
    await act(async () => {
      await settleStore();
    });
    expect(battle.phase).toMatchObject({ kind: 'over', outcome: 'victory' });
    expect(session.current()).toMatchObject({ tier: 1, passage: { to: 2 } });
  });

  when(/^le premier combat du palier 2 commence$/u, async () => {
    await act(async () => {
      world.session.acknowledgeBossVictory();
      world.session.enterNextTier();
    });
    expect(world.session.current()).toMatchObject({
      tier: 2,
      floor: 1,
      encounter: { kind: 'combat' },
    });
    await showBattle();
  });

  // --- Les Élites et le boss gardent le fond de leur palier ---

  given(/^un combat d'Élite ou de boss au palier 3$/u, async () => {
    await before(3, 'elite', 'bronzeWarden');
    await showBattle();
    await cleanup();
    world.store = storyStore();
    await before(3, 'boss', 'wishGranter');
    await showBattle();
    expect(world.shown).toHaveLength(2);
  });

  // --- Le fond est repris avec le combat ---

  given(/^un combat en cours au palier 2$/u, async () => {
    saveBefore(world.store, ascentBefore(2, 'combat', ['ashBramble']));
    await loadSession();
    expect(world.session.resuming()).toBe(true);
  });

  when(/^l'application est fermée puis le combat repris$/u, async () => {
    // L'application rouverte : une nouvelle session sur le même stockage, l'écran remonté.
    await loadSession();
    jest.useFakeTimers();
    try {
      await showAscent();
      expect(screen.getByTestId('ascent-countdown')).toBeOnTheScreen();
      noteBackdrop();
      for (let second = 0; second < RESUME_COUNTDOWN_S; second += 1) {
        await act(async () => {
          jest.advanceTimersByTime(1_000);
        });
      }
      expect(screen.getByTestId('battle-screen')).toBeOnTheScreen();
      noteBackdrop();
    } finally {
      jest.useRealTimers();
    }
  });

  // --- Limite : le fond ne gêne jamais le combat ---

  given(/^l'écran de combat sur n'importe quel fond de palier$/u, async () => {
    for (const tier of TIERS) {
      await cleanup();
      world.store = storyStore();
      await before(tier, 'combat', FOES[tier]);
      await showBattle();
    }
    expect(world.shown).toEqual([...TIERS]);
  });

  then(
    /^le sceau, le Reflet, les intentions, les PV, la garde et les touches de combat restent aussi lisibles qu'aujourd'hui$/u,
    async () => {
      // Le fond est sous tout l'écran de combat, hors de la scène (sceau, Reflet, colonnes).
      const container = screen.getByTestId('ascent-battle-backdrop', hidden);
      const [first, second] = container.children as unknown as { props: { testID?: string } }[];
      expect(first?.props.testID).toBe('tier-backdrop');
      expect(second?.props.testID).toBe('ascent-battle');
      expect(
        within(screen.getByTestId('battle-scene-frame')).queryByTestId('tier-backdrop', hidden),
      ).toBeNull();
      // La plaque pleine porte le nom, les PV et la garde ; l'intention a son propre fond.
      const kind = FOES[3];
      const style = (testID: string) =>
        StyleSheet.flatten(screen.getByTestId(testID, hidden).props.style);
      expect(style(`enemy-${kind}-plate`).backgroundColor).toBe(roles.surface);
      expect(style(`enemy-${kind}-intent`).backgroundColor).toBe(battleColors.badge);
      expect(screen.getByTestId('battle-pad')).toBeOnTheScreen();
      // Les chiffres et mots de scène ont un contour d'encre opaque, sans décalage.
      const outline = {
        textShadowColor: roles.ink,
        textShadowRadius: 2,
        textShadowOffset: { width: 0, height: 0 },
      };
      await render(<FeedbackLabel texts={[{ tone: 'perfect', title: 'Parade parfaite' }]} />);
      expect(StyleSheet.flatten(screen.getByText('Parade parfaite').props.style)).toMatchObject(
        outline,
      );
      await render(<DamageFloat float={{ at: 0, text: '−12', big: false, kind: 'damage' }} />);
      expect(StyleSheet.flatten(screen.getByText('−12').props.style)).toMatchObject(outline);
    },
  );

  and(/^chaque texte garde un contraste d'au moins 4,5:1$/u, () => {
    const failing = TIERS.flatMap((tier) =>
      TIER_BACKDROPS[tier].palette.flatMap((tint) =>
        VEILED_TEXTS.filter((text) => contrast(text, underVeil(tint)) < 4.5).map(
          (text) => `${text} on ${tint} (tier ${tier})`,
        ),
      ),
    );
    expect(failing).toEqual([]);
    for (const text of PLATE_TEXTS) {
      expect(contrast(text, roles.surface)).toBeGreaterThanOrEqual(4.5);
    }
  });

  // --- Limite : mouvement réduit ---

  given(/^le mouvement réduit actif$/u, async () => {
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(true);
    await before(1, 'combat', FOES[1]);
    await showBattle();
  });

  then(/^le fond de palier est fixe$/u, () => {
    // Hors de la vue qui tremble, et rien d'animé : son palier et le cadre de la scène, rien d'autre.
    expect(
      within(screen.getByTestId('battle-scene-frame')).queryByTestId('tier-backdrop', hidden),
    ).toBeNull();
    const { tier, scene, style } = backdrop().props as Record<string, unknown>;
    expect(tier).toBe(1);
    expect(scene).toBeNull();
    expect(style).toBeUndefined();
  });

  // --- Limite : lecteur d'écran ---

  given(/^le lecteur d'écran est actif$/u, async () => {
    jest.mocked(AccessibilityInfo.isScreenReaderEnabled).mockResolvedValue(true);
    await before(2, 'combat', FOES[2]);
    await showBattle();
  });

  then(/^le fond de palier n'est pas lu$/u, () => {
    expect(screen.queryByTestId('tier-backdrop')).toBeNull();
    expect(backdrop()).toHaveProp('accessibilityElementsHidden', true);
    expect(backdrop()).toHaveProp('importantForAccessibility', 'no-hide-descendants');
    expect(backdrop().props.accessibilityLabel).toBeUndefined();
    expect(screen.getByRole('header', { name: 'Étage 3' })).toBeOnTheScreen();
  });
};

autoBindSteps([loadFeature('features/fond-de-palier.feature')], [steps]);
