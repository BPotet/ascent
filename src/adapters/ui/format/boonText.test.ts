import { BOON_KINDS } from '../../../domain/ascent/boons';
import {
  BOON_NAMES,
  boonCard,
  boonChip,
  boonObtainedLabel,
  offerBoonCard,
  offerHeading,
  ownedBoonsLabel,
  secondBreathCard,
  secondBreathObtained,
} from './boonText';

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

  describe('the offer (#212)', () => {
    it('ends the line of a tier boon with « · Palier N », read at the end of its name', () => {
      expect(offerBoonCard('hoarfrost')).toEqual({
        ...boonCard('hoarfrost'),
        tierMark: '· Palier 2',
        label:
          'Gelée blanche, Givre, Rare, palier 2. Chaque impact paré parfaitement te rend 2 PV.',
      });
      expect(offerBoonCard('trueHour').label).toBe(
        'Heure juste, Écho, Rare, palier 3. Ta frappe parfaite multiplie les dégâts par 1,8 au lieu de 1,5.',
      );
    });

    it('keeps the card of a base boon, without a tier mark, and the card elsewhere', () => {
      expect(offerBoonCard('perfectEcho')).toEqual({ ...boonCard('perfectEcho'), tierMark: null });
      expect(boonCard('hoarfrost').label).toBe(
        'Gelée blanche, Givre, Rare. Chaque impact paré parfaitement te rend 2 PV.',
      );
    });

    it('counts the cards in the heading, and greets the card alone', () => {
      expect(offerHeading(['perfectEcho', 'hoarfrost', 'lingeringFrost'])).toEqual({
        title: 'Choisis un bienfait',
        sub: "Un seul des trois. Un bienfait dure jusqu'à la fin de l'ascension.",
      });
      expect(offerHeading(['emberHeart', 'secondBreath'])).toEqual({
        title: 'Choisis un bienfait',
        sub: "Un seul des deux. Un bienfait dure jusqu'à la fin de l'ascension.",
      });
      expect(offerHeading(['secondBreath'])).toEqual({
        title: 'Reprends ton souffle',
        sub: 'Tu as tous les bienfaits de ce palier.',
      });
    });

    it('writes the card Second souffle with the HP it will give back', () => {
      expect(secondBreathCard(40, 88)).toEqual({
        name: 'Second souffle',
        gain: '+8 PV',
        healed: 48,
        tag: 'Soin',
        effect: 'Rend 10 % de tes PV max, tout de suite.',
        hpLine: '40 → 48 / 88 PV',
        full: null,
        label: "Second souffle : rend 8 PV, de 40 à 48 PV sur 88. Ce n'est pas un bienfait.",
      });
      expect(secondBreathCard(3, 9)).toMatchObject({ gain: '+1 PV', hpLine: '3 → 4 / 9 PV' });
      expect(secondBreathCard(79, 80)).toMatchObject({ gain: '+1 PV', healed: 80 });
    });

    it('says honestly that it gives back nothing at full HP', () => {
      expect(secondBreathCard(80, 80)).toMatchObject({
        gain: '+0 PV',
        healed: 80,
        hpLine: '80 / 80 PV',
        full: 'Tes PV sont déjà pleins.',
        label:
          "Second souffle : rend 0 PV, tes PV sont déjà pleins, 80 sur 80. Ce n'est pas un bienfait.",
      });
    });

    it('announces the HP given back after the choice', () => {
      expect(secondBreathObtained(40, 88)).toEqual({
        gain: '+8 PV',
        healed: 48,
        hpLine: 'PV 40 → 48 / 88',
        line: 'PV rendus.',
        label: 'PV rendus : Second souffle, 8 PV. PV 48 sur 88.',
      });
      expect(secondBreathObtained(3, 9).label).toBe(
        'PV rendus : Second souffle, 1 PV. PV 4 sur 9.',
      );
      expect(secondBreathObtained(80, 80)).toEqual({
        gain: '+0 PV',
        healed: 80,
        hpLine: 'PV 80 / 80',
        line: 'Tes PV étaient déjà pleins.',
        label: 'Second souffle : PV déjà pleins, 80 sur 80.',
      });
    });
  });
});
