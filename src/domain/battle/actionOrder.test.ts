// L'ordre d'action (#32, C1) : le héros, puis les ennemis debout de gauche à droite.
import { actionOrder, initiativeOrder } from './actionOrder';

describe('actionOrder (C1)', () => {
  it('puts the hero first, then the standing enemies from left to right', () => {
    expect(actionOrder([{ hp: 50 }, { hp: 35 }, { hp: 45 }])).toEqual(['hero', 0, 1, 2]);
  });

  it('leaves out the fallen enemies', () => {
    expect(actionOrder([{ hp: 0 }, { hp: 35 }, { hp: 0 }])).toEqual(['hero', 1]);
  });
});

// L'ordre d'action par Initiative (#90, P14).
describe('initiativeOrder (P14)', () => {
  const ghoul = { hp: 50, initiative: 4 };
  const specter = { hp: 35, initiative: 8 };
  const necromancer = { hp: 45, initiative: 3 };

  it('sorts the round by decreasing Initiative: Specter, Sentinel, Ghoul, Necromancer', () => {
    expect(initiativeOrder(5, [ghoul, specter, necromancer])).toEqual([1, 'hero', 0, 2]);
  });

  it('puts the hero first on a tie, then the enemies from left to right', () => {
    expect(
      initiativeOrder(5, [
        { hp: 10, initiative: 5 },
        { hp: 10, initiative: 5 },
      ]),
    ).toEqual(['hero', 0, 1]);
  });

  it('leaves out the fallen enemies', () => {
    expect(initiativeOrder(5, [ghoul, { ...specter, hp: 0 }, necromancer])).toEqual(['hero', 0, 2]);
  });

  it('lets a faster hero act before the Specter', () => {
    expect(initiativeOrder(9, [ghoul, specter, necromancer])).toEqual(['hero', 1, 0, 2]);
  });
});
