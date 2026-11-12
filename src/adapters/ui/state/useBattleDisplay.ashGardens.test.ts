// L'état d'affichage des Jardins de cendre (#267, maquette 246, J2, J4, J7, J9, J10) : la chute de la
// Cosse de braise (éclatée ou étouffée), ses 2 flammes vers le héros 200 ms après, l'étiquette de la
// Brûlure cerclée, et le losange d'Élan volé 300 ms après l'impact, la barre baissant avec lui.
import type { BattleSnapshot } from '../../../application/useCases/BattleSession';
import { startBattle, type Battle } from '../../../domain/battle/Battle';
import type { BattleEvent } from '../../../domain/battle/BattleEvent';
import { INITIAL_DISPLAY, displayOf, momentumShown } from './useBattleDisplay';

const gardens: Battle = startBattle({
  seed: 1,
  defenseHint: false,
  at: 0,
  enemies: ['thievingMoth', 'ashBramble', 'emberPod'],
}).battle;

function snapshot(events: readonly BattleEvent[], battle: Battle = gardens): BattleSnapshot {
  return { battle, events, heroHint: false, powersHint: false };
}

const fell: BattleEvent = { type: 'enemyDefeated', at: 600, enemy: 2 };
const burst: BattleEvent = {
  type: 'heroBurning',
  at: 600,
  added: 2,
  stacks: 3,
  cause: 'emberBurst',
  enemy: 2,
};
const stolen: BattleEvent = { type: 'momentumStolen', at: 1_000, enemy: 0, stolen: 1, momentum: 2 };

describe('the fall of the Ember pod (#267)', () => {
  it('bursts: the pose of the Burst, 2 flames to the hero 200 ms later, the Burn label ringed (J7)', () => {
    const display = displayOf(INITIAL_DISPLAY, snapshot([fell, burst]), false);

    expect(display.podFalls).toEqual({ 2: { at: 600, kind: 'burst' } });
    expect(display.emberFlames).toEqual({ key: 1, enemy: 2, at: 600, delayMs: 200 });
    expect(display.burnRing).toEqual({ kind: 'new', key: 1 });
    expect(display.feedback?.texts).toEqual([
      { tone: 'ember', title: 'Elle éclate', sub: 'Brûlure ×3' },
    ]);
  });

  it('still bursts and rings at 5 stacks, though nothing is added (J10)', () => {
    const capped: BattleEvent = { ...burst, added: 0, stacks: 5 } as BattleEvent;
    const display = displayOf(INITIAL_DISPLAY, snapshot([fell, capped]), false);

    expect(display.emberFlames).not.toBeNull();
    expect(display.burnRing?.kind).toBe('new');
  });

  it('goes out in smoke when smothered: no flame, no ring (J9)', () => {
    const display = displayOf(
      INITIAL_DISPLAY,
      snapshot([fell, { type: 'emberBurstSmothered', at: 600, enemy: 2 }]),
      false,
    );

    expect(display.podFalls).toEqual({ 2: { at: 600, kind: 'smothered' } });
    expect(display.emberFlames).toBeNull();
    expect(display.burnRing).toBeNull();
    expect(display.feedback?.texts).toEqual([
      { tone: 'smoke', title: 'Éteinte', sub: 'Achevée étourdie · pas de Brûlure' },
    ]);
  });

  it('forgets the fall when a reinforcement takes its place', () => {
    const fallen = displayOf(INITIAL_DISPLAY, snapshot([fell, burst]), false);
    const entered = displayOf(
      fallen,
      snapshot([{ type: 'reinforcementEntered', at: 2_000, enemy: 2, kind: 'mothkin' }]),
      false,
    );

    expect(entered.podFalls).toEqual({});
  });
});

describe('the momentum stolen by the Thieving moth (#267)', () => {
  it('sends the diamond 300 ms after the impact, with « −1 Élan » (J2)', () => {
    const display = displayOf(INITIAL_DISPLAY, snapshot([stolen]), false);

    expect(display.theft).toEqual({ key: 1, enemy: 0, stolen: 1, at: 1_000, delayMs: 300 });
  });

  it('keeps the stolen diamond in the bar until it leaves, never before', () => {
    const display = displayOf(INITIAL_DISPLAY, snapshot([stolen]), false);

    expect(momentumShown(2, display, false)).toBe(3);
    expect(momentumShown(2, display, true)).toBe(2);
    expect(momentumShown(2, INITIAL_DISPLAY, false)).toBe(2);
  });

  it('shows no diamond and no word when nothing is stolen (J4)', () => {
    const display = displayOf(
      INITIAL_DISPLAY,
      snapshot([
        {
          type: 'blowResolved',
          at: 1_000,
          enemy: 0,
          index: 0,
          outcome: 'suffered',
          button: null,
          delta: null,
          damage: 4,
          heroHp: 56,
        },
      ]),
      false,
    );

    expect(display.theft).toBeNull();
    expect(display.heroFloat?.float.text).toBe('−4');
  });
});
