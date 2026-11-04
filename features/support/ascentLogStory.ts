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
import {
  acknowledgeBossVictory,
  chooseBlessing,
  chooseBoon,
  chooseExit,
  endFloorBattle,
  enterNextTier,
  equipItem,
  type Ascent,
} from '../../src/domain/ascent/Ascent';
import {
  beginAscentLog,
  recordAscentStep,
  type AscentLog,
  type AscentStep,
} from '../../src/domain/ascentLog/AscentLog';
import type { AscentLogExport } from '../../src/domain/ascentLog/AscentLogExport';
import { Day } from '../../src/domain/day/Day';
import { storyStore, type StoryStore } from './tiersStory';

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

/**
 * Le parcours d'une ascension, transition par transition, avec le journal qui l'observe : les
 * bénédictions prises, chaque combat gagné à quelques PV de moins, le premier bienfait, l'objet
 * équipé, la porte `pick` (la première par défaut), jusqu'à `until` (le Sommet par défaut).
 */
export function climb(
  start: Ascent,
  until: (ascent: Ascent) => boolean = (ascent) => ascent.outcome !== null,
  pick: (ascent: Ascent) => number = () => 0,
): { readonly ascent: Ascent; readonly log: AscentLog } {
  let ascent = start;
  let log = beginAscentLog(start, LOG_DAY);
  const step = (kind: AscentStep['kind'], after: Ascent, full?: AscentStep) => {
    log = recordAscentStep(log, full ?? ({ kind, before: ascent, after } as AscentStep));
    ascent = after;
  };
  for (let guard = 0; guard < 200 && !until(ascent); guard += 1) {
    if (ascent.blessingOffer !== null) step('blessingChosen', chooseBlessing(ascent, 0));
    else if (ascent.passage?.step === 'bossDefeated')
      step('bossAcknowledged', acknowledgeBossVictory(ascent));
    else if (ascent.passage?.step === 'announce') step('tierEntered', enterNextTier(ascent));
    else if (ascent.encounter !== null) {
      const vitals = { hp: ascent.hero.hp, maxHp: ascent.hero.maxHp, momentum: 1 };
      step('battleStarted', ascent, {
        kind: 'battleStarted',
        hero: vitals,
        before: ascent,
        after: ascent,
      });
      const heroHp = Math.max(1, ascent.hero.hp - 3);
      const after = endFloorBattle(ascent, { outcome: 'victory', heroHp });
      step('battleEnded', after, {
        kind: 'battleEnded',
        hero: { ...vitals, hp: heroHp, momentum: 3 },
        before: ascent,
        after,
      });
    } else if (ascent.boonOffer !== null) step('boonChosen', chooseBoon(ascent, 0));
    else if (ascent.foundItem !== null) step('itemEquipped', equipItem(ascent));
    else step('exitChosen', chooseExit(ascent, pick(ascent)));
  }
  return { ascent, log };
}
