// L'Éclatement de la Cosse de braise (`EmberBurst`, #267, ADR 0028) : la règle pure de la chute
// (EC1, EC2, EC4, EC5) et la lecture de sa marque de signature (D5).
import { emberBurstOnFall, emberBurstPrimed } from './emberBurst';
import { ENEMIES } from './combatants';

const POD = { kind: 'emberPod' as const, stun: null, hp: 45 };
const STUNNED = { ...POD, stun: { heroAction: 1, actionLost: false } };
const FALL = { at: 1_200, enemy: 2, won: false };

describe('the Burst of a falling Ember pod (#267, EC1)', () => {
  it('gives the hero its 2 stacks of Burn, added to his own: 1 becomes 3', () => {
    expect(emberBurstOnFall(POD, { ...FALL, heroBurn: 1 })).toEqual({
      burn: 3,
      events: [
        { type: 'heroBurning', at: 1_200, added: 2, stacks: 3, cause: 'emberBurst', enemy: 2 },
      ],
    });
  });

  it('lights a hero who was not burning', () => {
    expect(emberBurstOnFall(POD, { ...FALL, heroBurn: undefined })).toEqual({
      burn: 2,
      events: [
        { type: 'heroBurning', at: 1_200, added: 2, stacks: 2, cause: 'emberBurst', enemy: 2 },
      ],
    });
  });

  it('stops at 5 stacks, and is still seen and heard at 5 (added 0)', () => {
    expect(emberBurstOnFall(POD, { ...FALL, heroBurn: 4 }).events).toEqual([
      { type: 'heroBurning', at: 1_200, added: 1, stacks: 5, cause: 'emberBurst', enemy: 2 },
    ]);
    expect(emberBurstOnFall(POD, { ...FALL, heroBurn: 5 })).toEqual({
      burn: 5,
      events: [
        { type: 'heroBurning', at: 1_200, added: 0, stacks: 5, cause: 'emberBurst', enemy: 2 },
      ],
    });
  });

  it('reads its stacks from the profile, never scaled: 2', () => {
    expect(ENEMIES.emberPod.emberBurst).toEqual({ stacks: 2 });
  });
});

describe('a stunned Ember pod is smothered (#267, EC2)', () => {
  it('lights nothing, and says it is smothered', () => {
    expect(emberBurstOnFall(STUNNED, { ...FALL, heroBurn: 1 })).toEqual({
      burn: 1,
      events: [{ type: 'emberBurstSmothered', at: 1_200, enemy: 2 }],
    });
  });
});

describe('the fall that wins the battle (#267, EC4)', () => {
  it.each([
    ['standing', POD],
    ['stunned', STUNNED],
  ])('lights nothing and shows nothing, %s', (_, pod) => {
    expect(emberBurstOnFall(pod, { ...FALL, won: true, heroBurn: 1 })).toEqual({
      burn: 1,
      events: [],
    });
  });
});

describe('an enemy without a Burst', () => {
  it('lights nothing when it falls', () => {
    expect(emberBurstOnFall({ ...POD, kind: 'burningHusk' }, { ...FALL, heroBurn: 2 })).toEqual({
      burn: 2,
      events: [],
    });
  });
});

describe('the mark of the Burst (#267, D5)', () => {
  it('is lit on a standing Ember pod, not stunned: « Braises 2 »', () => {
    expect(emberBurstPrimed(POD)).toBe(true);
  });

  it('is struck through while it is stunned, and on a fallen pod', () => {
    expect(emberBurstPrimed(STUNNED)).toBe(false);
    expect(emberBurstPrimed({ ...POD, hp: 0 })).toBe(false);
  });

  it('is never lit on another enemy', () => {
    expect(emberBurstPrimed({ ...POD, kind: 'mothkin' })).toBe(false);
  });
});
