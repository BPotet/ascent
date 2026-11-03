// Les textes de l'Invocation (#172, maquette 170, I1 à I8) : les noms, l'étiquette « Invoquée »,
// l'annonce et ses phrases au lecteur d'écran.
import { startBattle, type Battle } from '../../../domain/battle/Battle';
import type { BattleEvent } from '../../../domain/battle/BattleEvent';
import type { EnemyKind } from '../../../domain/battle/combatants';
import {
  ENEMY_NAMES,
  announcement,
  announcementsFor,
  enemyLabel,
  enemyTag,
  summonBannerText,
} from './battleText';

function battleOf(kinds: readonly EnemyKind[], fallen: readonly number[] = []): Battle {
  const { battle } = startBattle({ seed: 1, defenseHint: false, at: 0, enemies: kinds });
  return {
    ...battle,
    enemies: battle.enemies.map((enemy, index) =>
      fallen.includes(index) ? { ...enemy, hp: 0 } : enemy,
    ),
  };
}

const shifted: BattleEvent = { type: 'bossPhaseShifted', at: 0, enemy: 0 };
const called = (slots: readonly number[]): BattleEvent => ({
  type: 'summonCalled',
  at: 0,
  enemy: 0,
  kind: 'mothkin',
  slots,
});
const fell = (enemy: number): BattleEvent => ({ type: 'summonedFell', at: 0, enemy });

describe('the names of the Summon (#172)', () => {
  it('names the Moth queen with her article, and the Mothkin', () => {
    expect(ENEMY_NAMES.mothQueen).toBe('La Reine des phalènes');
    expect(ENEMY_NAMES.mothkin).toBe('Phalénide');
  });
});

describe('the tag « Invoquée » (#172)', () => {
  const mothkin = battleOf(['mothQueen', 'mothkin']).enemies[1]!;

  it('tags a summoned Mothkin « Invoquée », agreed with its name', () => {
    expect(enemyTag({ ...mothkin, summoned: true })).toBe('Invoquée');
    expect(enemyTag({ ...battleOf(['skeleton']).enemies[0]!, summoned: true })).toBe('Invoqué');
  });

  it('never tags a Mothkin drawn in an ordinary group', () => {
    expect(enemyTag(mothkin)).toBeNull();
  });

  it('prefers « Invoquée » to « Relevée » for an enemy that is both', () => {
    expect(enemyTag({ ...mothkin, summoned: true, selfRevives: 1 })).toBe('Invoquée');
    expect(enemyTag({ ...mothkin, selfRevives: 1 })).toBe('Relevée');
  });

  it('reads a summoned Mothkin as an enemy: « Phalénide, invoquée, 33 PV sur 33, … »', () => {
    const summoned = {
      ...mothkin,
      summoned: true as const,
      hp: 33,
      maxHp: 33,
      guard: 7,
      maxGuard: 7,
    };

    expect(enemyLabel(summoned, { category: 'attack' }, false)).toBe(
      'Phalénide, invoquée, 33 PV sur 33, garde 7 sur 7, intention : attaque',
    );
  });
});

describe('the banner of the Summon (#172, I2, I6)', () => {
  it('says « Elle appelle les Phalénides » for two, under the phase shift of the Queen', () => {
    expect(summonBannerText('mothQueen', 'mothkin', 2)).toEqual({
      title: 'Elle appelle les Phalénides',
      line: 'La Reine des phalènes change de phase',
    });
  });

  it('says « Elle appelle une Phalénide » for one', () => {
    expect(summonBannerText('mothQueen', 'mothkin', 1).title).toBe('Elle appelle une Phalénide');
  });

  it('agrees the pronoun with the boss and the article with the summoned enemy', () => {
    expect(summonBannerText('ossuaryWarden', 'skeleton', 1).title).toBe(
      'Elle appelle un Squelette',
    );
    expect(summonBannerText('facelessPrior', 'ghoul', 2).title).toBe('Il appelle les Goules');
  });
});

