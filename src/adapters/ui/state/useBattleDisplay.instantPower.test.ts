// #173 : l'état d'affichage au lancer d'un pouvoir instantané : la pose `cast`, l'instant du
// lancer (l'ombre glisse) et le mot de scène « Pas de l'ombre ».
import type { BattleSnapshot } from '../../../application/useCases/BattleSession';
import type { BattleEvent } from '../../../domain/battle/BattleEvent';
import { startTestBattle } from '../../../domain/battle/testing/testBattle';
import { INITIAL_DISPLAY, displayOf } from './useBattleDisplay';

const battle = startTestBattle({ seed: 1, defenseHint: false, at: 0, hero: 'wanderer' }).battle;

function snapshot(events: readonly BattleEvent[]): BattleSnapshot {
  return { battle, events, heroHint: false, powersHint: false };
}

const shadowStep: BattleEvent = {
  type: 'powerUsed',
  at: 1_200,
  power: 'shadowStep',
  until: 1_200,
  instant: true,
};
const bulwark: BattleEvent = { type: 'powerUsed', at: 1_200, power: 'bulwark', until: 1_700 };

describe('displayOf, the instant Shadow Step (#173)', () => {
  it('raises the daggers (cast pose) and remembers the cast for the shadow', () => {
    const display = displayOf(INITIAL_DISPLAY, snapshot([shadowStep]), false);

    expect(display).toMatchObject({ heroPose: 'cast', heroPoseSince: 1_200, shadowStepAt: 1_200 });
  });

  it("writes « Pas de l'ombre » on the scene, in its own tone, without band", () => {
    const display = displayOf(INITIAL_DISPLAY, snapshot([shadowStep]), false);

    expect(display.feedback?.texts).toEqual([{ tone: 'shadowStep', title: "Pas de l'ombre" }]);
  });

  it('leaves the Bulwark as it was: no cast pose, no word, no shadow', () => {
    const display = displayOf(INITIAL_DISPLAY, snapshot([bulwark]), false);

    expect(display).toMatchObject({ heroPose: 'idle', feedback: null, shadowStepAt: null });
  });
});
