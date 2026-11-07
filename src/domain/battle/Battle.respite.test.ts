// Le répit par palier (#244, R3) : 10 % des PV max au palier 1, 5 % aux paliers 2 et 3, entier
// inférieur, sans dépasser le maximum ; un combat sauvegardé avant #244, sans `respitePercent`, garde
// 10 %.
import {
  RESPITE_PERCENT,
  advance,
  heroAction,
  nextDeadline,
  startBattle,
  type Battle,
} from './Battle';
import type { BattleEvent } from './BattleEvent';

function lastBlow(heroMaxHp: number, heroHp: number, respitePercent?: number): Battle {
  const { battle } = startBattle({
    seed: 7,
    defenseHint: false,
    at: 0,
    heroHp,
    heroMaxHp,
    enemies: ['ghoul'],
    ...(respitePercent !== undefined && { respitePercent }),
  });
  return { ...battle, enemies: battle.enemies.map((enemy) => ({ ...enemy, hp: 1 })) };
}

/** Le combat joué jusqu'à la victoire : le héros frappe l'ennemi à 1 PV. */
function respiteOf(battle: Battle): Extract<BattleEvent, { type: 'respite' }> {
  let current = battle;
  const events: BattleEvent[] = [];
  for (let step = 0; step < 50 && current.phase.kind !== 'over'; step += 1) {
    const update =
      current.phase.kind === 'hero'
        ? heroAction(current, {
            action: { kind: 'attack' },
            touchStartedAt: current.now + 50,
            releasedAt: current.now + 100,
          })
        : advance(current, nextDeadline(current)!.at + 40);
    current = update.battle;
    events.push(...update.events);
  }
  return events.find((event) => event.type === 'respite') as Extract<
    BattleEvent,
    { type: 'respite' }
  >;
}

describe('the respite of the tier (#244, R3)', () => {
  it.each([
    [80, 10, 8],
    [80, 5, 4],
    [92, 10, 9],
    [92, 5, 4],
  ])('gives a hero at 50 of %i max HP, at %i %, %i HP', (maxHp, percent, gain) => {
    expect(respiteOf(lastBlow(maxHp, 50, percent))).toMatchObject({ gain, heroHp: 50 + gain });
  });

  it('never goes above the maximum: 78 of 80 at 5 % gets back to 80', () => {
    expect(respiteOf(lastBlow(80, 78, 5))).toMatchObject({ gain: 2, heroHp: 80 });
  });

  it('keeps the respite percent in the battle, saved with it', () => {
    expect(lastBlow(80, 50, 5).respitePercent).toBe(5);
    expect(lastBlow(80, 50)).not.toHaveProperty('respitePercent');
  });

  it('gives 10 % to a battle saved before #244, without respitePercent', () => {
    expect(RESPITE_PERCENT).toBe(10);
    expect(respiteOf(lastBlow(80, 50))).toMatchObject({ gain: 8, heroHp: 58 });
  });
});
