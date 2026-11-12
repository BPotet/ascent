// Les textes des Catacombes (#268, maquette 246, C1, C2, C4, C6) : la bulle du Porte-cierge, le mot
// de scène de sa chute, et ce que le lecteur d'écran annonce : sa chute, un coup renforcé par son
// Aura, un renfort qui la reçoit.
import { startBattle, type Battle } from '../../../domain/battle/Battle';
import type { BattleEvent } from '../../../domain/battle/BattleEvent';
import type { EnemyKind } from '../../../domain/battle/combatants';
import { announcement, encounterHintText, feedbackText, isOrdinarySignature } from './battleText';

function line(enemies: readonly EnemyKind[], fallen: readonly number[] = []): Battle {
  const { battle } = startBattle({ seed: 1, defenseHint: false, at: 0, enemies });
  return {
    ...battle,
    enemies: battle.enemies.map((enemy, index) =>
      fallen.includes(index) ? { ...enemy, hp: 0 } : enemy,
    ),
  };
}

const defeated = (enemy: number): BattleEvent => ({ type: 'enemyDefeated', at: 0, enemy });

describe('the first encounter bubble of the Candle bearer (#268, C1)', () => {
  it('says his rule, the Aura that burns while he lives, even stunned', () => {
    expect(encounterHintText('candleBearer')).toEqual({
      title: 'Porte-cierge',
      text: 'Tant qu’il vit, ses alliés font 20 % de dégâts en plus, même s’il est étourdi. Abats-le d’abord.',
      close: "Touche n'importe où pour fermer. Elle ne reviendra pas.",
      speech:
        'Porte-cierge. Tant qu’il vit, ses alliés font 20 % de dégâts en plus, même s’il est étourdi. Abats-le d’abord.',
    });
    expect(isOrdinarySignature('aura')).toBe(true);
  });
});

describe('the fall of the Candle bearer (#268, C4)', () => {
  it('writes « L’aura s’éteint » and says it after his fall, while an ally stands', () => {
    const after = line(['ghoul', 'candleBearer'], [1]);

    expect(feedbackText(defeated(1), after)).toEqual({
      tone: 'aura',
      title: 'L’aura s’éteint',
      sub: 'Ses alliés reviennent à leurs dégâts',
    });
    expect(announcement(defeated(1), after)).toBe('Porte-cierge tombe. L’aura s’éteint');
  });

  it('says nothing more when nobody stood under his Aura, nor at the fall of another enemy', () => {
    const alone = line(['ghoul', 'candleBearer'], [0, 1]);
    const ghoul = line(['ghoul', 'candleBearer'], [0]);

    expect(feedbackText(defeated(1), alone)).toBeNull();
    expect(announcement(defeated(1), alone)).toBeNull();
    expect(feedbackText(defeated(0), ghoul)).toBeNull();
    expect(announcement(defeated(0), ghoul)).toBeNull();
  });
});

describe('a blow under the Aura (#268, C2)', () => {
  const blow: BattleEvent = {
    type: 'blowResolved',
    at: 1_100,
    enemy: 0,
    index: 0,
    outcome: 'suffered',
    button: null,
    delta: null,
    damage: 6,
    heroHp: 74,
  };

  it('says the Aura of the Candle bearer after the damage', () => {
    const battle = line(['ghoul', 'candleBearer']);

    expect(announcement({ ...blow, aura: 1 } as BattleEvent, battle)).toBe(
      'Touché, 6 dégâts, aura du Porte-cierge',
    );
  });

  it('says nothing more on a blow without the Aura, nor on a blow without damage', () => {
    const battle = line(['ghoul', 'candleBearer']);
    const parried = { ...blow, outcome: 'perfectParry', damage: 0, aura: 1 } as BattleEvent;

    expect(announcement(blow, battle)).toBe('Touché, 6 dégâts');
    expect(announcement(parried, battle)).toBe('Parade parfaite');
  });
});

describe('a reinforcement under the Aura (#268, C6)', () => {
  const entered: BattleEvent = { type: 'reinforcementEntered', at: 0, enemy: 0, kind: 'skeleton' };

  it('says that it receives the Aura as it enters', () => {
    expect(announcement(entered, line(['skeleton', 'candleBearer']))).toBe(
      'Renfort : Squelette. Aura du Porte-cierge, +20 % de dégâts',
    );
  });

  it('says nothing for a reinforcement without the Aura, as before', () => {
    expect(announcement(entered, line(['skeleton', 'ghoul']))).toBeNull();
  });
});
