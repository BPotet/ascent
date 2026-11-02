// La Brûlure à l'écran (#171, maquette 170, B1 à B7) : ce que la scène, l'étiquette, le chiffre et
// le lecteur d'écran tirent des événements de la Brûlure.
import type { BattleSnapshot } from '../../../application/useCases/BattleSession';
import type { Battle } from '../../../domain/battle/Battle';
import type { BattleEvent } from '../../../domain/battle/BattleEvent';
import { startTestBattle } from '../../../domain/battle/testing/testBattle';
import { INITIAL_DISPLAY, announcementsOf, displayOf } from './useBattleDisplay';

const started = startTestBattle({ seed: 1, defenseHint: false, at: 0 }).battle;
const withBurn = (burn?: number): Battle => ({
  ...started,
  hero: burn === undefined ? started.hero : { ...started.hero, burn },
});

function snapshot(events: readonly BattleEvent[], battle: Battle = started): BattleSnapshot {
  return { battle, events, heroHint: false };
}

const display = (events: readonly BattleEvent[], battle?: Battle) =>
  displayOf(INITIAL_DISPLAY, snapshot(events, battle), false);

const touched: BattleEvent = {
  type: 'blowResolved',
  at: 1_000,
  enemy: 0,
  index: 0,
  outcome: 'suffered',
  button: null,
  delta: null,
  damage: 4,
  heroHp: 76,
};

describe('the Burn in the display state (#171)', () => {
  it('starts without flame being lit nor put out, without ring nor number', () => {
    expect(INITIAL_DISPLAY).toMatchObject({
      burnFx: { lit: null, ticked: null, out: null },
      burnRing: null,
      burnFloat: null,
    });
  });

  it('lights the new flames from the first new stack, with the ember burst, and rings the chip', () => {
    const shown = display([touched, { type: 'heroBurning', at: 1_000, added: 2, stacks: 3 }]);

    expect(shown.burnFx.lit).toEqual({ at: 1_000, from: 1 });
    expect(shown.burnRing).toEqual({ kind: 'new', key: 1 });
  });

  it('still bursts and rings the chip at 5 stacks, lighting nothing', () => {
    const first = display([{ type: 'heroBurning', at: 1_000, added: 1, stacks: 5 }]);
    const again = displayOf(
      first,
      snapshot([{ type: 'heroBurning', at: 2_000, added: 0, stacks: 5 }]),
      false,
    );

    expect(again.burnFx.lit).toEqual({ at: 2_000, from: 5 });
    expect(again.burnRing).toEqual({ kind: 'new', key: 2 });
  });

  it('puts the last flame out 80 ms after a perfect parry or a dodge, and lowers the chip', () => {
    const shown = display([{ type: 'burnExtinguished', at: 1_000, stacks: 2, cause: 'blow' }]);

    expect(shown.burnFx.out).toEqual({ at: 1_080, slots: [2] });
    expect(shown.burnRing).toEqual({ kind: 'down', key: 1 });
  });

  it('grows the flames with the crackle and puts the last one out 800 ms later (B7)', () => {
    const shown = display([
      { type: 'burnTicked', at: 1_000, loss: 2, heroHp: 70, stacks: 2 },
      { type: 'burnExtinguished', at: 1_000, stacks: 1, cause: 'round' },
    ]);

    expect(shown.burnFx.ticked).toBe(1_000);
    expect(shown.burnFx.out).toEqual({ at: 1_800, slots: [1] });
  });

  it('waits 700 ms after the Bleed of the round, then puts the flame out at 1 500 ms (B5)', () => {
    const shown = display([
      { type: 'bleedTicked', at: 1_000, loss: 2, heroHp: 72, roundsLeft: 2 },
      { type: 'burnTicked', at: 1_000, loss: 3, heroHp: 69, stacks: 3 },
      { type: 'burnExtinguished', at: 1_000, stacks: 2, cause: 'round' },
    ]);

    expect(shown.burnFx.ticked).toBe(1_700);
    expect(shown.burnFx.out).toEqual({ at: 2_500, slots: [2] });
  });

  it('puts every flame out together at the end of the battle, without a ring', () => {
    const before = displayOf(INITIAL_DISPLAY, snapshot([], withBurn(3)), false);

    const shown = displayOf(before, snapshot([{ type: 'burnCleared', at: 3_000 }]), false);

    expect(shown.burnFx.out).toEqual({ at: 3_000, slots: [0, 1, 2] });
    expect(shown.burnRing).toBeNull();
  });

  it('flies an ember « −3 » on the hero at the start of a round, apart from the other numbers', () => {
    const shown = display([{ type: 'burnTicked', at: 1_000, loss: 3, heroHp: 70, stacks: 3 }]);

    expect(shown.burnFloat).toEqual({
      float: { at: 'hero', text: '−3', big: false, kind: 'burn' },
      key: 1,
      delayMs: 0,
    });
    expect(shown.heroFloat).toBeNull();
    expect(shown.float).toBeNull();
  });

  it('flies the number of the Burn after the one of the Bleed, which stays', () => {
    const shown = display([
      { type: 'bleedTicked', at: 1_000, loss: 2, heroHp: 72, roundsLeft: 2 },
      { type: 'burnTicked', at: 1_000, loss: 3, heroHp: 69, stacks: 3 },
    ]);

    expect(shown.heroFloat?.float.text).toBe('−2');
    expect(shown.burnFloat).toMatchObject({
      float: { text: '−3' },
      delayMs: 700,
    });
  });

  it('flies no number on the floor of 1 HP, but still grows the flames (B7)', () => {
    const shown = display([{ type: 'burnTicked', at: 1_000, loss: 0, heroHp: 1, stacks: 2 }]);

    expect(shown.burnFloat).toBeNull();
    expect(shown.burnFx.ticked).toBe(1_000);
  });
});

