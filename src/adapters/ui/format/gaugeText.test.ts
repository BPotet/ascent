import type { FateGaugeReading } from '../../../application/useCases/fateGauge';
import {
  KEY_DETAIL_LINE,
  GAUGE_LEVELS,
  GAUGE_SAFEGUARDS,
  ascentFavorEffects,
  ascentGaugeAnnouncement,
  closingNote,
  gaugeAnnouncement,
  gaugeEffects,
  gaugeReason,
  gaugeShare,
  gaugeValue,
  gaugeWord,
  levelTag,
} from './gaugeText';

const reading = (overrides: Partial<FateGaugeReading> = {}): FateGaugeReading => ({
  gauge: 1,
  blessings: ['rare', 'rare', 'common'],
  done: 3,
  expected: 4,
  habits: [],
  sealed: false,
  unreadable: false,
  ...overrides,
});

const texts = (effects: ReturnType<typeof gaugeEffects>) => effects.map(({ text }) => text);

describe('the texts of the gauge (#93, #41)', () => {
  it('names each level in words, with its value', () => {
    expect([2, 1, 0, -1, -2].map((gauge) => gaugeWord(gauge as never))).toEqual([
      'Faveur pleine',
      'Faveur',
      'Neutre',
      'Malédiction',
      'Malédiction forte',
    ]);
    expect([2, 1, 0, -1, -2].map((gauge) => gaugeValue(gauge as never))).toEqual([
      '+2',
      '+1',
      '0',
      '−1',
      '−2',
    ]);
  });

  it('tells the count of yesterday, without blame, or that there is no count yet', () => {
    expect(gaugeReason({ done: 3, expected: 4 })).toBe("D'après hier : 3 habitudes sur 4.");
    expect(gaugeReason({ done: 1, expected: 3 })).toBe("D'après hier : 1 habitude sur 3.");
    expect(gaugeReason({ done: 0, expected: 3 })).toBe("D'après hier : 0 habitude sur 3.");
    expect(gaugeReason({ done: 0, expected: 0 })).toBe(
      "Pas encore de compte : aucune habitude n'était attendue hier.",
    );
    expect(gaugeShare({ done: 3, expected: 4 })).toBe('3 sur 4, soit 75 %.');
    expect(gaugeShare({ done: 2, expected: 3 })).toBe('2 sur 3, soit 67 %.');
  });

  it('lists the effects of full favor, with their glyphs', () => {
    expect(gaugeEffects(reading({ gauge: 2 }))).toEqual([
      { glyph: 'bless', tone: 'gold', text: '3 bénédictions de départ' },
      { glyph: 'loot', tone: 'favor', text: 'Objets plus fréquents' },
      { glyph: 'rare', tone: 'favor', text: 'Objets Rares plus fréquents' },
      { glyph: 'reroll', tone: 'favor', text: '2 relances' },
      { glyph: 'key8', tone: 'favor', text: '1 clé' },
      { glyph: 'secondChance', tone: 'favor', text: '1 seconde chance' },
    ]);
  });

  it('lists 1 reroll at +1, after the Rare items (#42), then 1 key (#226)', () => {
    expect(texts(gaugeEffects(reading({ gauge: 1 })))).toEqual([
      '3 bénédictions de départ',
      'Objets plus fréquents',
      'Objets Rares plus fréquents',
      '1 relance',
      '1 clé',
    ]);
  });

  it.each([0, -1, -2] as const)('lists no key at a gauge of %p (#226)', (gauge) => {
    expect(texts(gaugeEffects(reading({ gauge })))).not.toContain('1 clé');
  });

  it('tells what a key opens, at +1 and +2 only (#226, J3)', () => {
    expect(KEY_DETAIL_LINE).toBe(
      "La clé ouvre le coffre scellé d'une Élite. Elle vaut toute l'ascension.",
    );
  });

  it('lists the fatigue, the rarer Rare items and the cursed enemies of a curse (#209)', () => {
    expect(texts(gaugeEffects(reading({ gauge: -1, blessings: ['rare'] })))).toEqual([
      '1 bénédiction de départ',
      'Fatigue : PV max −10 %',
      'Objets Rares moins fréquents',
      '1 ennemi maudit par combat',
    ]);
    expect(gaugeEffects(reading({ gauge: -2, blessings: [] }))).toEqual([
      { glyph: 'fatigue', tone: 'curse', text: 'Fatigue : PV max −20 %' },
      { glyph: 'rare', tone: 'curse', text: 'Objets Rares moins fréquents' },
      { glyph: 'skull', tone: 'curse', text: 'Ennemis et Élite maudits' },
    ]);
  });

  it('says a Neutral gauge has no other effect, an unreadable one none at all, and the first use nothing', () => {
    expect(texts(gaugeEffects(reading({ gauge: 0, blessings: ['rare', 'rare'] })))).toEqual([
      '2 bénédictions de départ',
      "Aucun autre effet aujourd'hui",
    ]);
    expect(gaugeEffects(reading({ gauge: 0, blessings: [], unreadable: true }))).toEqual([
      { glyph: 'dash8', tone: 'muted', text: "Aucun effet aujourd'hui" },
    ]);
    expect(gaugeEffects(reading({ gauge: 0, blessings: [], done: 0, expected: 0 }))).toEqual([]);
  });

  it('tells the five levels with their thresholds, and marks the level of the day', () => {
    expect(
      GAUGE_LEVELS.map(({ gauge, threshold }) => `${gaugeWord(gauge)} · ${threshold}`),
    ).toEqual([
      'Faveur pleine · toutes faites',
      'Faveur · 75 % ou plus',
      'Neutre · 50 % ou plus, ou aucune attendue',
      'Malédiction · 25 % ou plus',
      'Malédiction forte · moins de 25 %',
    ]);
    expect(levelTag(reading())).toBe("Aujourd'hui");
    expect(levelTag(reading({ gauge: 0, done: 0, expected: 0 }))).toBe('Pas encore');
  });

  it('keeps the same four safeguards', () => {
    expect(GAUGE_SAFEGUARDS.map(({ text }) => text)).toEqual([
      "Seul hier compte, tel qu'à la clôture. Corriger un jour plus ancien ne la change pas.",
      "Elle ne vaut que pour aujourd'hui. Demain, elle repart d'aujourd'hui.",
      "L'ascension se lance toujours, et reste gagnable.",
      "Jamais d'effet sur tes Éclats, tes déblocages, leurs prix ni le camp.",
    ]);
  });

  it('tells why the gauge differs from the reminder of yesterday', () => {
    expect(closingNote(['Courir'])).toBe(
      "Une correction d'un jour plus ancien a changé le Rappel d'hier, pas la jauge : hier est compté tel qu'à la clôture, quand « Courir » était encore attendue.",
    );
    expect(closingNote(['Courir', 'Lire'])).toBe(
      "Une correction d'un jour plus ancien a changé le Rappel d'hier, pas la jauge : hier est compté tel qu'à la clôture, quand « Courir » et « Lire » étaient encore attendues.",
    );
  });
});

