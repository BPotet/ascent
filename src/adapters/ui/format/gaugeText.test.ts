import { gaugeEffects, gaugeReason, gaugeWord } from './gaugeText';

describe('the texts of the gauge (#93)', () => {
  it('names the gauge in words, from yesterday, without blame', () => {
    expect([2, 1, 0, -1, -2].map((gauge) => gaugeWord(gauge as never))).toEqual([
      'Faveur pleine',
      'Faveur',
      'Neutre',
      'Malédiction',
      'Malédiction forte',
    ]);
    expect(gaugeReason({ done: 3, expected: 4 })).toBe("D'après hier : 3 habitudes sur 4.");
    expect(gaugeReason({ done: 0, expected: 0 })).toBe(
      "Aucune habitude hier : pas d'effet aujourd'hui.",
    );
  });

  it('tells the effects of the gauge', () => {
    expect(gaugeEffects({ gauge: 1, blessings: ['rare'] })).toEqual([
      '1 bénédiction de départ',
      'Objets plus fréquents',
    ]);
    expect(gaugeEffects({ gauge: -1, blessings: ['rare', 'epic'] })).toEqual([
      '2 bénédictions de départ',
      'Fatigue : PV max −10 %',
      "D'après hier, seulement aujourd'hui. L'ascension reste gagnable.",
    ]);
    expect(gaugeEffects({ gauge: 0, blessings: [] })).toEqual([]);
  });
});
