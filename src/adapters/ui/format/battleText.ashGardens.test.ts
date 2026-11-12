// Les textes de la Cosse de braise et de la Phalène voleuse (#267, maquette 246, J1 à J10) : leurs
// noms, leurs marques de signature, leurs bulles de première rencontre, les mots de la scène
// (« Elle éclate », « Éteinte », « Cassure ») et les phrases au lecteur d'écran.
import { startBattle, type AttackStep, type Battle } from '../../../domain/battle/Battle';
import type { BattleEvent, BlowOutcome } from '../../../domain/battle/BattleEvent';
import {
  ENEMY_NAMES,
  announcement,
  announcementsFor,
  encounterHintText,
  feedbackText,
  signatureText,
} from './battleText';

/** La Phalène voleuse (place 0), la Ronce de cendre et la Cosse de braise (place 2). */
function gardens(): Battle {
  return startBattle({
    seed: 1,
    defenseHint: false,
    at: 0,
    enemies: ['thievingMoth', 'ashBramble', 'emberPod'],
  }).battle;
}

/** Le Frôlement de la Phalène, son 1er impact résolu sur `outcome`. */
function brushing(outcome: BlowOutcome): Battle {
  const step: AttackStep = {
    kind: 'attack',
    enemy: 0,
    attack: 'double',
    damage: 4,
    startedAt: 0,
    feintAt: null,
    feintShown: false,
    impacts: [
      { at: 1_000, landed: true, lost: false, outcome },
      { at: 1_420, landed: false, lost: false, outcome: null },
    ],
    resolvedAt: 1_580,
    counter: null,
  };
  return { ...gardens(), phase: { kind: 'enemy', step }, lastPlayed: 'enemy' };
}

const blow = (
  outcome: BlowOutcome,
  damage: number,
): Extract<BattleEvent, { type: 'blowResolved' }> => ({
  type: 'blowResolved',
  at: 1_000,
  enemy: 0,
  index: 0,
  outcome,
  button: outcome === 'suffered' ? null : 'parry',
  delta: 0,
  damage,
  heroHp: 56,
});

const stolen: BattleEvent = { type: 'momentumStolen', at: 1_000, enemy: 0, stolen: 1, momentum: 2 };
const burst: BattleEvent = {
  type: 'heroBurning',
  at: 600,
  added: 2,
  stacks: 3,
  cause: 'emberBurst',
  enemy: 2,
};
const smothered: BattleEvent = { type: 'emberBurstSmothered', at: 600, enemy: 2 };

describe('the names of the enemies of the Ash gardens (#267)', () => {
  it('names the Ember pod and the Thieving moth, never the Mothkin', () => {
    expect([ENEMY_NAMES.emberPod, ENEMY_NAMES.thievingMoth]).toEqual([
      'Cosse de braise',
      'Phalène voleuse',
    ]);
    expect(ENEMY_NAMES.mothkin).toBe('Phalénide');
  });
});

describe('the marks of the Ash gardens (#267)', () => {
  it('says « Braises 2 » on a standing pod, and its price', () => {
    expect(signatureText('emberPod', { state: 'emberBurst', off: false })).toEqual({
      text: 'Braises 2',
      speech: 'à sa mort, 2 charges de Brûlure, sauf si elle est étourdie',
    });
  });

  it('keeps « Braises 2 », struck through, on a stunned pod, and says it lights nothing', () => {
    expect(signatureText('emberPod', { state: 'emberBurst', off: true })).toEqual({
      text: 'Braises 2',
      speech: 'étourdie : pas de Brûlure à sa mort',
    });
  });

  it('says « Vole l’Élan » on the Thieving moth: only the perfect parry and the dodge keep it', () => {
    expect(signatureText('thievingMoth', { state: 'momentumTheft' })).toEqual({
      text: "Vole l'Élan",
      speech:
        'vole 1 Élan à chaque impact qui te touche, bonne parade comprise ; parade parfaite ou esquive : rien n’est volé',
    });
  });
});

