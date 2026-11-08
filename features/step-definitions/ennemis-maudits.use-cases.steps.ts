/**
 * Scénarios `@session` de « Ennemis maudits » (#209) : la lecture de la jauge (`getFateGauge`) et
 * une vraie session d'ascension, sur un stockage en mémoire. « Hier » et « aujourd'hui » sont deux
 * sessions sur le même stockage ; la jauge d'aujourd'hui ne touche pas l'ascension en cours.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { FixedSeedSource } from '../../src/application/testing/FixedSeedSource';
import { ManualBattleClock } from '../../src/application/testing/ManualBattleClock';
import {
  silentBattleHaptics,
  silentBattleSound,
} from '../../src/application/testing/recordingBattleFeedback';
import { settableClock } from '../../src/application/testing/settableClock';
import { ASCENT_KEY, AscentSession } from '../../src/application/useCases/AscentSession';
import { BATTLE_HINT_SEEN_KEYS } from '../../src/application/useCases/battleHints';
import { getFateGauge, type FateGaugeReading } from '../../src/application/useCases/fateGauge';
import { Day } from '../../src/domain/day/Day';
import type { Battle } from '../../src/domain/battle/Battle';
import { chooseExit, endFloorBattle, startAscent } from '../../src/domain/ascent/Ascent';
import type { FateGauge } from '../../src/domain/ascent/fateGauge';
import type { UnitOfWork } from '../../src/application/ports/UnitOfWork';

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

/** Un stockage des habitudes qui ne peut pas être lu. */
const unreadable = {
  run: async () => {
    throw new Error('The habits cannot be read');
  },
} as unknown as UnitOfWork;

let store: ReturnType<typeof mapStore>;
let session: AscentSession;
let reading: FateGaugeReading;
let todayGauge: FateGauge;
let battle: Battle;

function newSession(): AscentSession {
  return new AscentSession({
    clock: new ManualBattleClock(1_000),
    seeds: new FixedSeedSource(5),
    sound: silentBattleSound(),
    haptics: silentBattleHaptics(),
    keyValueStore: store,
  });
}

async function fight(): Promise<Battle> {
  const battleSession = session.battleSession();
  await battleSession.start();
  return battleSession.current()!.battle;
}

const steps: StepDefinitions = ({ given, when, then, and }) => {
  given(/^les habitudes ne peuvent pas être lues au lancement$/u, async () => {
    store = mapStore();
    reading = await getFateGauge({
      clock: settableClock(Day.of(2026, 11, 5)),
      unitOfWork: unreadable,
      keyValueStore: store,
    });
    session = newSession();
    session.begin({ gauge: reading.gauge });
  });

  when(/^le héros entre dans un combat ordinaire$/u, async () => {
    expect(session.current()!.encounter!.kind).toBe('combat');
    battle = await fight();
  });

  then(/^la jauge est Neutre et aucun ennemi n'est maudit$/u, () => {
    expect(reading).toMatchObject({ gauge: 0, unreadable: true });
    expect(session.current()!.encounter!.cursed).toBeUndefined();
    expect(battle.enemies.some((enemy) => enemy.cursed)).toBe(false);
  });

  given(/^une ascension lancée hier avec une jauge de −2, toujours en cours$/u, () => {
    store = mapStore();
    // Entre deux étages, la porte Élite proposée ; la graine choisie tire le Chevalier déchu.
    const saved = [5, 6, 7, 8, 9, 10, 11, 12]
      .map((seed) => {
        const ascent = endFloorBattle(startAscent(seed, { gauge: -2 }), {
          outcome: 'victory',
          heroHp: 50,
        });
        return { ...ascent, boonOffer: null, exits: [{ kind: 'elite', groupSize: null } as const] };
      })
      .find((ascent) => chooseExit(ascent, 0).encounter!.enemies[0] === 'fallenKnight')!;
    store.values.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent: saved, battle: null }));
  });

  and(/^la jauge d'aujourd'hui vaut \+2$/u, () => {
    todayGauge = 2;
  });

  when(/^le joueur reprend l'ascension et passe la porte Élite$/u, async () => {
    session = newSession();
    expect((await session.load())!.gauge).not.toBe(todayGauge);
    session.chooseExit(0);
    battle = await fight();
  });

  then(/^le Chevalier déchu est maudit$/u, () => {
    expect(session.current()!.gauge).toBe(-2);
    // #257 : 160 PV au palier 1 (80 %), puis +20 % maudit.
    expect(battle.enemies[0]).toMatchObject({ kind: 'fallenKnight', maxHp: 192, cursed: true });
  });
};

// La session seule : `@domain` et `@ui` ont leurs propres étapes.
const feature = loadFeature('features/ennemis-maudits.feature');
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
