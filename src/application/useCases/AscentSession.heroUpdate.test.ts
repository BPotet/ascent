// #173 : une ascension en cours, sauvegardée avec l'Errante d'avant le Codex `wanderer` v3 (60 PV
// max, Pas de l'ombre à 2 Élan, non instantané), est conservée telle quelle : ses PV restent ceux
// de la sauvegarde ; les règles du pouvoir (3 Élan, instantané) s'appliquent tout de suite.
import { startAscent, type Ascent } from '../../domain/ascent/Ascent';
import { startBattle, type Battle } from '../../domain/battle/Battle';
import { FixedSeedSource } from '../testing/FixedSeedSource';
import { ManualBattleClock } from '../testing/ManualBattleClock';
import { silentBattleHaptics, silentBattleSound } from '../testing/recordingBattleFeedback';
import { ASCENT_KEY, AscentSession } from './AscentSession';
import { BATTLE_HINT_SEEN_KEYS } from './battleHints';

function setUp() {
  const values = new Map<string, string>([
    [BATTLE_HINT_SEEN_KEYS.hero, '1'],
    [BATTLE_HINT_SEEN_KEYS.defense, '1'],
  ]);
  const store = {
    get: async (key: string) => values.get(key) ?? null,
    set: async (key: string, value: string) => void values.set(key, value),
    remove: async (key: string) => void values.delete(key),
  };
  const clock = new ManualBattleClock(1_000);
  const sound = silentBattleSound();
  const haptics = silentBattleHaptics();
  const session = new AscentSession({
    clock,
    seeds: new FixedSeedSource(42),
    sound,
    haptics,
    keyValueStore: store,
  });
  return { values, clock, sound, haptics, session };
}

/** L'ascension de l'Errante d'avant le Codex `wanderer` v3 : 60 PV max. */
function oldWandererAscent(hp: number): Ascent {
  const ascent = startAscent(5, { hero: 'wanderer' });
  return { ...ascent, hero: { ...ascent.hero, hp, maxHp: 60 } };
}

/** Son combat sauvegardé, contre une Goule seule. */
function oldWandererBattle(change: Partial<Battle> = {}): Battle {
  const { battle } = startBattle({
    seed: 3,
    defenseHint: false,
    at: 0,
    hero: 'wanderer',
    heroHp: 60,
    heroMaxHp: 60,
    enemies: ['ghoul'],
  });
  return { ...battle, ...change };
}

async function resume(saved: { readonly ascent: Ascent; readonly battle: Battle | null }) {
  const test = setUp();
  test.values.set(ASCENT_KEY, JSON.stringify({ version: 1, ...saved }));
  await test.session.load();
  const battleSession = test.session.battleSession();
  await battleSession.start();
  return { ...test, battleSession };
}

describe('an ascent saved with the Wanderer at 60 HP max (#173)', () => {
  it('keeps her 60 HP max in the ascent and in its next battle', async () => {
    const { session, battleSession } = await resume({
      ascent: oldWandererAscent(60),
      battle: null,
    });

    expect(session.current()!.hero).toMatchObject({ kind: 'wanderer', hp: 60, maxHp: 60 });
    expect(battleSession.current()!.battle.hero).toMatchObject({ hp: 60, maxHp: 60 });
  });

  it('keeps her 60 HP max in the saved battle', async () => {
    const { battleSession } = await resume({
      ascent: oldWandererAscent(60),
      battle: oldWandererBattle(),
    });

    expect(battleSession.current()!.battle.hero).toMatchObject({ hp: 60, maxHp: 60 });
  });

  it('ends a battle saved during the old Shadow Step, an action, as before', async () => {
    const { battleSession, clock } = await resume({
      ascent: oldWandererAscent(60),
      battle: oldWandererBattle({
        phase: { kind: 'heroPower', power: 'shadowStep', since: 0, until: 500 },
        hero: { hp: 60, maxHp: 60, momentum: 0, bulwark: false, shadowStep: true },
        lastPlayed: 'hero',
        heroActions: 1,
      }),
    });

    clock.advanceTo(clock.pending()[0]!);
    expect(battleSession.current()!.battle.phase).toMatchObject({
      kind: 'transition',
      to: 'enemy',
    });
    expect(battleSession.current()!.battle.hero.shadowStep).toBe(true);
  });

  it('leaves the Shadow Step unavailable at 2 momentum in that ascent', async () => {
    const { battleSession, clock } = await resume({
      ascent: oldWandererAscent(60),
      battle: oldWandererBattle({ hero: { ...oldWandererBattle().hero, momentum: 2 } }),
    });
    const at = clock.now() + 50;
    clock.advanceTo(at);
    battleSession.heroAction({ kind: 'power', power: 'shadowStep' }, at - 20, at);

    expect(battleSession.current()!.battle.hero).toMatchObject({ momentum: 2 });
    expect(battleSession.current()!.battle.hero.shadowStep).not.toBe(true);
  });

  it('casts it at 3 momentum as an instant power: the Bulwark sound, no phase cue', async () => {
    const { battleSession, clock, sound, haptics } = await resume({
      ascent: oldWandererAscent(60),
      battle: oldWandererBattle({ hero: { ...oldWandererBattle().hero, momentum: 3 } }),
    });
    const at = clock.now() + 50;
    clock.advanceTo(at);
    battleSession.heroAction({ kind: 'power', power: 'shadowStep' }, at - 20, at);

    expect(battleSession.current()!.battle).toMatchObject({
      hero: { momentum: 0, shadowStep: true },
      phase: { kind: 'hero', instantPowerUsed: true },
    });
    expect(sound.played).toEqual(['bulwark']);
    expect(haptics.played).toEqual([]);
    expect(clock.pending()).toEqual([]);
  });
});
