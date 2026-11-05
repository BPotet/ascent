import { BOON_KINDS } from '../../../domain/ascent/boons';
import { BOON_NAMES, boonCard, boonChip, boonObtainedLabel, ownedBoonsLabel } from './boonText';

describe('boonText', () => {
  it("names the 14 boons, Veillée d'hiver 7th, Cœur de braise 8th, then the tier boons (#195, #212)", () => {
    expect(BOON_KINDS.map((kind) => BOON_NAMES[kind])).toEqual([
      'Écho parfait',
      'Braise brisante',
      'Peau de givre',
      'Lame juste',
      'Braise ardente',
      'Givre persistant',
      "Veillée d'hiver",
      'Cœur de braise',
      'Ronce rendue',
      'Gelée blanche',
      'Lame de cendre',
      'Bronze chauffé',
      'Heure juste',
      'Givre du clocher',
    ]);
  });

  it.each([
    ['thornReturn', '◆ Écho · Commun', 'Ta contre-attaque fait 30 % de dégâts en plus.'],
    ['hoarfrost', '◆◆ Givre · Rare', 'Chaque impact paré parfaitement te rend 2 PV.'],
    ['ashenBlade', '◆◆◆ Braise · Épique', 'Attaque +25 % : tous tes coups frappent plus fort.'],
    ['heatedBronze', '◆ Braise · Commun', 'Attaque +10 % : tous tes coups frappent plus fort.'],
    [
      'trueHour',
      '◆◆ Écho · Rare',
      'Ta frappe parfaite multiplie les dégâts par 1,8 au lieu de 1,5.',
    ],
    [
      'belfryFrost',
      '◆◆◆ Givre · Épique',
      'Réduction des dégâts +5 points (40 % au plus) et 2 PV rendus par impact paré parfaitement.',
    ],
  ] as const)(
    'writes the card of the tier boon %s as the mockup 210 (#212)',
    (kind, tag, effect) => {
      expect(boonCard(kind)).toMatchObject({ tag, effect });
    },
  );

  it("writes the card of Veillée d'hiver, and keeps the one of Cœur de braise (#195)", () => {
    expect(boonCard('winterVigil')).toEqual({
      name: "Veillée d'hiver",
      tag: '◆◆◆ Givre · Épique',
      effect:
        'Réduction des dégâts +10 points (40 % au plus) et +1 Élan au début de chaque combat.',
      rarity: 'epic',
      label:
        "Veillée d'hiver, Givre, Épique. Réduction des dégâts +10 points (40 % au plus) et +1 Élan au début de chaque combat.",
    });
    expect(boonCard('emberHeart')).toMatchObject({
      name: 'Cœur de braise',
      effect: 'Chaque garde que tu brises : +1 Élan et 5 PV rendus.',
    });
    expect(boonChip('winterVigil').rarityLine).toBe('◆◆◆ Épique');
  });

  it('writes the family, the rarity and the effect of a boon', () => {
    expect(boonCard('perfectEcho')).toEqual({
      name: 'Écho parfait',
      tag: '◆ Écho · Commun',
      effect: 'Ta contre-attaque fait 50 % de dégâts en plus (6 → 9 PV).',
      rarity: 'common',
      label:
        'Écho parfait, Écho, Commun. Ta contre-attaque fait 50 % de dégâts en plus (6 → 9 PV).',
    });
    expect(boonCard('lingeringFrost').tag).toBe('◆◆ Givre · Rare');
    expect(boonCard('emberHeart').tag).toBe('◆◆◆ Braise · Épique');
  });

  it('writes the loadout chip of a boon: name, then diamonds and rarity (#157)', () => {
    expect(boonChip('lingeringFrost')).toEqual({
      name: 'Givre persistant',
      rarity: 'rare',
      rarityLine: '◆◆ Rare',
      label: 'Givre persistant, Rare',
    });
    expect(boonChip('perfectEcho').rarityLine).toBe('◆ Commun');
    expect(boonChip('emberHeart').rarityLine).toBe('◆◆◆ Épique');
  });

  it('reads the owned boons in one sentence, in the order they were won (#157)', () => {
    expect(ownedBoonsLabel(['perfectEcho', 'lingeringFrost'])).toBe(
      'Bienfaits : Écho parfait, Commun ; Givre persistant, Rare',
    );
    expect(ownedBoonsLabel(['lingeringFrost', 'perfectEcho'])).toBe(
      'Bienfaits : Givre persistant, Rare ; Écho parfait, Commun',
    );
  });

  it('announces the boon obtained, then its effect (#157)', () => {
    expect(boonObtainedLabel('lingeringFrost')).toBe(
      'Bienfait obtenu : Givre persistant, Givre, Rare. Un ennemi étourdi se relève avec la moitié de sa garde seulement.',
    );
  });
});
