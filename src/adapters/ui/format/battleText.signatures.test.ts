// Les textes de la Mère-ronce et du Bedeau (#259, maquette 245, M1 à M7, B1 à B6, § 6) : leurs noms,
// leurs marques de signature, leurs bulles de première rencontre, les chiffres de dégâts (« ½ » du
// Sanctuaire, « −2 » des Épines), les mots de la scène et les phrases au lecteur d'écran. Les
// libellés disent « Sanctuaire », jamais « Protégé », et « par frappe », jamais « par coup ».
import { startBattle, type Battle } from '../../../domain/battle/Battle';
import type { BattleEvent } from '../../../domain/battle/BattleEvent';
import type { EnemyKind } from '../../../domain/battle/combatants';
import {
  ENEMY_NAMES,
  announcement,
  damageFloat,
  encounterHintText,
  feedbackText,
  intentSpeech,
  signatureText,
} from './battleText';

function battleOf(kinds: readonly EnemyKind[]): Battle {
  const { battle } = startBattle({ seed: 1, defenseHint: false, at: 0, enemies: kinds });
  return battle;
}

const STUN = { heroAction: 1, actionLost: false };

const resolved = (change: Partial<Extract<BattleEvent, { type: 'strikeResolved' }>> = {}) =>
  ({
    type: 'strikeResolved',
    at: 0,
    enemy: 0,
    judgement: 'good',
    delta: 40,
    damage: 6,
    guardDamage: 14,
    ...change,
  }) as const satisfies BattleEvent;

const pricked = (loss: number, heroHp: number): BattleEvent => ({
  type: 'thornsPricked',
  at: 0,
  enemy: 0,
  loss,
  heroHp,
});

describe('the names of the Bramble mother and the Beadle (#259)', () => {
  it('are « Mère-ronce », feminine, and « Bedeau », masculine, without an article', () => {
    expect([ENEMY_NAMES.brambleMother, ENEMY_NAMES.beadle]).toEqual(['Mère-ronce', 'Bedeau']);
    expect(intentSpeech('brambleMother', { category: 'skip', reason: 'stunned' })).toBe(
      "étourdie, n'agit pas",
    );
    expect(intentSpeech('beadle', { category: 'skip', reason: 'stunned' })).toBe(
      "étourdi, n'agit pas",
    );
  });
});

describe('the signature mark of the Thorns (#259, M1, M4)', () => {
  it('says « Épines 2 », the price of a strike on her', () => {
    expect(signatureText('brambleMother', { state: 'thorns', off: false })).toEqual({
      text: 'Épines 2',
      speech: 'épines : chaque frappe sur elle te coûte 2 PV',
    });
  });

  it('says the Thorns without effect while she is stunned', () => {
    expect(signatureText('brambleMother', { state: 'thorns', off: true })).toEqual({
      text: 'Épines 2',
      speech: 'épines sans effet tant qu’elle est étourdie',
    });
  });
});

describe('the signature mark of the Sanctuary (#259, B1, B3)', () => {
  it('says « Sanctuaire ½ » while his guard holds', () => {
    expect(signatureText('beadle', { state: 'sanctuary', off: false })).toEqual({
      text: 'Sanctuaire ½',
      speech: 'sanctuaire : moitié des dégâts tant que sa garde tient',
    });
  });

  it('says « Sanctuaire rompu » once his guard is broken', () => {
    expect(signatureText('beadle', { state: 'sanctuary', off: true })).toEqual({
      text: 'Sanctuaire rompu',
      speech: 'sanctuaire rompu : dégâts entiers',
    });
  });

  it('never says « Protégé » nor « par coup »', () => {
    const texts = [
      signatureText('beadle', { state: 'sanctuary', off: false }),
      signatureText('beadle', { state: 'sanctuary', off: true }),
      signatureText('brambleMother', { state: 'thorns', off: false }),
      encounterHintText('beadle'),
      encounterHintText('brambleMother'),
    ].flatMap((each) => Object.values(each));

    for (const text of texts) {
      expect(text).not.toMatch(/Protégé|par coup/u);
    }
  });
});

describe('the first encounter bubbles (#259, M1, B1)', () => {
  it('names the Bramble mother and says the price of her Thorns, once per strike', () => {
    expect(encounterHintText('brambleMother')).toEqual({
      title: 'Mère-ronce',
      text: 'Chaque frappe sur elle te coûte 2 PV, une fois par frappe, sauf quand elle est étourdie.',
      close: "Touche n'importe où pour fermer. Elle ne reviendra pas.",
      speech:
        'Mère-ronce. Chaque frappe sur elle te coûte 2 PV, une fois par frappe, sauf quand elle est étourdie.',
    });
  });

  it('names the Beadle and says his Sanctuary, and how to break it', () => {
    expect(encounterHintText('beadle')).toEqual({
      title: 'Bedeau',
      text: 'Sanctuaire : tant que sa garde tient, il ne subit que la moitié des dégâts. Brise-la.',
      close: "Touche n'importe où pour fermer. Elle ne reviendra pas.",
      speech:
        'Bedeau. Sanctuaire : tant que sa garde tient, il ne subit que la moitié des dégâts. Brise-la.',
    });
  });
});

