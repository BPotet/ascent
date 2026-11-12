// Les textes du Battant de cloche et du Bélier de bronze (#266, maquette 246, A1 à A12, § 5) : leurs
// noms, leurs marques de signature, leurs bulles de première rencontre, les mots de la scène
// (« Balayé », « Il charge », « Cassure · Charge brisée ») et les phrases au lecteur d'écran.
import { startBattle, type Battle, type EnemyState } from '../../../domain/battle/Battle';
import type { BattleEvent } from '../../../domain/battle/BattleEvent';
import {
  ATTACK_NAMES,
  ENEMY_NAMES,
  announcement,
  encounterHintText,
  enemyLabel,
  feedbackText,
  intentSpeech,
  signatureText,
} from './battleText';

function belfry(change: Partial<EnemyState> = {}): Battle {
  const { battle } = startBattle({
    seed: 1,
    defenseHint: false,
    at: 0,
    enemies: ['bellClapper', 'bronzeRam'],
  });
  return {
    ...battle,
    enemies: battle.enemies.map((enemy, index) => (index === 1 ? { ...enemy, ...change } : enemy)),
  };
}

const sweepDodge: BattleEvent = {
  type: 'blowResolved',
  at: 0,
  enemy: 0,
  index: 0,
  outcome: 'sweepDodge',
  button: 'dodge',
  delta: 0,
  damage: 10,
  heroHp: 52,
};

describe('the names of the enemies of the Belfry (#266)', () => {
  it('names the Bell clapper and the Bronze ram, and the Sweep', () => {
    expect([ENEMY_NAMES.bellClapper, ENEMY_NAMES.bronzeRam]).toEqual([
      'Battant de cloche',
      'Bélier de bronze',
    ]);
    expect(ATTACK_NAMES.sweep).toBe('balayage');
  });
});

describe('the Sweep (#266, A1 to A5)', () => {
  it('says its mark: « Balayage », and how to answer it', () => {
    expect(signatureText('bellClapper', { state: 'sweep' })).toEqual({
      text: 'Balayage',
      speech: 'balayage : l’esquive échoue, pare',
    });
  });

  it('teaches it in its first encounter bubble (A1)', () => {
    expect(encounterHintText('bellClapper')).toEqual({
      title: 'Battant de cloche',
      text: 'Son Balayage rase le sol : l’esquive échoue. Quand le trait file au sol vers toi, pare.',
      close: "Touche n'importe où pour fermer. Elle ne reviendra pas.",
      speech:
        'Battant de cloche. Son Balayage rase le sol : l’esquive échoue. Quand le trait file au sol vers toi, pare.',
    });
  });

  it('says its wind-up and the right answer: « Battant de cloche, balayage, parade » (A2)', () => {
    const windUp: BattleEvent = {
      type: 'windUpStarted',
      at: 0,
      enemy: 0,
      attack: 'sweep',
      impacts: [1_300],
      feintAt: null,
    };

    expect(announcement(windUp, belfry())).toBe('Battant de cloche, balayage, parade');
  });

  it('writes « Balayé » on a dodge in the window, and says the damage and the off-balance (A5)', () => {
    expect(feedbackText(sweepDodge, belfry())).toEqual({
      tone: 'sweep',
      title: 'Balayé',
      sub: 'L’esquive échoue · pare le Balayage',
    });
    expect(announcement(sweepDodge, belfry())).toBe(
      'Balayage : l’esquive échoue, 10 dégâts. Déséquilibré',
    );
  });

  it('says no off-balance when the dodge on a Sweep ends the battle', () => {
    const over: Battle = { ...belfry(), phase: { kind: 'over', outcome: 'defeat', at: 0 } };

    expect(announcement({ ...sweepDodge, heroHp: 0 } as BattleEvent, over)).toBe(
      'Balayage : l’esquive échoue, 10 dégâts',
    );
  });

  it('reads its column with its mark, as an ordinary enemy, never an Elite', () => {
    const clapper = belfry().enemies[0]!;

    expect(
      enemyLabel(
        clapper,
        { category: 'attack' },
        true,
        undefined,
        'balayage : l’esquive échoue, pare',
      ),
    ).toBe(
      'Battant de cloche, cible, 46 PV sur 46, garde 30 sur 30, balayage : l’esquive échoue, pare, intention : attaque',
    );
  });
});

describe('the Charge (#266, A6 to A12)', () => {
  it.each([
    ['idle', 'Charge', 'charge sur 2 manches : brise sa garde pendant la charge pour l’annuler'],
    ['first', 'Charge 1/2', 'charge, manche 1 sur 2 : brise sa garde pour l’annuler'],
    [
      'second',
      'Charge 2/2',
      'charge, manche 2 sur 2 : gros coup à son tour, brise sa garde pour l’annuler',
    ],
    ['broken', 'Charge brisée', 'charge brisée : pas de gros coup'],
  ] as const)('says its mark %s: « %s »', (mark, text, speech) => {
    expect(signatureText('bronzeRam', { state: 'charge', mark })).toEqual({ text, speech });
  });

  it('teaches it in its first encounter bubble (A6)', () => {
    expect(encounterHintText('bronzeRam')).toEqual({
      title: 'Bélier de bronze',
      text: 'Il charge pendant 2 manches, puis frappe fort. Brise sa garde pendant la charge pour l’annuler.',
      close: "Touche n'importe où pour fermer. Elle ne reviendra pas.",
      speech:
        'Bélier de bronze. Il charge pendant 2 manches, puis frappe fort. Brise sa garde pendant la charge pour l’annuler.',
    });
  });

  it('says the intent Charge, then the Ram blow as an attack (§ 5)', () => {
    expect(intentSpeech('bronzeRam', { category: 'charge', notches: 1 })).toBe(
      'intention : charge',
    );
    expect(intentSpeech('bronzeRam', { category: 'charge', notches: 2 })).toBe(
      'intention : attaque',
    );
  });

  it('writes « Il charge » at its action, and says it (A7)', () => {
    const charged: BattleEvent = { type: 'chargeStarted', at: 0, enemy: 1 };

    expect(feedbackText(charged, belfry())).toEqual({
      tone: 'charge',
      title: 'Il charge',
      sub: 'Pas de coup cette manche · gros coup à la suivante',
    });
    expect(announcement(charged, belfry())).toBe(
      'Le Bélier de bronze charge. Gros coup à la manche suivante',
    );
  });

  it('writes « Cassure », « Charge brisée · pas de gros coup » when the break breaks it (A9)', () => {
    const broken = belfry({ charge: 'broken', stun: { actionLost: false, heroAction: 1 } });
    const event: BattleEvent = { type: 'guardBroken', at: 0, enemy: 1, by: 'strike' };

    expect(feedbackText(event, broken)).toEqual({
      tone: 'break',
      title: 'Cassure',
      sub: 'Charge brisée · pas de gros coup',
    });
    expect(announcement(event, broken)).toBe(
      'Cassure, Bélier de bronze étourdi : charge brisée, pas de gros coup',
    );
    expect(announcement({ type: 'chargeBroken', at: 0, enemy: 1 }, broken)).toBeNull();
  });

  it('writes only « Cassure » when the break comes too late', () => {
    const late = belfry({ stun: { actionLost: false, heroAction: 1 } });
    const event: BattleEvent = { type: 'guardBroken', at: 0, enemy: 1, by: 'counter' };

    expect(feedbackText(event, late)).toEqual({ tone: 'break', title: 'Cassure' });
  });
});
