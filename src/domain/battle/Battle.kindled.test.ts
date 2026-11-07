// #237 : un pouvoir attisé (`KindledPower`) coûte 1 Élan de moins, au moins 1, pour tout le combat ;
// `powerCost` est la seule règle du coût. Sans attisé, le combat est le même, JSON compris.
import {
  heroAction,
  powerAvailability,
  powerCost,
  startBattle,
  type Battle,
  type BattleOptions,
} from './Battle';
import { TEST_BATTLE_ENEMIES } from './testing/testBattle';

function start(options: Partial<BattleOptions> = {}): Battle {
  return startBattle({
    seed: 7,
    defenseHint: false,
    at: 0,
    enemies: TEST_BATTLE_ENEMIES,
    ...options,
  }).battle;
}

const withMomentum = (battle: Battle, momentum: number): Battle => ({
  ...battle,
  hero: { ...battle.hero, momentum },
});

describe('a kindled power in battle (#237)', () => {
  it('costs 1 Momentum less: 2 → 1 and 3 → 2', () => {
    const sentinel = start({
      powers: ['bulwark', 'retaliation', 'holdFast'],
      kindled: ['retaliation', 'holdFast'],
    });

    expect(powerCost(sentinel, 'retaliation')).toBe(1);
    expect(powerCost(sentinel, 'holdFast')).toBe(2);
  });

  it('never costs under 1 Momentum', () => {
    const battle = start({ powers: ['bulwark'], kindled: ['bulwark'] });

    expect(powerCost(battle, 'bulwark')).toBe(1);
  });

  it('keeps the price of a power that is not kindled', () => {
    const battle = start({ powers: ['bulwark', 'retaliation'], kindled: ['retaliation'] });

    expect(powerCost(battle, 'bulwark')).toBe(1);
    expect(powerCost(start({ powers: ['bulwark', 'retaliation'] }), 'retaliation')).toBe(2);
  });

  it('lets the Wanderer cast a kindled Shadow Step with 2 Momentum, leaving 0', () => {
    const battle = withMomentum(
      start({ hero: 'wanderer', powers: ['shadowStep'], kindled: ['shadowStep'] }),
      2,
    );

    expect(powerAvailability(battle, 'shadowStep')).toEqual({ kind: 'available' });
    const cast = heroAction(battle, {
      action: { kind: 'power', power: 'shadowStep' },
      touchStartedAt: 950,
      releasedAt: 1_000,
    });
    expect(cast.battle.hero.momentum).toBe(0);
    expect(cast.battle.hero.shadowStep).toBe(true);
  });

  it('says how much is missing at the kindled cost', () => {
    const battle = withMomentum(
      start({ powers: ['bulwark', 'retaliation', 'holdFast'], kindled: ['holdFast'] }),
      1,
    );

    expect(powerAvailability(battle, 'holdFast')).toEqual({ kind: 'missing', missing: 1 });
  });

  it('keeps the kindled powers in the battle, and saves none without them', () => {
    expect(start({ kindled: ['bulwark'] }).kindled).toEqual(['bulwark']);
    expect(start({ kindled: [] })).not.toHaveProperty('kindled');
    expect(JSON.stringify(start({ kindled: [] }))).toBe(JSON.stringify(start()));
  });
});
