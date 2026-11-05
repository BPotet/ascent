/**
 * Scénarios `@session` de « Relances de la faveur » (#42) : une vraie session d'ascension, sur un
 * stockage clé-valeur en mémoire. Fermer l'application, c'est ouvrir une nouvelle session sur le
 * même stockage ; la jauge d'aujourd'hui n'entre jamais dans l'ascension en cours.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { FixedSeedSource } from '../../src/application/testing/FixedSeedSource';
import { ManualBattleClock } from '../../src/application/testing/ManualBattleClock';
import {
  silentBattleHaptics,
  silentBattleSound,
} from '../../src/application/testing/recordingBattleFeedback';
import { ASCENT_KEY, AscentSession } from '../../src/application/useCases/AscentSession';
import { BATTLE_HINT_SEEN_KEYS } from '../../src/application/useCases/battleHints';
import { endFloorBattle, startAscent, type Ascent } from '../../src/domain/ascent/Ascent';
import type { FateGauge } from '../../src/domain/ascent/fateGauge';

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
let session: AscentSession;
let todayGauge: FateGauge;
let rerolled: Ascent;

function newSession(): AscentSession {
  return new AscentSession({
    clock: new ManualBattleClock(1_000),
    seeds: new FixedSeedSource(5),
    sound: silentBattleSound(),
    haptics: silentBattleHaptics(),
    keyValueStore: store,
  });
}

/** Une ascension lancée en faveur pleine, après son premier combat, son offre en attente. */
function save(ascent: Ascent) {
  store = mapStore();
  store.values.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent, battle: null }));
}

const offered = () =>
  endFloorBattle(startAscent(9, { gauge: 2 }), { outcome: 'victory', heroHp: 50 });

const steps: StepDefinitions = ({ given, when, then, and }) => {
  given(/^une ascension lancée hier avec une jauge de \+2, où il reste 1 relance$/u, () => {
    save({ ...offered(), rerolls: 1 });
  });

  and(/^la jauge d'aujourd'hui vaut −1$/u, () => {
    todayGauge = -1;
  });

  when(/^le joueur reprend l'ascension$/u, async () => {
    session = newSession();
    expect((await session.load())!.gauge).not.toBe(todayGauge);
  });

  then(/^le héros a toujours 1 relance$/u, () => {
    expect(session.current()).toMatchObject({ gauge: 2, rerolls: 1 });
  });

  given(/^le joueur a relancé une offre$/u, async () => {
    save(offered());
    session = newSession();
    await session.load();
    session.reroll();
    await flush();
    rerolled = session.current()!;
    expect(rerolled.rerolls).toBe(1);
  });

  when(/^il ferme l'application et reprend l'ascension$/u, async () => {
    session = newSession();
    await session.load();
  });

  then(/^il retrouve la nouvelle offre et le même nombre de relances$/u, () => {
    expect(session.current()!.boonOffer).toEqual(rerolled.boonOffer);
    expect(session.current()!.rerolls).toBe(1);
  });
};

// La session seule : `@domain` et `@ui` ont leurs propres étapes.
const feature = loadFeature('features/relances-de-la-faveur.feature');
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
