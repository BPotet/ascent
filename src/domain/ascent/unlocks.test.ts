// Les Déblocages (`Unlock`, #195) : les contenus de la tour à débloquer au Camp.
import { UNLOCKS, unlockedItems } from './unlocks';

describe('the Unlocks (#195)', () => {
  it('lists the 4 contents to unlock, in the order of the camp catalog', () => {
    expect(UNLOCKS).toEqual(['huntingSpear', 'watchBell', 'emberHeart', 'flamberge']);
  });

  it('keeps the unlocked items only, in the order of the catalog', () => {
    expect(unlockedItems([])).toEqual([]);
    expect(unlockedItems(['emberHeart'])).toEqual([]);
    expect(unlockedItems(['flamberge', 'emberHeart', 'huntingSpear'])).toEqual([
      'huntingSpear',
      'flamberge',
    ]);
  });
});
