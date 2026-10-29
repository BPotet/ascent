/**
 * Scénario « Limite — les réglages d'essai déjà enregistrés » du retrait du combat d'essai (#121),
 * côté règles : exécuté à travers la session d'ascension (`AscentSession`) et sa session de combat,
 * avec l'horloge de combat manuelle (`ManualBattleClock`). Les réglages d'essai changés sont la
 * valeur que le panneau Réglages d'essai enregistrait (`battle.trialTuning`).
 *
 * « Plus rien ne permet de les changer » : aucun code de l'app ne lit ni n'écrit plus cette clé.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { FixedSeedSource } from '../../src/application/testing/FixedSeedSource';
import { ManualBattleClock } from '../../src/application/testing/ManualBattleClock';
import {
  silentBattleHaptics,
  silentBattleSound,
} from '../../src/application/testing/recordingBattleFeedback';
import { AscentSession } from '../../src/application/useCases/AscentSession';
import { BATTLE_HINT_SEEN_KEYS } from '../../src/application/useCases/battleHints';
import type { BattleSession } from '../../src/application/useCases/BattleSession';
import type { BattleEvent } from '../../src/domain/battle/BattleEvent';

const TRIAL_TUNING_KEY = 'battle.trialTuning';
const sourceDirectory = path.resolve(__dirname, '../../src');

interface World {
  values: Map<string, string>;
  clock: ManualBattleClock;
  battleSession: BattleSession;
  events: BattleEvent[];
}

let world: World;

/** Les fichiers de code livrés de `directory`, récursivement (sans tests ni aides de test). */
function shippedFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === 'testing' ? [] : shippedFiles(file);
    return /\.tsx?$/u.test(entry.name) && !/\.test\.tsx?$/u.test(entry.name) ? [file] : [];
  });
}

async function flush(): Promise<void> {
  for (let index = 0; index < 5; index += 1) await Promise.resolve();
}

const steps: StepDefinitions = ({ given, when, then, and }) => {
  given("un téléphone sur lequel des réglages d'essai ont été changés", () => {
    world = {
      values: new Map([
        [BATTLE_HINT_SEEN_KEYS.hero, '1'],
        [BATTLE_HINT_SEEN_KEYS.defense, '1'],
        [TRIAL_TUNING_KEY, JSON.stringify({ phaseTransitionMs: 1_200, stepInMs: 100 })],
      ]),
    } as World;
  });

  when("le joueur entre dans un combat de l'ascension", async () => {
    const { values } = world;
    const clock = new ManualBattleClock(1_000);
    const session = new AscentSession({
      clock,
      // Une graine où le héros ouvre le combat du 1er étage.
      seeds: new FixedSeedSource(1),
      sound: silentBattleSound(),
      haptics: silentBattleHaptics(),
      keyValueStore: {
        get: async (key) => values.get(key) ?? null,
        set: async (key, value) => {
          values.set(key, value);
        },
        remove: async (key) => {
          values.delete(key);
        },
      },
    });
    session.begin();
    const battleSession = session.battleSession();
    const events: BattleEvent[] = [];
    battleSession.subscribe((snapshot) => events.push(...snapshot.events));
    await battleSession.start();
    world = { ...world, clock, battleSession, events };
  });

  then(
    "la transition de phase dure 800 ms et l'avancée 400 ms, les valeurs du glossaire",
    async () => {
      const { clock, battleSession, events } = world;
      expect(battleSession.current()!.battle.phase.kind).toBe('hero');
      const at = clock.now() + 50;
      clock.advanceTo(at);
      battleSession.heroAction({ kind: 'attack' }, at - 20, at);
      for (let guard = 0; guard < 20; guard += 1) {
        if (events.some((event) => event.type === 'stepInStarted')) break;
        clock.advanceTo(clock.pending()[0]!);
        await flush();
      }
      const transition = events.find((event) => event.type === 'phaseTransitionStarted')!;
      const stepIn = events.find((event) => event.type === 'stepInStarted')!;
      expect(transition.until - transition.at).toBe(800);
      expect(stepIn.until - stepIn.at).toBe(400);
    },
  );

  and('plus rien ne permet de les changer', () => {
    const readers = shippedFiles(sourceDirectory).filter((file) =>
      /trialTuning|TrialTuning|TRIAL_TUNING/u.test(readFileSync(file, 'utf8')),
    );
    expect(readers).toEqual([]);
    // La valeur enregistrée reste orpheline : ni relue, ni réécrite.
    expect(JSON.parse(world.values.get(TRIAL_TUNING_KEY)!)).toEqual({
      phaseTransitionMs: 1_200,
      stepInMs: 100,
    });
  });
};

// Les scénarios d'interface (`@ui`) sont laissés aux étapes des routes de l'app.
const feature = loadFeature('features/combat-essai-retire.feature');
autoBindSteps(
  [{ ...feature, scenarios: feature.scenarios.filter(({ tags }) => !tags.includes('@ui')) }],
  [steps],
);
