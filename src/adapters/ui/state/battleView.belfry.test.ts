// Ce que l'écran montre du Battant de cloche et du Bélier de bronze (#266, maquette 246, A1 à A12) :
// leurs marques de signature lues dans le domaine, le trait de balayage pendant la préparation d'un
// Balayage, et la ligne du pouce de la Charge.
import {
  startBattle,
  type AttackStep,
  type Battle,
  type EnemyState,
  type SupportStep,
} from '../../../domain/battle/Battle';
import type { Intent } from '../../../domain/battle/intents';
import { battleView } from './battleView';

const FRONT_BLOW: Intent = {
  category: 'attack',
  attack: 'basic',
  damage: 6,
  windUpMs: 1_100,
  feintFraction: 0.5,
};

/** Le Battant de cloche (place 0) et le Bélier de bronze (place 1), le Bélier changé et ciblé. */
function belfry(change: Partial<EnemyState> = {}, battle: Partial<Battle> = {}): Battle {
  const { battle: started } = startBattle({
    seed: 1,
    defenseHint: false,
    at: 0,
    enemies: ['bellClapper', 'bronzeRam'],
  });
  return {
    ...started,
    target: 1,
    ...battle,
    enemies: started.enemies.map((enemy, index) =>
      index === 1 ? { ...enemy, intent: FRONT_BLOW, ...change } : enemy,
    ),
  };
}

function sweeping(): Battle {
  const step: AttackStep = {
    kind: 'attack',
    enemy: 0,
    attack: 'sweep',
    damage: 6,
    startedAt: 0,
    feintAt: null,
    feintShown: false,
    impacts: [{ at: 1_300, landed: false, lost: false, outcome: null }],
    resolvedAt: 1_460,
    counter: null,
  };
  return belfry({}, { phase: { kind: 'enemy', step }, lastPlayed: 'enemy' });
}

const signatureOf = (battle: Battle, index = 1) => battleView(battle).enemies[index]!.signature;

describe('the signature mark of the Bell clapper (#266, A1)', () => {
  it('says « Balayage », with its two grazing arrows', () => {
    expect(signatureOf(belfry(), 0)).toEqual({
      variant: 'sweep',
      glyph: 'sweep8',
      text: 'Balayage',
      speech: 'balayage : l’esquive échoue, pare',
      off: false,
      now: false,
    });
  });

  it('reads its column as an ordinary enemy, with its mark, never an Elite', () => {
    const { label } = battleView(belfry()).enemies[0]!;

    expect(label).toBe(
      'Battant de cloche, 46 PV sur 46, garde 30 sur 30, balayage : l’esquive échoue, pare, intention : attaque',
    );
    expect(battleView(belfry()).enemies[0]).not.toHaveProperty('elite');
  });
});

describe('the stroke of the Sweep (#266, A2, A3)', () => {
  it('stands over the Bell clapper during the wind-up of its Sweep, never the seal', () => {
    expect(battleView(sweeping())).toMatchObject({ swept: 0, sealed: null });
  });

  it('is absent outside a Sweep', () => {
    expect(battleView(belfry()).swept).toBeNull();
  });

  it('leaves the Dodge key neither greyed nor hidden during a Sweep', () => {
    expect(battleView(sweeping()).pad).toEqual({
      kind: 'defense',
      locked: false,
      lock: null,
      offBalance: false,
    });
  });
});

describe('the signature mark of the Bronze ram (#266, A6 to A12)', () => {
  it('says « Charge » at rest, with its horns', () => {
    expect(signatureOf(belfry())).toEqual({
      variant: 'charge',
      glyph: 'ram8',
      text: 'Charge',
      speech: 'charge sur 2 manches : brise sa garde pendant la charge pour l’annuler',
      off: false,
      now: false,
    });
  });

  it('says « Charge 1/2 » with the intent Charge, underlined (A6, A7)', () => {
    expect(signatureOf(belfry({ intent: { category: 'charge' } }))).toMatchObject({
      text: 'Charge 1/2',
      glyph: 'ram8',
      now: true,
      off: false,
    });
  });

  it('says « Charge 2/2 » in the round of its Ram blow (A8, A10)', () => {
    expect(signatureOf(belfry({ charge: 'charging' }))).toMatchObject({
      text: 'Charge 2/2',
      now: true,
    });
  });

  it('says « Charge brisée », greyed, with a cracked glyph (A9)', () => {
    expect(
      signatureOf(belfry({ charge: 'broken', stun: { actionLost: false, heroAction: 1 } })),
    ).toEqual({
      variant: 'charge',
      glyph: 'crack8',
      text: 'Charge brisée',
      speech: 'charge brisée : pas de gros coup',
      off: true,
      now: false,
    });
  });

  it('shows no mark once fallen', () => {
    expect(signatureOf(belfry({ hp: 0 }))).toBeUndefined();
  });
});

describe('the thumb line of the Charge (#266, A6, A7, A8)', () => {
  it('tells how to cancel the Charge when the Bronze ram is the target (A6)', () => {
    expect(battleView(belfry({ intent: { category: 'charge' } })).line).toEqual({
      before: 'Cible : ',
      strong: 'Bélier de bronze',
      after: ' · brise sa garde pour annuler sa charge',
    });
  });

  it('tells to break its guard before the big blow, in the round of the Ram blow (A8)', () => {
    expect(battleView(belfry({ charge: 'charging' })).line?.after).toBe(
      ' · brise sa garde avant son gros coup',
    );
  });

  it('says nothing more for another target, nor without a Charge', () => {
    expect(battleView(belfry({ intent: { category: 'charge' } }, { target: 0 })).line?.after).toBe(
      '',
    );
    expect(battleView(belfry()).line?.after).toBe('');
  });

  it('says there is no blow to parry during the Charge (A7)', () => {
    const step: SupportStep = {
      kind: 'support',
      enemy: 1,
      intent: { category: 'charge' },
      since: 0,
      until: 400,
    };
    const charging = belfry(
      { intent: { category: 'charge' }, charge: 'charging' },
      { phase: { kind: 'enemy', step }, lastPlayed: 'enemy' },
    );

    expect(battleView(charging).line).toEqual({
      before: 'Aucun coup à parer',
      strong: '',
      after: '',
    });
  });
});
