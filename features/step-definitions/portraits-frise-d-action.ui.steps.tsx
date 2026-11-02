/**
 * « Les portraits dans la Frise d'action » (#175) à l'écran : le vrai écran de combat sur une vraie
 * session de combat et l'horloge de combat manuelle (`renderBattle`), ou le vrai écran de
 * l'ascension sur une vraie session et un Stockage clé-valeur en mémoire, pour la reprise. Skia est
 * simulé sous Jest : la simulation du canevas expose le nom de chaque portrait (`portrait:<nom de
 * code>`, `:phase2` pour un portrait de phase 2) et sa taille.
 *
 * Correspondance des libellés :
 * - « le portrait de X » : une case de la frise (`track-entry`) dont le canevas a le nom
 *   `portrait:<nom de code de X>` ;
 * - « à la place de "Toi" / de leur initiale » : aucune case ne montre de texte ;
 * - « sort aussitôt » : la phrase de la frise et ses cases ne le montrent plus ; sa case fantôme
 *   (`track-ghost`) grise puis disparaît en 400 ms ;
 * - « un combattant dont l'icône n'est pas validée » : le héros et la Goule, leur portrait mis à
 *   `null` dans le registre (`PORTRAITS`), comme le script de recopie l'écrit ;
 * - « sans animation propre » : la case du boss est la même vue avant et après, seul son nom de
 *   portrait change, au rendu où la scène reçoit l'aspect de phase 2.
 */
import { act, cleanup, screen, within } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';

import { ENEMY_NAMES } from '../../src/adapters/ui/format/battleText';
import { artPalette } from '../../src/adapters/ui/pixelArt/artPalette';
import type * as PortraitsData from '../../src/adapters/ui/pixelArt/sprites/atelier/data/portraits';
import { AscentScreen, RESUME_COUNTDOWN_S } from '../../src/adapters/ui/screens/AscentScreen';
import { actionTrackView } from '../../src/adapters/ui/state/battleView';
import { renderBattle, type BattleScreenTest } from '../../src/adapters/ui/testing/battleScreen';
import { renderScreen } from '../../src/adapters/ui/testing/renderScreen';
import { silentHaptics } from '../../src/adapters/ui/testing/silentHaptics';
import { InMemoryUnitOfWork } from '../../src/application/testing/InMemoryUnitOfWork';
import { changeBattle, type BattleChange } from '../../src/application/testing/battleBuilder';
import { settableClock } from '../../src/application/testing/settableClock';
import { ASCENT_KEY } from '../../src/application/useCases/AscentSession';
import type { BattleFactory } from '../../src/application/useCases/BattleSession';
import { TIERS } from '../../src/domain/ascent/tiers';
import { startBattle, type Battle } from '../../src/domain/battle/Battle';
import type { EnemyKind, HeroKind } from '../../src/domain/battle/combatants';
import { Day } from '../../src/domain/day/Day';
import { ascentBefore, storySession, storyStore } from '../support/tiersStory';

jest.mock('../../src/adapters/ui/battle/BattleCanvas', () =>
  jest.requireActual('../../src/adapters/ui/battle/testing/fakeBattleCanvas'),
);

/** Les combattants dont l'icône n'est pas encore validée dans l'Atelier (repli sur l'initiale). */
const mockUnvalidated = new Set<string>();

jest.mock('../../src/adapters/ui/pixelArt/sprites/atelier/data/portraits', () => {
  const actual = jest.requireActual<typeof PortraitsData>(
    '../../src/adapters/ui/pixelArt/sprites/atelier/data/portraits',
  );
  return {
    ...actual,
    PORTRAITS: new Proxy(actual.PORTRAITS, {
      get: (portraits, kind: string) =>
        mockUnvalidated.has(kind) ? null : (portraits as Record<string, unknown>)[kind],
    }),
  };
});

const hidden = { includeHiddenElements: true } as const;

/** Les boss nommés dans les scénarios. */
const BOSSES: Readonly<Record<string, EnemyKind>> = {
  'la Jardinière des cendres': 'ashGardener',
  'le Sonneur des heures': 'hourRinger',
  'Celle qui exauce': 'wishGranter',
};

