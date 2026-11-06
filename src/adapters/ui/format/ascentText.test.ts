import {
  SKIP_CHEST_LABEL,
  TAP_TO_SKIP,
  blessingCard,
  chestAnnouncement,
  blessingChip,
  blessingText,
  enemiesText,
  exitLabel,
  TIER_LINE,
  TIER_NAMES,
  bossDefeatedAnnouncement,
  floorLine,
  shardText,
  summitAnnouncement,
  tierAnnouncement,
  tierLine,
  goldText,
  itemDescription,
  itemAnnouncement,
  itemEffectLine,
  itemName,
  itemText,
  slotName,
  startingBlessingsLabel,
  takenBlessingsHeading,
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
    expect(exitLabel({ kind: 'campfire', groupSize: null })).toBe(
      'Feu de camp · soin de 40 % des PV',
    );
    expect(exitLabel({ kind: 'boss', groupSize: null })).toBe('Affronter le boss');
  });

  it('announces the cursed enemy under the curse, by number only (#209)', () => {
    const combat = { kind: 'combat', groupSize: 3 } as const;
    const elite = { kind: 'elite', groupSize: null } as const;

    expect(exitLabel(combat, -1)).toBe('Combat · 3 ennemis · dont 1 maudit');
    expect(exitLabel(combat, -2)).toBe('Combat · 3 ennemis · dont 1 maudit');
    expect(exitLabel(elite, -1)).toBe('Élite · objet Rare garanti · coffre scellé');
    expect(exitLabel(elite, -2)).toBe('Élite maudite · objet Rare garanti · coffre scellé');
    for (const gauge of [0, 1, 2] as const) {
      expect(exitLabel(combat, gauge)).toBe('Combat · 3 ennemis');
      expect(exitLabel(elite, gauge)).toBe('Élite · objet Rare garanti · coffre scellé');
    }
    expect(exitLabel({ kind: 'boss', groupSize: null }, -2)).toBe('Affronter le boss');
  });

  it('announces the Rare item the Elite door guarantees, not the Elite drawn behind it (#120)', () => {
    const label = exitLabel({ kind: 'elite', groupSize: null });

    expect(label).toBe('Élite · objet Rare garanti · coffre scellé');
    expect(label).not.toMatch(/Chevalier déchu|Jumeaux/u);
  });
});

