// La session d'ascension et les Déblocages (#195) : figés au début de l'ascension, sauvegardés et
// repris tels quels ; une ascension sauvegardée avant #195 n'en a aucun et garde Cœur de braise.
import { startAscent, type Ascent } from '../../domain/ascent/Ascent';
import { FixedSeedSource } from '../testing/FixedSeedSource';
import { ManualBattleClock } from '../testing/ManualBattleClock';
import { silentBattleHaptics, silentBattleSound } from '../testing/recordingBattleFeedback';
import { ASCENT_KEY, AscentSession } from './AscentSession';

function mapStore() {
  const values = new Map<string, string>();
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

function sessionOn(store: ReturnType<typeof mapStore>) {
  return new AscentSession({
    clock: new ManualBattleClock(1_000),
    seeds: new FixedSeedSource(42),
    sound: silentBattleSound(),
    haptics: silentBattleHaptics(),
    keyValueStore: store,
  });
}

async function flush(): Promise<void> {
  for (let index = 0; index < 10; index += 1) await Promise.resolve();
}

/** Une ascension sauvegardée avant #195 : sans `unlocks` ni `emberHeartOffered`. */
function savedBeforeUnlocks(change: (ascent: Ascent) => Ascent): string {
  const { unlocks: _unlocks, emberHeartOffered: _offered, ...ascent } = change(startAscent(3));
  return JSON.stringify({ version: 1, ascent, battle: null });
}

describe('AscentSession and the Unlocks (#195)', () => {
  it('saves the Unlocks of the launch and gives them back after a pause and a resume', async () => {
    const store = mapStore();
    const session = sessionOn(store);

    const begun = session.begin({ unlocks: ['flamberge', 'emberHeart'] });
    session.pause();
    await flush();

    expect(begun.unlocks).toEqual(['flamberge', 'emberHeart']);
    const resumed = await sessionOn(store).load();
    expect(resumed?.unlocks).toEqual(['flamberge', 'emberHeart']);
    expect(resumed?.emberHeartOffered).toBe(false);
  });

  it('keeps Cœur de braise already offered after a pause and a resume', async () => {
    const store = mapStore();
    store.values.set(
      ASCENT_KEY,
      JSON.stringify({
        version: 1,
        ascent: { ...startAscent(3, { unlocks: ['emberHeart'] }), emberHeartOffered: true },
        battle: null,
      }),
    );
    const session = sessionOn(store);
    await session.load();

    session.pause();
    await flush();
    const resumed = await sessionOn(store).load();

    expect(resumed?.emberHeartOffered).toBe(true);
    expect(resumed?.unlocks).toEqual(['emberHeart']);
  });

  it('keeps Cœur de braise owned in an ascent saved before the update, with no Unlock', async () => {
    const store = mapStore();
    store.values.set(
      ASCENT_KEY,
      savedBeforeUnlocks((ascent) => ({
        ...ascent,
        hero: { ...ascent.hero, boons: ['perfectEcho', 'emberHeart'] },
      })),
    );

    const resumed = await sessionOn(store).load();

    expect(resumed?.hero.boons).toEqual(['perfectEcho', 'emberHeart']);
    expect(resumed?.unlocks).toEqual([]);
    expect(resumed?.emberHeartOffered).toBe(false);
  });

  it('resumes a pending offer with Cœur de braise as it was, and Cœur de braise can be taken', async () => {
    const store = mapStore();
    store.values.set(
      ASCENT_KEY,
      savedBeforeUnlocks((ascent) => ({
        ...ascent,
        encounter: null,
        boonOffer: ['perfectEcho', 'lingeringFrost', 'emberHeart'],
      })),
    );
    const session = sessionOn(store);

    const resumed = await session.load();
    expect(resumed?.boonOffer).toEqual(['perfectEcho', 'lingeringFrost', 'emberHeart']);
    session.chooseBoon(2);

    expect(session.current()?.hero.boons).toEqual(['emberHeart']);
    expect(session.current()?.boonOffer).toBeNull();
  });
});
