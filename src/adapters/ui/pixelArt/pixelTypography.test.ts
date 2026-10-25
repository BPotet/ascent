import { PIXEL_FONT_MIN_SIZE, pixelFont, pixelTypography, textFont } from './pixelTypography';

describe('pixelTypography', () => {
  const styles = Object.entries(pixelTypography);

  it('never sets the pixel font under 18', () => {
    expect(PIXEL_FONT_MIN_SIZE).toBe(18);
    const pixel = styles.filter(([, style]) => style.fontFamily === pixelFont);
    expect(pixel.length).toBeGreaterThan(0);
    pixel.forEach(([, style]) => expect(style.fontSize).toBeGreaterThanOrEqual(18));
  });

  it('puts every text to read in the text font', () => {
    const toRead = [
      'habitName',
      'body',
      'label',
      'statusWord',
      'notice',
      'noticeTitle',
      'tab',
      'tabActive',
      'button',
      'link',
    ] as const;
    const textFonts: readonly string[] = Object.values(textFont);
    toRead.forEach((role) => expect(textFonts).toContain(pixelTypography[role].fontFamily));
  });

  it('puts titles and game numbers in the pixel font', () => {
    (
      ['screenTitle', 'gameNumber', 'counter', 'counterUnit', 'stateTitle', 'moment'] as const
    ).forEach((role) => expect(pixelTypography[role].fontFamily).toBe(pixelFont));
    expect(pixelTypography.xpChange).toMatchObject({ fontFamily: pixelFont, fontSize: 18 });
    expect(pixelTypography.counter.fontSize).toBe(22);
    expect(pixelTypography.counterUnit.fontSize).toBe(18);
  });

  it('marks the active tab in bold', () => {
    expect(pixelTypography.tabActive.fontFamily).toBe(textFont.bold);
    expect(pixelTypography.tab.fontFamily).not.toBe(textFont.bold);
  });
});