describe('the announcement of the gauge, never the color alone (#41)', () => {
  it('says the word, then the value, then the count of yesterday and the effects', () => {
    expect(gaugeAnnouncement(reading({ gauge: -2, blessings: [], done: 0, expected: 3 }))).toBe(
      "Jauge du jour : Malédiction forte, moins 2. D'après hier : 0 habitude sur 3. Effets : fatigue : PV max moins 20 %, objets Rares moins fréquents, ennemis et Élite maudits. D'après hier, seulement aujourd'hui. L'ascension reste gagnable.",
    );
    expect(gaugeAnnouncement(reading({ gauge: 2, done: 3, expected: 3 }))).toBe(
      "Jauge du jour : Faveur pleine, plus 2. D'après hier : 3 habitudes sur 3. Effets : 3 bénédictions de départ, objets plus fréquents, objets Rares plus fréquents, 2 relances, 1 clé, 1 seconde chance.",
    );
  });

  it('says there is no count yet at the first use', () => {
    expect(gaugeAnnouncement(reading({ gauge: 0, blessings: [], done: 0, expected: 0 }))).toBe(
      "Jauge du jour : Neutre, pas encore de compte. Elle comptera dès demain, d'après tes habitudes d'aujourd'hui.",
    );
  });

  it('says an unreadable gauge is Neutral, without effect', () => {
    expect(
      gaugeAnnouncement(
        reading({ gauge: 0, blessings: [], done: 0, expected: 0, unreadable: true }),
      ),
    ).toBe(
      "Jauge du jour : Neutre, 0. Tes habitudes n'ont pas pu être lues. La jauge reste Neutre aujourd'hui, sans effet. L'ascension se lance quand même. Effets : aucun effet aujourd'hui.",
    );
  });

  it('says when it was sealed', () => {
    expect(gaugeAnnouncement(reading({ sealed: true }))).toMatch(
      / Scellée au lancement de ta première ascension d'aujourd'hui\.$/u,
    );
  });
});

describe('the favor of the ascent in progress (#42, G9)', () => {
  it('tells the rerolls left on those given at the start', () => {
    expect(ascentFavorEffects({ gauge: 2, rerolls: 1, secondChance: true })).toEqual([
      { glyph: 'reroll', tone: 'favor', text: '1 relance sur 2' },
      { glyph: 'secondChance', tone: 'favor', text: 'Seconde chance prête' },
    ]);
    expect(ascentFavorEffects({ gauge: 2, rerolls: 2, secondChance: false })).toEqual([
      { glyph: 'reroll', tone: 'favor', text: '2 relances sur 2' },
      { glyph: 'secondChance', tone: 'muted', text: 'Seconde chance utilisée' },
    ]);
    expect(ascentFavorEffects({ gauge: 1, rerolls: 0, secondChance: false })).toEqual([
      { glyph: 'reroll', tone: 'muted', text: '0 relance sur 1' },
    ]);
  });

  it('tells nothing without favor', () => {
    for (const gauge of [0, -1, -2] as const) {
      expect(ascentFavorEffects({ gauge, rerolls: 0, secondChance: false })).toEqual([]);
    }
  });

  it('announces the rerolls left and the second chance after the gauge of the ascent (#206)', () => {
    expect(ascentGaugeAnnouncement(2, 1, true)).toBe(
      "Jauge de l'ascension : Faveur pleine, plus 2. Lancée avec cette jauge : l'ascension la garde jusqu'à sa fin. Il reste 1 relance sur 2 et la seconde chance.",
    );
    expect(ascentGaugeAnnouncement(2, 1, false)).toBe(
      "Jauge de l'ascension : Faveur pleine, plus 2. Lancée avec cette jauge : l'ascension la garde jusqu'à sa fin. Il reste 1 relance sur 2. La seconde chance a servi.",
    );
    expect(ascentGaugeAnnouncement(1, 1, false)).toBe(
      "Jauge de l'ascension : Faveur, plus 1. Lancée avec cette jauge : l'ascension la garde jusqu'à sa fin. Il reste 1 relance sur 1.",
    );
    expect(ascentGaugeAnnouncement(-1, 0, false)).toBe(
      "Jauge de l'ascension : Malédiction, moins 1. Lancée avec cette jauge : l'ascension la garde jusqu'à sa fin.",
    );
  });
});
