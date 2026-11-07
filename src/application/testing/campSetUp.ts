// Réservé aux tests : une session du camp sur une vraie session d'ascension, un Stockage clé-valeur
// en mémoire qui peut faire échouer ou retenir l'écriture d'une clé, un son et une vibration muets
// qui notent ce qu'on leur demande.
import { Day } from '../../domain/day/Day';
import type { Clock } from '../ports/Clock';
import type { Haptics } from '../ports/Haptics';
import type { UnitOfWork } from '../ports/UnitOfWork';
import type { KeyValueStore } from '../ports/KeyValueStore';
import { AscentSession, SHARD_TOTAL_KEY } from '../useCases/AscentSession';
import { BATTLE_HINT_SEEN_KEYS } from '../useCases/battleHints';
import { CampSession } from '../useCases/CampSession';
import { FixedSeedSource } from './FixedSeedSource';
import { InMemoryUnitOfWork } from './InMemoryUnitOfWork';
import { ManualBattleClock } from './ManualBattleClock';
import { silentBattleHaptics, silentBattleSound } from './recordingBattleFeedback';
import { settableClock } from './settableClock';

/** Le jour des tests du camp : le samedi 7 novembre 2026. */
export const CAMP_TODAY = Day.of(2026, 11, 7);

/**
 * Un stockage en mémoire : `failing` fait échouer l'écriture d'une clé, `hold` la retient jusqu'à
 * `release`, et `writes` compte les écritures de chaque clé.
 */
export function campStore() {
  const values = new Map<string, string>([
    [BATTLE_HINT_SEEN_KEYS.hero, '1'],
    [BATTLE_HINT_SEEN_KEYS.defense, '1'],
    [BATTLE_HINT_SEEN_KEYS.powers, '1'],
  ]);
  const failing = new Set<string>();
  const failingReads = new Set<string>();
  const held = new Map<string, () => void>();
  const writes = new Map<string, number>();
  return {
    values,
    failing,
    failingReads,
    writes: (key: string) => writes.get(key) ?? 0,
    hold: (key: string) => held.set(key, () => undefined),
    release: (key: string) => {
      const resume = held.get(key);
      held.delete(key);
      resume?.();
    },
    get: async (key: string) => {
      if (failingReads.has(key)) throw new Error(`Cannot read ${key}`);
      return values.get(key) ?? null;
    },
    set: async (key: string, value: string) => {
      writes.set(key, (writes.get(key) ?? 0) + 1);
      if (held.has(key)) await new Promise<void>((resolve) => held.set(key, resolve));
      if (failing.has(key)) throw new Error(`Cannot write ${key}`);
      values.set(key, value);
    },
    remove: async (key: string) => {
      values.delete(key);
    },
  };
}

export type CampStore = ReturnType<typeof campStore>;

/** Le Total d'Éclats `total` stocké, comme l'écrit la session d'ascension. */
export function storeShardTotal(store: CampStore, total: number): void {
  store.values.set(SHARD_TOTAL_KEY, JSON.stringify({ version: 1, total, seed: null, awarded: [] }));
}

/** Un retour haptique muet qui compte les vibrations de réussite. */
export function countingHaptics(): Haptics & { readonly successes: () => number } {
  let successes = 0;
  return {
    success: () => {
      successes += 1;
    },
    successes: () => successes,
  };
}

/**
 * Une session du camp muette sur `ascentSession` et `keyValueStore` ; sans habitude, au jour des
 * tests du camp, sauf horloge ou unité de travail données.
 */
export function campSessionOf(
  ascentSession: AscentSession,
  keyValueStore: KeyValueStore,
  { clock, unitOfWork }: { readonly clock?: Clock; readonly unitOfWork?: UnitOfWork } = {},
): CampSession {
  return new CampSession({
    keyValueStore,
    ascentSession,
    sound: silentBattleSound(),
    haptics: countingHaptics(),
    clock: clock ?? settableClock(CAMP_TODAY),
    unitOfWork: unitOfWork ?? new InMemoryUnitOfWork(),
  });
}

/** Une session d'ascension et une session du camp sur `store` : une nouvelle app sur ce stockage. */
export function campSetUp(store: CampStore = campStore(), seed = 3) {
  const sound = silentBattleSound();
  const haptics = countingHaptics();
  const ascentSession = new AscentSession({
    clock: new ManualBattleClock(1_000),
    seeds: new FixedSeedSource(seed),
    sound: silentBattleSound(),
    haptics: silentBattleHaptics(),
    keyValueStore: store,
  });
  const clock = settableClock(CAMP_TODAY);
  const unitOfWork = new InMemoryUnitOfWork();
  const camp = new CampSession({
    keyValueStore: store,
    ascentSession,
    sound,
    haptics,
    clock,
    unitOfWork,
  });
  return { store, ascentSession, camp, sound, haptics, clock, unitOfWork };
}

/** Laisse passer les écritures en attente. */
export async function settle(): Promise<void> {
  for (let index = 0; index < 10; index += 1) await Promise.resolve();
}
