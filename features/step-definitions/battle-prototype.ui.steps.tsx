/**
 * Scénarios d'interface (`@ui`) de « Prototype jouable du combat » (#31) : exécutés à travers
 * l'écran du combat d'essai (`TrialBattleScreen`), sur une vraie session de combat, l'horloge de
 * combat manuelle et une graine du combat fixée. Les touchers sont simulés par Gesture Handler. La
 * scène Skia est simulée (Skia reste limité à son test de fumée sous Jest) : elle expose la pose
 * du héros et la préparation en cours.
 *
 * « Le son du téléphone est coupé » : le son de combat ne joue rien ; la bannière et la vibration,
 * qui n'en dépendent pas, restent.
 */
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';
import { AccessibilityInfo } from 'react-native';

import { seedFor, type FirstRound } from '../../src/application/testing/trialBattleSeeds';
import { BATTLE_HINT_SEEN_KEYS } from '../../src/application/useCases/battleHints';
import type { BattleEvent } from '../../src/domain/battle/BattleEvent';
import { memoryKeyValueStore } from '../../src/adapters/ui/testing/memoryKeyValueStore';
import { renderTrialBattle, type TrialBattleTest } from '../../src/adapters/ui/testing/trialBattle';

jest.mock('../../src/adapters/ui/battle/BattleCanvas', () =>
  jest.requireActual('../../src/adapters/ui/battle/testing/fakeBattleCanvas'),
);

const GHOUL = 0;
const SPECTER = 1;

const reduceMotion = () => jest.mocked(AccessibilityInfo.isReduceMotionEnabled);
const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');

interface World {
  test: TrialBattleTest;
  impact: number;
  reference: number;
  heroHp: number;
  keyValueStore: ReturnType<typeof memoryKeyValueStore>;
}

let world: World;

beforeEach(() => {
  announce.mockClear();
  world = { keyValueStore: memoryKeyValueStore() } as World;
});

afterEach(() => {
  reduceMotion().mockResolvedValue(false);
});

async function open({
  firstRound = {},
  hintsSeen = true,
  trialTools = false,
}: {
  readonly firstRound?: FirstRound;
  readonly hintsSeen?: boolean;
  readonly trialTools?: boolean;
} = {}): Promise<TrialBattleTest> {
  world.test = await renderTrialBattle({
    seed: seedFor(firstRound),
    hintsSeen,
    trialTools,
    keyValueStore: world.keyValueStore,
  });
  return world.test;
}

function events(): BattleEvent[] {
  return world.test.snapshots.flatMap((snapshot) => snapshot.events);
}

function pad() {
  return screen.getByTestId('battle-pad');
}

function scene(): Record<string, unknown> {
  return screen.getByTestId('battle-scene', { includeHiddenElements: true }).props as Record<
    string,
    unknown
  >;
}

/** Jusqu'au début de la transition vers la phase ennemie, après « Attaquer ». */
async function toEnemyTransition(): Promise<void> {
  const { test } = world;
  await test.attack();
  await test.runUntil(() => test.battle().phase.kind === 'transition');
  world.reference = (test.battle().phase as { readonly since: number }).since;
}

/** Les boutons de la phase qui arrive : inactifs, sans hachures. */
function lockedWithoutHatching(names: readonly string[]): void {
  for (const name of names) {
    expect(within(pad()).getByRole('button', { name })).toBeDisabled();
  }
  expect(screen.getByTestId('battle-lock-tag')).toHaveTextContent('Attends');
  expect(screen.queryByTestId('battle-pad-hatching')).toBeNull();
}

