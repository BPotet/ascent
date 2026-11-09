// Les Épines dans la session de combat (#259) : la vibration courte attend la fin de la frappe,
// puis 300 ms (maquette M2, M3) ; une seule pour une Rafale ; rien à 1 PV ; rien après la fin.
import { startBattle, type BattleOptions } from '../../domain/battle/Battle';
import type { BattleEvent } from '../../domain/battle/BattleEvent';
import type { BattleHapticCue } from '../ports/BattleHaptics';
import { FixedSeedSource } from '../testing/FixedSeedSource';
import { ManualBattleClock } from '../testing/ManualBattleClock';
import { silentBattleSound } from '../testing/recordingBattleFeedback';
import { BATTLE_HINT_SEEN_KEYS } from './battleHints';
import { THORNS_AFTER_STRIKE_MS } from './battleFeedback';
import { BattleSession } from './BattleSession';

const START = 1_000;

/** La Mère-ronce seule face au héros, les bulles déjà vues, et chaque vibration datée. */
function setUp(options: Partial<BattleOptions> = {}) {
  const clock = new ManualBattleClock(START);
  const values = new Map<string, string>([
    ...Object.values(BATTLE_HINT_SEEN_KEYS).map((key) => [key, '1'] as const),
    ['battle.hint.encounter.brambleMother.seen', '1'],
  ]);
  const keyValueStore = {
    get: async (key: string) => values.get(key) ?? null,
    set: async (key: string, value: string) => void values.set(key, value),
    remove: async (key: string) => void values.delete(key),
  };
  const felt: { readonly cue: BattleHapticCue; readonly at: number }[] = [];
  const haptics = { play: (cue: BattleHapticCue) => felt.push({ cue, at: clock.now() }) };
  const session = new BattleSession(
    { clock, seeds: new FixedSeedSource(7, 8), sound: silentBattleSound(), haptics, keyValueStore },
    {
      createBattle: (start) => {
        const update = startBattle({ ...start, enemies: ['brambleMother'], ...options });
        const battle = { ...update.battle, hero: { ...update.battle.hero, momentum: 5 } };
        return { ...update, battle };
      },
    },
  );
  const resolvedAt: { readonly event: BattleEvent; readonly at: number }[] = [];
  session.subscribe(({ events }) => {
    for (const event of events) {
      if (event.type === 'strikeResolved') resolvedAt.push({ event, at: clock.now() });
    }
  });
  const thorns = () => felt.filter(({ cue }) => cue === 'thorns');
  return { clock, session, felt, thorns, resolvedAt };
}

describe('the vibration of the Thorns in the battle session (#259)', () => {
  it('vibrates once, 300 ms after the strike that pricks, not at once', async () => {
    const context = setUp({ heroHp: 30 });
    await context.session.start();

    context.session.heroAction({ kind: 'attack' }, 1_940, 2_000);
    context.clock.advanceTo(2_999);
    const [resolved] = context.resolvedAt;

    expect(resolved).toBeDefined();
    expect(context.thorns()).toEqual([]);
    context.clock.advanceTo(resolved!.at + THORNS_AFTER_STRIKE_MS - 1);
    expect(context.thorns()).toEqual([]);
    context.clock.advanceTo(resolved!.at + THORNS_AFTER_STRIKE_MS);
    expect(context.thorns()).toEqual([
      { cue: 'thorns', at: resolved!.at + THORNS_AFTER_STRIKE_MS },
    ]);
  });

  it('waits for the last of the 4 hits of a Flurry, then vibrates once, 300 ms later', async () => {
    const context = setUp({ hero: 'wanderer', heroHp: 30, powers: ['flurry'] });
    await context.session.start();

    context.session.heroAction({ kind: 'power', power: 'flurry' }, 1_940, 2_000);
    context.clock.advanceTo(6_000);
    const last = context.resolvedAt.at(-1)!;

    expect(context.resolvedAt.map(({ event }) => (event as { hit?: number }).hit)).toEqual([
      1, 2, 3, 4,
    ]);
    expect(context.thorns()).toEqual([{ cue: 'thorns', at: last.at + THORNS_AFTER_STRIKE_MS }]);
  });

  it('does not vibrate when the Thorns take nothing, at 1 HP', async () => {
    const context = setUp({ heroHp: 1 });
    await context.session.start();

    context.session.heroAction({ kind: 'attack' }, 1_940, 2_000);
    context.clock.advanceTo(6_000);

    expect(context.resolvedAt).not.toEqual([]);
    expect(context.thorns()).toEqual([]);
  });

  it('cancels the vibration still to come when the battle stops', async () => {
    const context = setUp({ heroHp: 30 });
    await context.session.start();

    context.session.heroAction({ kind: 'attack' }, 1_940, 2_000);
    context.clock.advanceTo(2_999);
    context.session.dispose();
    context.clock.advanceTo(6_000);

    expect(context.thorns()).toEqual([]);
  });
});