interface World {
  test: BattleScreenTest | null;
  boss: EnemyKind | null;
  /** Les bosses mis au seuil de leur changement de phase, et leurs vues de case d'avant. */
  bossEntry: unknown;
  reducedMotion: boolean;
}

let world: World;

/**
 * Un combat par Initiative, comme dans l'ascension : `hero` contre `enemies` (les 3 premiers en
 * première ligne, les suivants en réserve), changé dès sa création.
 */
function initiativeBattle(
  hero: HeroKind,
  enemies: readonly EnemyKind[],
  ...changes: readonly BattleChange[]
): BattleFactory {
  return (options) => {
    const update = startBattle({ ...options, hero, initiative: true, enemies });
    return { ...update, battle: changeBattle(update.battle, ...changes) };
  };
}

/** L'ennemi `enemy` changé. */
function enemy(index: number, change: Partial<Battle['enemies'][number]>): BattleChange {
  return (battle) => ({
    ...battle,
    enemies: battle.enemies.map((one, at) => (at === index ? { ...one, ...change } : one)),
  });
}

async function open(createBattle: BattleFactory): Promise<BattleScreenTest> {
  world.test = await renderBattle({ seed: 7, createBattle });
  return world.test;
}

function battle(): Battle {
  return world.test!.session.current()!.battle;
}

/** Les cases de la frise (sans les cases fantômes), dans l'ordre : la manche, puis l'aperçu. */
function entries() {
  return screen.queryAllByTestId('track-entry', hidden);
}

/** Le nom du portrait de chaque case, `null` pour une case sans portrait. */
function sprites(): (string | null)[] {
  return entries().map((entry) => {
    const [portrait] = within(entry).queryAllByTestId('track-portrait', hidden);
    return portrait === undefined ? null : (portrait.props.sprite as string);
  });
}

/** Le texte de chaque case : tous vides quand chaque case a son portrait. */
function texts(): string[] {
  return entries().map((entry) =>
    within(entry)
      .queryAllByText(/./u, hidden)
      .map((text) => String(text.props.children))
      .join(''),
  );
}

function trackLabel(): string {
  return screen.getByTestId('battle-action-track').props.accessibilityLabel as string;
}

/** Le nombre de cases du combattant `actor` dans la frise de l'état courant (manche et aperçu). */
function entriesOf(actor: 'hero' | number): number {
  const track = actionTrackView(battle());
  return [...track.current, ...track.next].filter((entry) => entry.actor === actor).length;
}

/** Jusqu'à la phase du héros, puis son attaque, jusqu'à ce que `reached` soit vrai. */
async function heroAttacksUntil(reached: () => boolean): Promise<void> {
  const test = world.test!;
  await test.runUntil(() => battle().phase.kind === 'hero');
  await test.attack();
  await test.runUntil(reached);
}

async function waitReal(ms: number): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

/**
 * Un combat contre une Goule à 1 PV, le Spectre et le Nécromancien déjà tombés, et un Squelette en
 * réserve : la Goule tombe sous l'attaque du héros, et le Squelette entre à la manche suivante.
 */
function fallAndReinforcement(): BattleFactory {
  return initiativeBattle(
    'wanderer',
    ['ghoul', 'specter', 'necromancer', 'skeleton'],
    enemy(0, { hp: 1 }),
    enemy(1, { hp: 0 }),
    enemy(2, { hp: 0 }),
  );
}

/** La Gardienne des ossuaires puis le Prieur sans visage, à 151 PV, changent de phase. */
async function keepPortraits(): Promise<void> {
  for (const boss of ['ossuaryWarden', 'facelessPrior'] as const) {
    await cleanup();
    await open(initiativeBattle('wanderer', [boss], enemy(0, { hp: 151 })));
    await heroAttacksUntil(() => battle().enemies[0]!.phase2 === true);
    expect(battle().enemies[0]!.hp).toBeLessThanOrEqual(150);
    expect(sprites().filter((sprite) => sprite === `portrait:${boss}`)).toHaveLength(entriesOf(0));
    expect(sprites().join()).not.toContain(':phase2');
  }
}

