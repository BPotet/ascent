// #270 : les règles du menu des pouvoirs (`PowersMenu`) — le nombre de places, la case qui coche ou
// décoche un pouvoir du brouillon, les pouvoirs nouveaux (`NewPower`, clé `camp.newPowers`), équipés
// tout seuls ou en attente d'une place.
import type { PowerKind } from '../battle/powers';
import { EMPTY_CAMP, type Camp } from './camp';
import {
  equippedSlots,
  newPowerStanding,
  parseNewPowers,
  serializeNewPowers,
  toggleEquippedPower,
} from './equippedPowers';
import { powerPrice } from './powerTree';

function campWith(...powers: PowerKind[]): Camp {
  return { unlocks: [], powers: powers.map((power) => ({ power, price: powerPrice(power) })) };
}

describe('the slots of the equipped powers of a hero (#270)', () => {
  it('are min(3, owned)', () => {
    expect(equippedSlots(EMPTY_CAMP, 'sentinel')).toBe(1);
    expect(equippedSlots(campWith('retaliation'), 'sentinel')).toBe(2);
    expect(equippedSlots(campWith('retaliation', 'holdFast'), 'sentinel')).toBe(3);
    expect(equippedSlots(campWith('retaliation', 'holdFast', 'shieldBash'), 'sentinel')).toBe(3);
    expect(equippedSlots(campWith('retaliation', 'holdFast', 'shieldBash'), 'wanderer')).toBe(1);
  });
});

describe('a toggle of the powers menu (#270, M1 to M3)', () => {
  const camp = campWith('rend', 'mist', 'flurry', 'ambush');

  it('unchecks a checked power, the base power too', () => {
    expect(
      toggleEquippedPower(camp, 'wanderer', ['shadowStep', 'rend', 'mist'], 'shadowStep'),
    ).toEqual({ kind: 'unchecked', powers: ['rend', 'mist'] });
    expect(toggleEquippedPower(camp, 'wanderer', ['shadowStep', 'rend', 'mist'], 'mist')).toEqual({
      kind: 'unchecked',
      powers: ['shadowStep', 'rend'],
    });
  });

  it('checks a power while a slot is free, in the order of the tree', () => {
    expect(toggleEquippedPower(camp, 'wanderer', ['mist', 'rend'], 'flurry')).toEqual({
      kind: 'checked',
      powers: ['rend', 'flurry', 'mist'],
    });
  });

  it('refuses a 4th power and leaves the draft as it is (M2)', () => {
    const draft: readonly PowerKind[] = ['shadowStep', 'rend', 'mist'];

    expect(toggleEquippedPower(camp, 'wanderer', draft, 'flurry')).toEqual({
      kind: 'refused',
      powers: draft,
    });
  });

  it('refuses a power that is not owned, or of the other hero', () => {
    const few = campWith('rend');

    expect(toggleEquippedPower(few, 'wanderer', ['shadowStep'], 'mist')).toEqual({
      kind: 'refused',
      powers: ['shadowStep'],
    });
    expect(toggleEquippedPower(few, 'wanderer', ['shadowStep'], 'bulwark')).toEqual({
      kind: 'refused',
      powers: ['shadowStep'],
    });
  });

  it('counts the slots of a hero with 2 powers', () => {
    const two = campWith('retaliation');

    expect(toggleEquippedPower(two, 'sentinel', ['bulwark'], 'retaliation')).toEqual({
      kind: 'checked',
      powers: ['bulwark', 'retaliation'],
    });
    expect(toggleEquippedPower(two, 'sentinel', ['bulwark', 'retaliation'], 'holdFast')).toEqual({
      kind: 'refused',
      powers: ['bulwark', 'retaliation'],
    });
  });
});

describe('the new powers of a hero (#270, M8, M9, T4)', () => {
  it('are equipped by themselves when they are in the preselection, waiting otherwise', () => {
    expect(
      newPowerStanding(['bulwark', 'retaliation', 'holdFast'], ['holdFast'], 'sentinel'),
    ).toEqual({ autoEquipped: ['holdFast'], waiting: [] });
    expect(newPowerStanding(['shadowStep', 'rend', 'mist'], ['flurry'], 'wanderer')).toEqual({
      autoEquipped: [],
      waiting: ['flurry'],
    });
  });

  it('ignore the new powers of the other hero', () => {
    expect(newPowerStanding(['bulwark'], ['flurry', 'retaliation'], 'sentinel')).toEqual({
      autoEquipped: [],
      waiting: ['retaliation'],
    });
  });

  it('follow the order of the tree', () => {
    expect(
      newPowerStanding(['shadowStep', 'rend', 'mist'], ['ambush', 'mist', 'flurry'], 'wanderer'),
    ).toEqual({ autoEquipped: ['mist'], waiting: ['flurry', 'ambush'] });
  });
});

describe('the stored new powers (#270, `camp.newPowers`)', () => {
  it('are stored with their version and read back', () => {
    const powers: readonly PowerKind[] = ['flurry', 'holdFast'];

    expect(JSON.parse(serializeNewPowers(powers))).toEqual({ version: 1, powers });
    expect(parseNewPowers(serializeNewPowers(powers))).toEqual(powers);
  });

  it.each([
    ['nothing stored', null],
    ['not JSON', '{'],
    ['null', 'null'],
    ['a wrong version', '{"version":2,"powers":["flurry"]}'],
    ['no powers', '{"version":1}'],
    ['powers that are not a list', '{"version":1,"powers":"flurry"}'],
  ])('are empty with %s', (_, raw) => {
    expect(parseNewPowers(raw)).toEqual([]);
  });

  it('drop an unknown code, a duplicate and a base power', () => {
    expect(
      parseNewPowers(
        JSON.stringify({
          version: 1,
          powers: ['flurry', 'fireball', 'flurry', 'bulwark', 3, 'shadowStep', 'holdFast'],
        }),
      ),
    ).toEqual(['flurry', 'holdFast']);
  });
});
