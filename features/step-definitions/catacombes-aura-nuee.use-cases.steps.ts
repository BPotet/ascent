/**
 * « Les Catacombes, l'Aura et la Nuée » (#268) à travers une session de combat, sur un Stockage
 * clé-valeur en mémoire : la bulle de première rencontre du Porte-cierge, et aucune pour les Rats
 * de crypte, dont la plaque ne porte pas de marque.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { battleView } from '../../src/adapters/ui/state/battleView';
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
  given(/^un joueur qui n'a jamais rencontré le Porte-cierge$/u, () => {
    world = { store: storyStore() } as World;
    expect(world.store.values.has(encounterHintKey('candleBearer'))).toBe(false);
  });

  when(/^un combat avec un Porte-cierge commence$/u, async () => {
    world.session = battleSession(['ghoul', 'candleBearer', 'cryptRat']);
    world.first = await world.session.start();
  });

  then(/^la bulle de première rencontre « Porte-cierge » s'affiche, sans rien bloquer$/u, () => {
    expect(world.first.encounterHint).toBe('candleBearer');
    expect(world.first.battle.phase.kind).toBe('hero');
  });

  and(/^le premier toucher la ferme$/u, async () => {
    world.session.heroAction({ kind: 'attack' }, 1_100, 1_200);
    expect(world.session.current()!.encounterHint).toBeUndefined();
    await settleStore();
    expect(world.store.values.get(encounterHintKey('candleBearer'))).toBe('1');
  });

  and(/^elle ne revient plus dans les combats suivants$/u, async () => {
    expect((await battleSession(['candleBearer', 'ghoul']).start()).encounterHint).toBeUndefined();
  });

  given(/^un premier combat avec des Rats de crypte$/u, async () => {
    world = { store: storyStore() } as World;
    world.session = battleSession(['cryptRat', 'cryptRat', 'cryptRat']);
    world.first = await world.session.start();
  });

  then(/^aucune bulle de première rencontre ne s'affiche pour eux$/u, async () => {
    expect(world.first.encounterHint).toBeUndefined();
    world.session.heroAction({ kind: 'attack' }, 1_100, 1_200);
    await settleStore();
    expect(world.store.values.has(encounterHintKey('cryptRat'))).toBe(false);
    // Avec un Porte-cierge, c'est lui que la bulle présente, jamais un Rat.
    const mixed = await battleSession(['cryptRat', 'candleBearer']).start();
    expect(mixed.encounterHint).toBe('candleBearer');
  });

  and(/^leur plaque ne porte aucune marque de signature$/u, () => {
    const { enemies } = battleView(world.first.battle);
    expect(enemies.map((enemy) => enemy.kind)).toEqual(['cryptRat', 'cryptRat', 'cryptRat']);
    for (const enemy of enemies) expect(enemy).not.toHaveProperty('signature');
  });
};

// Les sessions seules : `@domain` et `@ui` ont leurs propres étapes.
const feature = loadFeature('features/catacombes-aura-nuee.feature');
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
