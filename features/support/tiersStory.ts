/**
 * Aide des scénarios des paliers et des Éclats (#38) : un Stockage clé-valeur en mémoire qui peut
 * retenir l'écriture d'une clé, une session d'ascension sur l'horloge de combat manuelle, une
 * ascension posée devant un combat, et le combat joué jusqu'à sa fin, le héros attaquant à son tour.
 */
import { FixedSeedSource } from '../../src/application/testing/FixedSeedSource';
import { ManualBattleClock } from '../../src/application/testing/ManualBattleClock';
import {
  silentBattleHaptics,
  silentBattleSound,
} from '../../src/application/testing/recordingBattleFeedback';
import { ASCENT_KEY, AscentSession } from '../../src/application/useCases/AscentSession';
import { BATTLE_HINT_SEEN_KEYS } from '../../src/application/useCases/battleHints';
import type { BattleSession } from '../../src/application/useCases/BattleSession';
import { startAscent, type Ascent, type Encounter } from '../../src/domain/ascent/Ascent';
import { startBattle, type Battle } from '../../src/domain/battle/Battle';
import type { BattleEvent } from '../../src/domain/battle/BattleEvent';
import { ENEMIES, type EnemyKind } from '../../src/domain/battle/combatants';

/** Un stockage en mémoire ; `hold` retient l'écriture d'une clé jusqu'à `release`. */
export function storyStore() {
  const values = new Map<string, string>([
    [BATTLE_HINT_SEEN_KEYS.hero, '1'],
    [BATTLE_HINT_SEEN_KEYS.defense, '1'],
  ]);
  const held = new Map<string, () => void>();
  return {
    values,
    hold: (key: string) => held.set(key, () => undefined),
    release: (key: string) => {
      const resume = held.get(key);
      held.delete(key);
      resume?.();
    },
    get: async (key: string) => values.get(key) ?? null,
    set: async (key: string, value: string) => {
      if (held.has(key)) await new Promise<void>((resolve) => held.set(key, resolve));
      values.set(key, value);
    },
    remove: async (key: string) => {
      values.delete(key);
    },
  };
}

export type StoryStore = ReturnType<typeof storyStore>;

export function storySession(store: StoryStore) {
  const clock = new ManualBattleClock(1_000);
  const session = new AscentSession({
    clock,
    seeds: new FixedSeedSource(3),
    sound: silentBattleSound(),
    haptics: silentBattleHaptics(),
    keyValueStore: store,
  });
  return { clock, session };
}

/** L'ascension de graine 3 au palier `tier`, devant `enemies` : à l'étage 6 pour un boss, 3 sinon. */
export function ascentBefore(
  tier: 1 | 2 | 3,
  kind: Encounter['kind'],
  enemies: readonly EnemyKind[],
): Ascent {
  return {
    ...startAscent(3),
    tier,
    floor: kind === 'boss' ? 6 : 3,
    encounter: { kind, enemies, battleSeed: 3 },
  };
}

/**
 * L'ascension sauvegardée devant son combat, son premier ennemi à 1 PV, ses relèves de Se relève
 * seul déjà faites (l'Épouvantail tombe pour de bon), le héros à 50 PV.
 */
export function saveBefore(store: StoryStore, ascent: Ascent, battleToo = true): void {
  const { battle } = startBattle({
    seed: 3,
    defenseHint: false,
    at: 0,
    heroHp: 50,
    enemies: ascent.encounter!.enemies,
  });
  const [first] = battle.enemies;
  const selfRevives = ENEMIES[first!.kind].selfRevive?.times ?? 0;
  const nearlyWon: Battle = {
    ...battle,
    enemies: [{ ...first!, hp: 1, ...(selfRevives > 0 && { selfRevives, raised: true }) }],
  };
  store.values.set(
    ASCENT_KEY,
    JSON.stringify({ version: 1, ascent, battle: battleToo ? nearlyWon : null }),
  );
}

async function flush(): Promise<void> {
  for (let index = 0; index < 10; index += 1) await Promise.resolve();
}

/** Le combat joué jusqu'à sa fin : ses événements et son dernier état. */
export async function playToTheEnd(
  battleSession: BattleSession,
  clock: ManualBattleClock,
): Promise<{ readonly battle: Battle; readonly events: BattleEvent[] }> {
  const events: BattleEvent[] = [];
  battleSession.subscribe((snapshot) => events.push(...snapshot.events));
  await battleSession.start();
  for (let guard = 0; guard < 200; guard += 1) {
    const battle = battleSession.current()!.battle;
    if (battle.phase.kind === 'over') {
      await flush();
      return { battle, events };
    }
    if (battle.phase.kind === 'hero') {
      const at = clock.now() + 50;
      clock.advanceTo(at);
      battleSession.heroAction({ kind: 'attack' }, at - 20, at);
    } else {
      clock.advanceTo(clock.pending()[0]!);
    }
    await flush();
  }
  throw new Error('The battle never ended');
}

export { flush as settleStore };
