/**
 * Scénarios d'interface (`@ui`) de « La Brûlure » (#171) : exécutés à travers l'écran de combat
 * (`BattleScreen`), sur une vraie session de combat et l'horloge de combat manuelle, ou sur une vraie
 * session d'ascension pour la fin du combat et la reprise. Skia est simulé sous Jest : les flammes
 * et la fumée se vérifient sur ce que l'écran passe à la scène et par les fonctions pures de la
 * scène (`burnFlames`).
 *
 * Correspondance métier : « un coup qui brûle » = un coup simple de la Goule, à la 1re place, qui
 * allume `burn` charges ; le Spectre et le Nécromancien restent étourdis et ne frappent pas.
 */
import { act, screen } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import { HeroBar } from '../../src/adapters/ui/battle/HeroBar';
import { burnFlames } from '../../src/adapters/ui/battle/scene/burnFlames';
import type { SceneBurn } from '../../src/adapters/ui/battle/sceneTypes';
import { BURN_EFFECT } from '../../src/adapters/ui/pixelArt/sprites/atelier/data/burn';
import { BattleScreen } from '../../src/adapters/ui/screens/BattleScreen';
import { renderBattle, type BattleScreenTest } from '../../src/adapters/ui/testing/battleScreen';
import { renderScreen } from '../../src/adapters/ui/testing/renderScreen';
import { silentHaptics } from '../../src/adapters/ui/testing/silentHaptics';
import { battleColors } from '../../src/adapters/ui/theme/battleColors';
import { InMemoryUnitOfWork } from '../../src/application/testing/InMemoryUnitOfWork';
import type { ManualBattleClock } from '../../src/application/testing/ManualBattleClock';
import {
  battleWith,
  enemyWith,
  heroWith,
  type BattleChange,
} from '../../src/application/testing/battleBuilder';
import { settableClock } from '../../src/application/testing/settableClock';
import { ASCENT_KEY, type AscentSession } from '../../src/application/useCases/AscentSession';
import type { BattleSession } from '../../src/application/useCases/BattleSession';
import type { Ascent } from '../../src/domain/ascent/Ascent';
import { ATTACKS } from '../../src/domain/battle/attacks';
import { startBattle, type Battle } from '../../src/domain/battle/Battle';
import type { BattleEvent } from '../../src/domain/battle/BattleEvent';
import { Day } from '../../src/domain/day/Day';
import { ascentBefore, settleStore, storySession, storyStore } from '../support/tiersStory';

jest.mock('../../src/adapters/ui/battle/BattleCanvas', () =>
  jest.requireActual('../../src/adapters/ui/battle/testing/fakeBattleCanvas'),
);

const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
const hiddenToo = { includeHiddenElements: true };

/** Le Spectre et le Nécromancien du combat de test restent étourdis. */
const STUNNED = { stun: { actionLost: false, heroAction: 999 } };

/** La Goule porte un coup simple de 5 qui allume `burn` charges. */
const burningBlow = (burn: number) =>
  enemyWith(0, {
    guard: 99,
    intent: {
      category: 'attack',
      attack: 'basic',
      damage: 5,
      windUpMs: ATTACKS.basic.windUpMs,
      feintFraction: 0.5,
      burn,
    },
  });

interface World {
  stacks: number;
  test: BattleScreenTest | null;
  ascent: AscentSession | null;
  battleSession: BattleSession | null;
  published: (Ascent | null)[];
  clock: ManualBattleClock | null;
  endedAt: number;
  heroHpBefore: number;
}

let world: World;

beforeEach(() => {
  announce.mockClear();
});

async function open(...changes: readonly BattleChange[]): Promise<BattleScreenTest> {
  world.test = await renderBattle({
    seed: 7,
    createBattle: battleWith(
      enemyWith(1, STUNNED),
      enemyWith(2, STUNNED),
      heroWith(world.stacks > 0 ? { burn: world.stacks } : {}),
      ...changes,
    ),
  });
  return world.test;
}

function sceneBurn(): SceneBurn {
  return (screen.getByTestId('battle-scene', hiddenToo).props as { burn: SceneBurn }).burn;
}

function chip() {
  return StyleSheet.flatten(screen.getByTestId('battle-burn-chip', hiddenToo).props.style);
}

function events(): BattleEvent[] {
  return world.test!.snapshots.flatMap((snapshot) => snapshot.events);
}

function announced(): string[] {
  return announce.mock.calls.map(([sentence]) => sentence);
}

/** Jusqu'à la résolution du coup de la Goule, sans défense ou avec une parade parfaite. */
async function blowOfTheGhoul(perfect = false): Promise<number> {
  const test = world.test!;
  const impact = await test.toWindUpOf(0);
  if (perfect) await test.touchDefense('parry', impact);
  await test.runUntil(() => events().some(({ type }) => type === 'blowResolved'));
  return events().find(({ type }) => type === 'blowResolved')!.at;
}