describe('the Burn at the screen reader (#171)', () => {
  const said = (events: readonly BattleEvent[]) => announcementsOf(snapshot(events));

  it('says the stacks and the damage they will do, after the blow', () => {
    expect(said([touched, { type: 'heroBurning', at: 1_000, added: 1, stacks: 1 }])).toEqual([
      'Touché, 4 dégâts',
      'Brûlure, 1 charge, 1 dégât',
    ]);
    expect(said([{ type: 'heroBurning', at: 1_000, added: 2, stacks: 3 }])).toEqual([
      'Brûlure, 3 charges, 3 dégâts',
    ]);
    expect(said([{ type: 'heroBurning', at: 1_000, added: 0, stacks: 5 }])).toEqual([
      'Brûlure, 5 charges, 5 dégâts',
    ]);
  });

  it('says a flame goes out, then the stacks left, on a perfect parry or a dodge', () => {
    expect(said([{ type: 'burnExtinguished', at: 1_000, stacks: 2, cause: 'blow' }])).toEqual([
      "Une flamme s'éteint. Brûlure, 2 charges, 2 dégâts",
    ]);
    expect(said([{ type: 'burnExtinguished', at: 1_000, stacks: 0, cause: 'blow' }])).toEqual([
      "Une flamme s'éteint",
    ]);
  });

  it('says the HP lost at the start of a round, then the flame going out', () => {
    expect(
      said([
        { type: 'burnTicked', at: 1_000, loss: 3, heroHp: 70, stacks: 3 },
        { type: 'burnExtinguished', at: 1_000, stacks: 2, cause: 'round' },
      ]),
    ).toEqual(['Brûlure, moins 3 PV', "Une flamme s'éteint"]);
    expect(said([{ type: 'burnTicked', at: 1_000, loss: 0, heroHp: 1, stacks: 2 }])).toEqual([]);
  });

  it('says nothing when the flames go out at the end of the battle', () => {
    expect(said([{ type: 'burnCleared', at: 3_000 }])).toEqual([]);
  });
});
