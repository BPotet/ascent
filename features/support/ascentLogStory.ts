/**
 * Aide des scénarios du Journal d'ascension (#196) : une vraie session d'ascension avec le vrai
 * enregistreur du journal et le vrai stockage des journaux, sur un Stockage clé-valeur en mémoire,
 * l'Export du journal avec un Menu de partage simulé qui garde le fichier, et une ascension posée à
 * un étage avec son journal déjà écrit.
 */
import { KeyValueAscentLogStore } from '../../src/adapters/persistence/keyValue/KeyValueAscentLogStore';
import type { SharedFile } from '../../src/application/ports/FileShare';
import { FixedSeedSource } from '../../src/application/testing/FixedSeedSource';
import { ManualBattleClock } from '../../src/application/testing/ManualBattleClock';
import {
  silentBattleHaptics,
  silentBattleSound,
} from '../../src/application/testing/recordingBattleFeedback';
import { settableClock } from '../../src/application/testing/settableClock';
import { AscentLogRecorder } from '../../src/application/useCases/AscentLogRecorder';
import { ASCENT_KEY, AscentSession } from '../../src/application/useCases/AscentSession';
import { ascentLogExport } from '../../src/application/useCases/exportAscentLog';
import type { Ascent } from '../../src/domain/ascent/Ascent';
import { beginAscentLog, type AscentLog } from '../../src/domain/ascentLog/AscentLog';
import type { Battle } from '../../src/domain/battle/Battle';
import { ENEMIES } from '../../src/domain/battle/combatants';
import type { AscentLogExport } from '../../src/domain/ascentLog/AscentLogExport';
import { Day } from '../../src/domain/day/Day';
import { playToTheEnd, settleStore, storyStore, type StoryStore } from './tiersStory';

export const LOG_DAY = Day.of(2026, 11, 3);

/** Une session d'ascension qui tient son journal, et l'Export du journal. */
export function logStory(store: StoryStore = storyStore(), seeds: readonly number[] = [3]) {
  const clock = settableClock(LOG_DAY);
  const logStore = new KeyValueAscentLogStore(store);
  const recorder = new AscentLogRecorder({ store: logStore, clock });
  const battleClock = new ManualBattleClock(1_000);
  const session = new AscentSession({
    clock: battleClock,
    seeds: new FixedSeedSource(...seeds),
    sound: silentBattleSound(),
    haptics: silentBattleHaptics(),
    keyValueStore: store,
    ascentLog: recorder,
  });
  const shared: SharedFile[] = [];
  const share = {
    share: jest.fn(async (file: SharedFile) => {
      shared.push(file);
    }),
  };
  const logExport = ascentLogExport({
    recorder,
    store: logStore,
    share,
    clock,
    appVersion: '0.3.0',
    buildChannel: 'preview',
  });
  return { store, logStore, recorder, session, battleClock, shared, share, logExport };
}

export type LogStory = ReturnType<typeof logStory>;

/** Le dernier fichier envoyé au Menu de partage. */
export function lastExport(story: LogStory): AscentLogExport {
  return JSON.parse(story.shared.at(-1)!.contents) as AscentLogExport;
}

/**
 * L'ascension `ascent` posée dans le stockage, avec son journal déjà écrit (de `log`, ou commencé
 * à son étage), comme après une pause ; `battle` est le combat sauvegardé.
 */
export async function savedWithLog(
  story: LogStory,
  ascent: Ascent,
  log: AscentLog = beginAscentLog(ascent, LOG_DAY),
  battle: unknown = null,
): Promise<void> {
  story.store.values.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent, battle }));
  const started = await story.logStore.start({ ...log, id: null }, 20);
  await story.logStore.save({ ...log, id: started.id });
}

/** Le combat sauvegardé, presque gagné : son premier ennemi à 1 PV (ses relèves faites), seul. */
export function nearlyWon(battle: Battle): Battle {
  const [first] = battle.enemies;
  const selfRevives = ENEMIES[first!.kind].selfRevive?.times ?? 0;
  const { summon: _summon, ...rest } = battle;
  return {
    ...rest,
    enemies: [{ ...first!, hp: 1, ...(selfRevives > 0 && { selfRevives, raised: true }) }],
    reserve: [],
  };
}

const savedBattle = (story: LogStory) =>
  (JSON.parse(story.store.values.get(ASCENT_KEY) ?? '{}') as { battle?: Battle | null }).battle ??
  null;

/**
 * Le combat de l'étage, commencé par la session (son début va au journal), joué jusqu'à sa
 * première sauvegarde (un impact jugé ou une action résolue), puis rendu presque gagné dans le
 * stockage, comme si l'app avait été fermée là.
 */
export async function startAndSaveBattle(story: LogStory): Promise<void> {
  story.store.values.set(
    ASCENT_KEY,
    JSON.stringify({ version: 1, ascent: story.session.current(), battle: null }),
  );
  const battleSession = story.session.battleSession();
  await battleSession.start();
  const clock = story.battleClock;
  for (let guard = 0; guard < 50 && savedBattle(story) === null; guard += 1) {
    const { battle } = battleSession.current()!;
    if (battle.phase.kind === 'hero') {
      const at = clock.now() + 50;
      clock.advanceTo(at);
      battleSession.heroAction({ kind: 'attack' }, at - 20, at);
    } else {
      clock.advanceTo(clock.pending()[0]!);
    }
    await settleStore();
  }
  await story.recorder.settled();
  const saved = JSON.parse(story.store.values.get(ASCENT_KEY)!) as { battle: Battle };
  story.store.values.set(ASCENT_KEY, JSON.stringify({ ...saved, battle: nearlyWon(saved.battle) }));
}

/** La session rouverte sur le même stockage, après une fermeture. */
export async function reopened(story: LogStory): Promise<LogStory> {
  const next = logStory(story.store);
  await next.session.load();
  return next;
}

/**
 * Le parcours d'une ascension à travers la session, jusqu'à `until` (le Sommet par défaut) : les
 * bénédictions prises, chaque combat commencé par la session puis gagné de justesse, le premier
 * bienfait, le premier objet laissé et les suivants équipés, la porte `pick` (la première par
 * défaut), les écrans du Passage de palier. Rend la session du moment.
 */
export async function climb(
  start: LogStory,
  until: (ascent: Ascent) => boolean = (ascent) => ascent.outcome !== null,
  pick: (ascent: Ascent) => number = () => 0,
): Promise<LogStory> {
  let story = start;
  let itemsFound = 0;
  for (let guard = 0; guard < 200; guard += 1) {
    const ascent = story.session.current()!;
    if (until(ascent)) break;
    if (ascent.outcome !== null) throw new Error('The ascent ended before the goal');
    if (ascent.blessingOffer !== null) story.session.chooseBlessing(0);
    else if (ascent.passage?.step === 'bossDefeated') story.session.acknowledgeBossVictory();
    else if (ascent.passage?.step === 'announce') story.session.enterNextTier();
    else if (ascent.encounter !== null) {
      await startAndSaveBattle(story);
      story = await reopened(story);
      await playToTheEnd(story.session.battleSession(), story.battleClock);
      await settleStore();
    } else if (ascent.boonOffer !== null) story.session.chooseBoon(0);
    else if (ascent.foundItem !== null) {
      itemsFound += 1;
      if (itemsFound === 1) story.session.leaveItem();
      else story.session.equipItem();
    } else story.session.chooseExit(pick(ascent));
  }
  await settleStore();
  await story.recorder.settled();
  return story;
}
