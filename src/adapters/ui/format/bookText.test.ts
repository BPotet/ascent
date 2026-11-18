import type { BestiaryEntry, BestiaryTier } from '../../../domain/discoveryBook/bestiary';
import {
  BOOK_TITLE,
  bookButtonLabel,
  bookLine,
  bookLineAnnouncement,
  bookSubtitle,
  entryLabel,
  openEntryLabel,
  entryStatus,
  tierChipLabel,
  tierSummary,
  tierSummaryLabel,
} from './bookText';

const entry = (change: Partial<BestiaryEntry>): BestiaryEntry => ({
  kind: 'ghoul',
  tier: 1,
  category: 'enemy',
  state: 'defeated',
  isNew: false,
  ...change,
});

const tier = (change: Partial<BestiaryTier>): BestiaryTier => ({
  tier: 1,
  sections: [],
  filled: 9,
  encountered: 2,
  total: 12,
  isNew: false,
  complete: false,
  ...change,
});

describe('the texts of the discovery book (#282)', () => {
  it('names the book « Le carnet », and its button with the count of new entries (T1 to T3)', () => {
    expect(BOOK_TITLE).toBe('Le carnet');
    expect(bookButtonLabel(0)).toBe('Le carnet');
    expect(bookButtonLabel(1)).toBe('Le carnet, 1 nouvelle page');
    expect(bookButtonLabel(3)).toBe('Le carnet, 3 nouvelles pages');
  });

  it('gives the total of the discoveries under the title', () => {
    expect(bookSubtitle(14, 37)).toBe('14 découvertes sur 37');
    expect(bookSubtitle(1, 37)).toBe('1 découverte sur 37');
    expect(bookSubtitle(0, 37)).toBe('0 découverte sur 37');
  });

  it('writes the line of the book: one page, several pages, more than 3 names (D1, D2)', () => {
    expect(bookLine(['burningHusk'])).toEqual({ lead: 'Nouvelle page : ', names: 'Embrasé' });
    expect(bookLine(['mothkin', 'thornPilgrim', 'thievingMoth'])).toEqual({
      lead: '3 nouvelles pages : ',
      names: 'Phalénide, Pèlerin enronce, Phalène voleuse',
    });
    expect(bookLine(['ghoul', 'specter', 'necromancer', 'skeleton'])).toEqual({
      lead: '4 nouvelles pages : ',
      names: 'Goule, Spectre, Nécromancien … et 1 autre',
    });
    expect(bookLine(['ghoul', 'specter', 'necromancer', 'skeleton', 'madVillager'])).toEqual({
      lead: '5 nouvelles pages : ',
      names: 'Goule, Spectre, Nécromancien … et 2 autres',
    });
  });

  it('announces the line of the book politely, in words', () => {
    expect(bookLineAnnouncement(['burningHusk'])).toBe('Carnet : nouvelle page, Embrasé.');
    expect(bookLineAnnouncement(['mothkin', 'thornPilgrim', 'thievingMoth'])).toBe(
      'Carnet : 3 nouvelles pages, Phalénide, Pèlerin enronce et Phalène voleuse.',
    );
    expect(bookLineAnnouncement(['ghoul', 'specter'])).toBe(
      'Carnet : 2 nouvelles pages, Goule et Spectre.',
    );
    expect(
      bookLineAnnouncement(['ghoul', 'specter', 'necromancer', 'skeleton', 'madVillager']),
    ).toBe('Carnet : 5 nouvelles pages, Goule, Spectre, Nécromancien et 2 autres.');
  });

  it('says the state of an entry in a word, agreed with its name', () => {
    expect(entryStatus(entry({ state: 'defeated' }))).toBe('Vaincue');
    expect(entryStatus(entry({ kind: 'specter', state: 'defeated' }))).toBe('Vaincu');
    expect(entryStatus(entry({ state: 'encountered' }))).toBe('Rencontrée');
    expect(entryStatus(entry({ kind: 'specter', state: 'encountered' }))).toBe('Rencontré');
    expect(entryStatus(entry({ state: 'unknown' }))).toBe('Jamais vu');
  });

  it('reads an entry for the screen reader, its category and its mark (B1, B2, B3)', () => {
    expect(entryLabel(entry({}))).toBe('Goule, vaincue');
    expect(entryLabel(entry({ kind: 'burningHusk', tier: 2, isNew: true }))).toBe(
      'Embrasé, vaincu, nouveau',
    );
    expect(
      entryLabel(
        entry({ kind: 'brambleMother', tier: 2, category: 'elite', state: 'encountered' }),
      ),
    ).toBe('Mère-ronce, Élite, rencontrée, pas encore vaincue');
    expect(entryLabel(entry({ kind: 'facelessPrior', category: 'boss' }))).toBe(
      'Prieur sans visage, Boss, vaincu',
    );
    expect(entryLabel(entry({ tier: 2, category: 'elite', state: 'unknown' }))).toBe(
      'Élite inconnue, Palier 2',
    );
    expect(entryLabel(entry({ category: 'enemy', state: 'unknown' }))).toBe(
      'Ennemi inconnu, Palier 1',
    );
    expect(entryLabel(entry({ tier: 3, category: 'boss', state: 'unknown' }))).toBe(
      'Boss inconnu, Palier 3',
    );
  });

  it('reads an entry that opens its page « … Ouvrir sa page » (#283, B3)', () => {
    expect(openEntryLabel(entry({}))).toBe('Goule, vaincue. Ouvrir sa page');
    expect(openEntryLabel(entry({ kind: 'burningHusk', tier: 2, isNew: true }))).toBe(
      'Embrasé, vaincu, nouveau. Ouvrir sa page',
    );
    expect(
      openEntryLabel(
        entry({ kind: 'brambleMother', tier: 2, category: 'elite', state: 'encountered' }),
      ),
    ).toBe('Mère-ronce, Élite, rencontrée, pas encore vaincue. Ouvrir sa page');
  });

  it('reads a tier chip for the screen reader: its name, its pages, new and complete', () => {
    expect(tierChipLabel(tier({}))).toBe('Palier 1, les Catacombes, 9 pages remplies sur 12');
    expect(tierChipLabel(tier({ tier: 2, filled: 1, isNew: true }))).toBe(
      'Palier 2, les Jardins de cendre, 1 page remplie sur 12, nouveau',
    );
    expect(tierChipLabel(tier({ filled: 12, complete: true }))).toBe(
      'Palier 1, les Catacombes, 12 pages remplies sur 12, complet',
    );
  });

  it('sums up a tier in its frame: complete, never seen, or what remains (B1, B4, B6)', () => {
    expect(tierSummary(tier({ filled: 12, encountered: 0, complete: true }))).toBe(
      'Toutes les pages du palier sont remplies.',
    );
    expect(tierSummary(tier({ filled: 0, encountered: 0, total: 13 }))).toBe(
      'Aucun ennemi de ce palier n’a encore été vu.',
    );
    expect(tierSummary(tier({}))).toBe('2 rencontrés, pas encore vaincus · 1 jamais vu');
    expect(tierSummary(tier({ filled: 5, encountered: 1 }))).toBe(
      '1 rencontré, pas encore vaincu · 6 jamais vus',
    );
    expect(tierSummary(tier({ filled: 11, encountered: 1 }))).toBe(
      '1 rencontré, pas encore vaincu',
    );
    expect(tierSummary(tier({ filled: 10, encountered: 0 }))).toBe('2 jamais vus');
    expect(tierSummaryLabel(tier({}))).toBe(
      'Les Catacombes : 9 pages remplies sur 12. 2 rencontrés, pas encore vaincus · 1 jamais vu',
    );
  });
});