describe('the screen reader at the Summon (#172)', () => {
  it('says the phase shift and the two Mothkin in one sentence', () => {
    expect(announcementsFor([shifted, called([1, 2])], battleOf(['mothQueen']))).toEqual([
      'La Reine des phalènes change de phase. Elle appelle les Phalénides : deux Phalénides entrent à la prochaine manche.',
    ]);
  });

  it('says where the Mothkin enters when it takes the slot of a fallen Mothkin (I6)', () => {
    const battle = battleOf(['mothQueen', 'mothkin', 'ghoul'], [1]);

    expect(announcementsFor([shifted, called([1])], battle)).toEqual([
      'La Reine des phalènes change de phase. Elle appelle une Phalénide : elle entre à la prochaine manche, à la place de la Phalénide tombée.',
    ]);
  });

  it('names the fallen enemy whose slot is taken, with its article', () => {
    const say = (kinds: readonly EnemyKind[]) =>
      announcementsFor([shifted, called([1])], battleOf(kinds, [1]))[0];

    expect(say(['mothQueen', 'ghoul', 'ghoul'])).toContain('à la place de la Goule tombée.');
    expect(say(['mothQueen', 'skeleton', 'ghoul'])).toContain('à la place du Squelette tombé.');
    expect(say(['mothQueen', 'ashBramble', 'ghoul'])).toContain(
      'à la place de la Ronce de cendre tombée.',
    );
    expect(say(['mothQueen', 'ossuaryWarden', 'ghoul'])).toContain(
      'à la place de la Gardienne des ossuaires tombée.',
    );
    expect(say(['mothQueen', 'twins', 'ghoul'])).toContain('à la place des Jumeaux tombés.');
    expect(say(['mothQueen', 'mothQueen', 'ghoul'])).toContain(
      'à la place de la Reine des phalènes tombée.',
    );
    expect(say(['mothQueen', 'ashGleaner', 'ghoul'])).toContain(
      'à la place de la Glaneuse de cendre tombée.',
    );
    expect(say(['mothQueen', 'scarecrow', 'ghoul'])).toContain(
      "à la place de l'Épouvantail tombé.",
    );
  });

  it('says only the phase shift when the line is full (I8)', () => {
    expect(announcementsFor([shifted], battleOf(['mothQueen', 'ghoul', 'ghoul']))).toEqual([
      'La Reine des phalènes change de phase.',
    ]);
    expect(announcement(shifted, battleOf(['ashGardener']))).toBe(
      'Jardinière des cendres change de phase.',
    );
  });

  it('says one Mothkin entering an empty slot without a fallen enemy to replace', () => {
    expect(announcementsFor([shifted, called([2])], battleOf(['mothQueen', 'ghoul']))).toEqual([
      'La Reine des phalènes change de phase. Elle appelle une Phalénide : elle entre à la prochaine manche.',
    ]);
  });

  it('says two Mothkin without the slots when they replace fallen enemies', () => {
    const battle = battleOf(['mothQueen', 'ghoul', 'ghoul'], [1, 2]);

    expect(announcementsFor([shifted, called([1, 2])], battle)[0]).toBe(
      'La Reine des phalènes change de phase. Elle appelle les Phalénides : deux Phalénides entrent à la prochaine manche.',
    );
  });

  it('says « La Reine des phalènes tombe. Les Phalénides tombent avec elle. » once', () => {
    const battle = battleOf(['mothQueen', 'mothkin', 'mothkin'], [0, 1, 2]);

    expect(announcementsFor([fell(1), fell(2)], battle)).toEqual([
      'La Reine des phalènes tombe. Les Phalénides tombent avec elle.',
    ]);
  });

  it('says the fall of a single Mothkin with the Queen', () => {
    const battle = battleOf(['mothQueen', 'mothkin', 'mothkin'], [0, 2]);

    expect(announcementsFor([fell(2)], battle)).toEqual([
      'La Reine des phalènes tombe. La Phalénide tombe avec elle.',
    ]);
  });

  it('says the other events as before, in their order', () => {
    const battle = battleOf(['mothQueen']);
    const ended: BattleEvent = { type: 'battleEnded', at: 0, outcome: 'victory' };

    expect(announcementsFor([fell(1), ended], battleOf(['mothQueen', 'mothkin'], [0, 1]))).toEqual([
      'La Reine des phalènes tombe. La Phalénide tombe avec elle.',
      'Combat gagné.',
    ]);
    expect(announcementsFor([ended], battle)).toEqual(['Combat gagné.']);
    expect(
      announcementsFor([{ type: 'summonEntered', at: 0, enemy: 1, kind: 'mothkin' }], battle),
    ).toEqual([]);
  });
});
