// #236 : le choix des pouvoirs équipés (`EquippedPower`) parmi les pouvoirs possédés, sa mémoire
// par héros (`EquippedPowersMemory`, clé `camp.equippedPowers`) et la présélection du Choix du héros.
import type { PowerKind } from '../battle/powers';
import { EMPTY_CAMP, type Camp } from './camp';
import {
  isEquippedChoice,
  ownedPowers,
  parseEquippedPowersMemory,
  preselectedPowers,
  rememberEquippedPowers,
  serializeEquippedPowersMemory,
  type EquippedPowersMemory,
} from './equippedPowers';
import { powerPrice } from './powerTree';

function campWith(...powers: PowerKind[]): Camp {
  return { unlocks: [], powers: powers.map((power) => ({ power, price: powerPrice(power) })) };
}

describe('the owned powers of a hero (#236, PW6)', () => {
  it('are the base power and the unlocked powers of the hero, in the order of the tree', () => {
    const camp = campWith('crushingBlow', 'mist', 'retaliation', 'shieldBash');

    expect(ownedPowers(camp, 'sentinel')).toEqual([
      'bulwark',
      'shieldBash',
      'crushingBlow',
      'retaliation',
    ]);
    expect(ownedPowers(camp, 'wanderer')).toEqual(['shadowStep', 'mist']);
    expect(ownedPowers(EMPTY_CAMP, 'wanderer')).toEqual(['shadowStep']);
  });
});

describe('a valid choice of equipped powers (#236)', () => {
  const camp = campWith('retaliation', 'holdFast', 'shieldBash', 'crushingBlow');

  it('is exactly 3 distinct owned powers of the hero, the base power left aside or not', () => {
    expect(isEquippedChoice(camp, 'sentinel', ['shieldBash', 'crushingBlow', 'retaliation'])).toBe(
      true,
    );
    expect(isEquippedChoice(camp, 'sentinel', ['bulwark', 'holdFast', 'retaliation'])).toBe(true);
  });

  it('refuses fewer or more than 3 powers', () => {
    expect(isEquippedChoice(camp, 'sentinel', ['shieldBash', 'crushingBlow'])).toBe(false);
    expect(
      isEquippedChoice(camp, 'sentinel', ['bulwark', 'shieldBash', 'crushingBlow', 'holdFast']),
    ).toBe(false);
  });

  it('refuses a duplicate, a power of another hero, or a power not owned', () => {
    expect(isEquippedChoice(camp, 'sentinel', ['bulwark', 'bulwark', 'holdFast'])).toBe(false);
    expect(isEquippedChoice(camp, 'sentinel', ['bulwark', 'holdFast', 'mist'])).toBe(false);
    expect(
      isEquippedChoice(campWith('retaliation'), 'sentinel', ['bulwark', 'retaliation', 'holdFast']),
    ).toBe(false);
  });

  it('is every owned power with 3 owned or fewer', () => {
    const few = campWith('rend', 'mist');

    expect(isEquippedChoice(few, 'wanderer', ['mist', 'rend', 'shadowStep'])).toBe(true);
    expect(isEquippedChoice(few, 'wanderer', ['rend', 'mist'])).toBe(false);
    expect(isEquippedChoice(EMPTY_CAMP, 'sentinel', ['bulwark'])).toBe(true);
    expect(isEquippedChoice(EMPTY_CAMP, 'sentinel', [])).toBe(false);
  });
});

