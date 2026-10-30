import { BOON_KINDS } from '../../../domain/ascent/boons';
import {
  BOON_NAMES,
  boonCard,
  boonChip,
  boonObtainedLabel,
  ownedBoonsLabel,
  ownedBoonsLine,
} from './boonText';

describe('boonText', () => {
  it('names the 7 boons', () => {
    expect(BOON_KINDS.map((kind) => BOON_NAMES[kind])).toEqual([
      'Écho parfait',
      'Braise brisante',
      'Peau de givre',
      'Lame juste',
      'Braise ardente',
      'Givre persistant',
      'Cœur de braise',
    ]);
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

  it('lists the owned boons', () => {
    expect(ownedBoonsLine([])).toBe('Aucun bienfait');
    expect(ownedBoonsLine(['perfectEcho', 'lingeringFrost'])).toBe(
      'Bienfaits : Écho parfait, Givre persistant',
    );
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
