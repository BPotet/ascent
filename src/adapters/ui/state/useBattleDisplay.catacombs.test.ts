// L'état d'affichage des Catacombes (#268, maquette 246, C2, C4) : la petite flamme sur le chiffre
// d'un coup renforcé par l'Aura, et la chute du Porte-cierge : son cierge soufflé, le mot de scène,
// et les « +20 % » de ses alliés qui se barrent.
import type { BattleSnapshot } from '../../../application/useCases/BattleSession';
import { startBattle, type Battle } from '../../../domain/battle/Battle';
import type { BattleEvent } from '../../../domain/battle/BattleEvent';
import { INITIAL_DISPLAY, displayOf } from './useBattleDisplay';

const catacombs: Battle = startBattle({
  seed: 1,
  defenseHint: false,
  at: 0,
  enemies: ['ghoul', 'candleBearer', 'cryptRat'],
}).battle;

const fallen = (battle: Battle, index: number): Battle => ({
  ...battle,
  enemies: battle.enemies.map((enemy, position) =>
    position === index ? { ...enemy, hp: 0 } : enemy,
  ),
});

function snapshot(events: readonly BattleEvent[], battle: Battle = catacombs): BattleSnapshot {
  return { battle, events, heroHint: false, powersHint: false };
}

const blow: BattleEvent = {
  type: 'blowResolved',
  at: 1_100,
  enemy: 0,
  index: 0,
  outcome: 'suffered',
  button: null,
  delta: null,
  damage: 5,
  heroHp: 75,
};

describe('the damage of a blow under the Aura (#268, C2)', () => {
  it('carries the small flame of the Aura', () => {
    const display = displayOf(
      INITIAL_DISPLAY,
      snapshot([{ ...blow, aura: 1 } as BattleEvent]),
      false,
    );

    expect(display.heroFloat?.float).toEqual({
      at: 'hero',
      text: '−5',
      big: false,
      kind: 'damage',
      aura: true,
    });
  });

  it('carries no flame without the Aura', () => {
    const display = displayOf(INITIAL_DISPLAY, snapshot([blow]), false);

    expect(display.heroFloat?.float).not.toHaveProperty('aura');
  });
});

describe('the fall of the Candle bearer (#268, C4)', () => {
  const fell: BattleEvent = { type: 'enemyDefeated', at: 600, enemy: 1 };

  it('blows his candle out, writes « L’aura s’éteint » and strikes through the « +20 % » of his allies', () => {
    const display = displayOf(INITIAL_DISPLAY, snapshot([fell], fallen(catacombs, 1)), false);

    expect(display.candleFalls).toEqual({ 1: 600 });
    expect(display.auraOut).toEqual({ key: 1, at: 600, enemies: [0, 2] });
    expect(display.feedback?.texts).toEqual([
      { tone: 'aura', title: 'L’aura s’éteint', sub: 'Ses alliés reviennent à leurs dégâts' },
    ]);
  });

  it('strikes through nobody when no ally stood under his Aura', () => {
    const alone = fallen(fallen(fallen(catacombs, 0), 2), 1);
    const display = displayOf(INITIAL_DISPLAY, snapshot([fell], alone), false);

    expect(display.candleFalls).toEqual({ 1: 600 });
    expect(display.auraOut).toBeNull();
  });

  it('forgets the fall when another enemy takes his place', () => {
    const blown = displayOf(INITIAL_DISPLAY, snapshot([fell], fallen(catacombs, 1)), false);
    const entered: BattleEvent = { type: 'reinforcementEntered', at: 900, enemy: 1, kind: 'ghoul' };

    expect(displayOf(blown, snapshot([entered]), false).candleFalls).toEqual({});
  });
});
