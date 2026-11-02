// Réservé aux tests des écrans de l'ascension : une session d'ascension sur l'horloge de combat
// manuelle, une graine fixée, un son et une vibration muets, et un stockage en mémoire.
import { FixedSeedSource } from '../../../application/testing/FixedSeedSource';
import { InMemoryUnitOfWork } from '../../../application/testing/InMemoryUnitOfWork';
import { ManualBattleClock } from '../../../application/testing/ManualBattleClock';
import {
  silentBattleHaptics,
  silentBattleSound,
} from '../../../application/testing/recordingBattleFeedback';
import { settableClock } from '../../../application/testing/settableClock';
import {
  ASCENT_KEY,
  AscentSession,
  SHARD_TOTAL_KEY,
} from '../../../application/useCases/AscentSession';
import { BATTLE_HINT_SEEN_KEYS } from '../../../application/useCases/battleHints';
import type { Ascent } from '../../../domain/ascent/Ascent';
import type { Battle } from '../../../domain/battle/Battle';
import { Day } from '../../../domain/day/Day';
import type { Dependencies } from '../state/Dependencies';
import { memoryKeyValueStore } from './memoryKeyValueStore';
import { silentHaptics } from './silentHaptics';

export function ascentSetUp({
  seed = 42,
  saved,
  shards,
  battle,
}: {
  seed?: number;
  saved?: Ascent;
  /** Le combat sauvegardé avec l'ascension `saved` (#175) ; absent, aucun. */
  battle?: Battle;
  /** Le Total d'Éclats déjà stocké (#38) ; absent, aucun. */
  shards?: number;
} = {}) {
  const keyValueStore = memoryKeyValueStore();
  if (shards !== undefined) {
    keyValueStore.values.set(
      SHARD_TOTAL_KEY,
      JSON.stringify({ version: 1, total: shards, seed: null, awarded: [] }),
    );
  }
  keyValueStore.values.set(BATTLE_HINT_SEEN_KEYS.hero, '1');
  keyValueStore.values.set(BATTLE_HINT_SEEN_KEYS.defense, '1');
  if (saved !== undefined) {
    keyValueStore.values.set(
      ASCENT_KEY,
      JSON.stringify({ version: 1, ascent: saved, battle: battle ?? null }),
    );
  }
  const clock = new ManualBattleClock(10_000);
  const session = new AscentSession({
    clock,
    seeds: new FixedSeedSource(seed),
    sound: silentBattleSound(),
    haptics: silentBattleHaptics(),
    keyValueStore,
  });
  const dependencies: Dependencies = {
    clock: settableClock(Day.of(2026, 10, 27)),
    unitOfWork: new InMemoryUnitOfWork(),
    keyValueStore,
    haptics: silentHaptics(),
  };
  return { keyValueStore, clock, session, dependencies };
}
