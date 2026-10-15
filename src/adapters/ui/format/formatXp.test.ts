import { formatXp, formatXpChange, xpAnnouncement } from './formatXp';

/** L'espace fine insécable qui sépare les milliers en français. */
const thin = ' ';

describe('formatXp', () => {
  it.each([
    [0, '0 XP'],
    [40, '40 XP'],
    [999, '999 XP'],
    [1510, `1${thin}510 XP`],
    [1000000, `1${thin}000${thin}000 XP`],
  ])('writes %d Xp « %s »', (xp, text) => {
    expect(formatXp(xp)).toBe(text);
  });
});

describe('formatXpChange', () => {
  it('writes a gain with a plus sign', () => {
    expect(formatXpChange(10)).toBe('+10 XP');
  });

  it('writes a loss with a true minus sign', () => {
    expect(formatXpChange(-10)).toBe('−10 XP');
  });
});

describe('xpAnnouncement', () => {
  it('announces a gain and the total (maquette, « Lecteur d’écran »)', () => {
    expect(xpAnnouncement({ xpChange: 10, xp: 510, correction: false })).toBe(
      `+10 points d’expérience. Total : 510 XP.`,
    );
  });

  it('announces a loss', () => {
    expect(xpAnnouncement({ xpChange: -10, xp: 30, correction: false })).toBe(
      '−10 points d’expérience. Total : 30 XP.',
    );
  });

  it('announces a correction first', () => {
    expect(xpAnnouncement({ xpChange: 10, xp: 1510, correction: true })).toBe(
      `Correction enregistrée, +10 points d’expérience. Total : 1${thin}510 XP.`,
    );
  });
});