const steps: StepDefinitions = ({ given, when, then, and }) => {
  beforeEach(() => {
    world = { test: null, boss: null, bossEntry: null, reducedMotion: false };
    mockUnvalidated.clear();
  });
  afterEach(() => {
    mockUnvalidated.clear();
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false);
    jest.mocked(AccessibilityInfo.isScreenReaderEnabled).mockResolvedValue(false);
  });

  // --- Le héros a son portrait ---

  given(/^un combat avec la Sentinelle$/u, async () => {
    await open(initiativeBattle('sentinel', ['ghoul']));
  });

  then(/^la Frise d'action montre le portrait de la Sentinelle, à la place de « Toi »$/u, () => {
    expect(sprites().filter((sprite) => sprite === 'portrait:sentinel')).toHaveLength(
      entriesOf('hero'),
    );
    expect(sprites()).not.toContain(null);
    expect(screen.queryByText('Toi', hidden)).toBeNull();
  });

  and(/^avec l'Errante, le portrait de l'Errante$/u, async () => {
    await cleanup();
    await open(initiativeBattle('wanderer', ['ghoul']));
    expect(sprites().filter((sprite) => sprite === 'portrait:wanderer')).toHaveLength(
      entriesOf('hero'),
    );
    expect(sprites()).not.toContain('portrait:sentinel');
    expect(screen.queryByText('Toi', hidden)).toBeNull();
  });

  // --- Chaque ennemi a son portrait ---

  given(/^un combat contre une Goule et un Spectre$/u, async () => {
    await open(initiativeBattle('sentinel', ['ghoul', 'specter']));
  });

  then(
    /^la Frise d'action montre le portrait de la Goule et celui du Spectre, à la place de leur initiale$/u,
    () => {
      expect(sprites()).toContain('portrait:ghoul');
      expect(sprites()).toContain('portrait:specter');
      expect(texts().every((text) => text === '')).toBe(true);
    },
  );

  and(/^dans la manche en cours comme dans l'aperçu « suiv\. »$/u, () => {
    const track = actionTrackView(battle());
    const all = sprites();
    const round = all.slice(0, track.current.length);
    const preview = all.slice(track.current.length);
    expect(preview).toHaveLength(track.next.length);
    expect(preview).toEqual(expect.arrayContaining(['portrait:ghoul', 'portrait:specter']));
    expect(round).toEqual(track.current.map(({ fighter }) => `portrait:${fighter}`));
    expect(screen.getByText('suiv.')).toBeOnTheScreen();
  });

  // --- Les Élites et les boss ont leur portrait ---

  given(/^un combat d'Élite ou de boss, à n'importe quel palier$/u, () => {
    // Les combats sont ouverts un à un à l'étape suivante.
  });

  then(/^la Frise d'action montre le portrait de l'Élite ou du boss$/u, async () => {
    const tiers = Object.values(TIERS);
    const kinds = tiers.flatMap(({ elites, bosses }) => [...elites, ...bosses]);
    for (const kind of kinds) {
      await cleanup();
      await open(initiativeBattle('wanderer', [kind]));
      expect(sprites().filter((sprite) => sprite === `portrait:${kind}`)).toHaveLength(
        entriesOf(0),
      );
      expect(entriesOf(0)).toBeGreaterThan(0);
      expect(sprites()).not.toContain(null);
    }
  });

  // --- Deux ennemis du même nom, sans pastille ---

  given(/^un combat contre deux Goules$/u, async () => {
    await open(initiativeBattle('sentinel', ['ghoul', 'ghoul']));
  });

  then(/^la Frise d'action montre le même portrait de Goule dans la case de chacune$/u, () => {
    const track = actionTrackView(battle());
    const ghouls = [...track.current, ...track.next].filter(({ actor }) => actor !== 'hero');
    expect(new Set(ghouls.map(({ actor }) => actor))).toEqual(new Set([0, 1]));
    expect(sprites().filter((sprite) => sprite === 'portrait:ghoul')).toHaveLength(ghouls.length);
  });

  and(
    /^aucune pastille, aucun numéro ni aucune autre marque ne s'ajoute au portrait ou à côté$/u,
    () => {
      expect(texts().every((text) => text === '')).toBe(true);
      entries().forEach((entry) =>
        expect(within(entry).getAllByTestId('track-portrait', hidden)).toHaveLength(1),
      );
      expect(within(screen.getByTestId('battle-action-track')).queryAllByText(/\d/u)).toHaveLength(
        0,
      );
    },
  );

  and(/^le cadre de chaque Goule est le même qu'aujourd'hui$/u, () => {
    const columns = screen.getAllByTestId('enemy-ghoul', hidden);
    expect(columns).toHaveLength(2);
    // Les deux plaques sont les mêmes ; seule la cible garde son trait d'or, comme aujourd'hui.
    const plates = screen
      .getAllByTestId('enemy-ghoul-plate', hidden)
      .map((plate) => StyleSheet.flatten(plate.props.style) as Record<string, unknown>);
    const withoutTarget = ({ borderColor: _, ...rest }: Record<string, unknown>) => rest;
    expect(withoutTarget(plates[0]!)).toEqual(withoutTarget(plates[1]!));
    expect(plates[battle().target]!.borderColor).toBe(artPalette.roles.gold);
    expect(plates[1 - battle().target]!.borderColor).not.toBe(artPalette.roles.gold);
    const wordsOf = (column: (typeof columns)[number]) =>
      within(column)
        .queryAllByText(/./u, hidden)
        .map((text) => String(text.props.children));
    expect(wordsOf(columns[0]!)).toEqual(wordsOf(columns[1]!));
    expect(wordsOf(columns[0]!).join(' ')).not.toMatch(/\b[12]\b|#/u);
    expect(screen.queryAllByTestId('track-portrait-badge', hidden)).toHaveLength(0);
  });

  // --- Le boss prend son portrait de phase 2 ---

  given(
    /^un combat contre (la Jardinière des cendres|le Sonneur des heures|Celle qui exauce)$/u,
    (name: string) => {
      world.boss = BOSSES[name]!;
    },
  );

  then(
    /^dans toutes ses cases de la Frise d'action, manche en cours et aperçu « suiv\. », son portrait devient son portrait de phase 2$/u,
    () => {
      const boss = world.boss!;
      const track = actionTrackView(battle());
      expect(track.current.some(({ actor }) => actor === 0)).toBe(true);
      expect(track.next.some(({ actor }) => actor === 0)).toBe(true);
      expect(sprites().filter((sprite) => sprite === `portrait:${boss}:phase2`)).toHaveLength(
        entriesOf(0),
      );
      expect(sprites()).not.toContain(`portrait:${boss}`);
    },
  );

  and(/^au même instant que son aspect de phase 2, sans animation propre$/u, () => {
    const scene = screen.getByTestId('battle-scene', hidden).props as {
      enemies: readonly { phase2: boolean }[];
    };
    expect(scene.enemies[0]!.phase2).toBe(true);
    // La même case qu'avant le changement de phase : seul son portrait a changé, sans fantôme.
    expect(entries()).toContain(world.bossEntry);
    expect(screen.queryAllByTestId('track-ghost', hidden)).toHaveLength(0);
    expect(Number(getAnimatedStyle(world.bossEntry as never).opacity ?? 1)).toBe(1);
  });

  // --- Un boss sans aspect de phase 2 garde son portrait ---

  given(/^un combat contre la Gardienne des ossuaires ou le Prieur sans visage$/u, () => {
    // Les deux combats sont ouverts à l'étape suivante.
  });

  when(/^ses PV passent à (\d+) ou moins$/u, async (threshold: string) => {
    if (world.boss === null) {
      await keepPortraits();
      return;
    }
    const boss = world.boss!;
    // Le boss à un PV au-dessus de son seuil : l'attaque du héros le fait changer de phase.
    await open(initiativeBattle('wanderer', [boss], enemy(0, { hp: Number(threshold) + 1 })));
    expect(sprites().filter((sprite) => sprite === `portrait:${boss}`)).toHaveLength(entriesOf(0));
    const [first] = entries().filter(
      (entry) =>
        within(entry).getByTestId('track-portrait', hidden).props.sprite === `portrait:${boss}`,
    );
    world.bossEntry = first;
    await heroAttacksUntil(() => battle().enemies[0]!.phase2 === true);
    expect(battle().enemies[0]!.hp).toBeLessThanOrEqual(Number(threshold));
  });

  then(/^la Frise d'action garde son portrait$/u, () => {
    expect(sprites()).toContain('portrait:facelessPrior');
    expect(sprites().join()).not.toContain(':phase2');
  });

  // --- Combat repris après le changement de phase ---

  given(/^un combat contre la Jardinière des cendres, déjà en phase 2$/u, () => {
    const store = storyStore();
    const { battle: started } = startBattle({
      seed: 3,
      defenseHint: false,
      at: 0,
      hero: 'wanderer',
      initiative: true,
      enemies: ['ashGardener'],
    });
    const saved = changeBattle(started, enemy(0, { hp: 200, phase2: true }));
    store.values.set(
      ASCENT_KEY,
      JSON.stringify({
        version: 1,
        ascent: { ...ascentBefore(2, 'boss', ['ashGardener']) },
        battle: saved,
      }),
    );
    (world as unknown as { store: typeof store }).store = store;
  });

  when(/^l'application est fermée puis le combat repris$/u, async () => {
    const { store } = world as unknown as { store: ReturnType<typeof storyStore> };
    // L'application rouverte : une nouvelle session sur le même stockage, l'écran monté.
    const { session } = storySession(store);
    await session.load();
    expect(session.resuming()).toBe(true);
    jest.useFakeTimers();
    try {
      await renderScreen(
        <AscentScreen
          session={session}
          visibility={{ onChange: () => () => {} }}
          onLeave={() => undefined}
        />,
        {
          clock: settableClock(Day.of(2026, 11, 2)),
          unitOfWork: new InMemoryUnitOfWork(),
          keyValueStore: store,
          haptics: silentHaptics(),
        },
      );
      for (let second = 0; second < RESUME_COUNTDOWN_S; second += 1) {
        await act(async () => {
          jest.advanceTimersByTime(1_000);
        });
      }
      expect(screen.getByTestId('battle-screen')).toBeOnTheScreen();
    } finally {
      jest.useRealTimers();
    }
  });

  then(/^la Frise d'action montre son portrait de phase 2$/u, () => {
    const all = sprites();
    expect(all).toContain('portrait:ashGardener:phase2');
    expect(all).not.toContain('portrait:ashGardener');
    expect(all).toContain('portrait:wanderer');
  });

  // --- La frise vit comme aujourd'hui ---

  given(/^un combat en cours$/u, async () => {
    await open(fallAndReinforcement());
    expect(sprites()).toContain('portrait:ghoul');
  });

  when(/^un ennemi tombe$/u, async () => {
    await heroAttacksUntil(() => battle().enemies[0]!.hp === 0);
  });

  then(/^son portrait sort aussitôt de la manche et de l'aperçu$/u, async () => {
    expect(sprites()).not.toContain('portrait:ghoul');
    expect(trackLabel()).not.toContain(ENEMY_NAMES.ghoul);
    // Sa case fantôme grise puis se referme, et ne reste pas au-delà de 400 ms.
    expect(screen.getAllByTestId('track-ghost', hidden).length).toBeGreaterThan(0);
    await waitReal(450);
    expect(screen.queryAllByTestId('track-ghost', hidden)).toHaveLength(0);
  });

  when(/^un renfort entre$/u, async () => {
    await world.test!.runUntil(() =>
      world.test!.snapshots.some(({ events }) =>
        events.some(({ type }) => type === 'reinforcementEntered'),
      ),
    );
  });

  then(/^il entre dans la frise avec son portrait$/u, async () => {
    expect(battle().enemies[0]!.kind).toBe('skeleton');
    expect(sprites()).toContain('portrait:skeleton');
    expect(trackLabel()).toContain(ENEMY_NAMES.skeleton);
    await waitReal(350);
    entries().forEach((entry) => expect(Number(getAnimatedStyle(entry).opacity ?? 1)).toBe(1));
  });

  // --- Un combattant sans portrait validé ---

  given(/^un combattant dont l'icône n'est pas validée dans l'Atelier$/u, async () => {
    mockUnvalidated.add('wanderer');
    mockUnvalidated.add('ghoul');
    await open(initiativeBattle('wanderer', ['ghoul', 'specter']));
  });

  then(
    /^la Frise d'action montre son initiale, comme aujourd'hui \(« Toi » pour le héros\)$/u,
    () => {
      const shown = entries().map((entry, index) => sprites()[index] ?? texts()[index]);
      expect(shown).toContain('Toi');
      expect(shown).toContain('G');
      expect(shown).toContain('portrait:specter');
      expect(shown).not.toContain('portrait:ghoul');
      expect(shown).not.toContain('portrait:wanderer');
    },
  );

  and(/^la frise ne montre jamais de case vide$/u, () => {
    const track = actionTrackView(battle());
    expect(entries()).toHaveLength(track.current.length + track.next.length);
    entries().forEach((_, index) => expect(sprites()[index] ?? texts()[index]).toBeTruthy());
  });

  // --- Lecteur d'écran inchangé ---

  given(/^le lecteur d'écran est actif$/u, async () => {
    jest.mocked(AccessibilityInfo.isScreenReaderEnabled).mockResolvedValue(true);
    // L'Errante (7) après le Spectre (8), avant deux Goules (4), à la manche 3.
    await open(
      initiativeBattle('wanderer', ['ghoul', 'specter', 'ghoul'], (started) => ({
        ...started,
        round: 3,
      })),
    );
  });

  then(
    /^la Frise d'action se lit avec la même phrase qu'aujourd'hui, par exemple « (.+) »$/u,
    (sentence: string) => {
      expect(trackLabel()).toBe(sentence);
      expect(screen.getByTestId('battle-action-track')).toHaveProp('accessible', true);
    },
  );

  and(/^deux ennemis du même nom se lisent toujours « Goule, Goule »$/u, () => {
    expect(trackLabel()).toContain('Goule, Goule');
  });

  and(/^les portraits, celui de phase 2 compris, ne sont pas lus$/u, async () => {
    const hiddenPortraits = () =>
      screen.getAllByTestId('track-portrait', hidden).forEach((portrait) => {
        expect(portrait).toHaveProp('accessibilityElementsHidden', true);
        expect(portrait).toHaveProp('importantForAccessibility', 'no-hide-descendants');
      });
    hiddenPortraits();
    expect(screen.queryAllByTestId('track-portrait')).toHaveLength(0);
    await cleanup();
    await open(initiativeBattle('wanderer', ['ashGardener'], enemy(0, { hp: 200, phase2: true })));
    expect(sprites()).toContain('portrait:ashGardener:phase2');
    hiddenPortraits();
    expect(trackLabel()).toMatch(/^Ordre d'action\. Manche 1 : .*Jardinière des cendres/u);
    expect(trackLabel()).not.toMatch(/phase/u);
  });

  // --- Mouvement réduit ---

  given(/^le mouvement réduit actif$/u, async () => {
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(true);
    await open(fallAndReinforcement());
    expect(sprites()).toContain('portrait:ghoul');
  });

  when(/^un ennemi tombe ou qu'un renfort entre$/u, async () => {
    await heroAttacksUntil(() => battle().enemies[0]!.hp === 0);
    // La Goule sort d'un coup : ni case fantôme, ni grisé.
    expect(sprites()).not.toContain('portrait:ghoul');
    expect(screen.queryAllByTestId('track-ghost', hidden)).toHaveLength(0);
    await world.test!.runUntil(() => battle().enemies[0]!.kind === 'skeleton');
  });

  then(/^son portrait disparaît ou apparaît d'un coup, sans grisé ni glissement$/u, () => {
    expect(sprites()).toContain('portrait:skeleton');
    expect(screen.queryAllByTestId('track-ghost', hidden)).toHaveLength(0);
    entries().forEach((entry) => {
      const style = getAnimatedStyle(entry);
      expect(Number(style.opacity ?? 1)).toBe(1);
      expect(style).toMatchObject({ transform: [{ translateY: 0 }] });
    });
  });
};

autoBindSteps([loadFeature('features/portraits-frise-d-action.feature')], [steps]);
