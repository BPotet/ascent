import { rarityLine, rarityName } from './rarityText';

describe('rarityText (#157)', () => {
  it('names a rarity in the masculine, for a boon or an item', () => {
    expect(rarityName('common')).toBe('Commun');
    expect(rarityName('rare')).toBe('Rare');
    expect(rarityName('epic')).toBe('Épique');
  });

  it('names a rarity in the feminine, for a blessing', () => {
    expect(rarityName('common', 'feminine')).toBe('Commune');
    expect(rarityName('rare', 'feminine')).toBe('Rare');
    expect(rarityName('epic', 'feminine')).toBe('Épique');
  });

  it('writes the diamonds before the rarity: 1, 2 or 3', () => {
    expect(rarityLine('common')).toBe('◆ Commun');
    expect(rarityLine('rare')).toBe('◆◆ Rare');
    expect(rarityLine('epic')).toBe('◆◆◆ Épique');
    expect(rarityLine('common', 'feminine')).toBe('◆ Commune');
  });
});