const steps: StepDefinitions = ({ given, when, then, and }) => {
  given(
    /^le combat d'essai : la Sentinelle .+ contre une Goule \(20 PV\) et un Spectre \(14 PV\)$/u,
    () => {
      // L'écran s'ouvre à l'étape suivante, avec la première manche voulue par le scénario.
    },
  );

  and('le décalage vaut 0 ms', () => {
    // Le décalage est vérifié par le premier écran ouvert (combat d'essai, décalage de 0 ms).
  });

  // --- Coups de la Goule et du Spectre ------------------------------------------------------

  given(/^la Goule (lance|prépare) un coup simple( de 5 dégâts)?$/u, async () => {
    const test = await open({ firstRound: { ghoul: 'basic' } });
    expect(test.battle().inputOffset).toBe(0);
    world.impact = await test.toWindUpOf(GHOUL);
    expect(screen.getByTestId('battle-zone-line')).toHaveTextContent('Goule : coup simple');
  });

  when(/^le joueur touche « Parade » (\d+) ms avant l'impact$/u, async (delay: string) => {
    await world.test.touchDefense('parry', world.impact - Number(delay));
  });

  then('la Sentinelle ne perd aucun PV', () => {
    expect(screen.getByLabelText('La Sentinelle, PV 80 sur 80')).toBeOnTheScreen();
  });

  and(/^la Sentinelle contre-attaque la Goule, qui perd 6 PV \(.+\)$/u, async () => {
    await world.test.advanceTo(world.impact + 40);
    expect(screen.getByTestId('battle-feedback')).toHaveTextContent(
      'Parade parfaiteContre-attaque · 6 dégâts',
    );
    // 20 PV − 10 (« Attaquer ») − 6.
    expect(screen.getByRole('button', { name: /^Goule, cible, PV 4 sur 20/u })).toBeOnTheScreen();
  });

  and(
    'le jeu marque un arrêt sur image, un éclat, un son, une vibration et une légère secousse',
    () => {
      expect(events()).toContainEqual(
        expect.objectContaining({
          type: 'hitStopStarted',
          at: world.impact - 50,
          until: world.impact + 40,
        }),
      );
      expect(screen.getByTestId('battle-flash-light')).toBeOnTheScreen();
      expect(world.test.sound.played).toContain('perfectParry');
      expect(world.test.haptics.played).toContain('perfectParry');
      expect(screen.getByTestId('battle-scene-frame').props.shakeKey).toBeGreaterThan(0);
    },
  );

  given(/^le Spectre prépare un coup imparable de 9 dégâts \(6 × 1,5\)$/u, async () => {
    const test = await open({ firstRound: { specter: 'perilous' } });
    world.impact = await test.toWindUpOf(SPECTER);
    world.heroHp = test.battle().hero.hp;
  });

  then(
    "le sceau rouge apparaît au-dessus de lui, avec sa forme et un libellé lu par le lecteur d'écran",
    () => {
      const seal = within(screen.getByTestId('enemy-specter')).getByLabelText(
        'Sceau rouge : coup imparable',
      );
      expect(seal).toHaveTextContent('!');
      expect(seal.props.accessibilityRole).toBe('image');
    },
  );

  when('le joueur touche « Parade » dans la fenêtre parfaite', async () => {
    await world.test.touchDefense('parry', world.impact - 30);
  });

  then(/^la parade échoue, la Sentinelle perd 8 PV \(.+\) et est déséquilibrée$/u, () => {
    expect(screen.getByLabelText(`La Sentinelle, PV ${world.heroHp - 8} sur 80`)).toBeOnTheScreen();
    expect(screen.getByTestId('battle-off-balance')).toHaveTextContent('Déséquilibré');
  });

  and("le message dit qu'un coup imparable s'esquive", () => {
    expect(screen.getByTestId('battle-feedback')).toHaveTextContent('Imparable : esquive !−8 PV');
    expect(announce).toHaveBeenCalledWith('Imparable : esquive !, −8 PV');
  });

  // --- Déséquilibre (C9) --------------------------------------------------------------------

  then(
    "la Sentinelle est déséquilibrée pendant 450 ms et les boutons s'affichent grisés et hachurés",
    () => {
      expect(world.test.battle().offBalanceUntil).toBe(world.impact + 50);
      expect(screen.getByTestId('battle-pad-hatching')).toBeOnTheScreen();
      expect(screen.getByTestId('battle-off-balance')).toHaveTextContent('Déséquilibré');
      expect(within(pad()).getByRole('button', { name: 'Parade' })).toBeEnabled();
    },
  );

  when('le joueur touche à nouveau « Parade » 200 ms plus tard', async () => {
    await world.test.touchDefense('parry', world.impact - 200);
  });

  then("l'appui est ignoré et le déséquilibre dure encore 450 ms à partir de cet appui", () => {
    expect(world.test.session.current()!.events).toEqual([
      { type: 'pressIgnored', at: world.impact - 200, button: 'parry', reason: 'offBalance' },
      { type: 'offBalanceStarted', at: world.impact - 200, until: world.impact + 250 },
    ]);
    expect(screen.getByTestId('battle-pad-hatching')).toBeOnTheScreen();
  });

  and("l'impact qui tombe pendant le déséquilibre compte comme un coup raté", async () => {
    await world.test.advanceTo(world.impact + 160 + 32);
    expect(events()).toContainEqual(
      expect.objectContaining({ type: 'impactLanded', at: world.impact, lost: true }),
    );
    expect(screen.getByTestId('battle-feedback')).toHaveTextContent('Touché−4 PV');
    expect(screen.getByLabelText('La Sentinelle, PV 76 sur 80')).toBeOnTheScreen();
  });

  // --- Datation au toucher ------------------------------------------------------------------

  given('la phase ennemie', async () => {
    const test = await open({ firstRound: { ghoul: 'basic' } });
    world.impact = await test.toWindUpOf(GHOUL);
    expect(screen.getByTestId('battle-phase')).toHaveTextContent('Phase ennemie');
  });

  when('le doigt se pose sur « Parade »', async () => {
    // Chaque étape du geste après son début avance l'horloge du fil UI de 100 ms.
    await world.test.touchDefense('parry', world.impact - 50, 100);
  });

  then("l'appui est daté à l'instant du toucher, sans attendre que le doigt se lève", () => {
    expect(events()).toContainEqual(
      expect.objectContaining({ type: 'blowResolved', at: world.impact - 50, delta: -50 }),
    );
    expect(screen.getByTestId('battle-feedback')).toHaveTextContent('Parade parfaite');
  });

  // --- Fin du déséquilibre à la transition (C9, C12) ----------------------------------------

  given(
    'la Sentinelle est déséquilibrée depuis 100 ms quand le dernier coup ennemi est résolu',
    async () => {
      const test = await open({ firstRound: { specter: 'delayed' } });
      world.impact = await test.toWindUpOf(SPECTER);
      // Le Spectre est le dernier ennemi : il est esquivé, puis un appui dans le vide à + 60 ms.
      await test.touchDefense('dodge', world.impact);
      await test.touchDefense('parry', world.impact + 60);
      world.reference = test.attackStep()!.resolvedAt;
      expect(world.reference - (world.impact + 60)).toBe(100);
      expect(screen.getByTestId('battle-pad-hatching')).toBeOnTheScreen();
    },
  );

  when('la transition de phase vers la phase du héros commence', async () => {
    await world.test.advanceTo(world.reference);
    expect(world.test.battle().phase).toMatchObject({ kind: 'transition', to: 'hero' });
  });

  then("le déséquilibre s'arrête", () => {
    expect(world.test.battle().offBalanceUntil).toBeNull();
    expect(events()).toContainEqual({ type: 'offBalanceEnded', at: world.reference });
  });

  and('les boutons ne sont plus hachurés', () => {
    expect(screen.queryByTestId('battle-pad-hatching')).toBeNull();
    expect(screen.queryByTestId('battle-off-balance')).toBeNull();
  });

  // --- Annonce de phase (C12) ---------------------------------------------------------------

  given('une transition de phase commence', async () => {
    await open();
    await toEnemyTransition();
  });

  then(/^une bannière « Phase ennemie » ou « À toi » s'affiche selon le sens$/u, async () => {
    expect(screen.getByTestId('phase-banner')).toHaveTextContent('Phase ennemiePrépare ta parade');
    const { test } = world;
    await test.runUntil(() => {
      const { phase } = test.battle();
      return phase.kind === 'transition' && phase.to === 'hero';
    });
    expect(screen.getByTestId('phase-banner')).toHaveTextContent('À toiVise et attaque');
  });

  and('un son propre à chaque sens est joué', () => {
    const played = world.test.sound.played;
    expect(played).toContain('enemyPhase');
    expect(played.at(-1)).toBe('heroPhase');
  });

  and('une vibration légère accompagne la phase ennemie seulement', () => {
    expect(world.test.haptics.played.filter((cue) => cue === 'enemyPhase')).toHaveLength(1);
    expect(world.test.haptics.played).not.toContain('heroPhase');
  });

  and("le lecteur d'écran annonce la phase qui arrive", () => {
    expect(announce).toHaveBeenCalledWith('Phase ennemie. Prépare ta parade.');
    expect(announce).toHaveBeenCalledWith('À toi. Vise et attaque.');
  });

  and("les boutons de la phase qui arrive s'affichent inactifs, sans hachures", () => {
    lockedWithoutHatching(['Attaquer, cible : Goule']);
  });

  given('le réglage « réduire les animations » du téléphone est actif', () => {
    reduceMotion().mockResolvedValue(true);
  });

  then('la bannière apparaît sans glissement', () => {
    expect(screen.getByTestId('phase-banner-still')).toHaveTextContent(/^Phase ennemie/u);
    expect(screen.queryByTestId('phase-banner')).toBeNull();
  });

  given('le son du téléphone est coupé', () => {
    // Le son de combat de l'écran ne joue rien : il note seulement ce qu'on lui demande.
  });

  when('une transition de phase vers la phase ennemie commence', async () => {
    // La manche suivante, sur le même écran.
    const { test } = world;
    await test.runUntil(() => test.battle().phase.kind === 'hero');
    await toEnemyTransition();
  });

  then('la bannière et la vibration restent', () => {
    expect(screen.getByTestId(/^phase-banner/u)).toHaveTextContent(/^Phase ennemie/u);
    expect(world.test.haptics.played.filter((cue) => cue === 'enemyPhase')).toHaveLength(2);
  });

  // --- Mouvement réduit ---------------------------------------------------------------------

  when('le joueur réussit une parade parfaite', async () => {
    const test = await open({ firstRound: { ghoul: 'basic' } });
    world.impact = await test.toWindUpOf(GHOUL);
    await test.touchDefense('parry', world.impact - 20);
    expect(screen.getByTestId('battle-feedback')).toHaveTextContent('Parade parfaite');
  });

  then("il n'y a ni secousse ni éclat plein écran, mais la vibration et le son restent", () => {
    expect(screen.queryByTestId('battle-flash-light')).toBeNull();
    expect(screen.getByTestId('battle-scene-frame').props.shakeKey).toBe(0);
    expect(scene().reducedMotion).toBe(true);
    expect(world.test.sound.played.at(-1)).toBe('perfectParry');
    expect(world.test.haptics.played.at(-1)).toBe('perfectParry');
  });

  // --- Bulle d'aide (C12) -------------------------------------------------------------------

  given("le joueur n'a jamais joué de combat", async () => {
    await open({ hintsSeen: false });
    expect(screen.getByTestId('battle-hint-hero')).toHaveTextContent(
      'Première ascensionTouche un ennemi pour le viser, puis Attaquer.',
    );
  });

  when('la première phase ennemie arrive', async () => {
    const { test } = world;
    await test.attack();
    await test.runUntil(() => test.battle().phase.kind === 'defenseHint');
  });

  then('une bulle explique Parade et Esquive avant la transition de phase', () => {
    expect(screen.getByTestId('battle-hint-defense')).toHaveTextContent(
      "Lis son gesteQuand il frappe, touche Parade. S'il porte un sceau rouge, touche Esquive.",
    );
    expect(screen.queryByTestId('phase-banner')).toBeNull();
  });

  and("la transition de phase ne commence qu'à la fermeture de la bulle", async () => {
    const { test } = world;
    await test.advanceTo(test.clock.now() + 5_000);
    expect(test.battle().phase.kind).toBe('defenseHint');

    await act(async () => {
      fireEvent.press(screen.getByTestId('battle-hint-defense'));
    });

    expect(test.battle().phase).toMatchObject({ kind: 'transition', since: test.clock.now() });
    expect(screen.getByTestId('phase-banner')).toHaveTextContent(/^Phase ennemie/u);
    expect(world.keyValueStore.values.get(BATTLE_HINT_SEEN_KEYS.defense)).toBe('1');
  });

  and("au combat suivant, la bulle n'apparaît plus", async () => {
    const { test } = world;
    await act(async () => {
      await test.session.start();
    });
    expect(screen.queryByTestId('battle-hint-hero')).toBeNull();
    await test.attack();
    await test.runUntil(() => test.battle().phase.kind === 'transition');
    expect(screen.queryByTestId('battle-hint-defense')).toBeNull();
  });

  // --- Réglages d'essai (C12) ---------------------------------------------------------------

  given('le build de preview du prototype', async () => {
    const test = await open({ trialTools: true });
    for (let round = 0; test.battle().phase.kind !== 'over' && round < 8; round += 1) {
      await test.runUntil(() => ['hero', 'over'].includes(test.battle().phase.kind));
      if (test.battle().phase.kind === 'hero') await test.attack();
    }
    await test.runUntil(() => test.battle().phase.kind === 'over');
  });

  then(
    /^la durée de la transition de phase \(800 ms par défaut\) et celle de l'avancée \(400 ms par défaut\) se changent sans nouvelle version$/u,
    async () => {
      expect(screen.getByTestId('trial-tuning-phaseTransitionMs')).toHaveTextContent('800 ms');
      expect(screen.getByTestId('trial-tuning-stepInMs')).toHaveTextContent('400 ms');
      for (let step = 0; step < 4; step += 1) {
        await act(async () => {
          fireEvent.press(screen.getByRole('button', { name: 'Allonger la transition de phase' }));
        });
      }
      await act(async () => {
        fireEvent.press(screen.getByRole('button', { name: "Raccourcir l'avancée" }));
      });
      expect(screen.getByTestId('trial-tuning-phaseTransitionMs')).toHaveTextContent('1 000 ms');
      expect(screen.getByTestId('trial-tuning-stepInMs')).toHaveTextContent('350 ms');

      await act(async () => {
        fireEvent.press(screen.getByRole('button', { name: 'Rejouer' }));
      });
      const { test } = world;
      await toEnemyTransition();
      expect(test.battle().phase).toMatchObject({ until: world.reference + 1_000 });
      await test.runUntil(() => test.battle().phase.kind === 'enemy');
      expect(test.battle().phase).toMatchObject({
        step: { kind: 'stepIn', until: world.reference + 1_000 + 350 },
      });
    },
  );
};

// Seuls les scénarios d'interface (`@ui`) : les autres passent par la session de combat.
const feature = loadFeature('features/battle-prototype.feature');
autoBindSteps(
  [{ ...feature, scenarios: feature.scenarios.filter(({ tags }) => tags.includes('@ui')) }],
  [steps],
);