/** Une ascension du palier 2 devant une Goule à 1 PV, le héros à 50 PV avec `stacks` charges. */
function savedAscent(stacks: number) {
  const store = storyStore();
  const ascent = ascentBefore(2, 'combat', ['ghoul']);
  const { battle } = startBattle({
    seed: 3,
    defenseHint: false,
    at: 0,
    heroHp: 50,
    enemies: ['ghoul'],
  });
  const saved: Battle = {
    ...battle,
    hero: { ...battle.hero, burn: stacks },
    enemies: [{ ...battle.enemies[0]!, hp: 1 }],
  };
  store.values.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent, battle: saved }));
  return store;
}

/** L'application rouverte sur `store` : le combat repris, sur son écran. */
async function resume(store: ReturnType<typeof storyStore>): Promise<void> {
  const { session, clock } = storySession(store);
  await session.load();
  world.ascent = session;
  world.clock = clock;
  world.published = [];
  session.subscribe((ascent) => world.published.push(ascent));
  world.battleSession = session.battleSession();
  await renderScreen(
    <BattleScreen
      session={world.battleSession}
      title="Étage 3"
      now={() => clock.now()}
      uiNow={() => clock.now()}
    />,
    {
      clock: settableClock(Day.of(2026, 11, 1)),
      unitOfWork: new InMemoryUnitOfWork(),
      keyValueStore: store,
      haptics: silentHaptics(),
    },
  );
  await screen.findByTestId('battle-scene', hiddenToo);
}