describe('the damage numbers (#259, M2, M7, B2, B3, B4)', () => {
  it('carries « ½ » on a blow the Sanctuary reduced, the riposte and the counter-attack too', () => {
    expect(damageFloat(resolved({ sanctuary: true }))).toEqual({
      at: 0,
      text: '−6',
      big: false,
      kind: 'damage',
      half: true,
    });
    expect(
      damageFloat({
        type: 'counterAttacked',
        at: 0,
        enemy: 0,
        damage: 3,
        guardDamage: 12,
        until: 200,
        sanctuary: true,
      }),
    ).toMatchObject({ text: '−3', half: true });
    expect(
      damageFloat({
        type: 'bulwarkCountered',
        at: 0,
        enemy: 0,
        damage: 1,
        guardDamage: 3,
        until: 200,
        sanctuary: true,
      }),
    ).toMatchObject({ text: '−1', kind: 'riposte', half: true });
  });

  it('carries no « ½ » on full damage', () => {
    expect(damageFloat(resolved({ damage: 22, judgement: 'perfect' }))).not.toHaveProperty('half');
  });

  it('writes the « −2 » of the Thorns on the hero, in bramble green, « −1 » at 2 HP', () => {
    expect(damageFloat(pricked(2, 57))).toEqual({
      at: 'hero',
      text: '−2',
      big: false,
      kind: 'thorns',
    });
    expect(damageFloat(pricked(1, 1))).toMatchObject({ text: '−1', kind: 'thorns' });
  });

  it('writes nothing when the Thorns take nothing, at 1 HP', () => {
    expect(damageFloat(pricked(0, 1))).toBeNull();
  });
});

describe('the words of the scene (#259, M4, B3, B5)', () => {
  const broken: BattleEvent = { type: 'guardBroken', at: 0, enemy: 0, by: 'strike' };

  it('writes why under « Cassure » on the Bramble mother', () => {
    expect(feedbackText(broken, battleOf(['brambleMother']))).toEqual({
      tone: 'break',
      title: 'Cassure',
      sub: 'Elle pique une dernière fois, puis plus tant qu’elle est étourdie',
    });
  });

  it('writes « Sanctuaire rompu · dégâts entiers » under « Cassure » on the Beadle', () => {
    expect(feedbackText(broken, battleOf(['beadle']))).toEqual({
      tone: 'ward',
      title: 'Cassure',
      sub: 'Sanctuaire rompu · dégâts entiers',
    });
  });

  it('writes « Sanctuaire », « Sa garde est revenue » at the return to guard of the Beadle', () => {
    const restored: BattleEvent = {
      type: 'guardRestored',
      at: 0,
      enemy: 0,
      until: 600,
      inPlaceOfAction: true,
    };

    expect(feedbackText(restored, battleOf(['beadle']))).toEqual({
      tone: 'ward',
      title: 'Sanctuaire',
      sub: 'Sa garde est revenue',
    });
    expect(feedbackText(restored, battleOf(['brambleMother']))).toBeNull();
  });

  it('writes no word for the Thorns among the words of the strike: they come 300 ms later', () => {
    expect(feedbackText(pricked(2, 57), battleOf(['brambleMother']))).toBeNull();
  });
});

describe('the screen reader (#259, § 6)', () => {
  it('reads the price paid: « Épines : tu perds 2 PV, 57 sur 80 »', () => {
    expect(announcement(pricked(2, 57), battleOf(['brambleMother']))).toBe(
      'Épines : tu perds 2 PV, 57 sur 80',
    );
  });

  it('reads « Épines : tu restes à 1 PV » at 1 HP', () => {
    expect(announcement(pricked(0, 1), battleOf(['brambleMother']))).toBe(
      'Épines : tu restes à 1 PV',
    );
  });

  it('reads « moitié des dégâts » on a blow the Sanctuary reduced', () => {
    const battle = battleOf(['beadle']);

    expect(announcement(resolved({ sanctuary: true }), battle)).toBe(
      'Bonne frappe, 6 dégâts, moitié des dégâts',
    );
    expect(announcement(resolved(), battle)).toBe('Bonne frappe, 6 dégâts');
    expect(
      announcement(
        {
          type: 'counterAttacked',
          at: 0,
          enemy: 0,
          damage: 3,
          guardDamage: 12,
          until: 200,
          sanctuary: true,
        },
        battle,
      ),
    ).toBe('Contre-attaque, 3 dégâts, moitié des dégâts');
  });

  it('reads the rupture of the Sanctuary and the stun of the Bramble mother at the guard break', () => {
    const broken: BattleEvent = { type: 'guardBroken', at: 0, enemy: 0, by: 'strike' };
    const mother = battleOf(['brambleMother']);
    const stunned = {
      ...mother,
      enemies: [{ ...mother.enemies[0]!, guard: 0, stun: STUN }],
    };

    expect(announcement(broken, battleOf(['beadle']))).toBe(
      'Cassure, Bedeau étourdi. Sanctuaire du Bedeau rompu : dégâts entiers',
    );
    expect(announcement(broken, stunned)).toBe(
      'Cassure, Mère-ronce étourdie : ses épines sont sans effet',
    );
  });

  it('reads the return of the Sanctuary with the guard', () => {
    expect(
      announcement(
        { type: 'guardRestored', at: 0, enemy: 0, until: 600, inPlaceOfAction: true },
        battleOf(['beadle']),
      ),
    ).toBe('Bedeau, retour en garde. Le Bedeau est de nouveau sous Sanctuaire');
  });
});
