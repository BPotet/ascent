// L'ordre d'action (#32, C1) : le héros, puis les ennemis debout de gauche à droite.
import { actionOrder } from './actionOrder';

describe('actionOrder (C1)', () => {
  it('puts the hero first, then the standing enemies from left to right', () => {
    expect(actionOrder([{ hp: 50 }, { hp: 35 }, { hp: 45 }])).toEqual(['hero', 0, 1, 2]);
  });

  it('leaves out the fallen enemies', () => {
    expect(actionOrder([{ hp: 0 }, { hp: 35 }, { hp: 0 }])).toEqual(['hero', 1]);
  });
});
