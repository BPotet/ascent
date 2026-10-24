import { difficultyIconRows, ICONS, iconNames } from './icons';

describe('the icons', () => {
  it('draws every icon on 8 × 8 (16 dp) or 12 × 12 (24 dp) art pixels, with known codes', () => {
    iconNames.forEach((name) => {
      const rows = ICONS[name];
      expect([8, 12]).toContain(rows.length);
      rows.forEach((row) => {
        expect(row).toHaveLength(rows.length);
        expect(row).toMatch(/^[.XYk]+$/);
      });
    });
  });

  it('has the icons of the day view, of the tab bar and those #73 needs', () => {
    expect(iconNames).toEqual(
      expect.arrayContaining([
        'check12',
        'cross12',
        'dot12',
        'dash12',
        'check8',
        'flag8',
        'star8',
        'info',
        'plus',
        'more',
        'close',
        'alert',
        'left',
        'right',
        'pencil',
        'trash',
        'tDay',
        'tWeek',
        'tMonth',
      ]),
    );
    // Les icônes de la tour viennent avec l'épique #30.
    expect(iconNames).not.toContain('tTower');
  });

  it('mirrors « left » into « right »', () => {
    ICONS.left.forEach((row, index) =>
      expect(ICONS.right[index]).toBe([...row].reverse().join('')),
    );
  });

  it.each([
    [1, 8],
    [2, 13],
    [3, 18],
  ])('draws %i joined peaks for the difficulty icon, %i art pixels wide', (peaks, width) => {
    const rows = difficultyIconRows(peaks as 1 | 2 | 3);
    expect(rows).toHaveLength(8);
    rows.forEach((row) => expect(row).toHaveLength(width));
    // Chaque sommet a sa pointe.
    const tips = [...(rows[1] ?? '')].filter((code) => code !== '.').length;
    expect(tips).toBe(2 * peaks);
  });
});