describe('blessing and item texts (#93)', () => {
  it('names Fortune with its keys (#226)', () => {
    expect(blessingText({ family: 'fortune', rarity: 'common' })).toBe(
      'Fortune · Commune · +1 clé',
    );
    expect(blessingText({ family: 'fortune', rarity: 'rare' })).toBe('Fortune · Rare · +2 clés');
    expect(blessingCard({ family: 'fortune', rarity: 'epic' })).toMatchObject({
      name: 'Fortune',
      effect: '+3 clés',
    });
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

  it('writes the loadout chip of a blessing: its family, then the rarity in the feminine (#157)', () => {
    expect(blessingChip({ family: 'haste', rarity: 'rare' })).toEqual({
      name: 'Hâte',
      rarity: 'rare',
      rarityLine: '◆◆ Rare',
      label: 'Hâte, Rare',
    });
    expect(blessingChip({ family: 'vigor', rarity: 'common' })).toEqual({
      name: 'Vigueur',
      rarity: 'common',
      rarityLine: '◆ Commune',
      label: 'Vigueur, Commune',
    });
    expect(blessingChip({ family: 'protection', rarity: 'epic' }).rarityLine).toBe('◆◆◆ Épique');
  });

  it('writes the button of a blessing: family, rarity on its own line in the feminine, effect (#158)', () => {
    expect(blessingCard({ family: 'haste', rarity: 'rare' })).toEqual({
      name: 'Hâte',
      rarity: 'rare',
      rarityLine: '◆◆ Rare',
      effect: 'Initiative +2 dans chaque combat',
      label: 'Hâte · Rare · Initiative +2 dans chaque combat',
    });
    expect(blessingCard({ family: 'vigor', rarity: 'common' })).toMatchObject({
      name: 'Vigueur',
      rarityLine: '◆ Commune',
      effect: 'PV max +6 %',
    });
    expect(blessingCard({ family: 'momentum', rarity: 'epic' }).rarityLine).toBe('◆◆◆ Épique');
  });

  it('reads the button of a blessing as before (#158)', () => {
    for (const blessing of [
      { family: 'edge', rarity: 'common' },
      { family: 'protection', rarity: 'epic' },
    ] as const) {
      expect(blessingCard(blessing).label).toBe(blessingText(blessing));
    }
  });

  it('heads the blessings already chosen in the singular, then the plural (#158)', () => {
    expect(takenBlessingsHeading(1)).toBe('Déjà choisie');
    expect(takenBlessingsHeading(2)).toBe('Déjà choisies');
  });

  it('reads the starting blessings in one sentence, in the order chosen (#158)', () => {
    expect(startingBlessingsLabel([{ family: 'haste', rarity: 'rare' }])).toBe(
      'Bénédictions de départ : Hâte, Rare',
    );
    expect(
      startingBlessingsLabel([
        { family: 'haste', rarity: 'rare' },
        { family: 'vigor', rarity: 'common' },
      ]),
    ).toBe('Bénédictions de départ : Hâte, Rare ; Vigueur, Commune');
  });

  it('gives the name, the slot and the effect line of an item, for the camp (#40)', () => {
    expect(itemName('watchBell')).toBe('Clochette du guet');
    expect(slotName('accessory')).toBe('Accessoire');
    expect(itemEffectLine('hasteAmulet')).toBe('Initiative +2');
    expect(itemEffectLine('flamberge')).toBe('Attaque +10 % · Frappe parfaite +0,3 · Initiative 0');
  });

  it('names the items, worn or found, with their effect and Initiative', () => {
    expect(itemText('hasteAmulet')).toBe('Amulette de Hâte · Accessoire · Rare · Initiative +2');
    expect(itemText('hammer')).toBe('Marteau · Arme · Rare · Brise-garde ×1,6 · Initiative −1');
    expect(itemText('crossbow')).toBe('Arbalète · Arme · Rare · Initiative +1');
    expect(itemText('blackKnightArmor')).toBe(
      'Armure de chevalier déchu · Armure · Rare · Réduction des dégâts +20 points, Attaque +5 % · Initiative −2',
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

  it('gives the Fallen knight armor and the Hammer their description, and no line to the other items', () => {
    expect(itemDescription('blackKnightArmor')).toBe(
      "L'armure d'un chevalier déchu. Trouvée dans une salle jadis emplie d'écuyers.",
    );
    expect(itemDescription('hammer')).toBe(
      'Un marteau de forge, trop lourd pour un combat rapide. Aucune garde ne lui résiste longtemps.',
    );
    expect(itemDescription('crossbow')).toBeNull();
  });

  it('names the three unlockable items, with their effect and their description (#195)', () => {
    expect(itemText('huntingSpear')).toBe(
      'Épieu de chasse · Arme · Commun · Attaque +10 % · Initiative 0',
    );
    expect(itemText('watchBell')).toBe(
      'Clochette du guet · Accessoire · Rare · Contre-attaque ×1,3 · Initiative 0',
    );
    expect(itemText('flamberge')).toBe(
      'Flamberge · Arme · Épique · Attaque +10 %, Frappe parfaite +0,3 · Initiative 0',
    );
    expect(itemDescription('huntingSpear')).toBe(
      'Un épieu de chasseur, le fer noirci par les feux du camp. Il ne brise aucune garde : il entre.',
    );
    expect(itemDescription('watchBell')).toBe(
      'Une clochette fêlée, pendue jadis au cou des guetteurs du Beffroi. Elle sonne quand le coup revient, et le coup revient plus fort.',
    );
    expect(itemDescription('flamberge')).toBe(
      "Une épée à lame ondulée, trempée dans la flamme du camp. Le Gardien dit qu'elle a appartenu à quelqu'un qui est monté très haut. Elle ne pèse rien quand le geste est juste.",
    );
  });
});

describe('tier and Shard texts (#38)', () => {
  it('names the three tiers', () => {
    expect([1, 2, 3].map((tier) => TIER_NAMES[tier as 1])).toEqual([
      'Les Catacombes',
      'Les Jardins de cendre',
      'Le Beffroi',
    ]);
    expect(tierLine(2)).toBe('Palier 2 · les Jardins de cendre · 6 étages');
    expect(TIER_LINE).toBe('Palier 1 · les Catacombes · 6 étages');
  });

  it('names the floor of a tier out of 6', () => {
    expect(floorLine(3, 2)).toBe('Palier 2 · Étage 3 sur 6');
    expect(floorLine(6, 3)).toBe('Palier 3 · Étage 6 sur 6');
  });

  it('counts the Shards: « 0 Éclat », « 1 Éclat », « 22 Éclats »', () => {
    expect([0, 1, 2, 22].map(shardText)).toEqual(['0 Éclat', '1 Éclat', '2 Éclats', '22 Éclats']);
  });

  it('tells the screen reader the Shards of the boss, the next tier and the Summit', () => {
    expect(bossDefeatedAnnouncement(12)).toBe('12 Éclats gagnés, gardés pour toujours');
    expect(tierAnnouncement(2)).toBe('Palier 2, les Jardins de cendre');
    expect(tierAnnouncement(3)).toBe('Palier 3, le Beffroi');
    expect(summitAnnouncement(28)).toBe('28 Éclats gagnés, Sommet atteint');
  });
});

describe('Chest texts (#227)', () => {
  it('announces an item by its name, rarity, effect and Initiative, without its slot', () => {
    expect(itemAnnouncement('axe')).toBe('Hache rouillée, Commun, Brise-garde ×1,1, Initiative −1');
    expect(itemAnnouncement('hammer')).toBe('Marteau, Rare, Brise-garde ×1,6, Initiative −1');
    expect(itemAnnouncement('crossbow')).toBe('Arbalète, Rare, Initiative +1');
    expect(itemAnnouncement('flamberge')).toBe(
      'Flamberge, Épique, Attaque +10 %, Frappe parfaite +0,3, Initiative 0',
    );
  });

  it('announces the opened Chest, then the item', () => {
    expect(chestAnnouncement('axe')).toBe(
      'Coffre ouvert. Hache rouillée, Commun, Brise-garde ×1,1, Initiative −1.',
    );
  });

  it('names the tap that skips the opening of the Chest', () => {
    expect(SKIP_CHEST_LABEL).toBe("Passer l'ouverture du coffre");
    expect(TAP_TO_SKIP).toBe('Touche pour passer');
  });
});
