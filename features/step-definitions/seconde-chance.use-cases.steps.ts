/**
 * Scénarios `@session` de « Seconde chance » (#206) : une vraie session d'ascension, sur un stockage
 * clé-valeur en mémoire. Fermer l'application, c'est ouvrir une nouvelle session sur le même
 * stockage ; la jauge d'aujourd'hui n'entre jamais dans l'ascension en cours.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { FixedSeedSource } from '../../src/application/testing/FixedSeedSource';
import { ManualBattleClock } from '../../src/application/testing/ManualBattleClock';
import {
  silentBattleHaptics,
  silentBattleSound,
} from '../../src/application/testing/recordingBattleFeedback';
import { ASCENT_KEY, AscentSession } from '../../src/application/useCases/AscentSession';
import type { BattleSession } from '../../src/application/useCases/BattleSession';
import { BATTLE_HINT_SEEN_KEYS } from '../../src/application/useCases/battleHints';
import { startAscent, type Ascent } from '../../src/domain/ascent/Ascent';
import type { FateGauge } from '../../src/domain/ascent/fateGauge';
import { startBattle, type Battle } from '../../src/domain/battle/Battle';

function mapStore() {
  const values = new Map<string, string>([
    [BATTLE_HINT_SEEN_KEYS.hero, '1'],
    [BATTLE_HINT_SEEN_KEYS.defense, '1'],
  ]);
  return {
    values,
    get: async (key: string) => values.get(key) ?? null,
    set: async (key: string, value: string) => {
      values.set(key, value);
    },
    remove: async (key: string) => {
      values.delete(key);
    },
  };
}

/** Laisse passer les écritures en attente. */
async function flush(): Promise<void> {
  for (let index = 0; index < 5; index += 1) await Promise.resolve();
}

let store: ReturnType<typeof mapStore>;
let clock: ManualBattleClock;
let session: AscentSession;
let battleSession: BattleSession;
let todayGauge: FateGauge;

function newSession(): AscentSession {
  clock = new ManualBattleClock(1_000);
  return new AscentSession({
    clock,
    seeds: new FixedSeedSource(5),
    sound: silentBattleSound(),
    haptics: silentBattleHaptics(),
    keyValueStore: store,
  });
}

function save(ascent: Ascent, battle: Battle | null = null) {
  store = mapStore();
  store.values.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent, battle }));
}

/** Rouvre l'ascension sauvegardée et son combat. */
async function reopen(): Promise<void> {
  session = newSession();
  await session.load();
  battleSession = session.battleSession();
  await battleSession.start();
}

const steps: StepDefinitions = ({ given, when, then, and }) => {
  given(
    /^une ascension lancée hier avec une jauge de \+2, sans avoir utilisé la seconde chance$/u,
    () => {
      save(startAscent(9, { gauge: 2 }));
    },
  );

  and(/^la jauge d'aujourd'hui vaut −2$/u, () => {
    todayGauge = -2;
  });

  when(/^le joueur reprend l'ascension$/u, async () => {
    await reopen();
    expect(session.current()!.gauge).not.toBe(todayGauge);
  });

  then(/^le héros a toujours sa seconde chance$/u, () => {
    expect(session.current()).toMatchObject({ gauge: 2, secondChance: true });
    expect(battleSession.current()!.battle.hero.secondChance).toBe('ready');
  });

  given(/^le héros s'est relevé grâce à sa seconde chance$/u, async () => {
    const { battle } = startBattle({
      seed: 3,
      defenseHint: false,
      at: 0,
      heroHp: 1,
      heroMaxHp: 80,
      enemies: ['ghoul'],
      secondChance: true,
    });
    save(startAscent(9, { gauge: 2 }), battle);
    await reopen();
    for (let guard = 0; guard < 100; guard += 1) {
      const current = battleSession.current()!.battle;
      if (current.hero.secondChance === 'used') break;
      if (current.phase.kind === 'hero') {
        const at = clock.now() + 50;
        clock.advanceTo(at);
        battleSession.heroAction({ kind: 'attack' }, at - 20, at);
      } else {
        clock.advanceTo(clock.pending()[0]!);
      }
      await flush();
    }
    expect(battleSession.current()!.battle.hero).toMatchObject({ hp: 40, secondChance: 'used' });
  });

  when(/^le joueur ferme l'application pendant le combat et le reprend$/u, async () => {
    await flush();
    battleSession.dispose();
    await reopen();
  });

  then(/^le héros n'a plus de seconde chance$/u, () => {
    expect(battleSession.current()!.battle.hero).toMatchObject({
      hp: 40,
      secondChance: 'used',
    });
  });
};

// Les cas d'usage seuls : `@domain` et `@ui` ont leurs propres étapes.
const feature = loadFeature('features/seconde-chance.feature');
const ofSession = ({ tags }: { readonly tags: readonly string[] }) => tags.includes('@session');
autoBindSteps(
  [
    {
      ...feature,
      scenarios: feature.scenarios.filter(ofSession),
      scenarioOutlines: feature.scenarioOutlines.filter(ofSession),
    },
  ],
  [steps],
);