const steps: StepDefinitions = ({ given, when, then, and }) => {
  given('la Brûlure ne touche que le héros', () => {
    world = {
      stacks: 0,
      test: null,
      ascent: null,
      battleSession: null,
      published: [],
      clock: null,
      endedAt: 0,
      heroHpBefore: 0,
    };
  });

  given(/^un héros avec (\d+) charges de Brûlure$/u, (stacks: string) => {
    world.stacks = Number(stacks);
  });

  given("le lecteur d'écran est actif", () => {
    world.stacks = 0;
  });

  when('un coup qui brûle le touche', async () => {
    await open(burningBlow(1));
    expect(sceneBurn()).toEqual({ stacks: 5, lit: null, out: null });
    await blowOfTheGhoul();
  });

  then("il a toujours 5 charges et aucune flamme de plus ne s'allume", () => {
    const burning = events().find((event) => event.type === 'heroBurning');
    expect(burning).toMatchObject({ added: 0, stacks: 5 });
    expect(sceneBurn()).toEqual({ stacks: 5, lit: { at: burning!.at, from: 5 }, out: null });
    const flames = burnFlames(sceneBurn(), burning!.at + 500, false);
    expect(flames.filter(({ effect }) => effect === 'burn')).toHaveLength(5);
  });

  and("l'étiquette « Brûlure ×5 » est cerclée un instant, pour dire que le coup a touché", () => {
    expect(screen.getByText('Brûlure ×5', hiddenToo)).toBeTruthy();
    expect(chip()).toMatchObject({ borderWidth: 2, borderColor: battleColors.burnRing });
  });

  and('le souffle de flamme se fait entendre', () => {
    const { played } = world.test!.sound;
    const hit = played.indexOf('hit');
    expect(played.slice(hit, hit + 2)).toEqual(['hit', 'flameBreath']);
  });

  when('le combat est gagné', async () => {
    await resume(savedAscent(world.stacks));
    const { battleSession, clock } = world;
    world.heroHpBefore = battleSession!.current()!.battle.hero.hp;
    for (let guard = 0; guard < 50; guard += 1) {
      const { battle } = battleSession!.current()!;
      if (battle.phase.kind === 'over') break;
      await act(async () => {
        if (battle.phase.kind === 'hero') {
          const at = clock!.now() + 50;
          clock!.advanceTo(at);
          battleSession!.heroAction({ kind: 'attack' }, at - 20, at);
        } else {
          clock!.advanceTo(clock!.pending()[0]!);
        }
        await settleStore();
      });
    }
    world.endedAt = clock!.now();
    expect(battleSession!.current()!.battle.phase).toMatchObject({
      kind: 'over',
      outcome: 'victory',
    });
  });

  then(
    "toutes ses flammes s'éteignent ensemble en fumée, sans perte de PV, avant l'écran de victoire",
    async () => {
      const { battle, events: last } = world.battleSession!.current()!;
      const cleared = last.find(({ type }) => type === 'burnCleared')!;
      expect(sceneBurn()).toEqual({ stacks: 0, lit: null, out: { at: cleared.at, slots: [0, 1] } });
      expect(burnFlames(sceneBurn(), cleared.at, false).map(({ effect }) => effect)).toEqual([
        'burnOut',
        'burnOut',
      ]);
      // Sans perte de PV : seulement le Répit, 10 % des PV max.
      expect(battle.hero.hp).toBe(world.heroHpBefore + 8);
      // L'écran qui suit le combat attend la fin de la fumée.
      expect(world.published).toEqual([]);
      await act(async () => {
        world.clock!.advanceTo(world.endedAt + 360);
        await settleStore();
      });
      expect(world.published.at(-1)?.encounter).toBeNull();
    },
  );

  and("le lecteur d'écran n'annonce rien sur la Brûlure", () => {
    expect(announced().filter((sentence) => /Brûlure|flamme/u.test(sentence))).toEqual([]);
  });

  and("il n'a plus aucune charge au combat suivant", () => {
    expect(world.battleSession!.current()!.battle.hero).not.toHaveProperty('burn');
    expect(JSON.stringify(world.published.at(-1))).not.toContain('burn');
  });

  when("l'application est fermée puis le combat repris", async () => {
    await resume(savedAscent(world.stacks));
  });

  then(/^il a toujours (\d+) charges$/u, (stacks: string) => {
    expect(world.battleSession!.current()!.battle.hero.burn).toBe(Number(stacks));
  });

  and("ses flammes et l'étiquette réapparaissent telles quelles, sans animation de prise", () => {
    expect(sceneBurn()).toEqual({ stacks: 3, lit: null, out: null });
    expect(screen.getByText('Brûlure ×3', hiddenToo)).toBeTruthy();
    expect(chip()).toMatchObject({ borderWidth: 1, borderColor: battleColors.burn });
  });

  then('3 petites flammes orange braise brûlent sur lui', async () => {
    await open();
    const flames = burnFlames(sceneBurn(), 0, false);
    expect(flames.map(({ effect }) => effect)).toEqual(['burn', 'burn', 'burn']);
    expect(BURN_EFFECT.pal).toContain('#d9733a');
  });

  and(
    "l'étiquette « Brûlure ×3 » s'affiche en orange braise sous ses PV, à droite de « Saignement ×N » s'il saigne aussi",
    async () => {
      expect(screen.getByText('Brûlure ×3', hiddenToo)).toBeTruthy();
      expect(chip()).toMatchObject({ backgroundColor: battleColors.burnBg });
      const hero = world.test!.battle().hero;
      await renderScreen(<HeroBar hero={{ ...hero, bleed: { damage: 2, rounds: 2 } }} />, {
        clock: settableClock(Day.of(2026, 11, 1)),
        unitOfWork: new InMemoryUnitOfWork(),
        keyValueStore: world.test!.keyValueStore,
        haptics: silentHaptics(),
      });
      const row = screen.getByTestId('battle-hero-ailments', hiddenToo);
      expect(
        (row.children as unknown as { props: { testID?: string } }[]).map(
          ({ props }) => props.testID,
        ),
      ).toEqual(['battle-bleed-chip', 'battle-burn-chip']);
    },
  );

  and("une flamme qui s'éteint part en fumée grise", async () => {
    await open(burningBlow(1));
    const at = await blowOfTheGhoul(true);
    const out = sceneBurn().out!;
    expect(out).toEqual({ at: at + 80, slots: [2] });
    const smoke = burnFlames(sceneBurn(), out.at + 240, false).find(
      ({ effect }) => effect === 'burnOut',
    );
    expect(smoke).toMatchObject({ frame: 2 });
    // La dernière image de la fumée : seulement les gris de la fumée.
    const grey = new Set(['#8c93a8', '#646b80', '#c3c7d3']);
    const used = new Set(
      [...BURN_EFFECT.effects.burnOut.frames[2]!.join('').replaceAll('.', '')].map(
        (char) => BURN_EFFECT.pal[parseInt(char, 36)],
      ),
    );
    expect([...used].every((tint) => grey.has(tint!))).toBe(true);
  });

  when("le héros prend 3 charges, puis qu'une charge s'éteint", async () => {
    await open(burningBlow(3));
    await blowOfTheGhoul();
    await world.test!.runUntil(() => events().some((event) => event.type === 'burnExtinguished'));
  });

  then("il entend « Brûlure, 3 charges, 3 dégâts », puis « Une flamme s'éteint »", () => {
    const said = announced();
    const taken = said.indexOf('Brûlure, 3 charges, 3 dégâts');
    expect(taken).toBeGreaterThan(-1);
    expect(said.indexOf("Une flamme s'éteint")).toBeGreaterThan(taken);
  });

  and('au début de manche, il entend « Brûlure, moins 3 PV »', () => {
    const said = announced();
    expect(said.indexOf('Brûlure, moins 3 PV')).toBeLessThan(said.indexOf("Une flamme s'éteint"));
    expect(said).toContain('Brûlure, moins 3 PV');
  });
};

const feature = loadFeature('features/brulure.feature');
const ofUi = ({ tags }: { readonly tags: readonly string[] }) => tags.includes('@ui');
autoBindSteps(
  [
    {
      ...feature,
      scenarios: feature.scenarios.filter(ofUi),
      scenarioOutlines: feature.scenarioOutlines.filter(ofUi),
    },
  ],
  [steps],
);
