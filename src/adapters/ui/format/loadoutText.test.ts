import type { StartingBlessing } from '../../../domain/ascent/blessings';
import type { BoonKind } from '../../../domain/ascent/boons';
import type { Loadout } from '../../../domain/ascent/loadout';
import {
  LOADOUT_SUBTITLE,
  NO_BLESSING,
  NO_BLESSING_YET,
  NO_BOON,
  NO_BOON_YET,
  blessingTag,
  loadoutButtonLabel,
  loadoutTitle,
} from './loadoutText';

const HASTE: StartingBlessing = { family: 'haste', rarity: 'rare' };
const VIGOR: StartingBlessing = { family: 'vigor', rarity: 'common' };
const PROTECTION: StartingBlessing = { family: 'protection', rarity: 'epic' };
const FIVE: readonly BoonKind[] = [
  'perfectEcho',
  'lingeringFrost',
  'shatteringEmber',
  'blazingEmber',
  'emberHeart',
];

const loadout = (blessings: readonly StartingBlessing[], boons: readonly BoonKind[]): Loadout => ({
  blessings,
  boons,
});

describe('loadoutButtonLabel (#159)', () => {
  it.each([
    [
      '3 blessings and 5 boons',
      loadout([PROTECTION, HASTE, VIGOR], FIVE),
      'Équipement : 3 bénédictions de départ, 5 bienfaits. Ouvre la liste',
    ],
    [
      'one blessing and one boon, in the singular',
      loadout([HASTE], ['perfectEcho']),
      'Équipement : 1 bénédiction de départ, 1 bienfait. Ouvre la liste',
    ],
    [
      'boons without blessing',
      loadout([], ['perfectEcho', 'lingeringFrost']),
      'Équipement : 2 bienfaits. Ouvre la liste',
    ],
    [
      'blessings without boon',
      loadout([HASTE, VIGOR], []),
      'Équipement : 2 bénédictions de départ. Ouvre la liste',
    ],
    ['an empty loadout', loadout([], []), 'Équipement : vide. Ouvre la liste'],
  ])('reads %s out of combat', (_, shown, label) => {
    expect(loadoutButtonLabel(shown, { combat: false })).toBe(label);
  });

  it.each([
    [
      loadout([PROTECTION, HASTE, VIGOR], FIVE),
      'Équipement : 3 bénédictions de départ, 5 bienfaits. Ouvre la liste. Met le combat en pause',
    ],
    [loadout([], []), 'Équipement : vide. Ouvre la liste. Met le combat en pause'],
  ])('tells in combat that it pauses the battle', (shown, label) => {
    expect(loadoutButtonLabel(shown, { combat: true })).toBe(label);
  });
});

describe('the texts of the loadout (#159)', () => {
  it('titles the section with its count', () => {
    expect(loadoutTitle(3)).toBe('Équipement · 3');
    expect(loadoutTitle(0)).toBe('Équipement · 0');
  });

  it('tells the sheet subtitle and the empty states', () => {
    expect(LOADOUT_SUBTITLE).toBe(
      "Tes bénédictions et tes bienfaits, jusqu'à la fin de l'ascension.",
    );
    expect(NO_BLESSING_YET).toBe(
      "Aucune bénédiction de départ : aucune habitude faite hier ne l'a donnée.",
    );
    expect(NO_BOON_YET).toBe("Aucun bienfait pour l'instant. Gagne un combat pour en choisir un.");
    expect(NO_BLESSING).toBe('Aucune bénédiction de départ');
    expect(NO_BOON).toBe('Aucun bienfait');
  });

  it.each([
    [HASTE, '◆◆ Bénédiction · Rare'],
    [VIGOR, '◆ Bénédiction · Commune'],
    [PROTECTION, '◆◆◆ Bénédiction · Épique'],
  ])(
    'tags a starting blessing with its diamonds and its rarity in the feminine',
    (blessing, tag) => {
      expect(blessingTag(blessing)).toBe(tag);
    },
  );
});
