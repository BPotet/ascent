import {
  blessingText,
  enemiesText,
  exitLabel,
  floorLine,
  gaugeEffects,
  gaugeReason,
  gaugeWord,
  goldText,
  itemText,
  wornText,
} from './ascentText';

describe('ascent texts', () => {
  it('names the floor out of 6, the Gold and the number of enemies', () => {
    expect(floorLine(3)).toBe('Palier 1 · Étage 3 sur 6');
    expect(goldText(12)).toBe('12 Or');
    expect(enemiesText(1)).toBe('1 ennemi');
    expect(enemiesText(4)).toBe('4 ennemis');
  });

  it('announces the group size on a Combat door, not its composition', () => {
    expect(exitLabel({ kind: 'combat', groupSize: 4 })).toBe('Combat · 4 ennemis');
    expect(exitLabel({ kind: 'elite', groupSize: null })).toBe('Élite · le Chevalier déchu');
    expect(exitLabel({ kind: 'campfire', groupSize: null })).toBe(
      'Feu de camp · soin de 40 % des PV',
    );
    expect(exitLabel({ kind: 'boss', groupSize: null })).toBe('Affronter le boss');
  });
});

describe('gauge, blessing and item texts (#93)', () => {
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

  it('names the blessings with their effect', () => {
    expect(blessingText({ family: 'haste', rarity: 'rare' })).toBe(
      'Hâte · Rare · Initiative +2 dans chaque combat',
    );
    expect(blessingText({ family: 'momentum', rarity: 'common' })).toBe(
      'Élan · Commune · +1 Élan au premier combat',
    );
    expect(blessingText({ family: 'momentum', rarity: 'epic' })).toBe(
      'Élan · Épique · +2 Élan de départ à chaque combat',
    );
    expect(blessingText({ family: 'vigor', rarity: 'epic' })).toBe(
      'Vigueur · Épique · PV max +15 %',
    );
    expect(blessingText({ family: 'edge', rarity: 'common' })).toBe(
      'Tranchant · Commune · Attaque +10 %',
    );
    expect(blessingText({ family: 'protection', rarity: 'rare' })).toBe(
      'Protection · Rare · Réduction des dégâts +10 points',
    );
  });

  it('names the items, worn or found, with their effect and Initiative', () => {
    expect(itemText('hasteAmulet')).toBe('Amulette de Hâte · Accessoire · Rare · Initiative +2');
    expect(itemText('hammer')).toBe('Marteau · Arme · Commun · Brise-garde ×1,6 · Initiative −1');
    expect(itemText('crossbow')).toBe('Arbalète · Arme · Rare · Initiative +1');
    expect(itemText('blackKnightArmor')).toBe(
      'Armure de chevalier noir · Armure · Rare · Réduction des dégâts +20 points, Attaque +1 · Initiative −2',
    );
    expect(itemText('leather')).toBe(
      'Cuir · Armure · Commun · Frappe parfaite +0,2 · Initiative +1',
    );
    expect(wornText({ weapon: null, armor: null, accessory: null }, 'accessory')).toBe(
      'Aucun accessoire',
    );
    expect(wornText({ weapon: null, armor: null, accessory: null }, 'weapon')).toBe(
      'Épée courte · Initiative 0',
    );
    expect(wornText({ weapon: null, armor: null, accessory: null }, 'armor')).toBe(
      'Cuirasse cabossée · Initiative 0',
    );
    expect(wornText({ weapon: 'axe', armor: null, accessory: null }, 'weapon')).toBe(
      'Hache rouillée · Arme · Commun · Brise-garde ×1,1 · Initiative −1',
    );
  });
});
