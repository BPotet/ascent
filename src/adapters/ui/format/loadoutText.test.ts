import type { StartingBlessing } from '../../../domain/ascent/blessings';
import type { BoonKind } from '../../../domain/ascent/boons';
import type { Loadout } from '../../../domain/ascent/loadout';
import {
  LOADOUT_SUBTITLE,
  NO_BLESSING,
  NO_BLESSING_YET,
  NO_BOON,
  NO_BOON_YET,
  RESERVES_TITLE,
  blessingTag,
  favorRows,
  reserveRows,
  reservesHeadingLabel,
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

describe('the rows of the favor of the ascent (#42, #206, E1)', () => {
  it('lists the rerolls, then the second chance ready at +2', () => {
    expect(
      favorRows({ gauge: 2, rerollsLeft: 1, rerollsGranted: 2, secondChance: 'ready' }),
    ).toEqual([
      {
        key: 'rerolls',
        glyph: 'reroll',
        name: 'Relances',
        effect: "Redonnent l'offre de bienfaits.",
        state: '1 sur 2',
        used: false,
        tone: 'favor',
        label: "Relances, 1 sur 2. Redonnent l'offre de bienfaits.",
      },
      {
        key: 'secondChance',
        glyph: 'secondChance',
        name: 'Seconde chance',
        effect: 'À 0 PV, relève une fois avec 50 % des PV max.',
        state: 'Prête',
        used: false,
        tone: 'favor',
        label: 'Seconde chance, Prête. À 0 PV, relève une fois avec 50 % des PV max.',
      },
    ]);
  });

  it('greys the rows that have served', () => {
    const rows = favorRows({ gauge: 2, rerollsLeft: 0, rerollsGranted: 2, secondChance: 'used' });

    expect(rows.map(({ state, used }) => [state, used])).toEqual([
      ['0 sur 2', true],
      ['Utilisée', true],
    ]);
  });

  it('lists the rerolls only at +1', () => {
    expect(
      favorRows({ gauge: 1, rerollsLeft: 1, rerollsGranted: 1 }).map(({ key }) => key),
    ).toEqual(['rerolls']);
  });
});

describe('the reserves of the ascent (#226, E1, E3)', () => {
  it('lists the Gold, then the keys left', () => {
    expect(RESERVES_TITLE).toBe('Réserves');
    expect(reserveRows({ gold: 35, keys: 2 })).toEqual([
      {
        key: 'gold',
        glyph: 'coin8',
        name: 'Or',
        effect: 'Gagné à chaque étage franchi.',
        state: '35',
        used: false,
        tone: 'gold',
        label: 'Or, 35',
      },
      {
        key: 'keys',
        glyph: 'key8',
        name: 'Clés',
        effect: "Ouvrent le coffre scellé d'une Élite. Perdues à la fin de l'ascension.",
        state: '2',
        used: false,
        tone: 'gold',
        label: "Clés, 2 : ouvrent le coffre scellé d'une Élite",
      },
    ]);
  });

  it('greys the keys without key, and says where they come from (E3)', () => {
    expect(reserveRows({ gold: 0, keys: 0 })[1]).toMatchObject({
      effect: 'Aucune clé. La faveur et Fortune en donnent.',
      state: '0',
      used: true,
      label: 'Clés, 0 : aucune clé. La faveur et Fortune en donnent',
    });
  });

  it('reads the heading of the section', () => {
    expect(reservesHeadingLabel()).toBe('Réserves');
  });
});