describe('the memory of the equipped powers (#236, `camp.equippedPowers`)', () => {
  const memory: EquippedPowersMemory = {
    sentinel: ['shieldBash', 'crushingBlow', 'retaliation'],
    wanderer: ['rend', 'flurry', 'ambush'],
  };

  it('is stored with its version, by hero, and read back', () => {
    expect(JSON.parse(serializeEquippedPowersMemory(memory))).toEqual({
      version: 1,
      heroes: memory,
    });
    expect(parseEquippedPowersMemory(serializeEquippedPowersMemory(memory))).toEqual(memory);
  });

  it('is empty when nothing is stored', () => {
    expect(parseEquippedPowersMemory(null)).toEqual({});
  });

  it.each([
    ['not JSON', '{'],
    ['null', 'null'],
    ['a wrong version', '{"version":2,"heroes":{"sentinel":["bulwark"]}}'],
    ['no heroes', '{"version":1}'],
    ['heroes that are a list', '{"version":1,"heroes":[]}'],
  ])('is empty with %s', (_, raw) => {
    expect(parseEquippedPowersMemory(raw)).toEqual({});
  });

  it('drops an unknown hero, and a hero whose list is not a list of known powers', () => {
    expect(
      parseEquippedPowersMemory(
        JSON.stringify({
          version: 1,
          heroes: {
            knight: ['bulwark'],
            sentinel: ['bulwark', 'fireball'],
            wanderer: ['rend', 'mist'],
          },
        }),
      ),
    ).toEqual({ wanderer: ['rend', 'mist'] });
    expect(
      parseEquippedPowersMemory('{"version":1,"heroes":{"sentinel":"bulwark","wanderer":[3]}}'),
    ).toEqual({});
  });

  it('remembers the choice of one hero in the order of the tree, the other kept', () => {
    const remembered = rememberEquippedPowers(memory, 'sentinel', [
      'retaliation',
      'bulwark',
      'holdFast',
    ]);

    expect(remembered).toEqual({
      sentinel: ['bulwark', 'retaliation', 'holdFast'],
      wanderer: memory.wanderer,
    });
    expect(rememberEquippedPowers({}, 'wanderer', ['rend'])).toEqual({ wanderer: ['rend'] });
  });
});

describe('the preselection of the Hero choice (#236)', () => {
  const camp = campWith('retaliation', 'holdFast', 'shieldBash', 'crushingBlow');

  it('keeps the last equipped powers of the hero when they are valid, in the order of the tree', () => {
    expect(
      preselectedPowers(
        camp,
        { sentinel: ['retaliation', 'crushingBlow', 'shieldBash'] },
        'sentinel',
      ),
    ).toEqual(['shieldBash', 'crushingBlow', 'retaliation']);
  });

  it('falls back on the base power then the order of the tree without memory', () => {
    expect(preselectedPowers(camp, {}, 'sentinel')).toEqual([
      'bulwark',
      'shieldBash',
      'crushingBlow',
    ]);
    expect(preselectedPowers(EMPTY_CAMP, {}, 'wanderer')).toEqual(['shadowStep']);
  });

  it('falls back on the default with a memory that is not valid any more', () => {
    for (const remembered of [
      ['bulwark', 'bulwark'],
      ['bulwark', 'mist'],
      ['bulwark', 'retaliation', 'holdFast', 'shieldBash'],
      [],
    ] as PowerKind[][]) {
      expect(preselectedPowers(camp, { sentinel: remembered }, 'sentinel')).toEqual([
        'bulwark',
        'shieldBash',
        'crushingBlow',
      ]);
    }
    expect(
      preselectedPowers(EMPTY_CAMP, { sentinel: ['bulwark', 'retaliation'] }, 'sentinel'),
    ).toEqual(['bulwark']);
  });

  it('fills the free slots of a partial memory with the other owned powers, in the order of purchase', () => {
    const bought = campWith('mist', 'ambush', 'rend');

    expect(preselectedPowers(bought, { wanderer: ['shadowStep', 'mist'] }, 'wanderer')).toEqual([
      'shadowStep',
      'mist',
      'ambush',
    ]);
    expect(preselectedPowers(bought, { wanderer: ['ambush'] }, 'wanderer')).toEqual([
      'shadowStep',
      'mist',
      'ambush',
    ]);
  });

  it('does not equip a 4th unlocked power by itself after a full choice', () => {
    const memory: EquippedPowersMemory = { sentinel: ['bulwark', 'retaliation', 'holdFast'] };

    expect(preselectedPowers(camp, memory, 'sentinel')).toEqual([
      'bulwark',
      'retaliation',
      'holdFast',
    ]);
  });

  it('reads one memory by hero', () => {
    const memory: EquippedPowersMemory = { sentinel: ['bulwark', 'retaliation', 'holdFast'] };
    const both = campWith('retaliation', 'holdFast', 'shieldBash', 'rend', 'mist', 'flurry');

    expect(preselectedPowers(both, memory, 'wanderer')).toEqual(['shadowStep', 'rend', 'flurry']);
  });
});