describe('the first encounter bubbles of the Ash gardens (#267, J1, J6)', () => {
  it('teaches the theft of the Thieving moth with the words of the corrected mockup', () => {
    expect(encounterHintText('thievingMoth')).toEqual({
      title: 'Phalène voleuse',
      text: 'Chaque impact qui te touche te vole 1 Élan, même une bonne parade. Seules la parade parfaite et l’esquive le protègent.',
      close: "Touche n'importe où pour fermer. Elle ne reviendra pas.",
      speech:
        'Phalène voleuse. Chaque impact qui te touche te vole 1 Élan, même une bonne parade. Seules la parade parfaite et l’esquive le protègent.',
    });
  });

  it('teaches the Burst of the Ember pod', () => {
    expect(encounterHintText('emberPod')).toMatchObject({
      title: 'Cosse de braise',
      text: 'À sa mort, elle t’inflige 2 charges de Brûlure. Brise sa garde avant de l’achever : étourdie, elle s’éteint.',
    });
  });
});

describe('the words of the scene (#267)', () => {
  it('writes « Elle éclate » in ember on a Burst, with the Burn of the hero (J7, J10)', () => {
    expect(feedbackText(burst, gardens())).toEqual({
      tone: 'ember',
      title: 'Elle éclate',
      sub: 'Brûlure ×3',
    });
  });

  it('writes nothing for the Burn of an impact', () => {
    expect(feedbackText({ type: 'heroBurning', at: 0, added: 1, stacks: 1 }, gardens())).toBeNull();
  });

  it('writes « Éteinte » in smoke on a smothered pod (J9)', () => {
    expect(feedbackText(smothered, gardens())).toEqual({
      tone: 'smoke',
      title: 'Éteinte',
      sub: 'Achevée étourdie · pas de Brûlure',
    });
  });

  it('says under « Cassure » that a stunned pod has no more embers (J8)', () => {
    const battle = gardens();
    expect(feedbackText({ type: 'guardBroken', at: 0, enemy: 2, by: 'strike' }, battle)).toEqual({
      tone: 'break',
      title: 'Cassure',
      sub: 'Étourdie : plus de Braises à sa mort',
    });
  });

  it('says under a good parry that the moth stole 1 momentum, so that it does not look like a bug (J2b)', () => {
    expect(feedbackText(stolen, brushing('parry'))).toEqual({
      tone: 'steal',
      title: 'Parade',
      sub: 'Bonne parade : 1 Élan volé',
    });
    expect(feedbackText(stolen, brushing('suffered'))).toBeNull();
  });

  it('says under a perfect parry on the moth that nothing is stolen (J3)', () => {
    expect(feedbackText(blow('perfectParry', 0), brushing('perfectParry'))).toEqual({
      tone: 'perfect',
      title: 'Parfait',
      sub: 'Parade parfaite : rien n’est volé · +1 Élan',
    });
  });
});

describe('the screen reader (#267)', () => {
  it('says the Burst after the fall, with the stacks of the Burst and the total (J7)', () => {
    expect(announcement(burst, gardens())).toBe(
      'Cosse de braise tombe. Elle éclate : Brûlure, 2 charges, 3 sur 5',
    );
  });

  it('says a smothered pod (J9)', () => {
    expect(announcement(smothered, gardens())).toBe(
      'Cosse de braise tombe, étourdie : elle s’éteint, pas de Brûlure',
    );
  });

  it('says what the guard break changes on a pod (J8)', () => {
    expect(announcement({ type: 'guardBroken', at: 0, enemy: 2, by: 'strike' }, gardens())).toBe(
      'Cassure, Cosse de braise étourdie : pas de Brûlure à sa mort',
    );
  });

  it('says the damage, then the theft, and nothing for the change of momentum (J2)', () => {
    expect(
      announcementsFor(
        [blow('suffered', 4), stolen, { type: 'momentumChanged', at: 1_000, momentum: 2 }],
        brushing('suffered'),
      ),
    ).toEqual(['Touché, 4 dégâts', 'La Phalène voleuse te vole 1 Élan, 2 sur 5']);
  });

  it('says nothing more than the damage when nothing is stolen (J4)', () => {
    expect(announcementsFor([blow('suffered', 4)], brushing('suffered'))).toEqual([
      'Touché, 4 dégâts',
    ]);
  });

  it('says that nothing is stolen on a perfect parry on the moth (J3)', () => {
    expect(announcement(blow('perfectParry', 0), brushing('perfectParry'))).toBe(
      'Parade parfaite, rien n’est volé',
    );
    expect(announcement({ ...blow('perfectParry', 0), enemy: 1 }, gardens())).toBe(
      'Parade parfaite',
    );
  });
});
