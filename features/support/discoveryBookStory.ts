/**
 * Aides des scénarios du carnet de découvertes (#282) : un Stockage clé-valeur en mémoire, une vraie
 * session d'ascension avec une vraie session du carnet (« fermeture forcée » : de nouvelles sessions
 * sur le même stockage), et le jeu d'un combat, le héros attaquant à chaque tour.
 */
import { startAscent, type Ascent } from '../../src/domain/ascent/Ascent';
import { startBattle, type Battle } from '../../src/domain/battle/Battle';
import type { BattleEvent } from '../../src/domain/battle/BattleEvent';
import type { EnemyKind } from '../../src/domain/battle/combatants';
import {
  EMPTY_DISCOVERY_BOOK,
  parseDiscoveryBook,
  type DiscoveryBook,
} from '../../src/domain/discoveryBook/DiscoveryBook';
import { FixedSeedSource } from '../../src/application/testing/FixedSeedSource';
import { ManualBattleClock } from '../../src/application/testing/ManualBattleClock';
import {
  silentBattleHaptics,
  silentBattleSound,
} from '../../src/application/testing/recordingBattleFeedback';
import { ASCENT_KEY, AscentSession } from '../../src/application/useCases/AscentSession';
import { BATTLE_HINT_SEEN_KEYS } from '../../src/application/useCases/battleHints';
import type { BattleSession } from '../../src/application/useCases/BattleSession';
import {
  DISCOVERY_BOOK_KEY,
  DiscoveryBookSession,
} from '../../src/application/useCases/DiscoveryBookSession';

/** Un Stockage clé-valeur en mémoire, ses écritures notées dans l'ordre ; les bulles d'aide vues. */
export function bookStore(initial: Readonly<Record<string, string>> = {}) {
  const values = new Map<string, string>([
    [BATTLE_HINT_SEEN_KEYS.hero, '1'],
    [BATTLE_HINT_SEEN_KEYS.defense, '1'],
    ...Object.entries(initial),
  ]);
  const writes: [string, string][] = [];
  return {
    values,
    writes,
    get: async (key: string) => values.get(key) ?? null,
    set: async (key: string, value: string) => {
      writes.push([key, value]);
      values.set(key, value);
    },
    remove: async (key: string) => {
      values.delete(key);
    },
  };
}

export type BookStore = ReturnType<typeof bookStore>;

/** Une app ouverte sur `store` : la session d'ascension (graine `seed`) et la session du carnet. */
export async function openApp(store: BookStore, seed = 5, withBook = true) {
  const clock = new ManualBattleClock(1_000);
  const book = new DiscoveryBookSession({ keyValueStore: store });
  const session = new AscentSession({
    clock,
    seeds: new FixedSeedSource(seed),
    sound: silentBattleSound(),
    haptics: silentBattleHaptics(),
    keyValueStore: store,
    ...(withBook && { discoveryBook: book }),
  });
  await session.load();
  await book.load();
  return { clock, book, session };
}

export type OpenApp = Awaited<ReturnType<typeof openApp>>;

export async function settle(): Promise<void> {
  for (let index = 0; index < 30; index += 1) await Promise.resolve();
}

/**
 * Joue le combat jusqu'à `until` (par défaut sa fin) : le héros attaque à son tour, sinon le temps
 * avance. Rend les événements de chaque mise à jour.
 */
export async function playBattle(
  battleSession: BattleSession,
  clock: ManualBattleClock,
  until: (battle: Battle) => boolean = () => false,
): Promise<BattleEvent[]> {
  const events: BattleEvent[] = [];
  const stop = battleSession.subscribe((snapshot) => events.push(...snapshot.events));
  for (let guard = 0; guard < 600; guard += 1) {
    const { battle } = battleSession.current()!;
    if (until(battle) || battle.phase.kind === 'over') {
      await settle();
      stop();
      return events;
    }
    if (battle.phase.kind === 'hero') {
      const at = clock.now() + 50;
      clock.advanceTo(at);
      battleSession.heroAction({ kind: 'attack' }, at - 20, at);
    } else {
      clock.advanceTo(clock.pending()[0]!);
    }
    await settle();
  }
  throw new Error('The battle never ended');
}

/** Passe l'objet trouvé, le coffre scellé et l'offre de bienfaits : jusqu'aux sorties. */
export function toExits(session: AscentSession): void {
  if (session.current()!.foundItem !== null) session.leaveItem();
  if (session.current()!.sealedChest !== null) session.leaveSealedChest();
  if (session.current()!.boonOffer !== null) session.chooseBoon(0);
}

/** Le carnet écrit dans le stockage. */
export function storedBook(store: BookStore): DiscoveryBook {
  return parseDiscoveryBook(store.values.get(DISCOVERY_BOOK_KEY) ?? null).book;
}

/** L'état de chaque entrée écrite du carnet, par nom de code. */
export function storedStates(store: BookStore): Record<string, string> {
  return Object.fromEntries(
    Object.entries(storedBook(store).enemies).map(([kind, { state }]) => [kind, state]),
  );
}

/** L'ascension et son combat sauvegardés, devant `enemies` (la réserve au-delà de la 3e place). */
export function saveBattle(
  store: BookStore,
  enemies: readonly EnemyKind[],
  change: (battle: Battle) => Battle = (battle) => battle,
  ascent: Ascent = startAscent(7),
): Battle {
  const battle = change(
    startBattle({ seed: 3, defenseHint: false, at: 500, initiative: true, enemies }).battle,
  );
  store.values.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent, battle }));
  return battle;
}

export { EMPTY_DISCOVERY_BOOK };
