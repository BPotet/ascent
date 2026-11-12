/**
 * « Les Jardins de cendre, l'Éclatement et le Vol d'Élan » (#267) à travers une session de combat,
 * sur un Stockage clé-valeur en mémoire : la bulle de première rencontre de la Phalène voleuse et de
 * la Cosse de braise.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { FixedSeedSource } from '../../src/application/testing/FixedSeedSource';
import { ManualBattleClock } from '../../src/application/testing/ManualBattleClock';
import {
  silentBattleHaptics,
  silentBattleSound,
} from '../../src/application/testing/recordingBattleFeedback';
import { encounterHintKey } from '../../src/application/useCases/battleHints';
import { BattleSession, type BattleSnapshot } from '../../src/application/useCases/BattleSession';
import { startBattle } from '../../src/domain/battle/Battle';
import type { EnemyKind } from '../../src/domain/battle/combatants';
import { settleStore, storyStore, type StoryStore } from '../support/tiersStory';

interface World {
  store: StoryStore;
  session: BattleSession;
  first: BattleSnapshot;
}

let world = {} as World;

/** Une session de combat contre `enemies`, sur le stockage du scénario. */
function battleSession(enemies: readonly EnemyKind[]): BattleSession {
  return new BattleSession(
    {
      clock: new ManualBattleClock(1_000),
      seeds: new FixedSeedSource(3),
      sound: silentBattleSound(),
      haptics: silentBattleHaptics(),
      keyValueStore: world.store,
    },
    { createBattle: (options) => startBattle({ ...options, enemies }) },
  );
}

const steps: StepDefinitions = ({ given, when, then, and }) => {
  given(/^un joueur qui n'a jamais rencontré la Phalène voleuse$/u, () => {
    world = { store: storyStore() } as World;
    expect(world.store.values.has(encounterHintKey('thievingMoth'))).toBe(false);
  });

  when(/^un combat avec une Phalène voleuse commence$/u, async () => {
    world.session = battleSession(['mothkin', 'thievingMoth']);
    world.first = await world.session.start();
  });

  then(/^la bulle de première rencontre « Phalène voleuse » s'affiche, sans rien bloquer$/u, () => {
    expect(world.first.encounterHint).toBe('thievingMoth');
    expect(world.first.battle.phase.kind).toBe('hero');
  });

  and(/^le premier toucher la ferme$/u, async () => {
    world.session.heroAction({ kind: 'attack' }, 1_100, 1_200);
    expect(world.session.current()!.encounterHint).toBeUndefined();
    await settleStore();
    expect(world.store.values.get(encounterHintKey('thievingMoth'))).toBe('1');
  });

  and(/^elle ne revient plus dans les combats suivants$/u, async () => {
    expect((await battleSession(['thievingMoth']).start()).encounterHint).toBeUndefined();
  });

  and(/^il en va de même pour la Cosse de braise avec sa propre bulle$/u, async () => {
    const pod = battleSession(['emberPod', 'thievingMoth']);
    expect((await pod.start()).encounterHint).toBe('emberPod');
    pod.dismissEncounterHint();
    await settleStore();
    expect(world.store.values.get(encounterHintKey('emberPod'))).toBe('1');
    expect((await battleSession(['emberPod']).start()).encounterHint).toBeUndefined();
  });
};

// Les sessions seules : `@domain` et `@ui` ont leurs propres étapes.
const feature = loadFeature('features/jardins-eclatement-vol-d-elan.feature');
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
